from fastapi.testclient import TestClient

from api.v1 import endpoints
from main import app


client = TestClient(app)


def test_route_defaults_to_real_traffic_without_test_hotspots(monkeypatch):
    origin_lat, origin_lon = 12.9756, 77.6066
    dest_lat, dest_lon = 12.9352, 77.6245
    candidate = {
        "route_index": 0,
        "distance_meters": 5200.0,
        "duration_seconds": 720.0,
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [origin_lon, origin_lat],
                [77.6150, 12.9550],
                [dest_lon, dest_lat],
            ],
        },
        "steps": [{"name": "Test Road", "distance": 5200.0, "duration": 720.0}],
    }

    async def mock_get_routes(**kwargs):
        return [candidate.copy()]

    monkeypatch.setattr(endpoints.OSRMService, "get_routes", staticmethod(mock_get_routes))
    monkeypatch.setattr(
        endpoints.RouteScorer,
        "evaluate_routes",
        staticmethod(lambda routes, *args, **kwargs: routes),
    )

    response = client.post(
        "/api/v1/route",
        json={
            "origin_lat": origin_lat,
            "origin_lon": origin_lon,
            "dest_lat": dest_lat,
            "dest_lon": dest_lon,
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["routes_count"] > 0
    assert all(
        hotspot.get("cause") != "Controlled traffic test"
        for route in data["candidates"]
        for hotspot in route["hotspots"]
    )
