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
