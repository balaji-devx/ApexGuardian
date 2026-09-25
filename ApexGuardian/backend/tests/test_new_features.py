import pytest
from fastapi.testclient import TestClient
from main import app
from services.traffic_service import LiveTrafficService
from services.congestion_detector import CongestionDetector
from services.notification_service import PushNotificationService

client = TestClient(app)

def test_health_features():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert "features" in data
    assert "congestion_point_identification" in data["features"]
    assert "dynamic_alternative_rerouting" in data["features"]

def test_live_traffic_service_point_factors():
    # Silk board area coordinates
    factors = LiveTrafficService.get_point_traffic_factors(12.9177, 77.6238)
    assert "current_speed_kmh" in factors
    assert "congestion_level" in factors
    assert factors["current_speed_kmh"] > 0
    assert factors["congestion_level"] in ["LOW", "MODERATE", "HEAVY", "SEVERE"]
    assert factors["color"].startswith("#")



def test_congestion_detector_analyze():
    # Synthetic route between Indiranagar and Silk Board
    dummy_geometry = {
        "type": "LineString",
        "coordinates": [
            [77.6412, 12.9719],
            [77.6350, 12.9500],
            [77.6276, 12.9348],
            [77.6238, 12.9177]
        ]
    }
    dummy_steps = [
        {"name": "100 Feet Rd", "distance": 1500.0, "duration": 180.0},
        {"name": "Intermediate Ring Rd", "distance": 2500.0, "duration": 300.0},
        {"name": "Hosur Rd", "distance": 2000.0, "duration": 250.0}
    ]

    analysis = CongestionDetector.analyze_route(
        geometry=dummy_geometry,
        steps=dummy_steps,
        total_distance_m=6000.0,
        base_duration_s=730.0,
        is_emergency_mode=False
    )

    assert "segments" in analysis
    assert len(analysis["segments"]) > 0
    assert "hotspots" in analysis
    assert "clear_distance_km" in analysis
    assert "total_delay_seconds" in analysis
    
    first_seg = analysis["segments"][0]
    assert "color" in first_seg
    assert "congestion_level" in first_seg
    assert "predicted_arrival_time_min" in first_seg

def test_push_notification_service():
    payload = PushNotificationService.create_congestion_alert(
        location_name="Silk Board",
        distance_meters=1200.0,
        delay_minutes=8.0,
        speed_kmh=12.0
    )
    assert "Silk Board" in payload.body
    assert "1.2 km" in payload.title
    
    reroute_payload = PushNotificationService.create_reroute_alert(
        time_saved_minutes=7.0,
        via_road="Koramangala 100ft Road"
    )
    assert "7 min" in reroute_payload.title

def test_traffic_factors_endpoint():
    response = client.get("/api/v1/traffic/factors?lat=12.9716&lon=77.5946")
    assert response.status_code == 200
    data = response.json()
    assert "current_speed_kmh" in data
    assert "density_index" in data

def test_traffic_hotspots_endpoint():
    response = client.get("/api/v1/traffic/hotspots")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["hotspots"]) > 0

def test_dynamic_reroute_endpoint():
    payload = {
        "current_lat": 12.9756,
        "current_lon": 77.6066,
        "dest_lat": 12.9352,
        "dest_lon": 77.6245,
        "remaining_seconds": 1200.0,
        "is_emergency_mode": False
    }
    response = client.post("/api/v1/reroute/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "is_reroute_recommended" in data
    assert "reason" in data
    assert "original_remaining_seconds" in data
    assert "recommended_duration_seconds" in data

def test_nearest_point_along_route_calculation():
    # Verify spatial projection logic for seamless reroute vehicle alignment
    coords = [
        [77.6000, 12.9700],
        [77.6050, 12.9700],
        [77.6100, 12.9700],
        [77.6150, 12.9700],
    ]
    current_pt = [77.6052, 12.9701]

    # Calculate nearest coordinate index
    min_dist = float("inf")
    closest_idx = 0
    for i, c in enumerate(coords):
        d = CongestionDetector.haversine_distance(current_pt, c)
        if d < min_dist:
            min_dist = d
            closest_idx = i

    assert closest_idx == 1  # [77.6050, 12.9700] is nearest

    # Calculate cumulative distance up to closest point
    running_dist = 0.0
    for i in range(1, closest_idx + 1):
        running_dist += CongestionDetector.haversine_distance(coords[i-1], coords[i])
    assert running_dist > 500.0
