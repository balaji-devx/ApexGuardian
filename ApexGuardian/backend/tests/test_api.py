from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "timestamp" in data

def test_search_endpoint_empty():
    response = client.get("/api/v1/search?q=")
    assert response.status_code == 422 or response.status_code == 400

def test_reverse_endpoint_missing_params():
    response = client.get("/api/v1/reverse")
    assert response.status_code == 422

# Add mock tests for /route to prevent actual network calls during CI
def test_route_missing_body():
    response = client.post("/api/v1/route", json={})
    assert response.status_code == 422
