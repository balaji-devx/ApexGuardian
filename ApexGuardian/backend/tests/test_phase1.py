import sys
import os
from fastapi.testclient import TestClient

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["region"] == "Bengaluru"
    assert "timestamp" in data

def test_search_endpoint():
    response = client.get("/api/v1/search?q=Indiranagar")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    first_result = data[0]
    assert "lat" in first_result and isinstance(first_result["lat"], float)
    assert "lon" in first_result and isinstance(first_result["lon"], float)
    assert "display_name" in first_result

def test_route_endpoint():
    payload = {
        "origin_lat": 12.9756,
        "origin_lon": 77.6066,
        "dest_lat": 12.9352,
        "dest_lon": 77.6245
    }
    response = client.post("/api/v1/route", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["routes_count"] >= 1
    candidate = data["candidates"][0]
    assert candidate["geometry"]["type"] == "LineString"
    assert len(candidate["geometry"]["coordinates"]) > 0
    assert candidate["distance_meters"] > 0
    assert candidate["duration_seconds"] > 0
