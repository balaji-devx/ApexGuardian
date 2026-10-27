from services.controlled_bypass_planner import plan_controlled_bypass, _cumulative, _project_distance_along_route
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
    assert plan["minimum_bypass_clearance_m"] >= 40


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
    # Every probe entry must fall inside the planner's feasible divergence window.
    # A former 55% probe fell outside the 48% cap and could never produce a plan.
    main_cumulative = _cumulative(main)
    assert len(requested) == 6
    probe_offsets_m = []
    for waypoints in requested:
        entry = [waypoints[0][1], waypoints[0][0]]  # OSRM input is (lat, lon); route points are (lon, lat).
        along, cross_track = _project_distance_along_route(entry, main, main_cumulative)
        assert cross_track <= 18.0
        assert 0.12 <= along / main_cumulative[-1] <= 0.48

        offset_point = [waypoints[1][1], waypoints[1][0]]
        _, offset_distance = _project_distance_along_route(offset_point, main, main_cumulative)
        probe_offsets_m.append(offset_distance)
    assert min(probe_offsets_m) >= 250.0
    assert max(probe_offsets_m) >= 650.0
    assert additions and plan is not None
    assert plan["active_route_index"] == 0
    assert plan["bypass_route_index"] != 0
    assert plan["minimum_bypass_clearance_m"] >= 40
    assert additions[0]["geometry"]["coordinates"][0] == main[0]


def test_planner_relaxes_for_early_narrow_split():
    """A real network often splits early and only ~70 m apart; a bypass must still be planned."""
    main = _dense([[77.0, 11.0], [77.0, 11.1]])
    # Splits ~1.1 km in (10 %), runs ~75 m east of the main road, rejoins near the end.
    side = _dense([[77.0, 11.0], [77.0, 11.010], [77.0007, 11.0115], [77.0007, 11.088], [77.0, 11.09], [77.0, 11.1]])
    plan = plan_controlled_bypass([
        {"route_index": 0, "distance_meters": 11100.0, "geometry": {"type": "LineString", "coordinates": main}},
        {"route_index": 1, "distance_meters": 11300.0, "geometry": {"type": "LineString", "coordinates": side}},
    ])
    assert plan is not None
    assert plan["active_route_index"] != plan["bypass_route_index"]
    assert abs((plan["zone_start_distance_m"] - plan["switch_distance_m"]) - 1000.0) <= 1.0
    assert plan["zone_end_distance_m"] > plan["zone_start_distance_m"]


def test_planner_last_resort_close_parallel_alternative():
    """Two real routes only ~50 m apart after an early split still get a jam on one of them."""
    main = _dense([[77.0, 11.0], [77.0, 11.1]])
    side = _dense([[77.0, 11.0], [77.0, 11.006], [77.00045, 11.0075], [77.00045, 11.09], [77.0, 11.092], [77.0, 11.1]])
    plan = plan_controlled_bypass([
        {"route_index": 0, "distance_meters": 11100.0, "geometry": {"type": "LineString", "coordinates": main}},
        {"route_index": 1, "distance_meters": 11200.0, "geometry": {"type": "LineString", "coordinates": side}},
    ])
    assert plan is not None
    assert abs((plan["zone_start_distance_m"] - plan["switch_distance_m"]) - 1000.0) <= 1.0
