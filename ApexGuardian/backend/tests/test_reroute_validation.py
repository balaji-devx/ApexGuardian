import pytest
import math
from services.reroute_engine import DynamicRerouteEngine, haversine_distance_m

@pytest.mark.asyncio
async def test_reject_short_teleport_reroute():
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
        rec = await DynamicRerouteEngine.evaluate_reroute(
            current_lat=current_lat,
            current_lon=current_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon,
            original_remaining_duration_s=1500
        )
        
        # Should reject because end point is not near destination
        assert rec.is_reroute_recommended is False
        assert rec.recommended_route is None
    finally:
        services.osrm.OSRMService.get_routes = original_get
        ml.recommender.RouteScorer.evaluate_routes = original_eval

@pytest.mark.asyncio
async def test_accept_valid_faster_reroute():
    """
    Test that a valid alternative route that saves time is recommended.
    """
    current_lat, current_lon = 12.9716, 77.5946
    dest_lat, dest_lon = 13.0520, 77.5946
    
    candidate = {
        "distance_meters": 8000.0,
        "duration_seconds": 1000.0,  # ~16 mins
        "geometry": {
            "coordinates": [
                [current_lon, current_lat],
                [current_lon, 13.0100],
                [dest_lon, dest_lat]
            ]
        },
        "steps": [{"distance": 8000, "duration": 1000}]
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
        rec = await DynamicRerouteEngine.evaluate_reroute(
            current_lat=current_lat,
            current_lon=current_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon,
            original_remaining_duration_s=1560
        )
        
        # Savings: 1560 - 1000 = 560s (> 90s threshold)
        assert rec.is_reroute_recommended is True
        assert rec.recommended_route is not None
        assert rec.time_saved_seconds == 560.0
    finally:
        services.osrm.OSRMService.get_routes = original_get
        ml.recommender.RouteScorer.evaluate_routes = original_eval
