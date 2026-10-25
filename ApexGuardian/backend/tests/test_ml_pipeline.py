import pytest
from types import SimpleNamespace
from ml.recommender import RouteScorer
from services.route_selection import rank_processed_routes
from services.traffic_scenario import apply_traffic_test_scenario
from schemas.navigation import TrafficTestMode

# EMERGENCY FEATURE DISABLED (commented out, not deleted) - re-enable later.
# def test_emergency_mode_bypass():
#     mock_routes = [{
#         "distance_meters": 10000.0,
#         "duration_seconds": 1200.0,
#         "steps": []
#     }]
    
#     # Run in emergency mode
#     evaluated = RouteScorer.evaluate_routes(mock_routes, 12.9, 77.5, 12.91, 77.51)
    
#     assert len(evaluated) == 1
#     # Congestion factor must be exactly 1.0
#     assert evaluated[0]["congestion_factor"] == 1.0
#     # Predicted duration should match standard duration
#     assert evaluated[0]["predicted_duration_seconds"] == 1200.0


def test_computed_fields(monkeypatch):
    # Emergency mode used to pin the congestion factor to 1.0 for this test; pin it directly instead.
    monkeypatch.setattr("ml.recommender.congestion_predictor.predict_congestion_factor", lambda **kwargs: 1.0)
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
    
    evaluated = RouteScorer.evaluate_routes(mock_routes, 12.9, 77.5, 12.91, 77.51)
    
    assert len(evaluated) == 2
    
    route1 = next(r for r in evaluated if r["distance_meters"] == 10000.0)
    route2 = next(r for r in evaluated if r["distance_meters"] == 12000.0)
    
    assert route1["predicted_average_speed_kmh"] == 30.0 # 10km / (20/60)h
    assert route2["predicted_average_speed_kmh"] == 24.0 # 12km / (30/60)h
    
    # Route 2 is the slowest (30 mins). Delay savings for route 1 = 30 - 20 = 10 mins
    assert route1["delay_savings_minutes"] == 10.0
    # Route 2 saves nothing compared to itself
    assert route2["delay_savings_minutes"] == 0.0


def test_moderate_traffic_keeps_shorter_effective_eta():
    current = SimpleNamespace(predicted_duration_seconds=1200, is_ai_recommended=False, recommendation_label="")
    alternative = SimpleNamespace(predicted_duration_seconds=1380, is_ai_recommended=False, recommendation_label="")

    ranked = rank_processed_routes([alternative, current])

    assert ranked[0] is current
    assert current.is_ai_recommended is True
    assert alternative.is_ai_recommended is False


def test_heavy_or_severe_delay_can_change_recommended_route():
    current = SimpleNamespace(predicted_duration_seconds=2700, is_ai_recommended=False, recommendation_label="")
    alternative = SimpleNamespace(predicted_duration_seconds=1440, is_ai_recommended=False, recommendation_label="")

    ranked = rank_processed_routes([current, alternative])

    assert ranked[0] is alternative
    assert alternative.recommendation_label == "Recommended Route"


def test_test_traffic_scenarios_change_only_backend_segment_evaluation():
    base_analysis = {
        "segments": [
            {
                "segment_index": index,
                "coordinates": [[77.60 + index * 0.0054, 12.97], [77.60 + (index + 1) * 0.0054, 12.97]],
                "distance_meters": 500.0,
                "duration_seconds": 40.0,
                "freeflow_speed_kmh": 45.0,
                "current_speed_kmh": 45.0,
                "delay_seconds": 0.0,
                "congestion_level": "LOW",
                "color": "#16A34A",
                "congestion_factor": 1.0,
                "density_index": 20.0,
                "predicted_arrival_time_min": float(index),
                "road_name": "Test Road",
            }
            for index in range(10)
        ],
        "hotspots": [],
        "clear_distance_km": 5.0,
        "moderate_distance_km": 0.0,
        "heavy_distance_km": 0.0,
        "severe_distance_km": 0.0,
        "total_delay_seconds": 0.0,
    }

    real_result = apply_traffic_test_scenario(base_analysis, TrafficTestMode.REAL)
    assert real_result is base_analysis
    assert all(segment["congestion_level"] == "LOW" for segment in real_result["segments"])

    test_result = apply_traffic_test_scenario(base_analysis, TrafficTestMode.SEVERE)
    severe_segments = [segment for segment in test_result["segments"] if segment["congestion_level"] == "SEVERE"]
    assert severe_segments
    assert test_result["hotspots"]
    assert all(hotspot["congestion_level"] == "SEVERE" for hotspot in test_result["hotspots"])
    assert all(segment["color"] == "#DC2626" for segment in severe_segments)


def _candidate_for_route_selection(index, duration_s, predicted_s, lat_offset):
    from types import SimpleNamespace
    return SimpleNamespace(
        route_index=index,
        original_route_index=index,
        distance_meters=duration_s * 12.0,
        duration_seconds=duration_s,
        predicted_duration_seconds=predicted_s,
        geometry={
            "type": "LineString",
            "coordinates": [
                [76.9500, 11.0100 + lat_offset],
                [76.9600, 11.0200 + lat_offset],
                [76.9700, 11.0300 + lat_offset],
            ],
        },
        is_ai_recommended=False,
        recommendation_label="",
    )


def test_route_selector_returns_one_ai_and_one_distinct_osrm_choice():
    fastest_osrm = _candidate_for_route_selection(0, 600.0, 620.0, 0.00)
    fastest_ai = _candidate_for_route_selection(1, 760.0, 410.0, 0.025)
    extra_route = _candidate_for_route_selection(2, 690.0, 470.0, 0.050)

    ranked = rank_processed_routes([fastest_osrm, fastest_ai, extra_route])

    assert ranked[0] is fastest_ai
    assert ranked[0].is_ai_recommended is True
    assert ranked[0].recommendation_label == "AI Recommended Route"
    assert ranked[1] is fastest_osrm
    assert ranked[1].is_ai_recommended is False
    assert ranked[1].recommendation_label == "OSRM Preferred Route"
    assert ranked[2].recommendation_label == "Additional Alternative"
    assert sum(route.is_ai_recommended for route in ranked) == 1
    assert sum(route.recommendation_label == "OSRM Preferred Route" for route in ranked) == 1


def test_route_selector_never_duplicates_geometry_to_fake_an_osrm_choice():
    first = _candidate_for_route_selection(0, 600.0, 500.0, 0.00)
    duplicate = _candidate_for_route_selection(1, 650.0, 550.0, 0.0001)

    ranked = rank_processed_routes([first, duplicate])

    assert ranked[0] is first
    assert ranked[0].recommendation_label == "AI + OSRM Best Route"
    assert sum(route.recommendation_label == "OSRM Preferred Route" for route in ranked) == 0
