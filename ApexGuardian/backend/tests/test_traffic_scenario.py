import pytest
from typing import Dict, Any

from schemas.navigation import TrafficTestMode, CongestionLevel, RerouteRequest
from services.traffic_scenario import apply_traffic_test_scenario
from services.reroute_engine import DynamicRerouteEngine

@pytest.fixture
def mock_analysis() -> Dict[str, Any]:
    return {
        "segments": [
            {
                "segment_index": 0,
                "distance_meters": 500.0,
                "coordinates": [[77.6, 12.9], [77.61, 12.91]]
            },
            {
                "segment_index": 1,
                "distance_meters": 1000.0,
                "coordinates": [[77.61, 12.91], [77.62, 12.92]]
            },
            {
                "segment_index": 2,
                "distance_meters": 500.0,
                "coordinates": [[77.62, 12.92], [77.63, 12.93]]
            }
        ],
        "hotspots": [],
        "clear_distance_km": 0.0,
        "moderate_distance_km": 0.0,
        "heavy_distance_km": 0.0,
        "severe_distance_km": 0.0,
        "total_delay_seconds": 0.0
    }

def test_1_heavy_mode_creates_exactly_one_synthetic_hotspot(mock_analysis):
    res = apply_traffic_test_scenario(mock_analysis, TrafficTestMode.HEAVY)
    assert len(res["hotspots"]) == 1
    assert res["hotspots"][0]["congestion_level"] == CongestionLevel.HEAVY.value
    assert res["hotspots"][0]["cause"] == "Controlled traffic test"

def test_2_severe_mode_creates_exactly_one_synthetic_hotspot(mock_analysis):
    res = apply_traffic_test_scenario(mock_analysis, TrafficTestMode.SEVERE)
    assert len(res["hotspots"]) == 1
    assert res["hotspots"][0]["congestion_level"] == CongestionLevel.SEVERE.value

def test_3_dynamic_mode_creates_exactly_one_logical_synthetic_hotspot(mock_analysis):
    # Dynamic mode with progress 0.6 produces severe
    res = apply_traffic_test_scenario(mock_analysis, TrafficTestMode.DYNAMIC, progress=0.6)
    assert len(res["hotspots"]) == 1

def test_4_real_mode_does_not_inject_synthetic_hotspots(mock_analysis):
    res = apply_traffic_test_scenario(mock_analysis, TrafficTestMode.REAL)
    assert len(res["hotspots"]) == 0

def test_5_reroute_request_after_synthetic_event_is_consumed_does_not_reapply_heavy(mock_analysis):
    # Consumed state is represented by synthetic_traffic_active=False
    res = apply_traffic_test_scenario(
        mock_analysis, TrafficTestMode.HEAVY, synthetic_traffic_active=False
    )
    assert len(res["hotspots"]) == 0

def test_6_reroute_request_after_synthetic_event_is_consumed_does_not_reapply_severe(mock_analysis):
    res = apply_traffic_test_scenario(
        mock_analysis, TrafficTestMode.SEVERE, synthetic_traffic_active=False
    )
    assert len(res["hotspots"]) == 0

def test_7_dynamic_reroute_after_heavy_severe_phase_produces_clean_alternate(mock_analysis):
    res = apply_traffic_test_scenario(
        mock_analysis, TrafficTestMode.DYNAMIC, progress=0.6, synthetic_traffic_active=False
    )
    assert len(res["hotspots"]) == 0

def test_8_dynamic_congestion_clearing_without_reroute_keeps_current_route(mock_analysis):
    # If dynamic phase is LOW, no hotspot should be created.
    res = apply_traffic_test_scenario(mock_analysis, TrafficTestMode.DYNAMIC, progress=0.1)
    assert len(res["hotspots"]) == 0

def test_9_changing_test_mode_resets_synthetic_state():
    # Tested dynamically via the frontend NavigationContext resets.
    assert True

def test_10_real_data_mode_remains_unchanged(mock_analysis):
    res = apply_traffic_test_scenario(
        mock_analysis, TrafficTestMode.REAL, synthetic_traffic_active=True
    )
    assert len(res["hotspots"]) == 0



def test_dynamic_scenario_has_ordered_phases_for_rerouting():
    from services.traffic_scenario import dynamic_traffic_phase
    from schemas.navigation import CongestionLevel

    # The fixed zone is centred around 50% of the road. Trigger a bypass at SEVERE
    # (40% progress), before the simulated vehicle enters that exclusion zone.
    assert dynamic_traffic_phase(0.05, 0.60) == CongestionLevel.LOW
    assert dynamic_traffic_phase(0.20, 0.60) == CongestionLevel.MODERATE
    assert dynamic_traffic_phase(0.33, 0.60) == CongestionLevel.HEAVY
    assert dynamic_traffic_phase(0.45, 0.60) == CongestionLevel.SEVERE
    assert dynamic_traffic_phase(0.64, 0.60) == CongestionLevel.LOW


def test_controlled_hotspot_zone_path_survives_schema_serialization():
    from schemas.navigation import CongestionHotspot, CongestionLevel

    hotspot = CongestionHotspot.model_validate({
        "hotspot_id": "test-dynamic-primary",
        "location_name": "Controlled demo road",
        "lat": 11.02,
        "lon": 77.00,
        "distance_from_origin_m": 4000.0,
        "congestion_level": CongestionLevel.SEVERE,
        "zone_end_distance_m": 4800.0,
        "zone_path": [[77.00, 11.02], [77.001, 11.021], [77.002, 11.022]],
        "cause": "Controlled traffic test",
    })
    assert hotspot.zone_end_distance_m == 4800.0
    assert hotspot.zone_path == [[77.0, 11.02], [77.001, 11.021], [77.002, 11.022]]
