from services.controlled_bypass_planner import plan_controlled_bypass
from services.traffic_scenario import compute_scenario_zone


def _dense(points, step=0.00005):
    out = []
    for start, end in zip(points, points[1:]):
        count = max(1, int(max(abs(start[0] - end[0]), abs(start[1] - end[1])) / step))
        for i in range(count):
            t = i / count
            out.append([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t])
    out.append(list(points[-1]))
    return out


def test_planner_selects_shared_junction_and_a_clear_existing_route():
    main = _dense([[77.0, 11.0], [77.0, 11.1]])
    side = _dense([[77.0, 11.0], [77.0, 11.04], [77.002, 11.045], [77.002, 11.075], [77.0, 11.08], [77.0, 11.1]])
    plan = plan_controlled_bypass([
        {"route_index": 0, "distance_meters": 11100.0, "geometry": {"type": "LineString", "coordinates": main}},
        {"route_index": 1, "distance_meters": 12000.0, "geometry": {"type": "LineString", "coordinates": side}},
    ])
    assert plan is not None
    assert plan["active_route_index"] in (0, 1)
    assert plan["bypass_route_index"] in (0, 1)
    assert plan["active_route_index"] != plan["bypass_route_index"]
    assert 0.12 <= plan["switch_distance_m"] / 12000.0 <= 0.48
    assert plan["zone_start_distance_m"] >= plan["switch_distance_m"] + 100
    assert plan["minimum_bypass_clearance_m"] >= 125


def test_zone_can_be_placed_after_the_shared_switch_point():
    start, end = compute_scenario_zone(10_000, zone_start_ratio=0.52, zone_length_m=400)
    assert 5_100 <= start <= 5_300
    assert 300 <= end - start <= 500



def test_fallback_builds_bypass_from_shared_route_prefix():
    import asyncio
    from services.controlled_bypass_planner import build_controlled_bypass_candidates

    main = _dense([[77.0, 11.0], [77.0, 11.1]])
    base = {"route_index": 0, "distance_meters": 11100.0, "duration_seconds": 900.0,
            "geometry": {"type": "LineString", "coordinates": main},
            "steps": [{"name": "Main road", "distance": 11100.0, "duration": 900.0,
                       "maneuver": {"type": "depart", "location": main[0]}}]}
    requested = []

    async def fake_osrm(waypoints):
        requested.append(waypoints)
        entry_lat, entry_lon = waypoints[0]
        offset_lat, offset_lon = waypoints[1]
        exit_lat, exit_lon = waypoints[2]
        dest_lat, dest_lon = waypoints[3]
        # Simulate a real OSRM returned route on a parallel street, with actual
        # geometry beginning at the shared junction and rejoining after the jam.
        coords = [[entry_lon, entry_lat], [offset_lon, entry_lat],
                  [offset_lon, exit_lat], [exit_lon, exit_lat], [dest_lon, dest_lat]]
        dense = _dense(coords, step=0.00005)
        return [{"route_index": 0, "distance_meters": 11800.0, "duration_seconds": 1000.0,
                 "geometry": {"type": "LineString", "coordinates": dense},
                 "steps": [{"name": "Parallel road", "distance": 11800.0, "duration": 1000.0,
                            "maneuver": {"type": "depart", "location": dense[0]}}]}]

    additions, plan = asyncio.run(build_controlled_bypass_candidates(
        [base], 11.0, 77.0, 11.1, 77.0, fake_osrm
    ))
    assert requested, "fallback should request OSRM geometry starting at the route's entry junction"
    assert additions and plan is not None
    assert plan["active_route_index"] == 0
    assert plan["bypass_route_index"] != 0
    assert plan["minimum_bypass_clearance_m"] >= 125
    assert additions[0]["geometry"]["coordinates"][0] == main[0]
