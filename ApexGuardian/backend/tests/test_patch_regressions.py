"""Regression tests for the heavy / severe / dynamic + OSRM alternatives patch."""
import math

from schemas.navigation import TrafficTestMode, CongestionLevel
from services.traffic_scenario import (
    apply_traffic_test_scenario,
    compute_scenario_zone,
    dynamic_traffic_phase,
)


def _analysis(total_m: float, chunks: int = 12):
    m_lon = 111_320.0 * math.cos(math.radians(12.95))
    step = total_m / chunks
    segs, lon = [], 77.60
    for i in range(chunks):
        lon2 = lon + step / m_lon
        segs.append({
            "segment_index": i,
            "distance_meters": step,
            "coordinates": [[lon, 12.95], [(lon + lon2) / 2, 12.95], [lon2, 12.95]],
            "freeflow_speed_kmh": 45.0,
            "road_name": "Test Road",
        })
        lon = lon2
    return {"segments": segs, "hotspots": [], "clear_distance_km": 0.0, "moderate_distance_km": 0.0,
            "heavy_distance_km": 0.0, "severe_distance_km": 0.0, "total_delay_seconds": 0.0}


def test_zone_is_short_even_on_long_routes():
    for total in (3_000, 8_000, 20_000, 40_000):
        start, end = compute_scenario_zone(total)
        assert 300 <= end - start <= 1000
        assert end - start <= 0.25 * total + 1e-6


def test_coloured_length_equals_hotspot_zone_and_distance_matches_start():
    for mode in (TrafficTestMode.HEAVY, TrafficTestMode.SEVERE):
        res = apply_traffic_test_scenario(_analysis(10_000), mode)
        hotspot = res["hotspots"][0]
        coloured = sum(s["distance_meters"] for s in res["segments"] if s["congestion_level"] != "LOW")
        start, end = compute_scenario_zone(10_000)
        assert abs(coloured - (end - start)) < 3
        assert abs(hotspot["distance_from_origin_m"] - start) < 3
        assert hotspot["zone_path"] and len(hotspot["zone_path"]) <= 14


def test_dynamic_zone_never_moves_only_severity_changes():
    starts, levels = set(), []
    for progress in (0.20, 0.35, 0.45):
        res = apply_traffic_test_scenario(_analysis(10_000), TrafficTestMode.DYNAMIC, progress=progress)
        hotspot = res["hotspots"][0]
        starts.add(round(hotspot["distance_from_origin_m"]))
        levels.append(hotspot["congestion_level"])
    assert len(starts) == 1
    assert levels == ["MODERATE", "HEAVY", "SEVERE"]


def test_dynamic_clears_only_after_zone_is_passed():
    _, end = compute_scenario_zone(10_000)
    inside = apply_traffic_test_scenario(_analysis(10_000), TrafficTestMode.DYNAMIC, progress=end / 10_000)
    after = apply_traffic_test_scenario(_analysis(10_000), TrafficTestMode.DYNAMIC, progress=end / 10_000 + 0.05)
    assert inside["hotspots"]
    assert after["hotspots"] == []


def test_dynamic_phase_helper():
    assert dynamic_traffic_phase(0.05) == CongestionLevel.LOW
    assert dynamic_traffic_phase(0.20) == CongestionLevel.MODERATE
    assert dynamic_traffic_phase(0.35) == CongestionLevel.HEAVY
    assert dynamic_traffic_phase(0.50, zone_end_ratio=0.6) == CongestionLevel.SEVERE
    assert dynamic_traffic_phase(0.70, zone_end_ratio=0.6) == CongestionLevel.LOW


def test_same_corridor_detection_for_osrm_alternatives():
    from services.osrm import routes_are_same_corridor

    def route(offset_lat):
        return {"geometry": {"coordinates": [[77.59 + i * 0.002, 12.97 + offset_lat] for i in range(60)]}}

    assert routes_are_same_corridor(route(0.0), route(0.0002))          # ~22 m apart => same road
    assert not routes_are_same_corridor(route(0.0), route(0.02))        # ~2.2 km apart => alternative


def test_detour_cap_rejects_absurd_bypass():
    from types import SimpleNamespace
    from services.reroute_engine import _avoidance_detour_allowed

    ok = SimpleNamespace(predicted_duration_seconds=800.0, distance_meters=9_000.0)
    too_slow = SimpleNamespace(predicted_duration_seconds=2_400.0, distance_meters=9_000.0)
    too_long = SimpleNamespace(predicted_duration_seconds=700.0, distance_meters=30_000.0)
    assert _avoidance_detour_allowed(ok, 700.0, 6_000.0)
    assert not _avoidance_detour_allowed(too_slow, 700.0, 6_000.0)
    assert not _avoidance_detour_allowed(too_long, 700.0, 6_000.0)


