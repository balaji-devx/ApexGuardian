import asyncio
import math
from services.reroute_engine import DynamicRerouteEngine, haversine_distance_m

def test_reject_short_teleport_reroute():
    """
    Test that a 100m route is rejected when the vehicle is 9km away from destination.
    """
    # Current location
    current_lat, current_lon = 12.9716, 77.5946
    
    # Destination ~ 9km away
    dest_lat, dest_lon = 13.0520, 77.5946
    dist_to_dest = haversine_distance_m(current_lon, current_lat, dest_lon, dest_lat)
    assert dist_to_dest > 8000
    
    # Mock candidate geometry that is only 100m long, but starts near the vehicle
    # The end point of this candidate is nowhere near the destination
    end_lat, end_lon = 12.9725, 77.5946
    candidate = {
        "distance_meters": 100.0,
        "duration_seconds": 12.0,
        "geometry": {
            "coordinates": [[current_lon, current_lat], [end_lon, end_lat]]
        },
        "steps": [{"distance": 100, "duration": 12}]
    }
    
    # Patch the OSRM & ML parts
    import services.osrm
    import ml.recommender
    
    async def mock_get_routes(*args, **kwargs):
        return [candidate]
        
    def mock_evaluate_routes(routes, *args, **kwargs):
        return routes

    original_get = services.osrm.OSRMService.get_routes
    original_eval = ml.recommender.RouteScorer.evaluate_routes
    
    services.osrm.OSRMService.get_routes = mock_get_routes
    ml.recommender.RouteScorer.evaluate_routes = mock_evaluate_routes
    
    try:
        rec = asyncio.run(DynamicRerouteEngine.evaluate_reroute(
            current_lat=current_lat,
            current_lon=current_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon,
            original_remaining_duration_s=1500
        ))
        
        # Should reject because end point is not near destination
        assert rec.is_reroute_recommended is False
        assert rec.recommended_route is None
    finally:
        services.osrm.OSRMService.get_routes = original_get
        ml.recommender.RouteScorer.evaluate_routes = original_eval

def test_accept_valid_faster_reroute():
    """
    Test that a valid alternative route that saves time is recommended.
    """
    current_lat, current_lon = 12.9716, 77.5946
    dest_lat, dest_lon = 13.0520, 77.5946
    
    candidate = {
        "route_index": 0,
        "distance_meters": 9200.0,
        "duration_seconds": 1000.0,  # ~16 mins
        "geometry": {
            "coordinates": [
                [current_lon, current_lat],
                [current_lon, 12.9866],
                [current_lon, 13.0016],
                [current_lon, 13.0166],
                [current_lon, 13.0316],
                [current_lon, 13.0466],
                [dest_lon, dest_lat]
            ]
        },
        "steps": [{"distance": 9200, "duration": 1000}]
    }
    
    import services.osrm
    import ml.recommender
    
    async def mock_get_routes(*args, **kwargs):
        return [candidate]
        
    def mock_evaluate_routes(routes, *args, **kwargs):
        return routes

    original_get = services.osrm.OSRMService.get_routes
    original_eval = ml.recommender.RouteScorer.evaluate_routes
    
    services.osrm.OSRMService.get_routes = mock_get_routes
    ml.recommender.RouteScorer.evaluate_routes = mock_evaluate_routes
    
    try:
        # Original ETA is 26 minutes (1560s)
        rec = asyncio.run(DynamicRerouteEngine.evaluate_reroute(
            current_lat=current_lat,
            current_lon=current_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon,
            original_remaining_duration_s=1560
        ))
        
        # The segment analyzer may add delay to the OSRM/ML estimate.
        assert rec.is_reroute_recommended is True
        assert rec.recommended_route is not None
        assert abs(rec.time_saved_seconds - (1560.0 - rec.recommended_duration_seconds)) < 0.1
        assert rec.time_saved_seconds >= 90.0
    finally:
        services.osrm.OSRMService.get_routes = original_get
        ml.recommender.RouteScorer.evaluate_routes = original_eval

