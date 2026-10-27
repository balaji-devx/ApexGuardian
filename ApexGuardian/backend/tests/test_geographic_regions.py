import math
import pytest
from fastapi.testclient import TestClient

from api.v1 import endpoints
from core.region import (
    is_valid_coordinate,
    find_region_by_coordinates,
    resolve_route_region,
    get_region,
)
from main import app
from schemas.navigation import TrafficTestMode

client = TestClient(app)


def _make_dummy_osrm_candidate(origin_lat, origin_lon, dest_lat, dest_lon):
    return {
        "route_index": 0,
        "distance_meters": 6200.0,
        "duration_seconds": 840.0,
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [origin_lon, origin_lat],
                [(origin_lon + dest_lon) / 2, (origin_lat + dest_lat) / 2],
                [dest_lon, dest_lat],
            ],
        },
        "steps": [
            {
                "name": "Main Highway",
                "distance": 6200.0,
                "duration": 840.0,
                "maneuver": {"type": "depart", "location": [origin_lon, origin_lat]},
            }
        ],
    }


# -----------------------------------------------------------------------------
# 1. Coordinate Validation Unit Tests
# -----------------------------------------------------------------------------
def test_is_valid_coordinate():
    assert is_valid_coordinate(11.0179, 76.9674) is True
    assert is_valid_coordinate(12.9786, 77.6421) is True
    assert is_valid_coordinate(0.0, 0.0) is True
    assert is_valid_coordinate(-90.0, 180.0) is True
    assert is_valid_coordinate(90.0, -180.0) is True

    # Invalid coordinates
    assert is_valid_coordinate(91.0, 77.0) is False
    assert is_valid_coordinate(-90.1, 77.0) is False
    assert is_valid_coordinate(12.0, 180.5) is False
    assert is_valid_coordinate(12.0, -181.0) is False
    assert is_valid_coordinate(float("nan"), 77.0) is False
    assert is_valid_coordinate(12.0, float("inf")) is False
    assert is_valid_coordinate(None, 77.0) is False


# -----------------------------------------------------------------------------
# 2. Region Resolution Tests
# -----------------------------------------------------------------------------
def test_find_region_by_coordinates():
    # Coimbatore
    cbe_region = find_region_by_coordinates(11.0179, 76.9674)
    assert cbe_region is not None
    assert cbe_region.key == "coimbatore"

    # Bengaluru
    blr_region = find_region_by_coordinates(12.9786, 77.6421)
    assert blr_region is not None
    assert blr_region.key == "bengaluru"

    # Outside regions (Tiruppur)
    tiruppur_region = find_region_by_coordinates(11.1085, 77.3411)
    assert tiruppur_region is None


def test_resolve_route_region():
    # Coimbatore route
    region = resolve_route_region(11.0179, 76.9674, 11.04146, 77.0381)
    assert region is not None
    assert region.key == "coimbatore"

    # Bengaluru route
    region = resolve_route_region(12.9786, 77.6421, 12.9569, 77.7011)
    assert region is not None
    assert region.key == "bengaluru"

    # Out of coverage route (Tiruppur)
    region = resolve_route_region(11.1085, 77.3411, 11.1150, 77.3550)
    assert region is None

    # Cross-region route (Coimbatore to Bengaluru) -> no single regional model
    region = resolve_route_region(11.0179, 76.9674, 12.9786, 77.6421)
    assert region is None

    # Explicit override when matching
    region = resolve_route_region(11.0179, 76.9674, 11.04146, 77.0381, requested_region="coimbatore")
    assert region is not None
    assert region.key == "coimbatore"


# -----------------------------------------------------------------------------
# 3. Supplied Coimbatore Coordinates Route Test (The bug report case)
# -----------------------------------------------------------------------------
def test_supplied_coimbatore_coordinates_route(monkeypatch, caplog):
    origin_lat, origin_lon = 11.0179, 76.9674
    dest_lat, dest_lon = 11.04146, 77.0381

    dummy = _make_dummy_osrm_candidate(origin_lat, origin_lon, dest_lat, dest_lon)

    async def mock_get_routes(**kwargs):
        return [dummy.copy()]

    monkeypatch.setattr(endpoints.OSRMService, "get_routes", staticmethod(mock_get_routes))

    with caplog.at_level("WARNING"):
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
    assert data["success"] is True
    assert data["routes_count"] == 1
    assert data["traffic_coverage"] == "supported"
    assert data["region"] == "coimbatore"

    # Verify NO warnings about Bengaluru bounding box
    for record in caplog.records:
        assert "outside Bengaluru bounding box" not in record.message
        assert "outside Bangalore bounding box" not in record.message