def test_zones_next_to_vehicle_are_ignored():
    from services.reroute_engine import _usable_avoid_zones

    zones = [{"lat": 12.9500, "lon": 77.6000, "radius_km": 0.06},      # on top of the vehicle
             {"lat": 12.9600, "lon": 77.6000, "radius_km": 0.06}]      # ~1.1 km ahead
    usable = _usable_avoid_zones(zones, 12.9500, 77.6000)
    assert len(usable) == 1 and usable[0]["lat"] == 12.9600

def test_controlled_dropdown_reroute_uses_street_snapped_osrm(monkeypatch):
    """HEAVY/SEVERE/DYNAMIC test reroutes must use OSRM road geometry, never a fake polyline."""
    import asyncio
    from services.osrm import OSRMService
    from ml.recommender import RouteScorer
    from services.reroute_engine import DynamicRerouteEngine

    current_lat, current_lon = 12.9300, 77.6000
    dest_lat, dest_lon = 12.9900, 77.6500

    def dense_coords(points, max_segment_m=900.0):
        from math import ceil, cos, hypot, radians
        dense = [list(points[0])]
        for start, end in zip(points, points[1:]):
            mean_lat = radians((start[1] + end[1]) / 2.0)
            dx = (end[0] - start[0]) * 111320.0 * cos(mean_lat)
            dy = (end[1] - start[1]) * 111132.0
            pieces = max(1, ceil(hypot(dx, dy) / max_segment_m))
            for part in range(1, pieces + 1):
                fraction = part / pieces
                dense.append([
                    start[0] + (end[0] - start[0]) * fraction,
                    start[1] + (end[1] - start[1]) * fraction,
                ])
        return dense

    initial = {
        "route_index": 0,
        "distance_meters": 10000.0,
        "duration_seconds": 700.0,
        "geometry": {
            "type": "LineString",
            "coordinates": dense_coords([
                    [77.6000, 12.9300],
                    [77.6120, 12.9420],
                    [77.6240, 12.9540],
                    [77.6360, 12.9660],
                    [77.6500, 12.9900],
                ]),
        },
        "steps": [
            {
                "distance": 7800.0,
                "duration": 700.0,
                "name": "Congested Main Road",
                "maneuver": {"type": "continue", "modifier": "straight"},
            }
        ],
    }

    # This represents an OSRM-returned street-snapped alternative.  The test
    # deliberately uses named roads/turns rather than a synthetic single-step.
    bypass = {
        "route_index": 0,
        "distance_meters": 11000.0,
        "duration_seconds": 900.0,
        "geometry": {
            "type": "LineString",
            "coordinates": dense_coords([
                    [77.6000, 12.9300],
                    [77.6020, 12.9380],
                    [77.6200, 12.9400],
                    [77.6400, 12.9520],
                    [77.6500, 12.9900],
                ]),
        },
        "steps": [
            {
                "distance": 2100.0,
                "duration": 190.0,
                "name": "Service Road",
                "maneuver": {"type": "depart", "modifier": "straight"},
            },
            {
                "distance": 4300.0,
                "duration": 420.0,
                "name": "Outer Ring Road",
                "maneuver": {"type": "turn", "modifier": "right"},
            },
            {
                "distance": 2900.0,
                "duration": 290.0,
                "name": "Bellandur Road",
                "maneuver": {"type": "turn", "modifier": "left"},
            },
        ],
    }

    waypoint_calls = []

    async def mock_get_routes(*args, **kwargs):
        return [initial.copy()]

    async def mock_get_routes_via_waypoints(waypoints):
        waypoint_calls.append(waypoints)
        return [bypass.copy()]

    monkeypatch.setattr(OSRMService, "get_routes", staticmethod(mock_get_routes))
    monkeypatch.setattr(OSRMService, "get_routes_via_waypoints", staticmethod(mock_get_routes_via_waypoints))
    monkeypatch.setattr(RouteScorer, "evaluate_routes", staticmethod(lambda routes, *args, **kwargs: routes))

    recommendation = asyncio.run(
        DynamicRerouteEngine.evaluate_reroute(
            current_lat=current_lat,
            current_lon=current_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon,
            original_remaining_duration_s=700.0,
            avoid_hotspots=[{"lat": 12.9540, "lon": 77.6240, "radius_km": 0.45}],
            traffic_test_mode=TrafficTestMode.HEAVY,
            traffic_progress=0.40,
            synthetic_traffic_active=True,
        )
    )

    assert waypoint_calls, "Controlled test reroute must probe OSRM via waypoints"
    assert recommendation.is_reroute_recommended
    assert recommendation.recommended_route is not None
    assert recommendation.recommended_route.source == "reroute"
    assert recommendation.recommended_route.steps[1]["name"] == "Outer Ring Road"
    assert "Synthetic Congestion Bypass" not in str(recommendation.recommended_route.dict())
