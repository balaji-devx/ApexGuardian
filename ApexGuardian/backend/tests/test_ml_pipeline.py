import pytest
from ml.recommender import RouteScorer

def test_emergency_mode_bypass():
    mock_routes = [{
        "distance_meters": 10000.0,
        "duration_seconds": 1200.0,
        "steps": []
    }]
    
    # Run in emergency mode
    evaluated = RouteScorer.evaluate_routes(mock_routes, 12.9, 77.5, 12.91, 77.51, is_emergency_mode=True)
    
    assert len(evaluated) == 1
    # Congestion factor must be exactly 1.0
    assert evaluated[0]["congestion_factor"] == 1.0
    # Predicted duration should match standard duration
    assert evaluated[0]["predicted_duration_seconds"] == 1200.0

def test_computed_fields():
    mock_routes = [
        {
            "distance_meters": 10000.0, # 10km
            "duration_seconds": 1200.0, # 20 mins
            "steps": []
        },
        {
            "distance_meters": 12000.0, # 12km
            "duration_seconds": 1800.0, # 30 mins
            "steps": []
        }
    ]
    
    evaluated = RouteScorer.evaluate_routes(mock_routes, 12.9, 77.5, 12.91, 77.51, is_emergency_mode=True)
    
    assert len(evaluated) == 2
    
    route1 = next(r for r in evaluated if r["distance_meters"] == 10000.0)
    route2 = next(r for r in evaluated if r["distance_meters"] == 12000.0)
    
    assert route1["predicted_average_speed_kmh"] == 30.0 # 10km / (20/60)h
    assert route2["predicted_average_speed_kmh"] == 24.0 # 12km / (30/60)h
    
    # Route 2 is the slowest (30 mins). Delay savings for route 1 = 30 - 20 = 10 mins
    assert route1["delay_savings_minutes"] == 10.0
    # Route 2 saves nothing compared to itself
    assert route2["delay_savings_minutes"] == 0.0