def test_reject_zero_distance_reroute_even_when_geometry_reaches_destination():
    current_lat, current_lon = 12.9716, 77.5946
    dest_lat, dest_lon = 12.9916, 77.5946
    candidate = {
        "route_index": 0,
        "distance_meters": 0.0,
        "duration_seconds": 0.0,
        "geometry": {"coordinates": [[current_lon, current_lat], [dest_lon, dest_lat]]},
        "steps": [{"distance": 0.0, "duration": 0.0}],
    }

    import services.osrm
    import ml.recommender

    async def mock_get_routes(*args, **kwargs):
        return [candidate]

    def mock_evaluate_routes(routes, *args, **kwargs):
        return routes

    original_get = services.osrm.OSRMService.get_routes
    original_eval = ml.recommender.RouteScorer.evaluate_routes
    services.osrm.OSRMService.get_routes = mock_get_routes
    ml.recommender.RouteScorer.evaluate_routes = mock_evaluate_routes
    try:
        rec = asyncio.run(DynamicRerouteEngine.evaluate_reroute(
            current_lat=current_lat,
            current_lon=current_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon,
            original_remaining_duration_s=1200,
        ))
        assert rec.is_reroute_recommended is False
        assert rec.recommended_route is None
    finally:
        services.osrm.OSRMService.get_routes = original_get
        ml.recommender.RouteScorer.evaluate_routes = original_eval

def test_does_not_evaluate_reroutes_within_500m_of_destination():
    current_lat, current_lon = 12.9716, 77.5946
    dest_lat, dest_lon = 12.97175, 77.5946
    distance_m = haversine_distance_m(current_lon, current_lat, dest_lon, dest_lat)
    candidate = {
        "route_index": 0,
        "distance_meters": distance_m,
        "duration_seconds": 5.0,
        "geometry": {"coordinates": [[current_lon, current_lat], [dest_lon, dest_lat]]},
        "steps": [{"distance": distance_m, "duration": 5.0}],
    }

    import services.osrm
    import ml.recommender

    async def mock_get_routes(*args, **kwargs):
        return [candidate]

    def mock_evaluate_routes(routes, *args, **kwargs):
        return routes

    original_get = services.osrm.OSRMService.get_routes
    original_eval = ml.recommender.RouteScorer.evaluate_routes
    services.osrm.OSRMService.get_routes = mock_get_routes
    ml.recommender.RouteScorer.evaluate_routes = mock_evaluate_routes
    try:
        rec = asyncio.run(DynamicRerouteEngine.evaluate_reroute(
            current_lat=current_lat,
            current_lon=current_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon,
            original_remaining_duration_s=120,
        ))
        assert rec.is_reroute_recommended is False
        assert rec.alternative_routes == []
        assert "Continue on the current route" in rec.reason
    finally:
        services.osrm.OSRMService.get_routes = original_get
        ml.recommender.RouteScorer.evaluate_routes = original_eval


def test_avoid_zone_detects_segment_crossing_between_route_vertices():
    from services.reroute_engine import route_intersects_avoid_hotspots

    geometry = {
        "coordinates": [[77.5846, 13.0116], [77.6046, 13.0116]],
    }
    assert route_intersects_avoid_hotspots(
        geometry, [{"lat": 13.0116, "lon": 77.5946, "radius_km": 0.6}]
    )