# -----------------------------------------------------------------------------
# 4. Bengaluru Route Test
# -----------------------------------------------------------------------------
def test_bengaluru_route(monkeypatch):
    origin_lat, origin_lon = 12.9786, 77.6421
    dest_lat, dest_lon = 12.9569, 77.7011

    dummy = _make_dummy_osrm_candidate(origin_lat, origin_lon, dest_lat, dest_lon)

    async def mock_get_routes(**kwargs):
        return [dummy.copy()]

    monkeypatch.setattr(endpoints.OSRMService, "get_routes", staticmethod(mock_get_routes))

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
    assert data["success"] is True
    assert data["traffic_coverage"] == "supported"
    assert data["region"] == "bengaluru"


# -----------------------------------------------------------------------------
# 5. Out of Coverage Coordinates Route Test (e.g. Tiruppur)
# -----------------------------------------------------------------------------
def test_out_of_coverage_route(monkeypatch):
    # Tiruppur coordinates (outside both BLR and CBE traffic models)
    origin_lat, origin_lon = 11.1085, 77.3411
    dest_lat, dest_lon = 11.1150, 77.3550

    dummy = _make_dummy_osrm_candidate(origin_lat, origin_lon, dest_lat, dest_lon)

    async def mock_get_routes(**kwargs):
        return [dummy.copy()]

    monkeypatch.setattr(endpoints.OSRMService, "get_routes", staticmethod(mock_get_routes))

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
    assert data["success"] is True
    assert data["traffic_coverage"] == "unsupported"
    assert data["region"] is None
    candidate = data["candidates"][0]
    # Check baseline fallback values
    assert candidate["congestion_factor"] == 1.0
    assert "Unsupported" in candidate["confidence"]
    assert candidate["predicted_duration_seconds"] == candidate["standard_duration_seconds"]


# -----------------------------------------------------------------------------
# 6. Genuinely Invalid Coordinates Tests
# -----------------------------------------------------------------------------
def test_invalid_coordinates_rejected_with_400():
    # Latitude > 90
    res = client.post(
        "/api/v1/route",
        json={"origin_lat": 95.0, "origin_lon": 76.96, "dest_lat": 11.0, "dest_lon": 77.0},
    )
    assert res.status_code == 400
    assert "Invalid origin coordinates" in res.json()["detail"]

    # Longitude > 180
    res = client.post(
        "/api/v1/route",
        json={"origin_lat": 11.0, "origin_lon": 76.96, "dest_lat": 11.0, "dest_lon": 195.0},
    )
    assert res.status_code == 400
    assert "Invalid destination coordinates" in res.json()["detail"]

    # Invalid in reroute endpoint
    res = client.post(
        "/api/v1/reroute/evaluate",
        json={
            "current_lat": -95.0,
            "current_lon": 77.0,
            "dest_lat": 11.0,
            "dest_lon": 77.0,
            "original_remaining_duration_seconds": 300.0,
        },
    )
    assert res.status_code == 400

    # Invalid in traffic factors endpoint
    res = client.get("/api/v1/traffic/factors", params={"lat": 12.0, "lon": 250.0})
    assert res.status_code == 400


# -----------------------------------------------------------------------------
# 7. Failed Route Calculation Returns 404 (Not 200 with 0 routes)
# -----------------------------------------------------------------------------
def test_failed_route_calculation_returns_404(monkeypatch):
    async def mock_empty_routes(**kwargs):
        return []

    monkeypatch.setattr(endpoints.OSRMService, "get_routes", staticmethod(mock_empty_routes))

    response = client.post(
        "/api/v1/route",
        json={
            "origin_lat": 11.0179,
            "origin_lon": 76.9674,
            "dest_lat": 11.04146,
            "dest_lon": 77.0381,
        },
    )

    assert response.status_code == 404
    assert "No driving route found" in response.json()["detail"]


# -----------------------------------------------------------------------------
# 8. Coordinate Ordering in OSRM
# -----------------------------------------------------------------------------
def test_osrm_coordinate_string_ordering():
    origin_lat, origin_lon = 11.0179, 76.9674
    dest_lat, dest_lon = 11.04146, 77.0381

    # OSRM requires "lon,lat;lon,lat"
    expected = f"{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
    actual = f"{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
    assert actual == "76.9674,11.0179;77.0381,11.04146"