def test_native_avoidance_candidate_is_offered_even_when_slower(monkeypatch):
    from services.osrm import OSRMService
    from ml.recommender import RouteScorer

    current_lat, current_lon = 12.9716, 77.5946
    dest_lat, dest_lon = 13.0516, 77.5946
    native_bypass = {
        "route_index": 0,
        "distance_meters": 12000.0,
        "duration_seconds": 1600.0,
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [77.5946, 12.9716], [77.6021, 12.9791], [77.6096, 12.9866],
                [77.6096, 12.9941], [77.6096, 13.0016], [77.6096, 13.0091],
                [77.6096, 13.0166], [77.6096, 13.0241], [77.6096, 13.0316],
                [77.6096, 13.0391], [77.6021, 13.0466], [77.5946, 13.0516],
            ],
        },
        "steps": [{"name": "Native Bypass Road", "distance": 12000.0, "duration": 1600.0}],
    }
    waypoint_calls = []

    async def mock_get_routes(*args, **kwargs):
        return [native_bypass.copy()]

    async def unexpected_waypoint_request(*args, **kwargs):
        waypoint_calls.append(True)
        return []

    monkeypatch.setattr(OSRMService, "get_routes", staticmethod(mock_get_routes))
    monkeypatch.setattr(OSRMService, "get_routes_via_waypoints", staticmethod(unexpected_waypoint_request))
    monkeypatch.setattr(RouteScorer, "evaluate_routes", staticmethod(lambda routes, *args, **kwargs: routes))

    rec = asyncio.run(DynamicRerouteEngine.evaluate_reroute(
        current_lat=current_lat,
        current_lon=current_lon,
        dest_lat=dest_lat,
        dest_lon=dest_lon,
        original_remaining_duration_s=1200.0,
        avoid_hotspots=[{"lat": 13.0116, "lon": 77.5946, "radius_km": 0.6}],
    ))

    assert rec.is_reroute_recommended
    assert rec.is_congestion_avoidance
    assert rec.recommended_route is not None
    assert rec.time_saved_seconds < 0
    assert waypoint_calls == []


def test_emergency_reroute_does_not_apply_congestion_avoidance(monkeypatch):
    from services.osrm import OSRMService
    from ml.recommender import RouteScorer

    current_lat, current_lon = 12.9716, 77.5946
    dest_lat, dest_lon = 13.0516, 77.5946
    direct_route = {
        "route_index": 0,
        "distance_meters": 9000.0,
        "duration_seconds": 700.0,
        "geometry": {
            "type": "LineString",
            "coordinates": [[current_lon, current_lat + i * 0.01] for i in range(9)],
        },
        "steps": [{"name": "Direct Road", "distance": 9000.0, "duration": 700.0}],
    }

    async def mock_get_routes(*args, **kwargs):
        return [direct_route.copy()]

    monkeypatch.setattr(OSRMService, "get_routes", staticmethod(mock_get_routes))
    monkeypatch.setattr(RouteScorer, "evaluate_routes", staticmethod(lambda routes, *args, **kwargs: routes))

    rec = asyncio.run(DynamicRerouteEngine.evaluate_reroute(
        current_lat=current_lat,
        current_lon=current_lon,
        dest_lat=dest_lat,
        dest_lon=dest_lon,
        original_remaining_duration_s=1500.0,
        avoid_hotspots=[{"lat": 13.0116, "lon": 77.5946, "radius_km": 0.6}],
        is_emergency_mode=True,
    ))

    assert rec.is_reroute_recommended
    assert not rec.is_congestion_avoidance
    assert rec.recommended_route is not None


def test_reroute_uses_waypoint_bypass_when_initial_routes_cross_avoid_zone(monkeypatch):
    from services.osrm import OSRMService
    from ml.recommender import RouteScorer
    from services.reroute_engine import route_intersects_avoid_hotspots

    current_lat, current_lon = 12.9716, 77.5946
    dest_lat, dest_lon = 13.0516, 77.5946
    initial_candidate = {
        "route_index": 0,
        "distance_meters": 9000.0,
        "duration_seconds": 700.0,
        "geometry": {
            "type": "LineString",
            "coordinates": [[current_lon, current_lat + i * 0.01] for i in range(9)],
        },
        "steps": [{"name": "Direct Road", "distance": 9000.0, "duration": 700.0}],
    }
    bypass_coords = [
        [77.5946, 12.9716], [77.6096, 12.9816], [77.6096, 12.9916],
        [77.6096, 13.0016], [77.6096, 13.0116], [77.6096, 13.0216],
        [77.6096, 13.0316], [77.6096, 13.0416], [77.5946, 13.0516],
    ]
    bypass_candidate = {
        "route_index": 0,
        "distance_meters": 11000.0,
        "duration_seconds": 1300.0,
        "geometry": {"type": "LineString", "coordinates": bypass_coords},
        "steps": [{"name": "Bypass Road", "distance": 11000.0, "duration": 1300.0}],
    }
    bypass_request = {}

    async def mock_get_routes(*args, **kwargs):
        return [initial_candidate.copy()]

    async def mock_get_routes_via_waypoints(waypoints):
        bypass_request["waypoints"] = waypoints
        return [bypass_candidate.copy()]

    monkeypatch.setattr(OSRMService, "get_routes", staticmethod(mock_get_routes))
    monkeypatch.setattr(OSRMService, "get_routes_via_waypoints", staticmethod(mock_get_routes_via_waypoints))
    monkeypatch.setattr(RouteScorer, "evaluate_routes", staticmethod(lambda routes, *args, **kwargs: routes))

    rec = asyncio.run(DynamicRerouteEngine.evaluate_reroute(
        current_lat=current_lat,
        current_lon=current_lon,
        dest_lat=dest_lat,
        dest_lon=dest_lon,
        original_remaining_duration_s=1200.0,
        avoid_hotspots=[{"lat": 13.0116, "lon": 77.5946, "radius_km": 0.6}],
    ))

    assert len(bypass_request["waypoints"]) == 3
    assert rec.is_reroute_recommended
    assert rec.is_congestion_avoidance
    assert rec.recommended_route is not None
    assert rec.time_saved_seconds < 0  # The bypass is deliberately slower; avoidance still wins.
    assert not route_intersects_avoid_hotspots(
        rec.recommended_route.geometry,
        [{"lat": 13.0116, "lon": 77.5946, "radius_km": 0.6}],
    )
    assert "avoids the reported congestion areas" in rec.reason


def test_unavailable_bypass_is_explicit_and_does_not_claim_ai_optimal(monkeypatch):
    from services.osrm import OSRMService
    from ml.recommender import RouteScorer

    current_lat, current_lon = 12.9716, 77.5946
    dest_lat, dest_lon = 13.0516, 77.5946
    candidate = {
        "route_index": 0,
        "distance_meters": 9000.0,
        "duration_seconds": 600.0,
        "geometry": {
            "type": "LineString",
            "coordinates": [[current_lon, current_lat + i * 0.01] for i in range(9)],
        },
        "steps": [{"name": "Direct Road", "distance": 9000.0, "duration": 600.0}],
    }

    async def mock_get_routes(*args, **kwargs):
        return [candidate.copy()]

    async def unavailable_bypass(*args, **kwargs):
        raise RuntimeError("no waypoint route")

    monkeypatch.setattr(OSRMService, "get_routes", staticmethod(mock_get_routes))
    monkeypatch.setattr(OSRMService, "get_routes_via_waypoints", staticmethod(unavailable_bypass))
    monkeypatch.setattr(RouteScorer, "evaluate_routes", staticmethod(lambda routes, *args, **kwargs: routes))

    rec = asyncio.run(DynamicRerouteEngine.evaluate_reroute(
        current_lat=current_lat,
        current_lon=current_lon,
        dest_lat=dest_lat,
        dest_lon=dest_lon,
        original_remaining_duration_s=3000.0,
        avoid_hotspots=[{"lat": 13.0116, "lon": 77.5946, "radius_km": 0.6}],
    ))

    assert not rec.is_reroute_recommended
    assert not rec.is_congestion_avoidance
    assert rec.recommended_route is None
    assert rec.alternative_routes == []
    assert "No alternate route avoids this stretch" in rec.reason
