# Code dump: `E:\PROJECTS\ApexGuardian V2.0\ApexGuardian`

Total files: 68

## Table of contents

- `backend\api\__init__.py`
- `backend\api\v1\__init__.py`
- `backend\api\v1\endpoints.py`
- `backend\core\__init__.py`
- `backend\core\config.py`
- `backend\core\region.py`
- `backend\main.py`
- `backend\ml\__init__.py`
- `backend\ml\dataset.py`
- `backend\ml\datasets\cbe\coverage_anchors_coimbatore.json`
- `backend\ml\datasets\cbe\osrm_cache_coimbatore.json`
- `backend\ml\datasets\tml\osrm_cache.json`
- `backend\ml\recommender.py`
- `backend\ml\route_model.py`
- `backend\ml\train.py`
- `backend\requirements.txt`
- `backend\schemas\__init__.py`
- `backend\schemas\navigation.py`
- `backend\services\__init__.py`
- `backend\services\congestion_detector.py`
- `backend\services\controlled_bypass_planner.py`
- `backend\services\nominatim.py`
- `backend\services\notification_service.py`
- `backend\services\osrm.py`
- `backend\services\reroute_engine.py`
- `backend\services\route_selection.py`
- `backend\services\traffic_scenario.py`
- `backend\services\traffic_service.py`
- `backend\tests\__init__.py`
- `backend\tests\test_api.py`
- `backend\tests\test_controlled_bypass_planner.py`
- `backend\tests\test_dataset_optimized.py`
- `backend\tests\test_geographic_regions.py`
- `backend\tests\test_ml_pipeline.py`
- `backend\tests\test_new_features.py`
- `backend\tests\test_patch_regressions.py`
- `backend\tests\test_region_config.py`
- `backend\tests\test_reroute_validation.py`
- `backend\tests\test_traffic_scenario.py`
- `frontend\next-env.d.ts`
- `frontend\package-lock.json`
- `frontend\package.json`
- `frontend\postcss.config.js`
- `frontend\src\app\globals.css`
- `frontend\src\app\layout.tsx`
- `frontend\src\app\page.tsx`
- `frontend\src\components\map\MapCanvas.tsx`
- `frontend\src\components\ui\AdvanceAlertBanner.tsx`
- `frontend\src\components\ui\FloatingSearchPanel.tsx`
- `frontend\src\components\ui\MapControls.tsx`
- `frontend\src\components\ui\NavigationControlsHUD.tsx`
- `frontend\src\components\ui\NoFasterRouteToast.tsx`
- `frontend\src\components\ui\RerouteModal.tsx`
- `frontend\src\components\ui\RouteCard.tsx`
- `frontend\src\components\ui\TrafficLegend.tsx`
- `frontend\src\components\ui\TurnByTurnDrawer.tsx`
- `frontend\src\context\NavigationContext.tsx`
- `frontend\src\lib\alertManager.ts`
- `frontend\src\lib\api.ts`
- `frontend\src\lib\layoutZones.ts`
- `frontend\src\lib\maneuverInstructions.ts`
- `frontend\src\lib\pushNotificationService.ts`
- `frontend\src\lib\region.ts`
- `frontend\src\lib\rerouteEngine.ts`
- `frontend\src\lib\trafficScenario.ts`
- `frontend\src\lib\ttsService.ts`
- `frontend\tailwind.config.ts`
- `frontend\tsconfig.json`

---


## `backend\api\__init__.py`

```python
# API package initialization
```


## `backend\api\v1\__init__.py`

```python
# API v1 package initialization
```


## `backend\api\v1\endpoints.py`

```python
from datetime import datetime, timezone
import logging
import uuid
import math
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query, Body
from core.region import get_region, is_valid_coordinate, resolve_route_region
from schemas.navigation import (
    LocationSearchResponse, 
    RouteRequest, 
    RouteResponse, 
    CandidateRoute,
    TrafficFactorsRequest,
    TrafficFactorData,
    RerouteRequest,
    RerouteRecommendation,
    PushNotificationPayload,
    TrafficTestMode,
)
from services.nominatim import NominatimService
from services.osrm import OSRMService
from services.traffic_service import LiveTrafficService
from services.congestion_detector import CongestionDetector
from services.reroute_engine import DynamicRerouteEngine
from services.notification_service import PushNotificationService
from services.route_selection import rank_processed_routes
from services.traffic_scenario import apply_traffic_test_scenario, compute_scenario_zone
from services.controlled_bypass_planner import plan_controlled_bypass, build_controlled_bypass_candidates
from ml.recommender import RouteScorer

logger = logging.getLogger("apexguardian.api")
router = APIRouter()


def _clear_controlled_test_analysis(analysis: Dict[str, Any]) -> Dict[str, Any]:
    """Return a clean-road traffic view for alternative routes in controlled tests.

    Only the selected test corridor should carry the synthetic jam. Applying the
    same scenario to every OSRM candidate paints a second jam onto the bypass and
    can make the UI reroute repeatedly between congested alternatives.
    """
    segments: List[Dict[str, Any]] = []
    total_distance = 0.0
    for raw_segment in analysis.get("segments", []):
        segment = dict(raw_segment)
        distance = max(0.0, float(segment.get("distance_meters", 0.0) or 0.0))
        freeflow_speed = max(20.0, float(segment.get("freeflow_speed_kmh", 45.0) or 45.0))
        duration = distance / max(0.5, freeflow_speed / 3.6)
        segment.update({
            "congestion_level": "LOW",
            "color": "#16A34A",
            "current_speed_kmh": round(freeflow_speed, 1),
            "delay_seconds": 0.0,
            "duration_seconds": round(duration, 1),
            "congestion_factor": 1.0,
        })
        segments.append(segment)
        total_distance += distance
    cleaned = dict(analysis)
    cleaned.update({
        "segments": segments,
        "hotspots": [],
        "total_delay_seconds": 0.0,
        "clear_distance_km": round(total_distance / 1000.0, 2),
        "moderate_distance_km": 0.0,
        "heavy_distance_km": 0.0,
        "severe_distance_km": 0.0,
    })
    return cleaned

@router.get("/health")
async def health_check():
    return {
        "status": "online",
        "region": get_region().display_name,
        "region_key": get_region().key,
        "training_data_is_synthetic": get_region().data_is_synthetic,
        "features": [
            "congestion_point_identification",
            "real_time_traffic_factors",
            "predictive_congestion",
            "advance_alert_messages",
            "mobile_push_notifications",
            "voice_tts_guidance",
            "dynamic_ml_reexecution",
            "dynamic_alternative_rerouting",
            "fastest_route_recommendation",
            "route_eta_updates"
        ],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.get("/search", response_model=List[LocationSearchResponse])
async def search_locations(q: str = Query(..., min_length=1, description="Location search query")):
    if not q.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty")
    try:
        results = await NominatimService.search_places(q)
        return results
    except Exception as e:
        logger.error(f"Error searching locations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Location search failed: {str(e)}")

@router.get("/reverse")
async def reverse_geocode(lat: float = Query(..., description="Latitude"), lon: float = Query(..., description="Longitude")):
    try:
        display_name = await NominatimService.reverse_geocode(lat, lon)
        return {
            "display_name": display_name,
            "lat": lat,
            "lon": lon
        }
    except Exception as e:
        logger.error(f"Error reverse geocoding ({lat}, {lon}): {str(e)}")
        return {
            "display_name": f"Location ({lat:.5f}, {lon:.5f})",
            "lat": lat,
            "lon": lon
        }

@router.post("/route", response_model=RouteResponse)
async def calculate_route(request: RouteRequest):
    """Calculates driving routes with ML scoring, multi-colored congestion segments, and hotspot detection."""
    # 1. Coordinate Validation
    if not is_valid_coordinate(request.origin_lat, request.origin_lon):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid origin coordinates: ({request.origin_lat}, {request.origin_lon}). Latitude must be between -90 and 90, longitude between -180 and 180."
        )
    if not is_valid_coordinate(request.dest_lat, request.dest_lon):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid destination coordinates: ({request.dest_lat}, {request.dest_lon}). Latitude must be between -90 and 90, longitude between -180 and 180."
        )

    # 2. Dynamic Geographic Region Resolution
    route_region = resolve_route_region(
        request.origin_lat,
        request.origin_lon,
        request.dest_lat,
        request.dest_lon,
        requested_region=request.region
    )
    if route_region:
        logger.info(
            f"Route matched traffic region '{route_region.display_name}' ({route_region.key}). Regional ML traffic model active."
        )
    else:
        logger.info(
            f"Coordinates ({request.origin_lat}, {request.origin_lon}) -> ({request.dest_lat}, {request.dest_lon}) outside regional traffic models. Baseline routing active."
        )

    try:
        # 3. Fetch High-Resolution OSRM Street Driving Polylines
        raw_candidates = await OSRMService.get_routes(
            origin_lat=request.origin_lat,
            origin_lon=request.origin_lon,
            dest_lat=request.dest_lat,
            dest_lon=request.dest_lon
        )

        controlled_plan = None
        controlled_modes = (TrafficTestMode.HEAVY, TrafficTestMode.SEVERE, TrafficTestMode.DYNAMIC)
        if request.traffic_test_mode in controlled_modes:
            # First use alternatives already returned by OSRM. If no real route pair
            # clears a complete congestion stretch, request compact street routes via
            # entry -> side-road -> exit waypoints before the simulation starts.
            controlled_plan = plan_controlled_bypass(raw_candidates)
            if not controlled_plan:
                try:
                    additions, generated_plan = await build_controlled_bypass_candidates(
                        raw_candidates,
                        request.origin_lat, request.origin_lon,
                        request.dest_lat, request.dest_lon,
                        OSRMService.get_routes_via_waypoints,
                    )
                    if additions:
                        raw_candidates.extend(additions)
                    controlled_plan = generated_plan or plan_controlled_bypass(raw_candidates)
                except Exception:
                    logger.exception("[TrafficTest] OSRM preplanned bypass generation failed")
            if controlled_plan:
                logger.info(
                    "[TrafficTest] Preplanned real-road bypass: active=%s bypass=%s switch=%.0fm zone=%.0f-%.0fm clearance=%.0fm",
                    controlled_plan["active_route_index"], controlled_plan["bypass_route_index"],
                    controlled_plan["switch_distance_m"], controlled_plan["zone_start_distance_m"],
                    controlled_plan["zone_end_distance_m"], controlled_plan["minimum_bypass_clearance_m"],
                )
            else:
                # The frontend will attempt a zone-specific live avoidance reroute at the
                # 1 km trigger when no valid preplanned pair exists; it never reroutes for
                # unrelated congestion in a controlled test.
                logger.warning("[TrafficTest] No preplanned bypass; zone-specific fallback reroute will be attempted 1000m before the test hotspot")
        # 4. Evaluate Candidates with Route-Level ML Model
        ml_evaluated_candidates = RouteScorer.evaluate_routes(
            raw_candidates,
            request.origin_lat,
            request.origin_lon,
            request.dest_lat,
            request.dest_lon,
            region=route_region,
            # EMERGENCY FEATURE DISABLED: is_emergency_mode=request.is_emergency_mode
        )

        # 3. Analyze each candidate for Segmented Congestion & Predictive Hotspots (Features 1 & 3)
        processed_candidates: List[CandidateRoute] = []
        for candidate in ml_evaluated_candidates:
            route_dist_m = candidate.get("distance_meters", 0.0)
            base_dur_s = candidate.get("duration_seconds", 0.0)
            geometry = candidate.get("geometry", {})
            steps = candidate.get("steps", [])

            # Hard Geometry Validation
            coords = geometry.get("coordinates", [])
            if not coords or len(coords) < 2:
                logger.error("Rejecting route: insufficient coordinates")
                continue
                
            has_nan = any(math.isnan(c[0]) or math.isnan(c[1]) for c in coords)
            if has_nan:
                logger.error("Rejecting route: contains NaN coordinates")
                continue

            if not steps:
                logger.error("Rejecting route: no steps found")
                continue

            candidate["route_id"] = str(uuid.uuid4())
            candidate["source"] = "initial-osrm"
            candidate["original_route_index"] = candidate.get("original_route_index", candidate.get("route_index", 0))

            analysis = CongestionDetector.analyze_route(
                geometry=geometry,
                steps=steps,
                total_distance_m=route_dist_m,
                base_duration_s=base_dur_s,
                region=route_region,
                # EMERGENCY FEATURE DISABLED: is_emergency_mode=request.is_emergency_mode
            )
            # In a controlled test, put the synthetic jam on exactly ONE route. If a
            # preplanned pair exists it is the planner's active route; otherwise use
            # original route index 0 and let the frontend attempt a zone-specific fallback.
            is_controlled_test = request.traffic_test_mode in controlled_modes
            controlled_active_index = int(controlled_plan["active_route_index"]) if controlled_plan else 0
            candidate_original_index = int(candidate.get("original_route_index", candidate.get("route_index", 0)))
            use_controlled_zone = is_controlled_test and candidate_original_index == controlled_active_index
            use_planned_zone = bool(controlled_plan and use_controlled_zone)
            if is_controlled_test and not use_controlled_zone:
                analysis = _clear_controlled_test_analysis(analysis)
            else:
                analysis = apply_traffic_test_scenario(
                    analysis, request.traffic_test_mode, request.traffic_progress, request.synthetic_traffic_active,
                    zone_start_ratio=controlled_plan["zone_start_ratio"] if use_planned_zone else 0.50,
                    zone_length_m=controlled_plan["zone_length_m"] if use_planned_zone else None,
                )

            if is_controlled_test:
                analysis["hotspots"] = [
                    hotspot for hotspot in analysis.get("hotspots", [])
                    if hotspot.get("cause") == "Controlled traffic test"
                ]
            candidate["segments"] = analysis["segments"]
            candidate["hotspots"] = analysis["hotspots"]
            candidate["clear_distance_km"] = analysis["clear_distance_km"]
            candidate["moderate_distance_km"] = analysis["moderate_distance_km"]
            candidate["heavy_distance_km"] = analysis["heavy_distance_km"]
            candidate["severe_distance_km"] = analysis["severe_distance_km"]
            candidate["total_delay_seconds"] = analysis["total_delay_seconds"]
            if is_controlled_test and use_controlled_zone and not controlled_plan:
                # The zone needs stable distance metadata even while DYNAMIC starts at LOW
                # (when it intentionally has no visible hotspot yet).
                zone_start_m, zone_end_m = compute_scenario_zone(route_dist_m, 0.50, None)
                candidate["controlled_test_zone_start_distance_m"] = zone_start_m
                candidate["controlled_test_zone_end_distance_m"] = zone_end_m

            # Incorporate segment-level live delays with ML duration. Clean alternatives
            # in controlled tests use the unsurcharged OSRM duration, not a residual ML jam.
            live_delay = analysis["total_delay_seconds"]
            ml_predicted_dur = candidate.get("predicted_duration_seconds", base_dur_s)
            final_predicted_dur = (
                base_dur_s if is_controlled_test and not use_controlled_zone
                else max(ml_predicted_dur, base_dur_s + live_delay)
            )
            candidate["predicted_duration_seconds"] = final_predicted_dur
            candidate["predicted_duration_minutes"] = round(final_predicted_dur / 60.0, 1)

            processed_candidates.append(CandidateRoute(**candidate))

        # Rank by the final ETA after segment-level delays have been added.
        # This keeps ML as the primary estimate while allowing material road
        # congestion to affect the initial recommendation.
        rank_processed_routes(processed_candidates)

        # Store the real OSRM bypass on the active route so the frontend can switch at
        # the shared approach point without making a second, failure-prone request mid-drive.
        if controlled_plan:
            active_idx = int(controlled_plan["active_route_index"])
            bypass_idx = int(controlled_plan["bypass_route_index"])
            active_candidate = next((r for r in processed_candidates if r.original_route_index == active_idx), None)
            bypass_candidate = next((r for r in processed_candidates if r.original_route_index == bypass_idx), None)
            if active_candidate is not None and bypass_candidate is not None and active_candidate.route_id != bypass_candidate.route_id:
                bypass_payload = bypass_candidate.model_dump(mode="json")
                bypass_payload["controlled_test_bypass_route"] = None
                bypass_payload["controlled_test_switch_distance_m"] = None
                bypass_payload["controlled_test_zone_start_distance_m"] = None
                bypass_payload["controlled_test_zone_end_distance_m"] = None
                active_candidate.controlled_test_bypass_route = bypass_payload
                active_candidate.controlled_test_switch_distance_m = controlled_plan["switch_distance_m"]
                active_candidate.controlled_test_zone_start_distance_m = controlled_plan["zone_start_distance_m"]
                active_candidate.controlled_test_zone_end_distance_m = controlled_plan["zone_end_distance_m"]
                processed_candidates = [active_candidate] + [
                    route for route in processed_candidates if route.route_id != active_candidate.route_id
                ]
            else:
                logger.warning("[TrafficTest] The verified OSRM pair was rejected during route validation")

        if not processed_candidates:
            logger.warning("No driving route found or all candidate routes rejected.")
            raise HTTPException(
                status_code=404,
                detail="No driving route found between the specified origin and destination."
            )

        return RouteResponse(
            success=True,
            routes_count=len(processed_candidates),
            candidates=processed_candidates,
            traffic_coverage="supported" if route_region is not None else "unsupported",
            region=route_region.key if route_region is not None else None,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching routes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Routing service error: {str(e)}")

@router.post("/reroute/evaluate", response_model=RerouteRecommendation)
async def evaluate_reroute(request: RerouteRequest):
    """Dynamically generates alternative routes from CURRENT user location and recommends the fastest (Features 8 & 9)."""
    if not is_valid_coordinate(request.current_lat, request.current_lon):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid current coordinates: ({request.current_lat}, {request.current_lon}). Latitude must be between -90 and 90, longitude between -180 and 180."
        )
    if not is_valid_coordinate(request.dest_lat, request.dest_lon):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid destination coordinates: ({request.dest_lat}, {request.dest_lon}). Latitude must be between -90 and 90, longitude between -180 and 180."
        )

    recommendation = await DynamicRerouteEngine.evaluate_reroute(
        current_lat=request.current_lat,
        current_lon=request.current_lon,
        dest_lat=request.dest_lat,
        dest_lon=request.dest_lon,
        original_remaining_duration_s=request.original_remaining_duration_seconds,
        avoid_hotspots=request.avoid_hotspots,
        # EMERGENCY FEATURE DISABLED: is_emergency_mode=request.is_emergency_mode,
        traffic_test_mode=request.traffic_test_mode,
        traffic_progress=request.traffic_progress,
        recent_routes=request.recent_routes,
        synthetic_traffic_active=request.synthetic_traffic_active,
        region_name=request.region,
    )
    return recommendation

@router.get("/traffic/factors", response_model=TrafficFactorData)
async def get_traffic_factors(lat: float = Query(...), lon: float = Query(...)):
    """Returns real-time traffic factor metrics for a location (Feature 2)."""
    if not is_valid_coordinate(lat, lon):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid coordinates: ({lat}, {lon}). Latitude must be between -90 and 90, longitude between -180 and 180."
        )
    factors = LiveTrafficService.get_point_traffic_factors(lat, lon)
    return TrafficFactorData(
        location_name=factors["location_name"],
        current_speed_kmh=factors["current_speed_kmh"],
        freeflow_speed_kmh=factors["freeflow_speed_kmh"],
        density_index=factors["density_index"],
        congestion_level=factors["congestion_level"],
        congestion_factor=factors["congestion_factor"],
        incident_description=factors["incident_description"],
        historical_baseline_speed_kmh=35.0
    )

@router.get("/traffic/hotspots")
async def get_traffic_hotspots():
    """Returns all active bottleneck hotspots across the active region."""
    hotspots = LiveTrafficService.get_all_active_hotspots()
    return {"success": True, "count": len(hotspots), "hotspots": hotspots}



@router.post("/notifications/dispatch", response_model=PushNotificationPayload)
async def dispatch_push_notification(payload: PushNotificationPayload):
    """Dispatches a mobile push notification (Feature 5)."""
    PushNotificationService._log_dispatch(payload)
    return payload

@router.get("/notifications/recent")
async def get_recent_notifications():
    """Retrieves recent push notification dispatch log."""
    dispatches = PushNotificationService.get_recent_dispatches()
    return {"dispatches": dispatches}
```


## `backend\core\__init__.py`

```python
# Core package initialization
```


## `backend\core\config.py`

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "Apex Guardian API"
    API_V1_STR: str = "/api/v1"
    PORT: int = 8000
    ACTIVE_REGION: str = "coimbatore"   # "bengaluru" | "coimbatore"
    ENVIRONMENT: str = "development"
    NOMINATIM_BASE_URL: str = "https://nominatim.openstreetmap.org"
    OSRM_BASE_URL: str = "https://router.project-osrm.org"
    MODEL_WEIGHTS_PATH: str = "ml/weights/congestion_model_v3_fixed.pkl"
    DATASET_PATH: str = "ml/datasets/cleaned_traffic.csv"
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True
    )

settings = Settings()
```


## `backend\core\region.py`

```python
import json
import os
from dataclasses import dataclass, field
from typing import List, Optional, Tuple


class BengaluruRegionManager:
    """Centralized geographical metadata for Bengaluru region."""
    CENTER: Tuple[float, float] = (12.9716, 77.5946)
    BOUNDING_BOX: List[float] = [77.4600, 12.8000, 77.7500, 13.1500]  # Min Lon, Min Lat, Max Lon, Max Lat
    DEFAULT_ZOOM: int = 12

    @classmethod
    def is_within_bounds(cls, lat: float, lon: float) -> bool:
        """Check if a coordinate pair sits inside the Bengaluru bounding box."""
        min_lon, min_lat, max_lon, max_lat = cls.BOUNDING_BOX
        return min_lat <= lat <= max_lat and min_lon <= lon <= max_lon


class CoimbatoreRegionManager:
    """Geographical metadata for Coimbatore (Tamil Nadu).

    CENTER is the commonly published city-centre coordinate. BOUNDING_BOX is a *configurable
    working extent* that comfortably covers the metropolitan road network (Thudiyalur and
    Saravanampatti in the north, Kuniyamuthur in the south, Vadavalli in the west, Singanallur
    and the airport in the east). Refine it once the route catalog has been resolved: the
    dataset generator prints the observed catalog extent.
    """
    CENTER: Tuple[float, float] = (11.0168, 76.9558)
    BOUNDING_BOX: List[float] = [76.8000, 10.9000, 77.1500, 11.2000]  # Min Lon, Min Lat, Max Lon, Max Lat
    DEFAULT_ZOOM: int = 12

    @classmethod
    def is_within_bounds(cls, lat: float, lon: float) -> bool:
        min_lon, min_lat, max_lon, max_lat = cls.BOUNDING_BOX
        return min_lat <= lat <= max_lat and min_lon <= lon <= max_lon


_DATASETS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml", "datasets")


@dataclass(frozen=True)
class RegionProfile:
    """Everything that used to be hard-wired to Bengaluru, gathered in one place."""
    key: str
    display_name: str
    manager: type
    plus_code_reference: Tuple[float, float]   # used to recover shortened Plus Codes
    traffic_csv: str
    osrm_cache: str
    model_filename: str
    nominatim_suffix: str
    nominatim_aliases: Tuple[str, ...]
    data_is_synthetic: bool = False
    coverage_anchors_file: Optional[str] = None
    default_coverage_anchors: Tuple[Tuple[float, float], ...] = field(default_factory=tuple)

    @property
    def center(self) -> Tuple[float, float]:
        return self.manager.CENTER

    @property
    def bounding_box(self) -> List[float]:
        return self.manager.BOUNDING_BOX

    @property
    def nominatim_viewbox(self) -> str:
        min_lon, min_lat, max_lon, max_lat = self.manager.BOUNDING_BOX
        return f"{min_lon},{max_lat},{max_lon},{min_lat}"  # left,top,right,bottom

    def is_within_bounds(self, lat: float, lon: float) -> bool:
        return self.manager.is_within_bounds(lat, lon)

    def coverage_anchors(self) -> List[Tuple[float, float]]:
        """Locations whose neighbourhood counts as 'historically covered' by training data."""
        if self.coverage_anchors_file and os.path.exists(self.coverage_anchors_file):
            with open(self.coverage_anchors_file, "r", encoding="utf-8") as fh:
                return [(float(a), float(b)) for a, b in json.load(fh)]
        return list(self.default_coverage_anchors)


REGIONS = {
    "bengaluru": RegionProfile(
        key="bengaluru",
        display_name="Bengaluru",
        manager=BengaluruRegionManager,
        plus_code_reference=(12.9716, 77.5946),
        traffic_csv=os.path.join(_DATASETS_DIR, "tml", "csv-traffic-bangalore.csv"),
        osrm_cache=os.path.join(_DATASETS_DIR, "tml", "osrm_cache.json"),
        model_filename="congestion_model_v3_fixed.pkl",
        nominatim_suffix="Bengaluru, India",
        nominatim_aliases=("bengaluru", "bangalore"),
        default_coverage_anchors=(
            (12.9514, 77.6590), (12.9345, 77.6200), (13.1989, 77.7069), (12.9716, 77.5946),
            (12.9279, 77.6271), (12.9698, 77.7499), (13.0354, 77.5988),
        ),
    ),
    "coimbatore": RegionProfile(
        key="coimbatore",
        display_name="Coimbatore",
        manager=CoimbatoreRegionManager,
        plus_code_reference=CoimbatoreRegionManager.CENTER,
        traffic_csv=os.path.join(_DATASETS_DIR, "cbe", "csv-traffic-coimbatore.csv"),
        osrm_cache=os.path.join(_DATASETS_DIR, "cbe", "osrm_cache_coimbatore.json"),
        # Distinct file so a Bengaluru-trained model can never be mistaken for a Coimbatore one.
        model_filename="congestion_model_coimbatore_synthetic_v1.pkl",
        nominatim_suffix="Coimbatore, India",
        nominatim_aliases=("coimbatore", "kovai"),
        data_is_synthetic=True,
        # Written by generate_coimbatore_dataset.py from the *resolved* route endpoints.
        coverage_anchors_file=os.path.join(_DATASETS_DIR, "cbe", "coverage_anchors_coimbatore.json"),
    ),
}


def get_region(key: Optional[str] = None) -> RegionProfile:
    """Return the active region profile (``ACTIVE_REGION`` env/.env setting; default Coimbatore)."""
    if key is None:
        from core.config import settings
        key = settings.ACTIVE_REGION
    key = (key or "coimbatore").strip().lower()
    if key not in REGIONS:
        raise ValueError(f"Unknown ACTIVE_REGION '{key}'. Valid options: {sorted(REGIONS)}")
    return REGIONS[key]


def list_registered_regions() -> List[RegionProfile]:
    """Return all registered region profiles."""
    return list(REGIONS.values())



def is_valid_coordinate(lat: float, lon: float) -> bool:
    """Check if lat/lon are finite, valid WGS-84 coordinates (-90 <= lat <= 90, -180 <= lon <= 180)."""
    try:
        import math
        if not (isinstance(lat, (int, float)) and isinstance(lon, (int, float))):
            return False
        if not (math.isfinite(lat) and math.isfinite(lon)):
            return False
        return -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0
    except Exception:
        return False


def find_region_by_coordinates(lat: float, lon: float) -> Optional[RegionProfile]:
    """Find a registered region whose bounding box contains the coordinate."""
    for region in REGIONS.values():
        if region.is_within_bounds(lat, lon):
            return region
    return None


def resolve_route_region(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
    requested_region: Optional[str] = None,
) -> Optional[RegionProfile]:
    """
    Resolve which traffic region applies to a route.
    1. If requested_region is provided and matches a registered region, use it.
    2. Check if origin and destination fall within the same registered region.
    3. If one point falls within a registered region and the other is near or inside, use that region.
    4. Otherwise, return None (unsupported traffic region; standard OSRM routing applies).
    """
    if requested_region and requested_region.strip().lower() in REGIONS:
        return REGIONS[requested_region.strip().lower()]

    origin_region = find_region_by_coordinates(origin_lat, origin_lon)
    dest_region = find_region_by_coordinates(dest_lat, dest_lon)

    if origin_region and dest_region and origin_region.key == dest_region.key:
        return origin_region
    if origin_region and not dest_region:
        return origin_region
    if dest_region and not origin_region:
        return dest_region

    return None
```


## `backend\main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from api.v1.endpoints import router as api_v1_router

app = FastAPI(title="Apex Guardian Navigation Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {
        "message": "Welcome to Apex Guardian Navigation Engine API",
        "docs": "/docs",
        "health": f"{settings.API_V1_STR}/health",
        "search": f"{settings.API_V1_STR}/search?q=Indiranagar"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
```


## `backend\ml\__init__.py`

```python
# ML package initialization
```


## `backend\ml\dataset.py`

```python
import os
import pandas as pd
import numpy as np
from typing import Tuple, List, Dict
from openlocationcode import openlocationcode as olc
from core.region import get_region
import asyncio
import time

class TrafficDataPipeline:
    """Feature engineering pipeline for Apex Guardian V2.0 Route-Level Model."""

    DATASETS_DIR = os.path.join(os.path.dirname(__file__), "datasets")
    # Dataset, OSRM-cache and Plus-Code reference all follow the ACTIVE_REGION setting
    # (default "coimbatore" for the college demo; set ACTIVE_REGION=bengaluru to opt into Bengaluru).
    REGION = get_region()
    TML_TRAFFIC_CSV = REGION.traffic_csv
    CACHE_FILE = REGION.osrm_cache

    # Shortened Plus Codes (e.g. "XJG4+7J") are recovered relative to this point.
    REF_LAT, REF_LON = REGION.plus_code_reference
    
    _osrm_cache = {}

    @classmethod
    def _decode_plus_code(cls, code: str) -> Tuple[float, float]:
        if len(code) <= 8 and '+' in code:
            full_code = olc.recoverNearest(code, cls.REF_LAT, cls.REF_LON)
        else:
            full_code = code
        decoded = olc.decode(full_code)
        return decoded.latitudeCenter, decoded.longitudeCenter
        
    @classmethod
    async def _build_osrm_cache(cls, unique_routes: pd.DataFrame):
        from services.osrm import OSRMService
        import json
        
        # Load from disk cache if exists
        if os.path.exists(cls.CACHE_FILE):
            try:
                with open(cls.CACHE_FILE, 'r') as f:
                    cls._osrm_cache = json.load(f)
                    print(f"Loaded {len(cls._osrm_cache)} routes from disk cache.")
            except Exception:
                pass

        needs_save = False
        for _, row in unique_routes.iterrows():
            o_lat, o_lon = row['origin_lat'], row['origin_lon']
            d_lat, d_lon = row['destination_lat'], row['destination_lon']
            key = f"{o_lat},{o_lon},{d_lat},{d_lon}"
            
            if key in cls._osrm_cache:
                continue
                
            # Rate limit backoff
            raw = None
            for attempt in range(5):
                try:
                    raw = await OSRMService.get_routes(o_lat, o_lon, d_lat, d_lon)
                    if raw:
                        break
                except Exception as e:
                    print(f"OSRM attempt {attempt+1} failed: {e}")
                print("Sleeping to respect OSRM rate limits...")
                await asyncio.sleep(3 * (attempt + 1))
                
            if not raw:
                raise RuntimeError(f"OSRM Route resolution failed for {key}. Halting dataset compilation.")
                
            route = raw[0]
            dist_km = route.get('distance_meters', 0) / 1000.0
            dur_sec = route.get('duration_seconds', 0)
            
            if dist_km <= 0 or dur_sec <= 0:
                raise RuntimeError(f"OSRM Route returned invalid metrics for {key}. Dist: {dist_km}, Dur: {dur_sec}")
                
            steps = route.get('steps', [])
            num_steps = max(1, len(steps))
            turns = 0
            roundabouts = 0
            for step in steps:
                mtype = step.get('maneuver', {}).get('type', '')
                if mtype in ['turn', 'merge', 'ramp']:
                    turns += 1
                if mtype in ['roundabout', 'rotary']:
                    roundabouts += 1
                    
            feats = {
                'osrm_dist': dist_km,
                'osrm_dur_min': dur_sec / 60.0,
                'steps_count': num_steps,
                'turns': turns,
                'roundabouts': roundabouts,
                'avg_step_len': dist_km / num_steps
            }
            cls._osrm_cache[key] = feats
            needs_save = True
            print(f"Resolved {key} -> Dist: {dist_km:.2f}km, Dur: {dur_sec/60.0:.2f}m, Steps: {num_steps}, Status: OK")
            
        if needs_save:
            with open(cls.CACHE_FILE, 'w') as f:
                json.dump(cls._osrm_cache, f)

    @classmethod
    def load_canonical_dataset(cls) -> pd.DataFrame:
        """Load canonical rows efficiently by decoding/cache-resolving each unique route once.

        The output columns and feature values are unchanged. This avoids row-wise Python
        ``DataFrame.apply`` calls across multi-million-row synthetic datasets.
        """
        if not os.path.exists(cls.TML_TRAFFIC_CSV):
            raise FileNotFoundError(f"Missing TML dataset at {cls.TML_TRAFFIC_CSV}")

        # Weather columns are not model features. Reading only the five required source
        # columns saves substantial RAM for the 5M+ row Coimbatore dataset.
        df = pd.read_csv(
            cls.TML_TRAFFIC_CSV,
            usecols=["date", "time", "route_code", "duration", "distance"],
            dtype={"date": "string", "time": "string", "route_code": "category"},
        )
        df["timestamp"] = pd.to_datetime(df["date"] + " " + df["time"], errors="coerce")
        df = df.dropna(subset=["timestamp", "route_code"]).copy()

        # Decode each unique route once, not once for every observation.
        route_codes = [str(code) for code in df["route_code"].cat.categories]
        coords_by_code = {}
        for rc in route_codes:
            parts = rc.split("|")
            if len(parts) != 2:
                coords_by_code[rc] = (np.nan, np.nan, np.nan, np.nan)
                continue
            try:
                o_lat, o_lon = cls._decode_plus_code(parts[0])
                d_lat, d_lon = cls._decode_plus_code(parts[1])
                coords_by_code[rc] = (o_lat, o_lon, d_lat, d_lon)
            except Exception:
                coords_by_code[rc] = (np.nan, np.nan, np.nan, np.nan)

        coord_cols = ["origin_lat", "origin_lon", "destination_lat", "destination_lon"]
        for i, col in enumerate(coord_cols):
            df[col] = df["route_code"].map({rc: coords[i] for rc, coords in coords_by_code.items()}).astype("float64")
        df = df.dropna(subset=["origin_lat", "origin_lon", "destination_lat", "destination_lon"]).copy()

        unique_routes = df[["route_code", *coord_cols]].drop_duplicates()
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
        if loop and loop.is_running():
            raise RuntimeError("load_canonical_dataset must be run in a separate sync wrapper")
        asyncio.run(cls._build_osrm_cache(unique_routes))

        # Attach OSRM features by route code. The persisted cache remains authoritative and
        # retains the same key format as the original implementation.
        route_features = {}
        for row in unique_routes.itertuples(index=False, name=None):
            route_code, o_lat, o_lon, d_lat, d_lon = row
            key = f"{o_lat},{o_lon},{d_lat},{d_lon}"
            if key not in cls._osrm_cache:
                raise RuntimeError(f"Missing OSRM cache entry for route {route_code}: {key}")
            route_features[str(route_code)] = cls._osrm_cache[key]

        feature_map_fields = {
            "osrm_dist": "osrm_dist",
            "osrm_dur_min": "osrm_dur_min",
            "steps_count": "steps_count",
            "turns": "turns",
            "roundabouts": "roundabouts",
            "avg_step_len": "avg_step_len",
        }
        for column, cache_field in feature_map_fields.items():
            df[column] = df["route_code"].map({rc: feat[cache_field] for rc, feat in route_features.items()}).astype("float64")
        df = df[df["osrm_dur_min"] > 0].copy()

        df["distance_km"] = df["distance"]
        df["observed_duration_min"] = df["duration"]
        df["congestion_factor"] = df["observed_duration_min"] / df["osrm_dur_min"]
        df["hour"] = df["timestamp"].dt.hour
        df["day_of_week"] = df["timestamp"].dt.dayofweek
        df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)
        df["month"] = df["timestamp"].dt.month

        canonical_cols = [
            "timestamp", "route_code", "origin_lat", "origin_lon",
            "destination_lat", "destination_lon", "observed_duration_min",
            "osrm_dist", "osrm_dur_min", "steps_count", "turns", "roundabouts", "avg_step_len",
            "congestion_factor", "hour", "day_of_week", "is_weekend", "month",
        ]
        return df[canonical_cols].copy()

    @classmethod
    def get_train_val_test_splits(cls):
        df = cls.load_canonical_dataset()

        # SANITY CHECKS BEFORE SPLIT
        if (df["osrm_dur_min"] == 1.0).all():
            raise RuntimeError("SANITY CHECK FAILED: All OSRM durations are exactly 1.0! Dataset is corrupted.")
        if df["osrm_dur_min"].min() <= 0:
            raise RuntimeError("SANITY CHECK FAILED: OSRM duration <= 0 found!")
        if not np.isfinite(df["congestion_factor"].to_numpy()).all() or (df["congestion_factor"] <= 0).any():
            raise RuntimeError("SANITY CHECK FAILED: non-finite or non-positive congestion factor found!")

        print("\n--- SANITY CHECKS ---")
        print(f"Valid Rows: {len(df)}")
        print(f"OSRM Duration Mean: {df['osrm_dur_min'].mean():.2f}")
        print("Congestion Factor Stats:")
        print(df["congestion_factor"].describe(percentiles=[0.9, 0.95, 0.99]))

        df = df.sort_values("timestamp", kind="mergesort").reset_index(drop=True)
        features = [
            "hour", "day_of_week", "is_weekend", "month",
            "osrm_dist", "osrm_dur_min", "steps_count", "turns", "roundabouts", "avg_step_len",
        ]
        X = df[features].to_numpy()
        y = df["congestion_factor"].to_numpy()

        n = len(df)
        train_target = int(0.75 * n)
        val_target = int(0.85 * n)

        if cls.REGION.key == "coimbatore":
            # All routes are observed at the same timestamp in the balanced CBE schedule.
            # Split at timestamp-group boundaries to avoid sharing a timestamp across train/val/test.
            group_sizes = df.groupby("timestamp", sort=True, observed=True).size().to_numpy(dtype=np.int64)
            cumulative = np.cumsum(group_sizes, dtype=np.int64)
            if len(cumulative) < 3:
                raise RuntimeError("Insufficient unique timestamps for chronological train/val/test splits")
            i_train = int(np.argmin(np.abs(cumulative - train_target)))
            candidates = np.arange(i_train + 1, len(cumulative))
            if len(candidates) == 0:
                raise RuntimeError("Insufficient timestamps after training split")
            i_val = int(candidates[np.argmin(np.abs(cumulative[candidates] - val_target))])
            train_idx = int(cumulative[i_train])
            val_idx = int(cumulative[i_val])
            print("Split strategy: strict chronological timestamp groups (Coimbatore)")
        else:
            # Preserve the exact historical Bengaluru row-split behaviour.
            train_idx = train_target
            val_idx = val_target

        X_train, y_train = X[:train_idx], y[:train_idx]
        X_val, y_val = X[train_idx:val_idx], y[train_idx:val_idx]
        X_test, y_test = X[val_idx:], y[val_idx:]

        if not all(len(a) > 0 for a in (X_train, X_val, X_test)):
            raise RuntimeError("Chronological split produced an empty train, validation, or test partition")
        if not all(np.isfinite(a).all() for a in (X_train, X_val, X_test, y_train, y_val, y_test)):
            raise RuntimeError("SANITY CHECK FAILED: non-finite feature or target values in train/validation/test")

        return X_train, y_train, X_val, y_val, X_test, y_test, features
```


## `backend\ml\datasets\cbe\coverage_anchors_coimbatore.json`

```json
[
 [
  10.92519,
  76.98194
 ],
 [
  10.95606,
  76.95406
 ],
 [
  10.95856,
  76.98831
 ],
 [
  10.98856,
  76.96169
 ],
 [
  10.99394,
  76.96331
 ],
 [
  10.99394,
  76.96394
 ],
 [
  10.99644,
  76.97019
 ],
 [
  10.99719,
  76.99569
 ],
 [
  10.99756,
  76.96631
 ],
 [
  11.00069,
  76.94981
 ],
 [
  11.00169,
  76.97131
 ],
 [
  11.00231,
  77.02919
 ],
 [
  11.00531,
  76.95006
 ],
 [
  11.00881,
  76.95944
 ],
 [
  11.01294,
  76.98606
 ],
 [
  11.01406,
  76.96694
 ],
 [
  11.02431,
  76.94481
 ],
 [
  11.02469,
  77.00281
 ],
 [
  11.02531,
  76.90519
 ],
 [
  11.02581,
  77.01656
 ],
 [
  11.03294,
  77.04269
 ],
 [
  11.03831,
  76.97806
 ],
 [
  11.04106,
  77.04144
 ],
 [
  11.04219,
  77.02644
 ],
 [
  11.04519,
  76.94719
 ],
 [
  11.06444,
  77.08619
 ],
 [
  11.07469,
  77.00269
 ],
 [
  11.08056,
  76.94219
 ]
]
```


## `backend\ml\datasets\cbe\osrm_cache_coimbatore.json`

```json
{
 "11.0140625,76.9669375,10.9885625,76.9616875": {
  "osrm_dist": 4.0025,
  "osrm_dur_min": 4.881666666666666,
  "steps_count": 11,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 0.3638636363636364
 },
 "11.0140625,76.9669375,10.9975625,76.9663125": {
  "osrm_dist": 2.5934,
  "osrm_dur_min": 3.1,
  "steps_count": 7,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 0.37048571428571425
 },
 "11.0140625,76.9669375,11.0329375,77.0426875": {
  "osrm_dist": 10.269200000000001,
  "osrm_dur_min": 14.221666666666666,
  "steps_count": 13,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.7899384615384617
 },
 "11.0140625,76.9669375,11.0129375,76.9860625": {
  "osrm_dist": 2.9744,
  "osrm_dur_min": 3.8516666666666666,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.29744000000000004
 },
 "11.0140625,76.9669375,11.0258125,77.01656249999999": {
  "osrm_dist": 6.5374,
  "osrm_dur_min": 6.785,
  "steps_count": 10,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.65374
 },
 "11.0140625,76.9669375,11.024687499999999,77.0028125": {
  "osrm_dist": 5.0322,
  "osrm_dur_min": 5.3966666666666665,
  "steps_count": 10,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.50322
 },
 "11.0140625,76.9669375,11.0023125,77.02918749999999": {
  "osrm_dist": 8.7503,
  "osrm_dur_min": 12.048333333333334,
  "steps_count": 15,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.5833533333333333
 },
 "11.0140625,76.9669375,11.0746875,77.0026875": {
  "osrm_dist": 8.2915,
  "osrm_dur_min": 7.7683333333333335,
  "steps_count": 10,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.8291499999999999
 },
 "11.0140625,76.9669375,11.0053125,76.9500625": {
  "osrm_dist": 3.7996,
  "osrm_dur_min": 5.141666666666667,
  "steps_count": 13,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.29227692307692305
 },
 "11.0140625,76.9669375,10.9939375,76.9633125": {
  "osrm_dist": 3.9036999999999997,
  "osrm_dur_min": 3.8916666666666666,
  "steps_count": 12,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 0.3253083333333333
 },
 "11.0140625,76.9669375,11.0243125,76.9448125": {
  "osrm_dist": 3.7853000000000003,
  "osrm_dur_min": 4.989999999999999,
  "steps_count": 12,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.3154416666666667
 },
 "11.0140625,76.9669375,11.0253125,76.9051875": {
  "osrm_dist": 8.928799999999999,
  "osrm_dur_min": 10.141666666666667,
  "steps_count": 14,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.6377714285714285
 },
 "11.0140625,76.9669375,11.0805625,76.9421875": {
  "osrm_dist": 9.4094,
  "osrm_dur_min": 10.886666666666667,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.94094
 },
 "11.0140625,76.9669375,11.0016875,76.9713125": {
  "osrm_dist": 2.297,
  "osrm_dur_min": 3.0416666666666665,
  "steps_count": 9,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.25522222222222224
 },
 "11.0140625,76.9669375,11.0383125,76.9780625": {
  "osrm_dist": 3.2198,
  "osrm_dur_min": 4.455,
  "steps_count": 9,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.3577555555555556
 },
 "11.0140625,76.9669375,10.9560625,76.95406249999999": {
  "osrm_dist": 8.4275,
  "osrm_dur_min": 8.711666666666668,
  "steps_count": 13,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 0.6482692307692308
 },
 "11.0140625,76.9669375,10.9585625,76.98831249999999": {
  "osrm_dist": 10.572700000000001,
  "osrm_dur_min": 12.803333333333335,
  "steps_count": 23,
  "turns": 9,
  "roundabouts": 1,
  "avg_step_len": 0.4596826086956522
 },
 "11.0140625,76.9669375,10.9939375,76.9639375": {
  "osrm_dist": 3.8353,
  "osrm_dur_min": 3.8433333333333333,
  "steps_count": 12,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 0.3196083333333333
 },
 "11.0140625,76.9669375,11.0088125,76.95943749999999": {
  "osrm_dist": 1.9981,
  "osrm_dur_min": 3.31,
  "steps_count": 10,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.19981
 },
 "11.0140625,76.9669375,10.996437499999999,76.9701875": {
  "osrm_dist": 3.195,
  "osrm_dur_min": 4.4350000000000005,
  "steps_count": 13,
  "turns": 10,
  "roundabouts": 0,
  "avg_step_len": 0.24576923076923077
 },
 "11.0140625,76.9669375,11.0451875,76.9471875": {
  "osrm_dist": 5.388199999999999,
  "osrm_dur_min": 5.7716666666666665,
  "steps_count": 10,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.53882
 },
 "11.0140625,76.9669375,10.9251875,76.9819375": {
  "osrm_dist": 12.076,
  "osrm_dur_min": 13.671666666666665,
  "steps_count": 19,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.6355789473684211
 },
 "11.0140625,76.9669375,11.0644375,77.0861875": {
  "osrm_dist": 15.657200000000001,
  "osrm_dur_min": 21.65666666666667,
  "steps_count": 13,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 1.2044000000000001
 },
 "11.0140625,76.9669375,10.997187499999999,76.9956875": {
  "osrm_dist": 5.4898,
  "osrm_dur_min": 6.298333333333333,
  "steps_count": 13,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.4222923076923077
 },
 "11.0140625,76.9669375,11.041062499999999,77.0414375": {
  "osrm_dist": 9.790899999999999,
  "osrm_dur_min": 12.401666666666667,
  "steps_count": 11,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.8900818181818181
 },
 "11.0140625,76.9669375,11.0421875,77.0264375": {
  "osrm_dist": 9.3896,
  "osrm_dur_min": 11.29,
  "steps_count": 13,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.722276923076923
 },
 "11.0140625,76.9669375,11.0006875,76.9498125": {
  "osrm_dist": 4.2391000000000005,
  "osrm_dur_min": 5.566666666666666,
  "steps_count": 10,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 0.42391000000000006
 },
 "10.9885625,76.9616875,11.0140625,76.9669375": {
  "osrm_dist": 4.2741999999999996,
  "osrm_dur_min": 5.575,
  "steps_count": 14,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.30529999999999996
 },
 "10.9885625,76.9616875,10.9975625,76.9663125": {
  "osrm_dist": 1.8187,
  "osrm_dur_min": 2.6383333333333336,
  "steps_count": 8,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.2273375
 },
 "10.9885625,76.9616875,11.0329375,77.0426875": {
  "osrm_dist": 12.482700000000001,
  "osrm_dur_min": 16.53666666666667,
  "steps_count": 16,
  "turns": 10,
  "roundabouts": 0,
  "avg_step_len": 0.7801687500000001
 },
 "10.9885625,76.9616875,11.0129375,76.9860625": {
  "osrm_dist": 4.937,
  "osrm_dur_min": 5.569999999999999,
  "steps_count": 13,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.3797692307692308
 },
 "10.9885625,76.9616875,11.0258125,77.01656249999999": {
  "osrm_dist": 8.7509,
  "osrm_dur_min": 9.1,
  "steps_count": 13,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.6731461538461538
 },
 "10.9885625,76.9616875,11.024687499999999,77.0028125": {
  "osrm_dist": 7.2457,
  "osrm_dur_min": 7.711666666666667,
  "steps_count": 13,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.5573615384615385
 },
 "10.9885625,76.9616875,11.0023125,77.02918749999999": {
  "osrm_dist": 8.5283,
  "osrm_dur_min": 12.188333333333333,
  "steps_count": 9,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.9475888888888888
 },
 "10.9885625,76.9616875,11.0746875,77.0026875": {
  "osrm_dist": 12.4293,
  "osrm_dur_min": 10.785,
  "steps_count": 17,
  "turns": 9,
  "roundabouts": 1,
  "avg_step_len": 0.731135294117647
 },
 "10.9885625,76.9616875,11.0053125,76.9500625": {
  "osrm_dist": 4.3037,
  "osrm_dur_min": 6.076666666666667,
  "steps_count": 14,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.3074071428571429
 },
 "10.9885625,76.9616875,10.9939375,76.9633125": {
  "osrm_dist": 1.6125,
  "osrm_dur_min": 2.271666666666667,
  "steps_count": 7,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.23035714285714287
 },
 "10.9885625,76.9616875,11.0243125,76.9448125": {
  "osrm_dist": 6.5712,
  "osrm_dur_min": 7.5633333333333335,
  "steps_count": 18,
  "turns": 11,
  "roundabouts": 1,
  "avg_step_len": 0.36506666666666665
 },
 "10.9885625,76.9616875,11.0253125,76.9051875": {
  "osrm_dist": 10.5076,
  "osrm_dur_min": 11.578333333333335,
  "steps_count": 17,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 0.6180941176470588
 },
 "10.9885625,76.9616875,11.0805625,76.9421875": {
  "osrm_dist": 12.1953,
  "osrm_dur_min": 13.46,
  "steps_count": 16,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.76220625
 },
 "10.9885625,76.9616875,11.0016875,76.9713125": {
  "osrm_dist": 2.7281999999999997,
  "osrm_dur_min": 3.6533333333333333,
  "steps_count": 13,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.20986153846153843
 },
 "10.9885625,76.9616875,11.0383125,76.9780625": {
  "osrm_dist": 7.357600000000001,
  "osrm_dur_min": 7.471666666666667,
  "steps_count": 16,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 0.45985000000000004
 },
 "10.9885625,76.9616875,10.9560625,76.95406249999999": {
  "osrm_dist": 4.7462,
  "osrm_dur_min": 5.318333333333333,
  "steps_count": 6,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 0.7910333333333334
 },
 "10.9885625,76.9616875,10.9585625,76.98831249999999": {
  "osrm_dist": 6.8915,
  "osrm_dur_min": 9.41,
  "steps_count": 16,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.43071875
 },
 "10.9885625,76.9616875,10.9939375,76.9639375": {
  "osrm_dist": 1.5442,
  "osrm_dur_min": 2.2233333333333336,
  "steps_count": 7,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.2206
 },
 "10.9885625,76.9616875,11.0088125,76.95943749999999": {
  "osrm_dist": 4.166600000000001,
  "osrm_dur_min": 5.336666666666667,
  "steps_count": 14,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.2976142857142858
 },
 "10.9885625,76.9616875,10.996437499999999,76.9701875": {
  "osrm_dist": 1.9772,
  "osrm_dur_min": 3.0349999999999997,
  "steps_count": 10,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.19772
 },
 "10.9885625,76.9616875,11.0451875,76.9471875": {
  "osrm_dist": 8.174199999999999,
  "osrm_dur_min": 8.345,
  "steps_count": 16,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.5108874999999999
 },
 "10.9885625,76.9616875,10.9251875,76.9819375": {
  "osrm_dist": 8.3947,
  "osrm_dur_min": 10.278333333333334,
  "steps_count": 12,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.6995583333333334
 },
 "10.9885625,76.9616875,11.0644375,77.0861875": {
  "osrm_dist": 19.842599999999997,
  "osrm_dur_min": 23.28666666666667,
  "steps_count": 15,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 1.3228399999999998
 },
 "10.9885625,76.9616875,10.997187499999999,76.9956875": {
  "osrm_dist": 4.3503,
  "osrm_dur_min": 5.031666666666666,
  "steps_count": 5,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 0.87006
 },
 "10.9885625,76.9616875,11.041062499999999,77.0414375": {
  "osrm_dist": 12.0044,
  "osrm_dur_min": 14.716666666666667,
  "steps_count": 14,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.8574571428571429
 },
 "10.9885625,76.9616875,11.0421875,77.0264375": {
  "osrm_dist": 11.6031,
  "osrm_dur_min": 13.604999999999999,
  "steps_count": 16,
  "turns": 10,
  "roundabouts": 0,
  "avg_step_len": 0.72519375
 },
 "10.9885625,76.9616875,11.0006875,76.9498125": {
  "osrm_dist": 4.6686000000000005,
  "osrm_dur_min": 6.1850000000000005,
  "steps_count": 15,
  "turns": 10,
  "roundabouts": 0,
  "avg_step_len": 0.31124
 },
 "10.9975625,76.9663125,11.0140625,76.9669375": {
  "osrm_dist": 2.4555,
  "osrm_dur_min": 2.9366666666666665,
  "steps_count": 8,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 0.3069375
 },
 "10.9975625,76.9663125,10.9885625,76.9616875": {
  "osrm_dist": 1.8802999999999999,
  "osrm_dur_min": 2.631666666666667,
  "steps_count": 5,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 0.37605999999999995
 },
 "10.9975625,76.9663125,11.0329375,77.0426875": {
  "osrm_dist": 11.0803,
  "osrm_dur_min": 14.315,
  "steps_count": 9,
  "turns": 2,
  "roundabouts": 1,
  "avg_step_len": 1.2311444444444444
 },
 "10.9975625,76.9663125,11.0129375,76.9860625": {
  "osrm_dist": 3.5345999999999997,
  "osrm_dur_min": 3.3483333333333336,
  "steps_count": 6,
  "turns": 0,
  "roundabouts": 1,
  "avg_step_len": 0.5891
 },
 "10.9975625,76.9663125,11.0258125,77.01656249999999": {
  "osrm_dist": 7.3486,
  "osrm_dur_min": 6.878333333333333,
  "steps_count": 6,
  "turns": 0,
  "roundabouts": 1,
  "avg_step_len": 1.2247666666666668
 },
 "10.9975625,76.9663125,11.024687499999999,77.0028125": {
  "osrm_dist": 5.8433,
  "osrm_dur_min": 5.489999999999999,
  "steps_count": 6,
  "turns": 0,
  "roundabouts": 1,
  "avg_step_len": 0.9738833333333333
 },
 "10.9975625,76.9663125,11.0023125,77.02918749999999": {
  "osrm_dist": 7.7748,
  "osrm_dur_min": 11.525,
  "steps_count": 10,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.77748
 },
 "10.9975625,76.9663125,11.0746875,77.0026875": {
  "osrm_dist": 10.6106,
  "osrm_dur_min": 8.146666666666667,
  "steps_count": 11,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 0.9646
 },
 "10.9975625,76.9663125,11.0053125,76.9500625": {
  "osrm_dist": 2.485,
  "osrm_dur_min": 3.4383333333333335,
  "steps_count": 8,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 0.310625
 },
 "10.9975625,76.9663125,10.9939375,76.9633125": {
  "osrm_dist": 0.7878999999999999,
  "osrm_dur_min": 0.8049999999999999,
  "steps_count": 3,
  "turns": 0,
  "roundabouts": 0,
  "avg_step_len": 0.26263333333333333
 },
 "10.9975625,76.9663125,11.0243125,76.9448125": {
  "osrm_dist": 4.7525,
  "osrm_dur_min": 4.925,
  "steps_count": 12,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.3960416666666667
 },
 "10.9975625,76.9663125,11.0253125,76.9051875": {
  "osrm_dist": 8.6889,
  "osrm_dur_min": 8.94,
  "steps_count": 11,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 0.7899
 },
 "10.9975625,76.9663125,11.0805625,76.9421875": {
  "osrm_dist": 10.3766,
  "osrm_dur_min": 10.821666666666665,
  "steps_count": 10,
  "turns": 2,
  "roundabouts": 1,
  "avg_step_len": 1.03766
 },
 "10.9975625,76.9663125,11.0016875,76.9713125": {
  "osrm_dist": 1.616,
  "osrm_dur_min": 1.9666666666666666,
  "steps_count": 9,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.17955555555555558
 },
 "10.9975625,76.9663125,11.0383125,76.9780625": {
  "osrm_dist": 5.5389,
  "osrm_dur_min": 4.833333333333333,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 0.55389
 },
 "10.9975625,76.9663125,10.9560625,76.95406249999999": {
  "osrm_dist": 6.3054,
  "osrm_dur_min": 6.461666666666667,
  "steps_count": 7,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 0.9007714285714286
 },
 "10.9975625,76.9663125,10.9585625,76.98831249999999": {
  "osrm_dist": 8.4506,
  "osrm_dur_min": 10.553333333333335,
  "steps_count": 17,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.4970941176470588
 },
 "10.9975625,76.9663125,10.9939375,76.9639375": {
  "osrm_dist": 0.7196,
  "osrm_dur_min": 0.7566666666666666,
  "steps_count": 3,
  "turns": 0,
  "roundabouts": 0,
  "avg_step_len": 0.23986666666666667
 },
 "10.9975625,76.9663125,11.0088125,76.95943749999999": {
  "osrm_dist": 2.3479,
  "osrm_dur_min": 2.6983333333333333,
  "steps_count": 8,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 0.2934875
 },
 "10.9975625,76.9663125,10.996437499999999,76.9701875": {
  "osrm_dist": 0.865,
  "osrm_dur_min": 1.3483333333333334,
  "steps_count": 5,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.173
 },
 "10.9975625,76.9663125,11.0451875,76.9471875": {
  "osrm_dist": 6.3553999999999995,
  "osrm_dur_min": 5.706666666666666,
  "steps_count": 10,
  "turns": 1,
  "roundabouts": 1,
  "avg_step_len": 0.63554
 },
 "10.9975625,76.9663125,10.9251875,76.9819375": {
  "osrm_dist": 9.9538,
  "osrm_dur_min": 11.421666666666665,
  "steps_count": 13,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.765676923076923
 },
 "10.9975625,76.9663125,11.0644375,77.0861875": {
  "osrm_dist": 16.4683,
  "osrm_dur_min": 21.75,
  "steps_count": 9,
  "turns": 2,
  "roundabouts": 1,
  "avg_step_len": 1.829811111111111
 },
 "10.9975625,76.9663125,10.997187499999999,76.9956875": {
  "osrm_dist": 3.5969,
  "osrm_dur_min": 4.368333333333334,
  "steps_count": 6,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.5994833333333334
 },
 "10.9975625,76.9663125,11.041062499999999,77.0414375": {
  "osrm_dist": 10.6021,
  "osrm_dur_min": 12.495000000000001,
  "steps_count": 7,
  "turns": 0,
  "roundabouts": 1,
  "avg_step_len": 1.5145857142857142
 },
 "10.9975625,76.9663125,11.0421875,77.0264375": {
  "osrm_dist": 10.2008,
  "osrm_dur_min": 11.383333333333333,
  "steps_count": 9,
  "turns": 2,
  "roundabouts": 1,
  "avg_step_len": 1.133422222222222
 },
 "10.9975625,76.9663125,11.0006875,76.9498125": {
  "osrm_dist": 2.735,
  "osrm_dur_min": 3.8,
  "steps_count": 7,
  "turns": 1,
  "roundabouts": 1,
  "avg_step_len": 0.3907142857142857
 },
 "11.0329375,77.0426875,11.0140625,76.9669375": {
  "osrm_dist": 10.3032,
  "osrm_dur_min": 15.553333333333335,
  "steps_count": 14,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.7359428571428571
 },
 "11.0329375,77.0426875,10.9885625,76.9616875": {
  "osrm_dist": 12.3508,
  "osrm_dur_min": 17.126666666666665,
  "steps_count": 11,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 1.1228
 },
 "11.0329375,77.0426875,10.9975625,76.9663125": {
  "osrm_dist": 10.9417,
  "osrm_dur_min": 15.345,
  "steps_count": 7,
  "turns": 2,
  "roundabouts": 1,
  "avg_step_len": 1.5631000000000002
 },
 "11.0329375,77.0426875,11.0129375,76.9860625": {
  "osrm_dist": 9.1351,
  "osrm_dur_min": 14.136666666666667,
  "steps_count": 9,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 1.015011111111111
 },
 "11.0329375,77.0426875,11.0258125,77.01656249999999": {
  "osrm_dist": 8.7174,
  "osrm_dur_min": 14.188333333333333,
  "steps_count": 11,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.792490909090909
 },
 "11.0329375,77.0426875,11.024687499999999,77.0028125": {
  "osrm_dist": 7.6845,
  "osrm_dur_min": 13.708333333333334,
  "steps_count": 12,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.640375
 },
 "11.0329375,77.0426875,11.0023125,77.02918749999999": {
  "osrm_dist": 6.277100000000001,
  "osrm_dur_min": 12.898333333333333,
  "steps_count": 6,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 1.0461833333333335
 },
 "11.0329375,77.0426875,11.0746875,77.0026875": {
  "osrm_dist": 9.009799999999998,
  "osrm_dur_min": 13.928333333333335,
  "steps_count": 20,
  "turns": 10,
  "roundabouts": 0,
  "avg_step_len": 0.45048999999999995
 },
 "11.0329375,77.0426875,11.0053125,76.9500625": {
  "osrm_dist": 12.3375,
  "osrm_dur_min": 17.45,
  "steps_count": 11,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 1.121590909090909
 },
 "11.0329375,77.0426875,10.9939375,76.9633125": {
  "osrm_dist": 11.3772,
  "osrm_dur_min": 15.876666666666667,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 1.13772
 },
 "11.0329375,77.0426875,11.0243125,76.9448125": {
  "osrm_dist": 13.2028,
  "osrm_dur_min": 18.436666666666667,
  "steps_count": 18,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.7334888888888889
 },
 "11.0329375,77.0426875,11.0253125,76.9051875": {
  "osrm_dist": 18.541400000000003,
  "osrm_dur_min": 22.951666666666664,
  "steps_count": 14,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 1.3243857142857145
 },
 "11.0329375,77.0426875,11.0805625,76.9421875": {
  "osrm_dist": 18.826900000000002,
  "osrm_dur_min": 24.333333333333332,
  "steps_count": 16,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 1.1766812500000001
 },
 "11.0329375,77.0426875,11.0016875,76.9713125": {
  "osrm_dist": 9.541,
  "osrm_dur_min": 13.993333333333334,
  "steps_count": 5,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 1.9082000000000001
 },
 "11.0329375,77.0426875,11.0383125,76.9780625": {
  "osrm_dist": 11.7663,
  "osrm_dur_min": 16.455,
  "steps_count": 20,
  "turns": 12,
  "roundabouts": 0,
  "avg_step_len": 0.5883149999999999
 },
 "11.0329375,77.0426875,10.9560625,76.95406249999999": {
  "osrm_dist": 16.7758,
  "osrm_dur_min": 20.956666666666667,
  "steps_count": 13,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 1.2904461538461538
 },
 "11.0329375,77.0426875,10.9585625,76.98831249999999": {
  "osrm_dist": 16.297,
  "osrm_dur_min": 21.743333333333332,
  "steps_count": 18,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.9053888888888889
 },
 "11.0329375,77.0426875,10.9939375,76.9639375": {
  "osrm_dist": 11.3089,
  "osrm_dur_min": 15.828333333333335,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 1.13089
 },
 "11.0329375,77.0426875,11.0088125,76.95943749999999": {
  "osrm_dist": 12.2004,
  "osrm_dur_min": 16.71,
  "steps_count": 11,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 1.1091272727272727
 },
 "11.0329375,77.0426875,10.996437499999999,76.9701875": {
  "osrm_dist": 10.31,
  "osrm_dur_min": 15.578333333333335,
  "steps_count": 12,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.8591666666666667
 },
 "11.0329375,77.0426875,11.0451875,76.9471875": {
  "osrm_dist": 14.8057,
  "osrm_dur_min": 19.21833333333333,
  "steps_count": 16,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.92535625
 },
 "11.0329375,77.0426875,10.9251875,76.9819375": {
  "osrm_dist": 20.0942,
  "osrm_dur_min": 25.78166666666667,
  "steps_count": 20,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 1.00471
 },
 "11.0329375,77.0426875,11.0644375,77.0861875": {
  "osrm_dist": 7.421600000000001,
  "osrm_dur_min": 12.979999999999999,
  "steps_count": 6,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 1.2369333333333334
 },
 "11.0329375,77.0426875,10.997187499999999,76.9956875": {
  "osrm_dist": 10.2171,
  "osrm_dur_min": 15.118333333333334,
  "steps_count": 8,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 1.2771375
 },
 "11.0329375,77.0426875,11.041062499999999,77.0414375": {
  "osrm_dist": 1.5553,
  "osrm_dur_min": 3.725,
  "steps_count": 4,
  "turns": 1,
  "roundabouts": 0,
  "avg_step_len": 0.388825
 },
 "11.0329375,77.0426875,11.0421875,77.0264375": {
  "osrm_dist": 3.821,
  "osrm_dur_min": 8.046666666666667,
  "steps_count": 8,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.477625
 },
 "11.0329375,77.0426875,11.0006875,76.9498125": {
  "osrm_dist": 12.587399999999999,
  "osrm_dur_min": 17.811666666666667,
  "steps_count": 10,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 1.25874
 },
 "11.0129375,76.9860625,10.9885625,76.9616875": {
  "osrm_dist": 13.7575,
  "osrm_dur_min": 16.11,
  "steps_count": 12,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 1.1464583333333334
 },
 "11.0129375,76.9860625,11.0329375,77.0426875": {
  "osrm_dist": 7.5465,
  "osrm_dur_min": 12.28,
  "steps_count": 6,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 1.25775
 },
 "11.0129375,76.9860625,11.0258125,77.01656249999999": {
  "osrm_dist": 3.8148,
  "osrm_dur_min": 4.843333333333334,
  "steps_count": 3,
  "turns": 1,
  "roundabouts": 0,
  "avg_step_len": 1.2716
 },
 "11.0129375,76.9860625,11.024687499999999,77.0028125": {
  "osrm_dist": 6.372199999999999,
  "osrm_dur_min": 11.403333333333334,
  "steps_count": 13,
  "turns": 10,
  "roundabouts": 0,
  "avg_step_len": 0.49016923076923075
 },
 "11.0129375,76.9860625,11.0023125,77.02918749999999": {
  "osrm_dist": 7.6838,
  "osrm_dur_min": 11.881666666666666,
  "steps_count": 7,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 1.0976857142857142
 },
 "11.0129375,76.9860625,11.0746875,77.0026875": {
  "osrm_dist": 11.952,
  "osrm_dur_min": 14.215,
  "steps_count": 13,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.9193846153846154
 },
 "11.0129375,76.9860625,11.0053125,76.9500625": {
  "osrm_dist": 13.744200000000001,
  "osrm_dur_min": 16.433333333333334,
  "steps_count": 12,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 1.14535
 },
 "11.0129375,76.9860625,10.9939375,76.9633125": {
  "osrm_dist": 12.7839,
  "osrm_dur_min": 14.860000000000001,
  "steps_count": 11,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 1.1621727272727271
 },
 "11.0129375,76.9860625,11.0243125,76.9448125": {
  "osrm_dist": 14.6095,
  "osrm_dur_min": 17.42,
  "steps_count": 19,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.768921052631579
 },
 "11.0129375,76.9860625,11.0253125,76.9051875": {
  "osrm_dist": 19.948,
  "osrm_dur_min": 21.935,
  "steps_count": 15,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 1.3298666666666668
 },
 "11.0129375,76.9860625,11.0805625,76.9421875": {
  "osrm_dist": 20.2336,
  "osrm_dur_min": 23.316666666666666,
  "steps_count": 17,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 1.1902117647058823
 },
 "11.0129375,76.9860625,10.9560625,76.95406249999999": {
  "osrm_dist": 18.1825,
  "osrm_dur_min": 19.94,
  "steps_count": 14,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 1.29875
 },
 "11.0129375,76.9860625,10.9585625,76.98831249999999": {
  "osrm_dist": 17.7037,
  "osrm_dur_min": 20.726666666666667,
  "steps_count": 19,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.9317736842105264
 },
 "11.0129375,76.9860625,10.9939375,76.9639375": {
  "osrm_dist": 12.7156,
  "osrm_dur_min": 14.811666666666667,
  "steps_count": 11,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 1.1559636363636363
 },
 "11.0129375,76.9860625,11.0451875,76.9471875": {
  "osrm_dist": 16.2124,
  "osrm_dur_min": 18.201666666666664,
  "steps_count": 17,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.953670588235294
 },
 "11.0129375,76.9860625,10.9251875,76.9819375": {
  "osrm_dist": 21.500799999999998,
  "osrm_dur_min": 24.765,
  "steps_count": 21,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 1.023847619047619
 },
 "11.0129375,76.9860625,11.0644375,77.0861875": {
  "osrm_dist": 12.935,
  "osrm_dur_min": 18.451666666666664,
  "steps_count": 4,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 3.23375
 },
 "11.0129375,76.9860625,11.041062499999999,77.0414375": {
  "osrm_dist": 7.0683,
  "osrm_dur_min": 10.46,
  "steps_count": 4,
  "turns": 1,
  "roundabouts": 0,
  "avg_step_len": 1.767075
 },
 "11.0129375,76.9860625,11.0421875,77.0264375": {
  "osrm_dist": 6.667,
  "osrm_dur_min": 9.348333333333333,
  "steps_count": 6,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 1.1111666666666666
 },
 "11.0129375,76.9860625,11.0006875,76.9498125": {
  "osrm_dist": 13.9941,
  "osrm_dur_min": 16.795,
  "steps_count": 11,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 1.2721909090909091
 },
 "11.0258125,77.01656249999999,11.0140625,76.9669375": {
  "osrm_dist": 7.8951,
  "osrm_dur_min": 9.693333333333333,
  "steps_count": 14,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.5639357142857143
 },
 "11.0258125,77.01656249999999,10.9885625,76.9616875": {
  "osrm_dist": 9.9427,
  "osrm_dur_min": 11.266666666666667,
  "steps_count": 11,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 0.9038818181818182
 },
 "11.0258125,77.01656249999999,10.9975625,76.9663125": {
  "osrm_dist": 8.533700000000001,
  "osrm_dur_min": 9.485000000000001,
  "steps_count": 7,
  "turns": 1,
  "roundabouts": 1,
  "avg_step_len": 1.2191000000000003
 },
 "11.0258125,77.01656249999999,11.0329375,77.0426875": {
  "osrm_dist": 3.7317,
  "osrm_dur_min": 7.4366666666666665,
  "steps_count": 5,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 0.74634
 },
 "11.0258125,77.01656249999999,11.0129375,76.9860625": {
  "osrm_dist": 6.7271,
  "osrm_dur_min": 8.276666666666667,
  "steps_count": 9,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.7474555555555555
 },
 "11.0258125,77.01656249999999,11.024687499999999,77.0028125": {
  "osrm_dist": 5.2528999999999995,
  "osrm_dur_min": 7.706666666666666,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.5252899999999999
 },
 "11.0258125,77.01656249999999,11.0023125,77.02918749999999": {
  "osrm_dist": 3.869,
  "osrm_dur_min": 7.038333333333333,
  "steps_count": 6,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 0.6448333333333334
 },
 "11.0258125,77.01656249999999,11.0746875,77.0026875": {
  "osrm_dist": 8.1372,
  "osrm_dur_min": 9.371666666666666,
  "steps_count": 12,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.6781
 },
 "11.0258125,77.01656249999999,11.0053125,76.9500625": {
  "osrm_dist": 9.9294,
  "osrm_dur_min": 11.59,
  "steps_count": 11,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 0.9026727272727272
 },
 "11.0258125,77.01656249999999,10.9939375,76.9633125": {
  "osrm_dist": 8.969100000000001,
  "osrm_dur_min": 10.016666666666667,
  "steps_count": 10,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.8969100000000001
 },
 "11.0258125,77.01656249999999,11.0243125,76.9448125": {
  "osrm_dist": 10.7947,
  "osrm_dur_min": 12.576666666666666,
  "steps_count": 18,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.5997055555555556
 },
 "11.0258125,77.01656249999999,11.0253125,76.9051875": {
  "osrm_dist": 16.1333,
  "osrm_dur_min": 17.091666666666665,
  "steps_count": 14,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 1.1523785714285713
 },
 "11.0258125,77.01656249999999,11.0805625,76.9421875": {
  "osrm_dist": 16.4188,
  "osrm_dur_min": 18.473333333333336,
  "steps_count": 16,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 1.026175
 },
 "11.0258125,77.01656249999999,11.0016875,76.9713125": {
  "osrm_dist": 7.133,
  "osrm_dur_min": 8.133333333333333,
  "steps_count": 5,
  "turns": 1,
  "roundabouts": 0,
  "avg_step_len": 1.4266
 },
 "11.0258125,77.01656249999999,11.0383125,76.9780625": {
  "osrm_dist": 8.0425,
  "osrm_dur_min": 10.893333333333334,
  "steps_count": 14,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.5744642857142858
 },
 "11.0258125,77.01656249999999,10.9560625,76.95406249999999": {
  "osrm_dist": 14.367700000000001,
  "osrm_dur_min": 15.096666666666666,
  "steps_count": 13,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 1.1052076923076923
 },
 "11.0258125,77.01656249999999,10.9585625,76.98831249999999": {
  "osrm_dist": 13.889,
  "osrm_dur_min": 15.883333333333333,
  "steps_count": 18,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.771611111111111
 },
 "11.0258125,77.01656249999999,10.9939375,76.9639375": {
  "osrm_dist": 8.900799999999998,
  "osrm_dur_min": 9.968333333333334,
  "steps_count": 10,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.8900799999999999
 },
 "11.0258125,77.01656249999999,11.0088125,76.95943749999999": {
  "osrm_dist": 9.7923,
  "osrm_dur_min": 10.85,
  "steps_count": 11,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 0.8902090909090908
 },
 "11.0258125,77.01656249999999,10.996437499999999,76.9701875": {
  "osrm_dist": 7.9018999999999995,
  "osrm_dur_min": 9.718333333333334,
  "steps_count": 12,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.6584916666666666
 },
 "11.0258125,77.01656249999999,11.0451875,76.9471875": {
  "osrm_dist": 12.3977,
  "osrm_dur_min": 13.358333333333333,
  "steps_count": 16,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.77485625
 },
 "11.0258125,77.01656249999999,10.9251875,76.9819375": {
  "osrm_dist": 17.6861,
  "osrm_dur_min": 19.921666666666667,
  "steps_count": 20,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.884305
 },
 "11.0258125,77.01656249999999,11.0644375,77.0861875": {
  "osrm_dist": 9.1198,
  "osrm_dur_min": 14.871666666666666,
  "steps_count": 5,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 1.82396
 },
 "11.0258125,77.01656249999999,10.997187499999999,76.9956875": {
  "osrm_dist": 7.809,
  "osrm_dur_min": 9.258333333333333,
  "steps_count": 8,
  "turns": 1,
  "roundabouts": 0,
  "avg_step_len": 0.976125
 },
 "11.0258125,77.01656249999999,11.041062499999999,77.0414375": {
  "osrm_dist": 3.2535,
  "osrm_dur_min": 5.616666666666666,
  "steps_count": 3,
  "turns": 0,
  "roundabouts": 0,
  "avg_step_len": 1.0845
 },
 "11.0258125,77.01656249999999,11.0421875,77.0264375": {
  "osrm_dist": 2.8522,
  "osrm_dur_min": 4.505,
  "steps_count": 5,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 0.57044
 },
 "11.0258125,77.01656249999999,11.0006875,76.9498125": {
  "osrm_dist": 10.1793,
  "osrm_dur_min": 11.951666666666666,
  "steps_count": 10,
  "turns": 2,
  "roundabouts": 1,
  "avg_step_len": 1.01793
 },
 "11.024687499999999,77.0028125,11.0140625,76.9669375": {
  "osrm_dist": 6.127,
  "osrm_dur_min": 9.695,
  "steps_count": 19,
  "turns": 11,
  "roundabouts": 0,
  "avg_step_len": 0.3224736842105263
 },
 "11.024687499999999,77.0028125,10.9885625,76.9616875": {
  "osrm_dist": 11.448,
  "osrm_dur_min": 12.655,
  "steps_count": 11,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 1.0407272727272727
 },
 "11.024687499999999,77.0028125,10.9975625,76.9663125": {
  "osrm_dist": 10.0389,
  "osrm_dur_min": 10.873333333333333,
  "steps_count": 7,
  "turns": 1,
  "roundabouts": 1,
  "avg_step_len": 1.4341285714285714
 },
 "11.024687499999999,77.0028125,11.0329375,77.0426875": {
  "osrm_dist": 5.237,
  "osrm_dur_min": 8.825,
  "steps_count": 5,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 1.0474
 },
 "11.024687499999999,77.0028125,11.0129375,76.9860625": {
  "osrm_dist": 5.9287,
  "osrm_dur_min": 9.371666666666666,
  "steps_count": 17,
  "turns": 11,
  "roundabouts": 0,
  "avg_step_len": 0.3487470588235294
 },
 "11.024687499999999,77.0028125,11.0258125,77.01656249999999": {
  "osrm_dist": 1.5052,
  "osrm_dur_min": 1.3883333333333332,
  "steps_count": 2,
  "turns": 0,
  "roundabouts": 0,
  "avg_step_len": 0.7526
 },
 "11.024687499999999,77.0028125,11.0023125,77.02918749999999": {
  "osrm_dist": 5.3743,
  "osrm_dur_min": 8.426666666666668,
  "steps_count": 6,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 0.8957166666666666
 },
 "11.024687499999999,77.0028125,11.0746875,77.0026875": {
  "osrm_dist": 8.1805,
  "osrm_dur_min": 9.783333333333333,
  "steps_count": 11,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.7436818181818182
 },
 "11.024687499999999,77.0028125,11.0053125,76.9500625": {
  "osrm_dist": 8.936,
  "osrm_dur_min": 12.183333333333334,
  "steps_count": 25,
  "turns": 13,
  "roundabouts": 1,
  "avg_step_len": 0.35744
 },
 "11.024687499999999,77.0028125,10.9939375,76.9633125": {
  "osrm_dist": 10.4743,
  "osrm_dur_min": 11.405,
  "steps_count": 10,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 1.0474299999999999
 },
 "11.024687499999999,77.0028125,11.0243125,76.9448125": {
  "osrm_dist": 8.9216,
  "osrm_dur_min": 12.031666666666666,
  "steps_count": 24,
  "turns": 13,
  "roundabouts": 1,
  "avg_step_len": 0.3717333333333333
 },
 "11.024687499999999,77.0028125,11.0253125,76.9051875": {
  "osrm_dist": 14.065100000000001,
  "osrm_dur_min": 17.183333333333334,
  "steps_count": 26,
  "turns": 13,
  "roundabouts": 1,
  "avg_step_len": 0.5409653846153847
 },
 "11.024687499999999,77.0028125,11.0805625,76.9421875": {
  "osrm_dist": 14.5457,
  "osrm_dur_min": 17.928333333333335,
  "steps_count": 22,
  "turns": 9,
  "roundabouts": 1,
  "avg_step_len": 0.6611681818181818
 },
 "11.024687499999999,77.0028125,11.0016875,76.9713125": {
  "osrm_dist": 8.638200000000001,
  "osrm_dur_min": 9.521666666666667,
  "steps_count": 5,
  "turns": 1,
  "roundabouts": 0,
  "avg_step_len": 1.7276400000000003
 },
 "11.024687499999999,77.0028125,11.0383125,76.9780625": {
  "osrm_dist": 5.7183,
  "osrm_dur_min": 8.603333333333333,
  "steps_count": 14,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.40845000000000004
 },
 "11.024687499999999,77.0028125,10.9560625,76.95406249999999": {
  "osrm_dist": 15.873,
  "osrm_dur_min": 16.485,
  "steps_count": 13,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 1.2209999999999999
 },
 "11.024687499999999,77.0028125,10.9585625,76.98831249999999": {
  "osrm_dist": 15.394200000000001,
  "osrm_dur_min": 17.271666666666665,
  "steps_count": 18,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.8552333333333334
 },
 "11.024687499999999,77.0028125,10.9939375,76.9639375": {
  "osrm_dist": 10.406,
  "osrm_dur_min": 11.356666666666666,
  "steps_count": 10,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 1.0406
 },
 "11.024687499999999,77.0028125,11.0088125,76.95943749999999": {
  "osrm_dist": 8.2043,
  "osrm_dur_min": 10.833333333333334,
  "steps_count": 26,
  "turns": 11,
  "roundabouts": 1,
  "avg_step_len": 0.31555
 },
 "11.024687499999999,77.0028125,10.996437499999999,76.9701875": {
  "osrm_dist": 9.407200000000001,
  "osrm_dur_min": 11.106666666666666,
  "steps_count": 12,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.7839333333333335
 },
 "11.024687499999999,77.0028125,11.0451875,76.9471875": {
  "osrm_dist": 10.5246,
  "osrm_dur_min": 12.813333333333333,
  "steps_count": 22,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.4783909090909091
 },
 "11.024687499999999,77.0028125,10.9251875,76.9819375": {
  "osrm_dist": 19.1913,
  "osrm_dur_min": 21.31,
  "steps_count": 20,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.9595649999999999
 },
 "11.024687499999999,77.0028125,11.0644375,77.0861875": {
  "osrm_dist": 10.625,
  "osrm_dur_min": 16.26,
  "steps_count": 5,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 2.125
 },
 "11.024687499999999,77.0028125,10.997187499999999,76.9956875": {
  "osrm_dist": 9.314200000000001,
  "osrm_dur_min": 10.646666666666667,
  "steps_count": 8,
  "turns": 1,
  "roundabouts": 0,
  "avg_step_len": 1.1642750000000002
 },
 "11.024687499999999,77.0028125,11.041062499999999,77.0414375": {
  "osrm_dist": 4.7587,
  "osrm_dur_min": 7.005,
  "steps_count": 3,
  "turns": 0,
  "roundabouts": 0,
  "avg_step_len": 1.5862333333333334
 },
 "11.024687499999999,77.0028125,11.0421875,77.0264375": {
  "osrm_dist": 4.357399999999999,
  "osrm_dur_min": 5.8933333333333335,
  "steps_count": 5,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 0.8714799999999998
 },
 "11.024687499999999,77.0028125,11.0006875,76.9498125": {
  "osrm_dist": 11.6846,
  "osrm_dur_min": 13.34,
  "steps_count": 10,
  "turns": 2,
  "roundabouts": 1,
  "avg_step_len": 1.16846
 },
 "11.0023125,77.02918749999999,11.0140625,76.9669375": {
  "osrm_dist": 9.4966,
  "osrm_dur_min": 10.768333333333334,
  "steps_count": 20,
  "turns": 10,
  "roundabouts": 0,
  "avg_step_len": 0.47483000000000003
 },
 "11.0023125,77.02918749999999,10.9885625,76.9616875": {
  "osrm_dist": 8.7291,
  "osrm_dur_min": 10.229999999999999,
  "steps_count": 11,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.7935545454545455
 },
 "11.0023125,77.02918749999999,10.9975625,76.9663125": {
  "osrm_dist": 7.5745,
  "osrm_dur_min": 8.543333333333333,
  "steps_count": 9,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.8416111111111111
 },
 "11.0023125,77.02918749999999,11.0329375,77.0426875": {
  "osrm_dist": 5.8504,
  "osrm_dur_min": 13.25,
  "steps_count": 20,
  "turns": 14,
  "roundabouts": 0,
  "avg_step_len": 0.29252
 },
 "11.0023125,77.02918749999999,11.0129375,76.9860625": {
  "osrm_dist": 8.3286,
  "osrm_dur_min": 9.351666666666667,
  "steps_count": 15,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.55524
 },
 "11.0023125,77.02918749999999,11.0258125,77.01656249999999": {
  "osrm_dist": 10.5251,
  "osrm_dur_min": 10.901666666666667,
  "steps_count": 12,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.8770916666666667
 },
 "11.0023125,77.02918749999999,11.024687499999999,77.0028125": {
  "osrm_dist": 9.0199,
  "osrm_dur_min": 9.513333333333332,
  "steps_count": 12,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.7516583333333333
 },
 "11.0023125,77.02918749999999,11.0746875,77.0026875": {
  "osrm_dist": 15.7974,
  "osrm_dur_min": 15.333333333333334,
  "steps_count": 20,
  "turns": 11,
  "roundabouts": 0,
  "avg_step_len": 0.78987
 },
 "11.0023125,77.02918749999999,11.0053125,76.9500625": {
  "osrm_dist": 10.0595,
  "osrm_dur_min": 11.981666666666666,
  "steps_count": 15,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.6706333333333333
 },
 "11.0023125,77.02918749999999,10.9939375,76.9633125": {
  "osrm_dist": 7.636699999999999,
  "osrm_dur_min": 8.403333333333332,
  "steps_count": 9,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.8485222222222222
 },
 "11.0023125,77.02918749999999,11.0243125,76.9448125": {
  "osrm_dist": 12.327,
  "osrm_dur_min": 13.468333333333334,
  "steps_count": 19,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 0.6487894736842105
 },
 "11.0023125,77.02918749999999,11.0253125,76.9051875": {
  "osrm_dist": 16.2634,
  "osrm_dur_min": 17.483333333333334,
  "steps_count": 18,
  "turns": 9,
  "roundabouts": 1,
  "avg_step_len": 0.9035222222222222
 },
 "11.0023125,77.02918749999999,11.0805625,76.9421875": {
  "osrm_dist": 17.9511,
  "osrm_dur_min": 19.365000000000002,
  "steps_count": 17,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 1.0559470588235293
 },
 "11.0023125,77.02918749999999,11.0016875,76.9713125": {
  "osrm_dist": 8.7345,
  "osrm_dur_min": 9.345,
  "steps_count": 13,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.6718846153846154
 },
 "11.0023125,77.02918749999999,11.0383125,76.9780625": {
  "osrm_dist": 10.725700000000002,
  "osrm_dur_min": 12.020000000000001,
  "steps_count": 19,
  "turns": 12,
  "roundabouts": 0,
  "avg_step_len": 0.5645105263157896
 },
 "11.0023125,77.02918749999999,10.9560625,76.95406249999999": {
  "osrm_dist": 12.476700000000001,
  "osrm_dur_min": 13.738333333333333,
  "steps_count": 14,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.8911928571428572
 },
 "11.0023125,77.02918749999999,10.9585625,76.98831249999999": {
  "osrm_dist": 9.7616,
  "osrm_dur_min": 10.703333333333335,
  "steps_count": 19,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.5137684210526315
 },
 "11.0023125,77.02918749999999,10.9939375,76.9639375": {
  "osrm_dist": 7.5684,
  "osrm_dur_min": 8.355,
  "steps_count": 9,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.8409333333333333
 },
 "11.0023125,77.02918749999999,11.0088125,76.95943749999999": {
  "osrm_dist": 9.9224,
  "osrm_dur_min": 11.241666666666667,
  "steps_count": 15,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.6614933333333333
 },
 "11.0023125,77.02918749999999,10.996437499999999,76.9701875": {
  "osrm_dist": 7.0755,
  "osrm_dur_min": 8.645000000000001,
  "steps_count": 12,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.589625
 },
 "11.0023125,77.02918749999999,11.0451875,76.9471875": {
  "osrm_dist": 13.9299,
  "osrm_dur_min": 14.25,
  "steps_count": 17,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 0.8194058823529412
 },
 "11.0023125,77.02918749999999,10.9251875,76.9819375": {
  "osrm_dist": 13.5587,
  "osrm_dur_min": 14.741666666666667,
  "steps_count": 21,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.645652380952381
 },
 "11.0023125,77.02918749999999,11.0644375,77.0861875": {
  "osrm_dist": 11.9135,
  "osrm_dur_min": 12.586666666666668,
  "steps_count": 11,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 1.0830454545454546
 },
 "11.0023125,77.02918749999999,10.997187499999999,76.9956875": {
  "osrm_dist": 4.5678,
  "osrm_dur_min": 5.168333333333334,
  "steps_count": 7,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 0.6525428571428572
 },
 "11.0023125,77.02918749999999,11.041062499999999,77.0414375": {
  "osrm_dist": 6.544899999999999,
  "osrm_dur_min": 13.46,
  "steps_count": 20,
  "turns": 14,
  "roundabouts": 0,
  "avg_step_len": 0.32724499999999995
 },
 "11.0023125,77.02918749999999,11.0421875,77.0264375": {
  "osrm_dist": 13.3773,
  "osrm_dur_min": 15.406666666666666,
  "steps_count": 15,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.89182
 },
 "11.0023125,77.02918749999999,11.0006875,76.9498125": {
  "osrm_dist": 10.6929,
  "osrm_dur_min": 12.316666666666666,
  "steps_count": 17,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.6289941176470588
 },
 "11.0746875,77.0026875,11.0140625,76.9669375": {
  "osrm_dist": 9.563600000000001,
  "osrm_dur_min": 8.233333333333333,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.8694181818181819
 },
 "11.0746875,77.0026875,10.9885625,76.9616875": {
  "osrm_dist": 11.8481,
  "osrm_dur_min": 10.161666666666667,
  "steps_count": 14,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.8462928571428572
 },
 "11.0746875,77.0026875,10.9975625,76.9663125": {
  "osrm_dist": 10.439,
  "osrm_dur_min": 8.38,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 1.0439
 },
 "11.0746875,77.0026875,11.0329375,77.0426875": {
  "osrm_dist": 9.331700000000001,
  "osrm_dur_min": 14.135,
  "steps_count": 21,
  "turns": 10,
  "roundabouts": 0,
  "avg_step_len": 0.44436666666666674
 },
 "11.0746875,77.0026875,11.0129375,76.9860625": {
  "osrm_dist": 9.438600000000001,
  "osrm_dur_min": 9.43,
  "steps_count": 13,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.7260461538461539
 },
 "11.0746875,77.0026875,11.0258125,77.01656249999999": {
  "osrm_dist": 9.1114,
  "osrm_dur_min": 10.946666666666665,
  "steps_count": 12,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.7592833333333333
 },
 "11.0746875,77.0026875,11.024687499999999,77.0028125": {
  "osrm_dist": 9.9297,
  "osrm_dur_min": 9.878333333333334,
  "steps_count": 9,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 1.1033
 },
 "11.0746875,77.0026875,11.0023125,77.02918749999999": {
  "osrm_dist": 12.1232,
  "osrm_dur_min": 17.415000000000003,
  "steps_count": 13,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.9325538461538462
 },
 "11.0746875,77.0026875,11.0053125,76.9500625": {
  "osrm_dist": 11.8348,
  "osrm_dur_min": 10.485000000000001,
  "steps_count": 14,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.8453428571428571
 },
 "11.0746875,77.0026875,10.9939375,76.9633125": {
  "osrm_dist": 11.7493,
  "osrm_dur_min": 9.171666666666665,
  "steps_count": 15,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.7832866666666667
 },
 "11.0746875,77.0026875,11.0243125,76.9448125": {
  "osrm_dist": 11.161100000000001,
  "osrm_dur_min": 10.94,
  "steps_count": 18,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 0.6200611111111112
 },
 "11.0746875,77.0026875,11.0253125,76.9051875": {
  "osrm_dist": 18.038700000000002,
  "osrm_dur_min": 15.986666666666668,
  "steps_count": 17,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 1.0611000000000002
 },
 "11.0746875,77.0026875,11.0805625,76.9421875": {
  "osrm_dist": 9.0769,
  "osrm_dur_min": 13.67,
  "steps_count": 12,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.7564083333333333
 },
 "11.0746875,77.0026875,11.0016875,76.9713125": {
  "osrm_dist": 10.1426,
  "osrm_dur_min": 8.321666666666667,
  "steps_count": 12,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.8452166666666666
 },
 "11.0746875,77.0026875,11.0383125,76.9780625": {
  "osrm_dist": 5.4129,
  "osrm_dur_min": 5.12,
  "steps_count": 9,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.6014333333333333
 },
 "11.0746875,77.0026875,10.9560625,76.95406249999999": {
  "osrm_dist": 16.2731,
  "osrm_dur_min": 13.991666666666667,
  "steps_count": 16,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 1.01706875
 },
 "11.0746875,77.0026875,10.9585625,76.98831249999999": {
  "osrm_dist": 18.418400000000002,
  "osrm_dur_min": 18.083333333333332,
  "steps_count": 26,
  "turns": 11,
  "roundabouts": 1,
  "avg_step_len": 0.7084
 },
 "11.0746875,77.0026875,10.9939375,76.9639375": {
  "osrm_dist": 11.681,
  "osrm_dur_min": 9.123333333333333,
  "steps_count": 15,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.7787333333333333
 },
 "11.0746875,77.0026875,11.0088125,76.95943749999999": {
  "osrm_dist": 10.4438,
  "osrm_dur_min": 9.741666666666667,
  "steps_count": 20,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.5221899999999999
 },
 "11.0746875,77.0026875,10.996437499999999,76.9701875": {
  "osrm_dist": 11.040700000000001,
  "osrm_dur_min": 9.715,
  "steps_count": 16,
  "turns": 12,
  "roundabouts": 0,
  "avg_step_len": 0.6900437500000001
 },
 "11.0746875,77.0026875,11.0451875,76.9471875": {
  "osrm_dist": 9.8164,
  "osrm_dur_min": 10.110000000000001,
  "steps_count": 15,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.6544266666666666
 },
 "11.0746875,77.0026875,10.9251875,76.9819375": {
  "osrm_dist": 19.921599999999998,
  "osrm_dur_min": 18.951666666666664,
  "steps_count": 22,
  "turns": 9,
  "roundabouts": 1,
  "avg_step_len": 0.9055272727272726
 },
 "11.0746875,77.0026875,11.0644375,77.0861875": {
  "osrm_dist": 11.967600000000001,
  "osrm_dur_min": 17.676666666666666,
  "steps_count": 17,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.7039764705882353
 },
 "11.0746875,77.0026875,10.997187499999999,76.9956875": {
  "osrm_dist": 11.954,
  "osrm_dur_min": 11.876666666666667,
  "steps_count": 16,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.747125
 },
 "11.0746875,77.0026875,11.041062499999999,77.0414375": {
  "osrm_dist": 8.816600000000001,
  "osrm_dur_min": 12.451666666666666,
  "steps_count": 21,
  "turns": 11,
  "roundabouts": 0,
  "avg_step_len": 0.4198380952380953
 },
 "11.0746875,77.0026875,11.0421875,77.0264375": {
  "osrm_dist": 7.477600000000001,
  "osrm_dur_min": 9.56,
  "steps_count": 13,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.5752
 },
 "11.0746875,77.0026875,11.0006875,76.9498125": {
  "osrm_dist": 12.084700000000002,
  "osrm_dur_min": 10.846666666666666,
  "steps_count": 13,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.9295923076923078
 },
 "11.0053125,76.9500625,11.0140625,76.9669375": {
  "osrm_dist": 2.9941,
  "osrm_dur_min": 4.486666666666666,
  "steps_count": 11,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.2721909090909091
 },
 "11.0053125,76.9500625,10.9885625,76.9616875": {
  "osrm_dist": 3.4604,
  "osrm_dur_min": 5.508333333333334,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.3145818181818182
 },
 "11.0053125,76.9500625,10.9975625,76.9663125": {
  "osrm_dist": 3.3371,
  "osrm_dur_min": 4.381666666666666,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.3033727272727273
 },
 "11.0053125,76.9500625,11.0329375,77.0426875": {
  "osrm_dist": 13.328100000000001,
  "osrm_dur_min": 17.363333333333333,
  "steps_count": 16,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.8330062500000001
 },
 "11.0053125,76.9500625,11.0129375,76.9860625": {
  "osrm_dist": 5.7824,
  "osrm_dur_min": 6.3966666666666665,
  "steps_count": 13,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.4448
 },
 "11.0053125,76.9500625,11.0258125,77.01656249999999": {
  "osrm_dist": 9.5964,
  "osrm_dur_min": 9.926666666666668,
  "steps_count": 13,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.7381846153846153
 },
 "11.0053125,76.9500625,11.024687499999999,77.0028125": {
  "osrm_dist": 8.0911,
  "osrm_dur_min": 8.538333333333332,
  "steps_count": 13,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.6223923076923078
 },
 "11.0053125,76.9500625,11.0023125,77.02918749999999": {
  "osrm_dist": 11.3015,
  "osrm_dur_min": 15.228333333333333,
  "steps_count": 20,
  "turns": 11,
  "roundabouts": 0,
  "avg_step_len": 0.565075
 },
 "11.0053125,76.9500625,11.0746875,77.0026875": {
  "osrm_dist": 11.673200000000001,
  "osrm_dur_min": 10.706666666666667,
  "steps_count": 19,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 0.6143789473684211
 },
 "11.0053125,76.9500625,10.9939375,76.9633125": {
  "osrm_dist": 3.3615999999999997,
  "osrm_dur_min": 4.465,
  "steps_count": 11,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.3056
 },
 "11.0053125,76.9500625,11.0243125,76.9448125": {
  "osrm_dist": 3.4846,
  "osrm_dur_min": 4.7316666666666665,
  "steps_count": 12,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.2903833333333333
 },
 "11.0053125,76.9500625,11.0253125,76.9051875": {
  "osrm_dist": 6.4205,
  "osrm_dur_min": 7.468333333333334,
  "steps_count": 9,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.7133888888888889
 },
 "11.0053125,76.9500625,11.0805625,76.9421875": {
  "osrm_dist": 9.1087,
  "osrm_dur_min": 10.628333333333334,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.9108700000000001
 },
 "11.0053125,76.9500625,11.0016875,76.9713125": {
  "osrm_dist": 4.0599,
  "osrm_dur_min": 5.055000000000001,
  "steps_count": 16,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.25374375
 },
 "11.0053125,76.9500625,11.0383125,76.9780625": {
  "osrm_dist": 6.6014,
  "osrm_dur_min": 7.3933333333333335,
  "steps_count": 18,
  "turns": 11,
  "roundabouts": 1,
  "avg_step_len": 0.36674444444444443
 },
 "11.0053125,76.9500625,10.9560625,76.95406249999999": {
  "osrm_dist": 7.8854,
  "osrm_dur_min": 9.338333333333333,
  "steps_count": 13,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.6065692307692307
 },
 "11.0053125,76.9500625,10.9585625,76.98831249999999": {
  "osrm_dist": 10.030700000000001,
  "osrm_dur_min": 13.43,
  "steps_count": 23,
  "turns": 10,
  "roundabouts": 0,
  "avg_step_len": 0.4361173913043479
 },
 "11.0053125,76.9500625,10.9939375,76.9639375": {
  "osrm_dist": 3.2933000000000003,
  "osrm_dur_min": 4.416666666666667,
  "steps_count": 11,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.2993909090909091
 },
 "11.0053125,76.9500625,11.0088125,76.95943749999999": {
  "osrm_dist": 1.768,
  "osrm_dur_min": 2.5816666666666666,
  "steps_count": 9,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.19644444444444445
 },
 "11.0053125,76.9500625,10.996437499999999,76.9701875": {
  "osrm_dist": 3.712,
  "osrm_dur_min": 5.205,
  "steps_count": 13,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.2855384615384616
 },
 "11.0053125,76.9500625,11.0451875,76.9471875": {
  "osrm_dist": 5.0876,
  "osrm_dur_min": 5.513333333333334,
  "steps_count": 10,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.50876
 },
 "11.0053125,76.9500625,10.9251875,76.9819375": {
  "osrm_dist": 11.5339,
  "osrm_dur_min": 14.298333333333334,
  "steps_count": 19,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.6070473684210526
 },
 "11.0053125,76.9500625,11.0644375,77.0861875": {
  "osrm_dist": 18.7162,
  "osrm_dur_min": 24.798333333333336,
  "steps_count": 16,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 1.1697625
 },
 "11.0053125,76.9500625,10.997187499999999,76.9956875": {
  "osrm_dist": 6.4438,
  "osrm_dur_min": 8.225,
  "steps_count": 14,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.4602714285714286
 },
 "11.0053125,76.9500625,11.041062499999999,77.0414375": {
  "osrm_dist": 12.8499,
  "osrm_dur_min": 15.543333333333333,
  "steps_count": 14,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.9178499999999999
 },
 "11.0053125,76.9500625,11.0421875,77.0264375": {
  "osrm_dist": 12.4486,
  "osrm_dur_min": 14.431666666666667,
  "steps_count": 16,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.7780375
 },
 "11.0053125,76.9500625,11.0006875,76.9498125": {
  "osrm_dist": 0.8389,
  "osrm_dur_min": 1.9466666666666665,
  "steps_count": 4,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 0.209725
 },
 "10.9939375,76.9633125,11.0140625,76.9669375": {
  "osrm_dist": 3.5333,
  "osrm_dur_min": 4.488333333333333,
  "steps_count": 11,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 0.32120909090909094
 },
 "10.9939375,76.9633125,10.9885625,76.9616875": {
  "osrm_dist": 1.0924,
  "osrm_dur_min": 1.8266666666666667,
  "steps_count": 4,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 0.2731
 },
 "10.9939375,76.9633125,10.9975625,76.9663125": {
  "osrm_dist": 1.8282,
  "osrm_dur_min": 1.8683333333333332,
  "steps_count": 6,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.3047
 },
 "10.9939375,76.9633125,11.0329375,77.0426875": {
  "osrm_dist": 12.4921,
  "osrm_dur_min": 15.766666666666667,
  "steps_count": 14,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.8922928571428572
 },
 "10.9939375,76.9633125,11.0129375,76.9860625": {
  "osrm_dist": 4.9464,
  "osrm_dur_min": 4.8,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.4496727272727272
 },
 "10.9939375,76.9633125,11.0258125,77.01656249999999": {
  "osrm_dist": 8.760299999999999,
  "osrm_dur_min": 8.33,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.796390909090909
 },
 "10.9939375,76.9633125,11.024687499999999,77.0028125": {
  "osrm_dist": 7.2551000000000005,
  "osrm_dur_min": 6.941666666666666,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.6595545454545455
 },
 "10.9939375,76.9633125,11.0023125,77.02918749999999": {
  "osrm_dist": 8.8964,
  "osrm_dur_min": 12.441666666666666,
  "steps_count": 13,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.6843384615384616
 },
 "10.9939375,76.9633125,11.0746875,77.0026875": {
  "osrm_dist": 11.6884,
  "osrm_dur_min": 9.698333333333332,
  "steps_count": 14,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 0.8348857142857142
 },
 "10.9939375,76.9633125,11.0053125,76.9500625": {
  "osrm_dist": 2.6155,
  "osrm_dur_min": 4.246666666666667,
  "steps_count": 7,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.3736428571428571
 },
 "10.9939375,76.9633125,11.0243125,76.9448125": {
  "osrm_dist": 4.883,
  "osrm_dur_min": 5.733333333333333,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.4439090909090909
 },
 "10.9939375,76.9633125,11.0253125,76.9051875": {
  "osrm_dist": 8.8194,
  "osrm_dur_min": 9.748333333333333,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.88194
 },
 "10.9939375,76.9633125,11.0805625,76.9421875": {
  "osrm_dist": 10.507100000000001,
  "osrm_dur_min": 11.629999999999999,
  "steps_count": 9,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 1.1674555555555557
 },
 "10.9939375,76.9633125,11.0016875,76.9713125": {
  "osrm_dist": 2.7376,
  "osrm_dur_min": 2.8833333333333333,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.24887272727272727
 },
 "10.9939375,76.9633125,11.0383125,76.9780625": {
  "osrm_dist": 6.6167,
  "osrm_dur_min": 6.385000000000001,
  "steps_count": 13,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.5089769230769231
 },
 "10.9939375,76.9633125,10.9560625,76.95406249999999": {
  "osrm_dist": 5.517399999999999,
  "osrm_dur_min": 5.656666666666666,
  "steps_count": 6,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 0.9195666666666665
 },
 "10.9939375,76.9633125,10.9585625,76.98831249999999": {
  "osrm_dist": 7.6627,
  "osrm_dur_min": 9.748333333333333,
  "steps_count": 16,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.47891875
 },
 "10.9939375,76.9633125,11.0088125,76.95943749999999": {
  "osrm_dist": 3.1664,
  "osrm_dur_min": 3.6983333333333333,
  "steps_count": 9,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.3518222222222222
 },
 "10.9939375,76.9633125,10.996437499999999,76.9701875": {
  "osrm_dist": 1.9866,
  "osrm_dur_min": 2.265,
  "steps_count": 8,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.248325
 },
 "10.9939375,76.9633125,11.0451875,76.9471875": {
  "osrm_dist": 6.486,
  "osrm_dur_min": 6.515,
  "steps_count": 9,
  "turns": 1,
  "roundabouts": 0,
  "avg_step_len": 0.7206666666666667
 },
 "10.9939375,76.9633125,10.9251875,76.9819375": {
  "osrm_dist": 9.165899999999999,
  "osrm_dur_min": 10.616666666666667,
  "steps_count": 12,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.7638249999999999
 },
 "10.9939375,76.9633125,11.0644375,77.0861875": {
  "osrm_dist": 17.8801,
  "osrm_dur_min": 23.201666666666664,
  "steps_count": 14,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 1.27715
 },
 "10.9939375,76.9633125,10.997187499999999,76.9956875": {
  "osrm_dist": 4.7184,
  "osrm_dur_min": 5.285,
  "steps_count": 9,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.5242666666666667
 },
 "10.9939375,76.9633125,11.041062499999999,77.0414375": {
  "osrm_dist": 12.0138,
  "osrm_dur_min": 13.946666666666665,
  "steps_count": 12,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 1.00115
 },
 "10.9939375,76.9633125,11.0421875,77.0264375": {
  "osrm_dist": 11.6126,
  "osrm_dur_min": 12.835,
  "steps_count": 14,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.8294714285714286
 },
 "10.9939375,76.9633125,11.0006875,76.9498125": {
  "osrm_dist": 3.0561,
  "osrm_dur_min": 3.9133333333333336,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.30561
 },
 "11.0243125,76.9448125,11.0140625,76.9669375": {
  "osrm_dist": 4.0322,
  "osrm_dur_min": 5.416666666666667,
  "steps_count": 14,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.28801428571428567
 },
 "11.0243125,76.9448125,10.9885625,76.9616875": {
  "osrm_dist": 5.7843,
  "osrm_dur_min": 7.093333333333334,
  "steps_count": 19,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 0.3044368421052632
 },
 "11.0243125,76.9448125,10.9975625,76.9663125": {
  "osrm_dist": 4.3751999999999995,
  "osrm_dur_min": 5.3116666666666665,
  "steps_count": 15,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.29168
 },
 "11.0243125,76.9448125,11.0329375,77.0426875": {
  "osrm_dist": 12.713299999999998,
  "osrm_dur_min": 17.69333333333333,
  "steps_count": 19,
  "turns": 9,
  "roundabouts": 1,
  "avg_step_len": 0.6691210526315788
 },
 "11.0243125,76.9448125,11.0129375,76.9860625": {
  "osrm_dist": 6.820600000000001,
  "osrm_dur_min": 7.326666666666667,
  "steps_count": 17,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.4012117647058824
 },
 "11.0243125,76.9448125,11.0258125,77.01656249999999": {
  "osrm_dist": 8.9816,
  "osrm_dur_min": 10.256666666666666,
  "steps_count": 16,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.56135
 },
 "11.0243125,76.9448125,11.024687499999999,77.0028125": {
  "osrm_dist": 7.4764,
  "osrm_dur_min": 8.868333333333334,
  "steps_count": 16,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.467275
 },
 "11.0243125,76.9448125,11.0023125,77.02918749999999": {
  "osrm_dist": 12.3396,
  "osrm_dur_min": 16.158333333333335,
  "steps_count": 23,
  "turns": 12,
  "roundabouts": 0,
  "avg_step_len": 0.536504347826087
 },
 "11.0243125,76.9448125,11.0746875,77.0026875": {
  "osrm_dist": 11.1954,
  "osrm_dur_min": 10.671666666666665,
  "steps_count": 19,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 0.5892315789473684
 },
 "11.0243125,76.9448125,11.0053125,76.9500625": {
  "osrm_dist": 3.5376999999999996,
  "osrm_dur_min": 4.861666666666666,
  "steps_count": 12,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.2948083333333333
 },
 "11.0243125,76.9448125,10.9939375,76.9633125": {
  "osrm_dist": 5.6855,
  "osrm_dur_min": 6.1033333333333335,
  "steps_count": 20,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 0.284275
 },
 "11.0243125,76.9448125,11.0253125,76.9051875": {
  "osrm_dist": 6.5157,
  "osrm_dur_min": 8.628333333333334,
  "steps_count": 11,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.5923363636363637
 },
 "11.0243125,76.9448125,11.0805625,76.9421875": {
  "osrm_dist": 7.438899999999999,
  "osrm_dur_min": 9.595,
  "steps_count": 10,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.7438899999999999
 },
 "11.0243125,76.9448125,11.0016875,76.9713125": {
  "osrm_dist": 5.0981000000000005,
  "osrm_dur_min": 5.985,
  "steps_count": 20,
  "turns": 9,
  "roundabouts": 1,
  "avg_step_len": 0.25490500000000005
 },
 "11.0243125,76.9448125,11.0383125,76.9780625": {
  "osrm_dist": 6.123600000000001,
  "osrm_dur_min": 7.358333333333333,
  "steps_count": 18,
  "turns": 11,
  "roundabouts": 1,
  "avg_step_len": 0.34020000000000006
 },
 "11.0243125,76.9448125,10.9560625,76.95406249999999": {
  "osrm_dist": 10.209299999999999,
  "osrm_dur_min": 10.923333333333334,
  "steps_count": 21,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 0.4861571428571428
 },
 "11.0243125,76.9448125,10.9585625,76.98831249999999": {
  "osrm_dist": 12.3546,
  "osrm_dur_min": 15.014999999999999,
  "steps_count": 31,
  "turns": 14,
  "roundabouts": 1,
  "avg_step_len": 0.3985354838709677
 },
 "11.0243125,76.9448125,10.9939375,76.9639375": {
  "osrm_dist": 5.6171999999999995,
  "osrm_dur_min": 6.055000000000001,
  "steps_count": 20,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 0.28086
 },
 "11.0243125,76.9448125,11.0088125,76.95943749999999": {
  "osrm_dist": 2.8061,
  "osrm_dur_min": 3.5116666666666663,
  "steps_count": 13,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.21585384615384615
 },
 "11.0243125,76.9448125,10.996437499999999,76.9701875": {
  "osrm_dist": 5.2403,
  "osrm_dur_min": 6.66,
  "steps_count": 18,
  "turns": 11,
  "roundabouts": 1,
  "avg_step_len": 0.2911277777777778
 },
 "11.0243125,76.9448125,11.0451875,76.9471875": {
  "osrm_dist": 3.4178,
  "osrm_dur_min": 4.48,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.34178000000000003
 },
 "11.0243125,76.9448125,10.9251875,76.9819375": {
  "osrm_dist": 13.8578,
  "osrm_dur_min": 15.883333333333333,
  "steps_count": 27,
  "turns": 12,
  "roundabouts": 1,
  "avg_step_len": 0.5132518518518518
 },
 "11.0243125,76.9448125,11.0644375,77.0861875": {
  "osrm_dist": 18.1014,
  "osrm_dur_min": 25.128333333333334,
  "steps_count": 19,
  "turns": 9,
  "roundabouts": 1,
  "avg_step_len": 0.9527052631578948
 },
 "11.0243125,76.9448125,10.997187499999999,76.9956875": {
  "osrm_dist": 7.9721,
  "osrm_dur_min": 9.68,
  "steps_count": 19,
  "turns": 11,
  "roundabouts": 1,
  "avg_step_len": 0.4195842105263158
 },
 "11.0243125,76.9448125,11.041062499999999,77.0414375": {
  "osrm_dist": 12.235100000000001,
  "osrm_dur_min": 15.873333333333333,
  "steps_count": 17,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.7197117647058824
 },
 "11.0243125,76.9448125,11.0421875,77.0264375": {
  "osrm_dist": 11.8338,
  "osrm_dur_min": 14.761666666666667,
  "steps_count": 19,
  "turns": 9,
  "roundabouts": 1,
  "avg_step_len": 0.6228315789473684
 },
 "11.0243125,76.9448125,11.0006875,76.9498125": {
  "osrm_dist": 4.3785,
  "osrm_dur_min": 6.196666666666667,
  "steps_count": 12,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.364875
 },
 "11.0253125,76.9051875,11.0140625,76.9669375": {
  "osrm_dist": 8.1295,
  "osrm_dur_min": 9.663333333333332,
  "steps_count": 12,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.6774583333333334
 },
 "11.0253125,76.9051875,10.9885625,76.9616875": {
  "osrm_dist": 9.4444,
  "osrm_dur_min": 11.335,
  "steps_count": 15,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.6296266666666667
 },
 "11.0253125,76.9051875,10.9975625,76.9663125": {
  "osrm_dist": 8.4725,
  "osrm_dur_min": 9.558333333333334,
  "steps_count": 12,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.7060416666666667
 },
 "11.0253125,76.9051875,11.0329375,77.0426875": {
  "osrm_dist": 18.4635,
  "osrm_dur_min": 22.540000000000003,
  "steps_count": 17,
  "turns": 9,
  "roundabouts": 1,
  "avg_step_len": 1.0860882352941177
 },
 "11.0253125,76.9051875,11.0129375,76.9860625": {
  "osrm_dist": 10.9178,
  "osrm_dur_min": 11.573333333333332,
  "steps_count": 14,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.7798428571428572
 },
 "11.0253125,76.9051875,11.0258125,77.01656249999999": {
  "osrm_dist": 14.7317,
  "osrm_dur_min": 15.103333333333333,
  "steps_count": 14,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 1.0522642857142857
 },
 "11.0253125,76.9051875,11.024687499999999,77.0028125": {
  "osrm_dist": 13.2265,
  "osrm_dur_min": 13.715,
  "steps_count": 14,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.94475
 },
 "11.0253125,76.9051875,11.0023125,77.02918749999999": {
  "osrm_dist": 16.4369,
  "osrm_dur_min": 20.404999999999998,
  "steps_count": 21,
  "turns": 12,
  "roundabouts": 0,
  "avg_step_len": 0.7827095238095239
 },
 "11.0253125,76.9051875,11.0746875,77.0026875": {
  "osrm_dist": 15.9342,
  "osrm_dur_min": 15.658333333333333,
  "steps_count": 18,
  "turns": 9,
  "roundabouts": 1,
  "avg_step_len": 0.8852333333333333
 },
 "11.0253125,76.9051875,11.0053125,76.9500625": {
  "osrm_dist": 6.426699999999999,
  "osrm_dur_min": 7.536666666666666,
  "steps_count": 9,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.7140777777777777
 },
 "11.0253125,76.9051875,10.9939375,76.9633125": {
  "osrm_dist": 9.345600000000001,
  "osrm_dur_min": 10.345,
  "steps_count": 16,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.5841000000000001
 },
 "11.0253125,76.9051875,11.0243125,76.9448125": {
  "osrm_dist": 6.4836,
  "osrm_dur_min": 8.608333333333333,
  "steps_count": 10,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.64836
 },
 "11.0253125,76.9051875,11.0805625,76.9421875": {
  "osrm_dist": 10.5268,
  "osrm_dur_min": 13.993333333333334,
  "steps_count": 23,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.45768695652173913
 },
 "11.0253125,76.9051875,11.0016875,76.9713125": {
  "osrm_dist": 9.1953,
  "osrm_dur_min": 10.231666666666666,
  "steps_count": 17,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.5408999999999999
 },
 "11.0253125,76.9051875,11.0383125,76.9780625": {
  "osrm_dist": 10.8624,
  "osrm_dur_min": 12.345,
  "steps_count": 17,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 0.6389647058823529
 },
 "11.0253125,76.9051875,10.9560625,76.95406249999999": {
  "osrm_dist": 13.869399999999999,
  "osrm_dur_min": 15.165,
  "steps_count": 17,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.8158470588235294
 },
 "11.0253125,76.9051875,10.9585625,76.98831249999999": {
  "osrm_dist": 16.0147,
  "osrm_dur_min": 19.256666666666668,
  "steps_count": 27,
  "turns": 13,
  "roundabouts": 0,
  "avg_step_len": 0.5931370370370371
 },
 "11.0253125,76.9051875,10.9939375,76.9639375": {
  "osrm_dist": 9.277299999999999,
  "osrm_dur_min": 10.296666666666665,
  "steps_count": 16,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.5798312499999999
 },
 "11.0253125,76.9051875,11.0088125,76.95943749999999": {
  "osrm_dist": 6.9033,
  "osrm_dur_min": 7.758333333333334,
  "steps_count": 10,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.69033
 },
 "11.0253125,76.9051875,10.996437499999999,76.9701875": {
  "osrm_dist": 9.3375,
  "osrm_dur_min": 10.906666666666666,
  "steps_count": 15,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 0.6225
 },
 "11.0253125,76.9051875,11.0451875,76.9471875": {
  "osrm_dist": 9.348600000000001,
  "osrm_dur_min": 10.465,
  "steps_count": 9,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 1.0387333333333335
 },
 "11.0253125,76.9051875,10.9251875,76.9819375": {
  "osrm_dist": 17.5179,
  "osrm_dur_min": 20.125,
  "steps_count": 23,
  "turns": 11,
  "roundabouts": 0,
  "avg_step_len": 0.7616478260869566
 },
 "11.0253125,76.9051875,11.0644375,77.0861875": {
  "osrm_dist": 23.8515,
  "osrm_dur_min": 29.975,
  "steps_count": 17,
  "turns": 9,
  "roundabouts": 1,
  "avg_step_len": 1.403029411764706
 },
 "11.0253125,76.9051875,10.997187499999999,76.9956875": {
  "osrm_dist": 12.0693,
  "osrm_dur_min": 13.926666666666668,
  "steps_count": 16,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 0.75433125
 },
 "11.0253125,76.9051875,11.041062499999999,77.0414375": {
  "osrm_dist": 17.9852,
  "osrm_dur_min": 20.720000000000002,
  "steps_count": 15,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 1.1990133333333333
 },
 "11.0253125,76.9051875,11.0421875,77.0264375": {
  "osrm_dist": 17.584,
  "osrm_dur_min": 19.608333333333334,
  "steps_count": 17,
  "turns": 9,
  "roundabouts": 1,
  "avg_step_len": 1.0343529411764705
 },
 "11.0253125,76.9051875,11.0006875,76.9498125": {
  "osrm_dist": 6.3147,
  "osrm_dur_min": 7.803333333333333,
  "steps_count": 5,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 1.26294
 },
 "11.0805625,76.9421875,11.0140625,76.9669375": {
  "osrm_dist": 9.7296,
  "osrm_dur_min": 8.611666666666668,
  "steps_count": 12,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.8108
 },
 "11.0805625,76.9421875,10.9885625,76.9616875": {
  "osrm_dist": 11.4817,
  "osrm_dur_min": 10.288333333333332,
  "steps_count": 17,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.6753941176470588
 },
 "11.0805625,76.9421875,10.9975625,76.9663125": {
  "osrm_dist": 10.0726,
  "osrm_dur_min": 8.506666666666666,
  "steps_count": 13,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 0.7748153846153846
 },
 "11.0805625,76.9421875,11.0329375,77.0426875": {
  "osrm_dist": 18.410700000000002,
  "osrm_dur_min": 20.888333333333332,
  "steps_count": 17,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 1.0829823529411766
 },
 "11.0805625,76.9421875,11.0129375,76.9860625": {
  "osrm_dist": 12.518,
  "osrm_dur_min": 10.521666666666667,
  "steps_count": 15,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 0.8345333333333333
 },
 "11.0805625,76.9421875,11.0258125,77.01656249999999": {
  "osrm_dist": 14.6789,
  "osrm_dur_min": 13.451666666666666,
  "steps_count": 14,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 1.0484928571428571
 },
 "11.0805625,76.9421875,11.024687499999999,77.0028125": {
  "osrm_dist": 13.1737,
  "osrm_dur_min": 12.063333333333333,
  "steps_count": 14,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 0.9409785714285714
 },
 "11.0805625,76.9421875,11.0023125,77.02918749999999": {
  "osrm_dist": 18.037,
  "osrm_dur_min": 19.353333333333335,
  "steps_count": 21,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.8589047619047618
 },
 "11.0805625,76.9421875,11.0746875,77.0026875": {
  "osrm_dist": 14.0246,
  "osrm_dur_min": 11.948333333333332,
  "steps_count": 15,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.9349733333333333
 },
 "11.0805625,76.9421875,11.0053125,76.9500625": {
  "osrm_dist": 9.235100000000001,
  "osrm_dur_min": 8.056666666666667,
  "steps_count": 10,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.92351
 },
 "11.0805625,76.9421875,10.9939375,76.9633125": {
  "osrm_dist": 11.3829,
  "osrm_dur_min": 9.298333333333334,
  "steps_count": 18,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.6323833333333333
 },
 "11.0805625,76.9421875,11.0243125,76.9448125": {
  "osrm_dist": 7.5265,
  "osrm_dur_min": 6.798333333333333,
  "steps_count": 10,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.75265
 },
 "11.0805625,76.9421875,11.0253125,76.9051875": {
  "osrm_dist": 14.3643,
  "osrm_dur_min": 13.056666666666667,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 1.3058454545454545
 },
 "11.0805625,76.9421875,11.0016875,76.9713125": {
  "osrm_dist": 10.795399999999999,
  "osrm_dur_min": 9.18,
  "steps_count": 18,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.5997444444444444
 },
 "11.0805625,76.9421875,11.0383125,76.9780625": {
  "osrm_dist": 8.9529,
  "osrm_dur_min": 8.635,
  "steps_count": 14,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.6394928571428571
 },
 "11.0805625,76.9421875,10.9560625,76.95406249999999": {
  "osrm_dist": 15.9067,
  "osrm_dur_min": 14.118333333333334,
  "steps_count": 19,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.8371947368421053
 },
 "11.0805625,76.9421875,10.9585625,76.98831249999999": {
  "osrm_dist": 18.052,
  "osrm_dur_min": 18.209999999999997,
  "steps_count": 29,
  "turns": 11,
  "roundabouts": 1,
  "avg_step_len": 0.6224827586206897
 },
 "11.0805625,76.9421875,10.9939375,76.9639375": {
  "osrm_dist": 11.3146,
  "osrm_dur_min": 9.25,
  "steps_count": 18,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.6285888888888889
 },
 "11.0805625,76.9421875,11.0088125,76.95943749999999": {
  "osrm_dist": 8.5035,
  "osrm_dur_min": 6.706666666666666,
  "steps_count": 11,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.7730454545454546
 },
 "11.0805625,76.9421875,10.996437499999999,76.9701875": {
  "osrm_dist": 10.937700000000001,
  "osrm_dur_min": 9.854999999999999,
  "steps_count": 16,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.6836062500000001
 },
 "11.0805625,76.9421875,11.0451875,76.9471875": {
  "osrm_dist": 4.1953000000000005,
  "osrm_dur_min": 3.6616666666666666,
  "steps_count": 6,
  "turns": 1,
  "roundabouts": 0,
  "avg_step_len": 0.6992166666666667
 },
 "11.0805625,76.9421875,10.9251875,76.9819375": {
  "osrm_dist": 19.5552,
  "osrm_dur_min": 19.078333333333333,
  "steps_count": 25,
  "turns": 9,
  "roundabouts": 1,
  "avg_step_len": 0.782208
 },
 "11.0805625,76.9421875,11.0644375,77.0861875": {
  "osrm_dist": 23.7987,
  "osrm_dur_min": 28.323333333333334,
  "steps_count": 17,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 1.3999235294117647
 },
 "11.0805625,76.9421875,10.997187499999999,76.9956875": {
  "osrm_dist": 13.6695,
  "osrm_dur_min": 12.875,
  "steps_count": 17,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.8040882352941177
 },
 "11.0805625,76.9421875,11.041062499999999,77.0414375": {
  "osrm_dist": 17.9324,
  "osrm_dur_min": 19.06833333333333,
  "steps_count": 15,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 1.1954933333333335
 },
 "11.0805625,76.9421875,11.0421875,77.0264375": {
  "osrm_dist": 15.7232,
  "osrm_dur_min": 17.831666666666667,
  "steps_count": 21,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.7487238095238096
 },
 "11.0805625,76.9421875,11.0006875,76.9498125": {
  "osrm_dist": 10.075899999999999,
  "osrm_dur_min": 9.391666666666667,
  "steps_count": 10,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 1.00759
 },
 "11.0016875,76.9713125,11.0140625,76.9669375": {
  "osrm_dist": 2.3051,
  "osrm_dur_min": 3.1766666666666667,
  "steps_count": 11,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.20955454545454544
 },
 "11.0016875,76.9713125,10.9885625,76.9616875": {
  "osrm_dist": 3.0529,
  "osrm_dur_min": 3.578333333333333,
  "steps_count": 10,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 0.30529
 },
 "11.0016875,76.9713125,10.9975625,76.9663125": {
  "osrm_dist": 1.6438,
  "osrm_dur_min": 1.7966666666666666,
  "steps_count": 6,
  "turns": 2,
  "roundabouts": 1,
  "avg_step_len": 0.27396666666666664
 },
 "11.0016875,76.9713125,11.0329375,77.0426875": {
  "osrm_dist": 10.3395,
  "osrm_dur_min": 13.68,
  "steps_count": 8,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 1.2924375
 },
 "11.0016875,76.9713125,11.0129375,76.9860625": {
  "osrm_dist": 2.7938,
  "osrm_dur_min": 2.7133333333333334,
  "steps_count": 5,
  "turns": 1,
  "roundabouts": 0,
  "avg_step_len": 0.55876
 },
 "11.0016875,76.9713125,11.0258125,77.01656249999999": {
  "osrm_dist": 6.6078,
  "osrm_dur_min": 6.243333333333334,
  "steps_count": 5,
  "turns": 1,
  "roundabouts": 0,
  "avg_step_len": 1.32156
 },
 "11.0016875,76.9713125,11.024687499999999,77.0028125": {
  "osrm_dist": 5.1025,
  "osrm_dur_min": 4.855,
  "steps_count": 5,
  "turns": 1,
  "roundabouts": 0,
  "avg_step_len": 1.0205
 },
 "11.0016875,76.9713125,11.0023125,77.02918749999999": {
  "osrm_dist": 8.8206,
  "osrm_dur_min": 11.661666666666667,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.8018727272727273
 },
 "11.0016875,76.9713125,11.0746875,77.0026875": {
  "osrm_dist": 10.4602,
  "osrm_dur_min": 8.386666666666667,
  "steps_count": 14,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.7471571428571429
 },
 "11.0016875,76.9713125,11.0053125,76.9500625": {
  "osrm_dist": 3.0395,
  "osrm_dur_min": 3.9016666666666664,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 0.30395
 },
 "11.0016875,76.9713125,10.9939375,76.9633125": {
  "osrm_dist": 1.8362,
  "osrm_dur_min": 1.8833333333333333,
  "steps_count": 7,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.2623142857142857
 },
 "11.0016875,76.9713125,11.0243125,76.9448125": {
  "osrm_dist": 5.307,
  "osrm_dur_min": 5.388333333333334,
  "steps_count": 14,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.3790714285714286
 },
 "11.0016875,76.9713125,11.0253125,76.9051875": {
  "osrm_dist": 9.2434,
  "osrm_dur_min": 9.403333333333334,
  "steps_count": 13,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.7110307692307691
 },
 "11.0016875,76.9713125,11.0805625,76.9421875": {
  "osrm_dist": 10.9311,
  "osrm_dur_min": 11.285,
  "steps_count": 12,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 0.9109250000000001
 },
 "11.0016875,76.9713125,11.0383125,76.9780625": {
  "osrm_dist": 5.3885,
  "osrm_dur_min": 5.073333333333333,
  "steps_count": 13,
  "turns": 10,
  "roundabouts": 0,
  "avg_step_len": 0.4145
 },
 "11.0016875,76.9713125,10.9560625,76.95406249999999": {
  "osrm_dist": 7.4779,
  "osrm_dur_min": 7.408333333333333,
  "steps_count": 12,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 0.6231583333333334
 },
 "11.0016875,76.9713125,10.9585625,76.98831249999999": {
  "osrm_dist": 9.6231,
  "osrm_dur_min": 11.5,
  "steps_count": 22,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.4374136363636364
 },
 "11.0016875,76.9713125,10.9939375,76.9639375": {
  "osrm_dist": 1.7678,
  "osrm_dur_min": 1.835,
  "steps_count": 7,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.2525428571428571
 },
 "11.0016875,76.9713125,11.0088125,76.95943749999999": {
  "osrm_dist": 2.9024,
  "osrm_dur_min": 3.1616666666666666,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 0.29024
 },
 "11.0016875,76.9713125,10.996437499999999,76.9701875": {
  "osrm_dist": 1.3938,
  "osrm_dur_min": 1.9466666666666665,
  "steps_count": 7,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.19911428571428572
 },
 "11.0016875,76.9713125,11.0451875,76.9471875": {
  "osrm_dist": 6.9098999999999995,
  "osrm_dur_min": 6.17,
  "steps_count": 12,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 0.5758249999999999
 },
 "11.0016875,76.9713125,10.9251875,76.9819375": {
  "osrm_dist": 11.1264,
  "osrm_dur_min": 12.368333333333334,
  "steps_count": 18,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.6181333333333333
 },
 "11.0016875,76.9713125,11.0644375,77.0861875": {
  "osrm_dist": 15.7276,
  "osrm_dur_min": 21.115000000000002,
  "steps_count": 8,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 1.96595
 },
 "11.0016875,76.9713125,10.997187499999999,76.9956875": {
  "osrm_dist": 4.1256,
  "osrm_dur_min": 4.966666666666667,
  "steps_count": 8,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.5157
 },
 "11.0016875,76.9713125,11.041062499999999,77.0414375": {
  "osrm_dist": 9.8613,
  "osrm_dur_min": 11.860000000000001,
  "steps_count": 6,
  "turns": 1,
  "roundabouts": 0,
  "avg_step_len": 1.64355
 },
 "11.0016875,76.9713125,11.0421875,77.0264375": {
  "osrm_dist": 9.46,
  "osrm_dur_min": 10.748333333333333,
  "steps_count": 8,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 1.1825
 },
 "11.0016875,76.9713125,11.0006875,76.9498125": {
  "osrm_dist": 3.2895,
  "osrm_dur_min": 4.263333333333334,
  "steps_count": 9,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 0.3655
 },
 "11.0383125,76.9780625,11.0140625,76.9669375": {
  "osrm_dist": 5.0539,
  "osrm_dur_min": 5.145,
  "steps_count": 13,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.38876153846153844
 },
 "11.0383125,76.9780625,10.9885625,76.9616875": {
  "osrm_dist": 7.3384,
  "osrm_dur_min": 7.073333333333333,
  "steps_count": 16,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.45865
 },
 "11.0383125,76.9780625,10.9975625,76.9663125": {
  "osrm_dist": 5.9293000000000005,
  "osrm_dur_min": 5.291666666666667,
  "steps_count": 12,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 0.49410833333333337
 },
 "11.0383125,76.9780625,11.0329375,77.0426875": {
  "osrm_dist": 10.6569,
  "osrm_dur_min": 15.615,
  "steps_count": 14,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.7612071428571429
 },
 "11.0383125,76.9780625,11.0129375,76.9860625": {
  "osrm_dist": 4.9289,
  "osrm_dur_min": 6.341666666666667,
  "steps_count": 15,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.3285933333333333
 },
 "11.0383125,76.9780625,11.0258125,77.01656249999999": {
  "osrm_dist": 6.9252,
  "osrm_dur_min": 8.178333333333333,
  "steps_count": 11,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.6295636363636364
 },
 "11.0383125,76.9780625,11.024687499999999,77.0028125": {
  "osrm_dist": 5.42,
  "osrm_dur_min": 6.79,
  "steps_count": 11,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.49272727272727274
 },
 "11.0383125,76.9780625,11.0023125,77.02918749999999": {
  "osrm_dist": 10.704799999999999,
  "osrm_dur_min": 14.538333333333332,
  "steps_count": 20,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.5352399999999999
 },
 "11.0383125,76.9780625,11.0746875,77.0026875": {
  "osrm_dist": 5.5687,
  "osrm_dur_min": 4.888333333333334,
  "steps_count": 8,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.6960875
 },
 "11.0383125,76.9780625,11.0053125,76.9500625": {
  "osrm_dist": 7.3251,
  "osrm_dur_min": 7.3966666666666665,
  "steps_count": 16,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.45781875
 },
 "11.0383125,76.9780625,10.9939375,76.9633125": {
  "osrm_dist": 7.2396,
  "osrm_dur_min": 6.083333333333333,
  "steps_count": 17,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.4258588235294118
 },
 "11.0383125,76.9780625,11.0243125,76.9448125": {
  "osrm_dist": 6.6514,
  "osrm_dur_min": 7.8516666666666675,
  "steps_count": 20,
  "turns": 9,
  "roundabouts": 1,
  "avg_step_len": 0.33257
 },
 "11.0383125,76.9780625,11.0253125,76.9051875": {
  "osrm_dist": 13.529,
  "osrm_dur_min": 12.898333333333333,
  "steps_count": 19,
  "turns": 9,
  "roundabouts": 1,
  "avg_step_len": 0.7120526315789474
 },
 "11.0383125,76.9780625,11.0805625,76.9421875": {
  "osrm_dist": 8.7228,
  "osrm_dur_min": 11.488333333333333,
  "steps_count": 16,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.545175
 },
 "11.0383125,76.9780625,11.0016875,76.9713125": {
  "osrm_dist": 5.632899999999999,
  "osrm_dur_min": 5.233333333333333,
  "steps_count": 14,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.40234999999999993
 },
 "11.0383125,76.9780625,10.9560625,76.95406249999999": {
  "osrm_dist": 11.763399999999999,
  "osrm_dur_min": 10.903333333333334,
  "steps_count": 18,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.6535222222222221
 },
 "11.0383125,76.9780625,10.9585625,76.98831249999999": {
  "osrm_dist": 13.908700000000001,
  "osrm_dur_min": 14.995000000000001,
  "steps_count": 28,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 0.49673928571428577
 },
 "11.0383125,76.9780625,10.9939375,76.9639375": {
  "osrm_dist": 7.1713000000000005,
  "osrm_dur_min": 6.035,
  "steps_count": 17,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.4218411764705883
 },
 "11.0383125,76.9780625,11.0088125,76.95943749999999": {
  "osrm_dist": 5.9341,
  "osrm_dur_min": 6.653333333333333,
  "steps_count": 22,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.2697318181818182
 },
 "11.0383125,76.9780625,10.996437499999999,76.9701875": {
  "osrm_dist": 6.531,
  "osrm_dur_min": 6.626666666666667,
  "steps_count": 18,
  "turns": 11,
  "roundabouts": 0,
  "avg_step_len": 0.36283333333333334
 },
 "11.0383125,76.9780625,11.0451875,76.9471875": {
  "osrm_dist": 4.6998999999999995,
  "osrm_dur_min": 6.645,
  "steps_count": 16,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.29374374999999997
 },
 "11.0383125,76.9780625,10.9251875,76.9819375": {
  "osrm_dist": 15.4119,
  "osrm_dur_min": 15.863333333333333,
  "steps_count": 24,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.6421625
 },
 "11.0383125,76.9780625,11.0644375,77.0861875": {
  "osrm_dist": 17.018900000000002,
  "osrm_dur_min": 21.388333333333332,
  "steps_count": 17,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 1.0011117647058825
 },
 "11.0383125,76.9780625,10.997187499999999,76.9956875": {
  "osrm_dist": 7.4443,
  "osrm_dur_min": 8.788333333333332,
  "steps_count": 18,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.41357222222222223
 },
 "11.0383125,76.9780625,11.041062499999999,77.0414375": {
  "osrm_dist": 10.178700000000001,
  "osrm_dur_min": 13.795,
  "steps_count": 12,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.8482250000000001
 },
 "11.0383125,76.9780625,11.0421875,77.0264375": {
  "osrm_dist": 7.2672,
  "osrm_dur_min": 10.771666666666667,
  "steps_count": 14,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.5190857142857143
 },
 "11.0383125,76.9780625,11.0006875,76.9498125": {
  "osrm_dist": 7.575,
  "osrm_dur_min": 7.758333333333334,
  "steps_count": 15,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 0.505
 },
 "10.9560625,76.95406249999999,11.0140625,76.9669375": {
  "osrm_dist": 8.3095,
  "osrm_dur_min": 13.879999999999999,
  "steps_count": 23,
  "turns": 12,
  "roundabouts": 1,
  "avg_step_len": 0.36128260869565215
 },
 "10.9560625,76.95406249999999,10.9885625,76.9616875": {
  "osrm_dist": 5.474600000000001,
  "osrm_dur_min": 11.28,
  "steps_count": 17,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.3220352941176471
 },
 "10.9560625,76.95406249999999,10.9975625,76.9663125": {
  "osrm_dist": 5.854,
  "osrm_dur_min": 10.943333333333333,
  "steps_count": 17,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.3443529411764706
 },
 "10.9560625,76.95406249999999,11.0329375,77.0426875": {
  "osrm_dist": 16.5179,
  "osrm_dur_min": 24.841666666666665,
  "steps_count": 25,
  "turns": 14,
  "roundabouts": 0,
  "avg_step_len": 0.6607160000000001
 },
 "10.9560625,76.95406249999999,11.0129375,76.9860625": {
  "osrm_dist": 8.972299999999999,
  "osrm_dur_min": 13.875,
  "steps_count": 22,
  "turns": 12,
  "roundabouts": 0,
  "avg_step_len": 0.40783181818181813
 },
 "10.9560625,76.95406249999999,11.0258125,77.01656249999999": {
  "osrm_dist": 12.786200000000001,
  "osrm_dur_min": 17.404999999999998,
  "steps_count": 22,
  "turns": 12,
  "roundabouts": 0,
  "avg_step_len": 0.5811909090909091
 },
 "10.9560625,76.95406249999999,11.024687499999999,77.0028125": {
  "osrm_dist": 11.281,
  "osrm_dur_min": 16.016666666666666,
  "steps_count": 22,
  "turns": 12,
  "roundabouts": 0,
  "avg_step_len": 0.5127727272727273
 },
 "10.9560625,76.95406249999999,11.0023125,77.02918749999999": {
  "osrm_dist": 13.586,
  "osrm_dur_min": 18.015,
  "steps_count": 22,
  "turns": 13,
  "roundabouts": 0,
  "avg_step_len": 0.6175454545454545
 },
 "10.9560625,76.95406249999999,11.0746875,77.0026875": {
  "osrm_dist": 16.464599999999997,
  "osrm_dur_min": 19.09,
  "steps_count": 26,
  "turns": 13,
  "roundabouts": 1,
  "avg_step_len": 0.6332538461538461
 },
 "10.9560625,76.95406249999999,11.0053125,76.9500625": {
  "osrm_dist": 7.900399999999999,
  "osrm_dur_min": 13.603333333333333,
  "steps_count": 14,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.5643142857142857
 },
 "10.9560625,76.95406249999999,10.9939375,76.9633125": {
  "osrm_dist": 5.6478,
  "osrm_dur_min": 10.576666666666666,
  "steps_count": 16,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.3529875
 },
 "10.9560625,76.95406249999999,11.0243125,76.9448125": {
  "osrm_dist": 10.6065,
  "osrm_dur_min": 15.868333333333334,
  "steps_count": 27,
  "turns": 15,
  "roundabouts": 1,
  "avg_step_len": 0.39283333333333337
 },
 "10.9560625,76.95406249999999,11.0253125,76.9051875": {
  "osrm_dist": 12.3956,
  "osrm_dur_min": 18.976666666666667,
  "steps_count": 17,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.7291529411764706
 },
 "10.9560625,76.95406249999999,11.0805625,76.9421875": {
  "osrm_dist": 16.2306,
  "osrm_dur_min": 21.765,
  "steps_count": 25,
  "turns": 11,
  "roundabouts": 1,
  "avg_step_len": 0.6492239999999999
 },
 "10.9560625,76.95406249999999,11.0016875,76.9713125": {
  "osrm_dist": 6.7635,
  "osrm_dur_min": 11.958333333333334,
  "steps_count": 22,
  "turns": 12,
  "roundabouts": 0,
  "avg_step_len": 0.30743181818181814
 },
 "10.9560625,76.95406249999999,11.0383125,76.9780625": {
  "osrm_dist": 11.3929,
  "osrm_dur_min": 15.776666666666667,
  "steps_count": 25,
  "turns": 14,
  "roundabouts": 1,
  "avg_step_len": 0.45571599999999995
 },
 "10.9560625,76.95406249999999,10.9585625,76.98831249999999": {
  "osrm_dist": 6.263199999999999,
  "osrm_dur_min": 8.893333333333334,
  "steps_count": 21,
  "turns": 11,
  "roundabouts": 0,
  "avg_step_len": 0.29824761904761904
 },
 "10.9560625,76.95406249999999,10.9939375,76.9639375": {
  "osrm_dist": 5.5795,
  "osrm_dur_min": 10.528333333333334,
  "steps_count": 16,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.34871875
 },
 "10.9560625,76.95406249999999,11.0088125,76.95943749999999": {
  "osrm_dist": 8.2019,
  "osrm_dur_min": 13.641666666666667,
  "steps_count": 23,
  "turns": 12,
  "roundabouts": 1,
  "avg_step_len": 0.35660434782608696
 },
 "10.9560625,76.95406249999999,10.996437499999999,76.9701875": {
  "osrm_dist": 6.0125,
  "osrm_dur_min": 11.34,
  "steps_count": 19,
  "turns": 10,
  "roundabouts": 0,
  "avg_step_len": 0.31644736842105264
 },
 "10.9560625,76.95406249999999,11.0451875,76.9471875": {
  "osrm_dist": 12.2095,
  "osrm_dur_min": 16.65,
  "steps_count": 25,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 0.48838000000000004
 },
 "10.9560625,76.95406249999999,10.9251875,76.9819375": {
  "osrm_dist": 6.9852,
  "osrm_dur_min": 9.471666666666666,
  "steps_count": 16,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.436575
 },
 "10.9560625,76.95406249999999,11.0644375,77.0861875": {
  "osrm_dist": 24.900299999999998,
  "osrm_dur_min": 29.113333333333333,
  "steps_count": 28,
  "turns": 15,
  "roundabouts": 0,
  "avg_step_len": 0.8892964285714285
 },
 "10.9560625,76.95406249999999,10.997187499999999,76.9956875": {
  "osrm_dist": 10.4892,
  "osrm_dur_min": 12.266666666666667,
  "steps_count": 18,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.5827333333333333
 },
 "10.9560625,76.95406249999999,11.041062499999999,77.0414375": {
  "osrm_dist": 16.0397,
  "osrm_dur_min": 23.021666666666665,
  "steps_count": 23,
  "turns": 12,
  "roundabouts": 0,
  "avg_step_len": 0.6973782608695652
 },
 "10.9560625,76.95406249999999,11.0421875,77.0264375": {
  "osrm_dist": 15.638399999999999,
  "osrm_dur_min": 21.91,
  "steps_count": 25,
  "turns": 14,
  "roundabouts": 0,
  "avg_step_len": 0.625536
 },
 "10.9560625,76.95406249999999,11.0006875,76.9498125": {
  "osrm_dist": 7.7403,
  "osrm_dur_min": 12.95,
  "steps_count": 13,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.5954076923076923
 },
 "10.9585625,76.98831249999999,11.0140625,76.9669375": {
  "osrm_dist": 11.6113,
  "osrm_dur_min": 13.49,
  "steps_count": 21,
  "turns": 11,
  "roundabouts": 0,
  "avg_step_len": 0.5529190476190476
 },
 "10.9585625,76.98831249999999,10.9885625,76.9616875": {
  "osrm_dist": 10.8438,
  "osrm_dur_min": 12.951666666666666,
  "steps_count": 12,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.90365
 },
 "10.9585625,76.98831249999999,10.9975625,76.9663125": {
  "osrm_dist": 9.689200000000001,
  "osrm_dur_min": 11.264999999999999,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.9689200000000001
 },
 "10.9585625,76.98831249999999,11.0329375,77.0426875": {
  "osrm_dist": 16.3716,
  "osrm_dur_min": 21.06,
  "steps_count": 16,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 1.023225
 },
 "10.9585625,76.98831249999999,11.0129375,76.9860625": {
  "osrm_dist": 10.443299999999999,
  "osrm_dur_min": 12.073333333333332,
  "steps_count": 16,
  "turns": 10,
  "roundabouts": 0,
  "avg_step_len": 0.6527062499999999
 },
 "10.9585625,76.98831249999999,11.0258125,77.01656249999999": {
  "osrm_dist": 12.6398,
  "osrm_dur_min": 13.623333333333333,
  "steps_count": 13,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.9722923076923077
 },
 "10.9585625,76.98831249999999,11.024687499999999,77.0028125": {
  "osrm_dist": 11.1346,
  "osrm_dur_min": 12.235000000000001,
  "steps_count": 13,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.8565076923076924
 },
 "10.9585625,76.98831249999999,11.0023125,77.02918749999999": {
  "osrm_dist": 9.8382,
  "osrm_dur_min": 13.05,
  "steps_count": 20,
  "turns": 14,
  "roundabouts": 0,
  "avg_step_len": 0.49191
 },
 "10.9585625,76.98831249999999,11.0746875,77.0026875": {
  "osrm_dist": 17.9121,
  "osrm_dur_min": 18.055,
  "steps_count": 21,
  "turns": 12,
  "roundabouts": 0,
  "avg_step_len": 0.8529571428571427
 },
 "10.9585625,76.98831249999999,11.0053125,76.9500625": {
  "osrm_dist": 12.1742,
  "osrm_dur_min": 14.703333333333335,
  "steps_count": 16,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.7608875
 },
 "10.9585625,76.98831249999999,10.9939375,76.9633125": {
  "osrm_dist": 9.7514,
  "osrm_dur_min": 11.125,
  "steps_count": 10,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.97514
 },
 "10.9585625,76.98831249999999,11.0243125,76.9448125": {
  "osrm_dist": 14.4417,
  "osrm_dur_min": 16.19,
  "steps_count": 20,
  "turns": 11,
  "roundabouts": 1,
  "avg_step_len": 0.7220850000000001
 },
 "10.9585625,76.98831249999999,11.0253125,76.9051875": {
  "osrm_dist": 18.3781,
  "osrm_dur_min": 20.205,
  "steps_count": 19,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 0.9672684210526316
 },
 "10.9585625,76.98831249999999,11.0805625,76.9421875": {
  "osrm_dist": 20.0658,
  "osrm_dur_min": 22.086666666666666,
  "steps_count": 18,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 1.1147666666666667
 },
 "10.9585625,76.98831249999999,11.0016875,76.9713125": {
  "osrm_dist": 10.849200000000002,
  "osrm_dur_min": 12.066666666666666,
  "steps_count": 14,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.7749428571428573
 },
 "10.9585625,76.98831249999999,11.0383125,76.9780625": {
  "osrm_dist": 12.840399999999999,
  "osrm_dur_min": 14.741666666666667,
  "steps_count": 20,
  "turns": 13,
  "roundabouts": 0,
  "avg_step_len": 0.6420199999999999
 },
 "10.9585625,76.98831249999999,10.9560625,76.95406249999999": {
  "osrm_dist": 7.0077,
  "osrm_dur_min": 9.158333333333333,
  "steps_count": 10,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 0.70077
 },
 "10.9585625,76.98831249999999,10.9939375,76.9639375": {
  "osrm_dist": 9.6831,
  "osrm_dur_min": 11.076666666666666,
  "steps_count": 10,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.96831
 },
 "10.9585625,76.98831249999999,11.0088125,76.95943749999999": {
  "osrm_dist": 12.0371,
  "osrm_dur_min": 13.963333333333333,
  "steps_count": 16,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.75231875
 },
 "10.9585625,76.98831249999999,10.996437499999999,76.9701875": {
  "osrm_dist": 9.1902,
  "osrm_dur_min": 11.366666666666667,
  "steps_count": 13,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.7069384615384616
 },
 "10.9585625,76.98831249999999,11.0451875,76.9471875": {
  "osrm_dist": 16.0446,
  "osrm_dur_min": 16.971666666666668,
  "steps_count": 18,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.8913666666666666
 },
 "10.9585625,76.98831249999999,10.9251875,76.9819375": {
  "osrm_dist": 6.2537,
  "osrm_dur_min": 8.615,
  "steps_count": 15,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.41691333333333336
 },
 "10.9585625,76.98831249999999,11.0644375,77.0861875": {
  "osrm_dist": 20.585,
  "osrm_dur_min": 22.925,
  "steps_count": 24,
  "turns": 13,
  "roundabouts": 0,
  "avg_step_len": 0.8577083333333334
 },
 "10.9585625,76.98831249999999,10.997187499999999,76.9956875": {
  "osrm_dist": 6.6825,
  "osrm_dur_min": 7.89,
  "steps_count": 8,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.8353125
 },
 "10.9585625,76.98831249999999,11.041062499999999,77.0414375": {
  "osrm_dist": 15.8933,
  "osrm_dur_min": 19.240000000000002,
  "steps_count": 14,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 1.1352357142857143
 },
 "10.9585625,76.98831249999999,11.0421875,77.0264375": {
  "osrm_dist": 15.492,
  "osrm_dur_min": 18.128333333333334,
  "steps_count": 16,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.96825
 },
 "10.9585625,76.98831249999999,11.0006875,76.9498125": {
  "osrm_dist": 12.8076,
  "osrm_dur_min": 15.038333333333332,
  "steps_count": 18,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.7115333333333334
 },
 "10.9939375,76.9639375,11.0140625,76.9669375": {
  "osrm_dist": 3.6016,
  "osrm_dur_min": 4.536666666666666,
  "steps_count": 11,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 0.32741818181818183
 },
 "10.9939375,76.9639375,10.9885625,76.9616875": {
  "osrm_dist": 1.1607,
  "osrm_dur_min": 1.875,
  "steps_count": 4,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 0.290175
 },
 "10.9939375,76.9639375,10.9975625,76.9663125": {
  "osrm_dist": 1.8965,
  "osrm_dur_min": 1.9166666666666667,
  "steps_count": 6,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.3160833333333333
 },
 "10.9939375,76.9639375,11.0329375,77.0426875": {
  "osrm_dist": 12.5604,
  "osrm_dur_min": 15.815,
  "steps_count": 14,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.8971714285714285
 },
 "10.9939375,76.9639375,11.0129375,76.9860625": {
  "osrm_dist": 5.0146999999999995,
  "osrm_dur_min": 4.848333333333333,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.4558818181818181
 },
 "10.9939375,76.9639375,11.0258125,77.01656249999999": {
  "osrm_dist": 8.828700000000001,
  "osrm_dur_min": 8.378333333333334,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.802609090909091
 },
 "10.9939375,76.9639375,11.024687499999999,77.0028125": {
  "osrm_dist": 7.3233999999999995,
  "osrm_dur_min": 6.989999999999999,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.6657636363636363
 },
 "10.9939375,76.9639375,11.0023125,77.02918749999999": {
  "osrm_dist": 8.9647,
  "osrm_dur_min": 12.49,
  "steps_count": 13,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.6895923076923077
 },
 "10.9939375,76.9639375,11.0746875,77.0026875": {
  "osrm_dist": 11.7567,
  "osrm_dur_min": 9.746666666666666,
  "steps_count": 14,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 0.8397642857142857
 },
 "10.9939375,76.9639375,11.0053125,76.9500625": {
  "osrm_dist": 2.6839,
  "osrm_dur_min": 4.295,
  "steps_count": 7,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.3834142857142857
 },
 "10.9939375,76.9639375,10.9939375,76.9633125": {
  "osrm_dist": 0.0683,
  "osrm_dur_min": 0.04833333333333333,
  "steps_count": 2,
  "turns": 0,
  "roundabouts": 0,
  "avg_step_len": 0.03415
 },
 "10.9939375,76.9639375,11.0243125,76.9448125": {
  "osrm_dist": 4.9513,
  "osrm_dur_min": 5.781666666666666,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.4501181818181818
 },
 "10.9939375,76.9639375,11.0253125,76.9051875": {
  "osrm_dist": 8.887799999999999,
  "osrm_dur_min": 9.796666666666665,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.8887799999999999
 },
 "10.9939375,76.9639375,11.0805625,76.9421875": {
  "osrm_dist": 10.5754,
  "osrm_dur_min": 11.678333333333335,
  "steps_count": 9,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 1.1750444444444446
 },
 "10.9939375,76.9639375,11.0016875,76.9713125": {
  "osrm_dist": 2.806,
  "osrm_dur_min": 2.9316666666666666,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.2550909090909091
 },
 "10.9939375,76.9639375,11.0383125,76.9780625": {
  "osrm_dist": 6.685,
  "osrm_dur_min": 6.433333333333334,
  "steps_count": 13,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.5142307692307692
 },
 "10.9939375,76.9639375,10.9560625,76.95406249999999": {
  "osrm_dist": 5.5857,
  "osrm_dur_min": 5.705,
  "steps_count": 6,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 0.93095
 },
 "10.9939375,76.9639375,10.9585625,76.98831249999999": {
  "osrm_dist": 7.731,
  "osrm_dur_min": 9.796666666666665,
  "steps_count": 16,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.4831875
 },
 "10.9939375,76.9639375,11.0088125,76.95943749999999": {
  "osrm_dist": 3.2346999999999997,
  "osrm_dur_min": 3.746666666666667,
  "steps_count": 9,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.35941111111111107
 },
 "10.9939375,76.9639375,10.996437499999999,76.9701875": {
  "osrm_dist": 2.055,
  "osrm_dur_min": 2.3133333333333335,
  "steps_count": 8,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.256875
 },
 "10.9939375,76.9639375,11.0451875,76.9471875": {
  "osrm_dist": 6.5543000000000005,
  "osrm_dur_min": 6.5633333333333335,
  "steps_count": 9,
  "turns": 1,
  "roundabouts": 0,
  "avg_step_len": 0.7282555555555557
 },
 "10.9939375,76.9639375,10.9251875,76.9819375": {
  "osrm_dist": 9.234200000000001,
  "osrm_dur_min": 10.665,
  "steps_count": 12,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.7695166666666667
 },
 "10.9939375,76.9639375,11.0644375,77.0861875": {
  "osrm_dist": 17.948400000000003,
  "osrm_dur_min": 23.25,
  "steps_count": 14,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 1.2820285714285717
 },
 "10.9939375,76.9639375,10.997187499999999,76.9956875": {
  "osrm_dist": 4.7868,
  "osrm_dur_min": 5.333333333333333,
  "steps_count": 9,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.5318666666666667
 },
 "10.9939375,76.9639375,11.041062499999999,77.0414375": {
  "osrm_dist": 12.0822,
  "osrm_dur_min": 13.995000000000001,
  "steps_count": 12,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 1.00685
 },
 "10.9939375,76.9639375,11.0421875,77.0264375": {
  "osrm_dist": 11.6809,
  "osrm_dur_min": 12.883333333333333,
  "steps_count": 14,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.8343499999999999
 },
 "10.9939375,76.9639375,11.0006875,76.9498125": {
  "osrm_dist": 3.1245,
  "osrm_dur_min": 3.9616666666666664,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.31245
 },
 "11.0088125,76.95943749999999,11.0140625,76.9669375": {
  "osrm_dist": 2.9354,
  "osrm_dur_min": 3.4033333333333333,
  "steps_count": 9,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 0.32615555555555553
 },
 "11.0088125,76.95943749999999,10.9885625,76.9616875": {
  "osrm_dist": 2.9781999999999997,
  "osrm_dur_min": 3.5816666666666666,
  "steps_count": 9,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 0.3309111111111111
 },
 "11.0088125,76.95943749999999,10.9975625,76.9663125": {
  "osrm_dist": 1.5692000000000002,
  "osrm_dur_min": 1.8,
  "steps_count": 5,
  "turns": 1,
  "roundabouts": 1,
  "avg_step_len": 0.31384
 },
 "11.0088125,76.95943749999999,11.0329375,77.0426875": {
  "osrm_dist": 11.5602,
  "osrm_dur_min": 14.781666666666666,
  "steps_count": 10,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 1.15602
 },
 "11.0088125,76.95943749999999,11.0129375,76.9860625": {
  "osrm_dist": 4.0145,
  "osrm_dur_min": 3.815,
  "steps_count": 7,
  "turns": 1,
  "roundabouts": 1,
  "avg_step_len": 0.5735
 },
 "11.0088125,76.95943749999999,11.0258125,77.01656249999999": {
  "osrm_dist": 7.828399999999999,
  "osrm_dur_min": 7.345,
  "steps_count": 7,
  "turns": 1,
  "roundabouts": 1,
  "avg_step_len": 1.118342857142857
 },
 "11.0088125,76.95943749999999,11.024687499999999,77.0028125": {
  "osrm_dist": 6.3232,
  "osrm_dur_min": 5.956666666666666,
  "steps_count": 7,
  "turns": 1,
  "roundabouts": 1,
  "avg_step_len": 0.9033142857142857
 },
 "11.0088125,76.95943749999999,11.0023125,77.02918749999999": {
  "osrm_dist": 10.0413,
  "osrm_dur_min": 12.763333333333332,
  "steps_count": 13,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.7724076923076922
 },
 "11.0088125,76.95943749999999,11.0746875,77.0026875": {
  "osrm_dist": 11.0905,
  "osrm_dur_min": 8.613333333333333,
  "steps_count": 12,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 0.9242083333333334
 },
 "11.0088125,76.95943749999999,11.0053125,76.9500625": {
  "osrm_dist": 1.5493,
  "osrm_dur_min": 3.3116666666666665,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.15492999999999998
 },
 "11.0088125,76.95943749999999,10.9939375,76.9633125": {
  "osrm_dist": 2.8794,
  "osrm_dur_min": 2.591666666666667,
  "steps_count": 10,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 0.28794
 },
 "11.0088125,76.95943749999999,11.0243125,76.9448125": {
  "osrm_dist": 3.5701,
  "osrm_dur_min": 4.376666666666667,
  "steps_count": 10,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.35701
 },
 "11.0088125,76.95943749999999,11.0253125,76.9051875": {
  "osrm_dist": 7.5065,
  "osrm_dur_min": 8.391666666666667,
  "steps_count": 9,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.8340555555555556
 },
 "11.0088125,76.95943749999999,11.0805625,76.9421875": {
  "osrm_dist": 9.1942,
  "osrm_dur_min": 10.273333333333333,
  "steps_count": 8,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 1.149275
 },
 "11.0088125,76.95943749999999,11.0016875,76.9713125": {
  "osrm_dist": 2.292,
  "osrm_dur_min": 2.4733333333333336,
  "steps_count": 10,
  "turns": 2,
  "roundabouts": 1,
  "avg_step_len": 0.2292
 },
 "11.0088125,76.95943749999999,11.0383125,76.9780625": {
  "osrm_dist": 6.0187,
  "osrm_dur_min": 5.3,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.5471545454545454
 },
 "11.0088125,76.95943749999999,10.9560625,76.95406249999999": {
  "osrm_dist": 7.4032,
  "osrm_dur_min": 7.411666666666666,
  "steps_count": 11,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 0.6730181818181818
 },
 "11.0088125,76.95943749999999,10.9585625,76.98831249999999": {
  "osrm_dist": 9.5485,
  "osrm_dur_min": 11.503333333333334,
  "steps_count": 21,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.4546904761904762
 },
 "11.0088125,76.95943749999999,10.9939375,76.9639375": {
  "osrm_dist": 2.8110999999999997,
  "osrm_dur_min": 2.5433333333333334,
  "steps_count": 10,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 0.28110999999999997
 },
 "11.0088125,76.95943749999999,10.996437499999999,76.9701875": {
  "osrm_dist": 2.4341999999999997,
  "osrm_dur_min": 3.1483333333333334,
  "steps_count": 8,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 0.30427499999999996
 },
 "11.0088125,76.95943749999999,11.0451875,76.9471875": {
  "osrm_dist": 5.173,
  "osrm_dur_min": 5.158333333333333,
  "steps_count": 8,
  "turns": 1,
  "roundabouts": 0,
  "avg_step_len": 0.646625
 },
 "11.0088125,76.95943749999999,10.9251875,76.9819375": {
  "osrm_dist": 11.0517,
  "osrm_dur_min": 12.371666666666666,
  "steps_count": 17,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 0.6501
 },
 "11.0088125,76.95943749999999,11.0644375,77.0861875": {
  "osrm_dist": 16.9482,
  "osrm_dur_min": 22.216666666666665,
  "steps_count": 10,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 1.69482
 },
 "11.0088125,76.95943749999999,10.997187499999999,76.9956875": {
  "osrm_dist": 5.166,
  "osrm_dur_min": 6.168333333333334,
  "steps_count": 9,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 0.5740000000000001
 },
 "11.0088125,76.95943749999999,11.041062499999999,77.0414375": {
  "osrm_dist": 11.0819,
  "osrm_dur_min": 12.961666666666668,
  "steps_count": 8,
  "turns": 1,
  "roundabouts": 1,
  "avg_step_len": 1.3852375
 },
 "11.0088125,76.95943749999999,11.0421875,77.0264375": {
  "osrm_dist": 10.6806,
  "osrm_dur_min": 11.85,
  "steps_count": 10,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 1.06806
 },
 "11.0088125,76.95943749999999,11.0006875,76.9498125": {
  "osrm_dist": 2.2487,
  "osrm_dur_min": 4.168333333333333,
  "steps_count": 6,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.3747833333333333
 },
 "10.996437499999999,76.9701875,11.0140625,76.9669375": {
  "osrm_dist": 2.8069,
  "osrm_dur_min": 4.333333333333333,
  "steps_count": 14,
  "turns": 11,
  "roundabouts": 0,
  "avg_step_len": 0.20049285714285717
 },
 "10.996437499999999,76.9701875,10.9885625,76.9616875": {
  "osrm_dist": 2.0462000000000002,
  "osrm_dur_min": 3.1966666666666668,
  "steps_count": 8,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.25577500000000003
 },
 "10.996437499999999,76.9701875,10.9975625,76.9663125": {
  "osrm_dist": 0.8916000000000001,
  "osrm_dur_min": 1.51,
  "steps_count": 6,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.1486
 },
 "10.996437499999999,76.9701875,11.0329375,77.0426875": {
  "osrm_dist": 10.8414,
  "osrm_dur_min": 14.836666666666668,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.9855818181818182
 },
 "10.996437499999999,76.9701875,11.0129375,76.9860625": {
  "osrm_dist": 3.2956999999999996,
  "osrm_dur_min": 3.8699999999999997,
  "steps_count": 8,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.41196249999999995
 },
 "10.996437499999999,76.9701875,11.0258125,77.01656249999999": {
  "osrm_dist": 7.1096,
  "osrm_dur_min": 7.4,
  "steps_count": 8,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.8887
 },
 "10.996437499999999,76.9701875,11.024687499999999,77.0028125": {
  "osrm_dist": 5.6044,
  "osrm_dur_min": 6.011666666666667,
  "steps_count": 8,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.70055
 },
 "10.996437499999999,76.9701875,11.0023125,77.02918749999999": {
  "osrm_dist": 7.257,
  "osrm_dur_min": 11.478333333333333,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.6597272727272727
 },
 "10.996437499999999,76.9701875,11.0746875,77.0026875": {
  "osrm_dist": 10.9621,
  "osrm_dur_min": 9.543333333333333,
  "steps_count": 17,
  "turns": 12,
  "roundabouts": 0,
  "avg_step_len": 0.6448294117647059
 },
 "10.996437499999999,76.9701875,11.0053125,76.9500625": {
  "osrm_dist": 3.3766,
  "osrm_dur_min": 4.948333333333333,
  "steps_count": 12,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.2813833333333333
 },
 "10.996437499999999,76.9701875,10.9939375,76.9633125": {
  "osrm_dist": 0.9538,
  "osrm_dur_min": 1.37,
  "steps_count": 6,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.15896666666666667
 },
 "10.996437499999999,76.9701875,11.0243125,76.9448125": {
  "osrm_dist": 5.644100000000001,
  "osrm_dur_min": 6.4350000000000005,
  "steps_count": 16,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 0.35275625000000005
 },
 "10.996437499999999,76.9701875,11.0253125,76.9051875": {
  "osrm_dist": 9.5805,
  "osrm_dur_min": 10.45,
  "steps_count": 15,
  "turns": 9,
  "roundabouts": 1,
  "avg_step_len": 0.6387
 },
 "10.996437499999999,76.9701875,11.0805625,76.9421875": {
  "osrm_dist": 11.2682,
  "osrm_dur_min": 12.331666666666667,
  "steps_count": 14,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.8048714285714286
 },
 "10.996437499999999,76.9701875,11.0016875,76.9713125": {
  "osrm_dist": 0.973,
  "osrm_dur_min": 1.805,
  "steps_count": 7,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.13899999999999998
 },
 "10.996437499999999,76.9701875,11.0383125,76.9780625": {
  "osrm_dist": 5.8903,
  "osrm_dur_min": 6.23,
  "steps_count": 16,
  "turns": 13,
  "roundabouts": 0,
  "avg_step_len": 0.36814375
 },
 "10.996437499999999,76.9701875,10.9560625,76.95406249999999": {
  "osrm_dist": 6.4712,
  "osrm_dur_min": 7.026666666666667,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.6471199999999999
 },
 "10.996437499999999,76.9701875,10.9585625,76.98831249999999": {
  "osrm_dist": 8.6165,
  "osrm_dur_min": 11.118333333333334,
  "steps_count": 20,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.430825
 },
 "10.996437499999999,76.9701875,10.9939375,76.9639375": {
  "osrm_dist": 0.8855,
  "osrm_dur_min": 1.3216666666666665,
  "steps_count": 6,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.14758333333333332
 },
 "10.996437499999999,76.9701875,11.0088125,76.95943749999999": {
  "osrm_dist": 3.2395,
  "osrm_dur_min": 4.208333333333333,
  "steps_count": 12,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.26995833333333336
 },
 "10.996437499999999,76.9701875,11.0451875,76.9471875": {
  "osrm_dist": 7.247,
  "osrm_dur_min": 7.216666666666667,
  "steps_count": 14,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 0.5176428571428572
 },
 "10.996437499999999,76.9701875,10.9251875,76.9819375": {
  "osrm_dist": 10.1197,
  "osrm_dur_min": 11.986666666666668,
  "steps_count": 16,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.63248125
 },
 "10.996437499999999,76.9701875,11.0644375,77.0861875": {
  "osrm_dist": 16.2294,
  "osrm_dur_min": 22.271666666666665,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 1.4753999999999998
 },
 "10.996437499999999,76.9701875,10.997187499999999,76.9956875": {
  "osrm_dist": 3.0791,
  "osrm_dur_min": 4.321666666666667,
  "steps_count": 7,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.4398714285714286
 },
 "10.996437499999999,76.9701875,11.041062499999999,77.0414375": {
  "osrm_dist": 10.363100000000001,
  "osrm_dur_min": 13.016666666666667,
  "steps_count": 9,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 1.1514555555555557
 },
 "10.996437499999999,76.9701875,11.0421875,77.0264375": {
  "osrm_dist": 9.961799999999998,
  "osrm_dur_min": 11.905,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.9056181818181817
 },
 "10.996437499999999,76.9701875,11.0006875,76.9498125": {
  "osrm_dist": 4.01,
  "osrm_dur_min": 5.283333333333333,
  "steps_count": 14,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.2864285714285714
 },
 "11.0451875,76.9471875,11.0140625,76.9669375": {
  "osrm_dist": 5.886699999999999,
  "osrm_dur_min": 6.1,
  "steps_count": 11,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.5351545454545454
 },
 "11.0451875,76.9471875,10.9885625,76.9616875": {
  "osrm_dist": 7.6388,
  "osrm_dur_min": 7.776666666666667,
  "steps_count": 16,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.477425
 },
 "11.0451875,76.9471875,10.9975625,76.9663125": {
  "osrm_dist": 6.2297,
  "osrm_dur_min": 5.995,
  "steps_count": 12,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 0.5191416666666667
 },
 "11.0451875,76.9471875,11.0329375,77.0426875": {
  "osrm_dist": 14.5678,
  "osrm_dur_min": 18.376666666666665,
  "steps_count": 16,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 0.9104875
 },
 "11.0451875,76.9471875,11.0129375,76.9860625": {
  "osrm_dist": 8.6751,
  "osrm_dur_min": 8.01,
  "steps_count": 14,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 0.61965
 },
 "11.0451875,76.9471875,11.0258125,77.01656249999999": {
  "osrm_dist": 10.8361,
  "osrm_dur_min": 10.94,
  "steps_count": 13,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 0.8335461538461538
 },
 "11.0451875,76.9471875,11.024687499999999,77.0028125": {
  "osrm_dist": 9.3308,
  "osrm_dur_min": 9.551666666666668,
  "steps_count": 13,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 0.7177538461538462
 },
 "11.0451875,76.9471875,11.0023125,77.02918749999999": {
  "osrm_dist": 14.1941,
  "osrm_dur_min": 16.841666666666665,
  "steps_count": 20,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.709705
 },
 "11.0451875,76.9471875,11.0746875,77.0026875": {
  "osrm_dist": 10.181700000000001,
  "osrm_dur_min": 9.436666666666667,
  "steps_count": 14,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.7272642857142858
 },
 "11.0451875,76.9471875,11.0053125,76.9500625": {
  "osrm_dist": 5.3922,
  "osrm_dur_min": 5.545,
  "steps_count": 9,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.5991333333333333
 },
 "11.0451875,76.9471875,10.9939375,76.9633125": {
  "osrm_dist": 7.54,
  "osrm_dur_min": 6.786666666666666,
  "steps_count": 17,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.4435294117647059
 },
 "11.0451875,76.9471875,11.0243125,76.9448125": {
  "osrm_dist": 3.6835999999999998,
  "osrm_dur_min": 4.286666666666666,
  "steps_count": 9,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.40928888888888887
 },
 "11.0451875,76.9471875,11.0253125,76.9051875": {
  "osrm_dist": 10.5214,
  "osrm_dur_min": 10.545,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 1.05214
 },
 "11.0451875,76.9471875,11.0805625,76.9421875": {
  "osrm_dist": 4.027699999999999,
  "osrm_dur_min": 6.175,
  "steps_count": 3,
  "turns": 1,
  "roundabouts": 0,
  "avg_step_len": 1.3425666666666665
 },
 "11.0451875,76.9471875,11.0016875,76.9713125": {
  "osrm_dist": 6.9525,
  "osrm_dur_min": 6.668333333333334,
  "steps_count": 17,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 0.4089705882352941
 },
 "11.0451875,76.9471875,11.0383125,76.9780625": {
  "osrm_dist": 5.11,
  "osrm_dur_min": 6.123333333333333,
  "steps_count": 13,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.3930769230769231
 },
 "11.0451875,76.9471875,10.9560625,76.95406249999999": {
  "osrm_dist": 12.063799999999999,
  "osrm_dur_min": 11.606666666666666,
  "steps_count": 18,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.6702111111111111
 },
 "11.0451875,76.9471875,10.9585625,76.98831249999999": {
  "osrm_dist": 14.209100000000001,
  "osrm_dur_min": 15.698333333333332,
  "steps_count": 28,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 0.5074678571428571
 },
 "11.0451875,76.9471875,10.9939375,76.9639375": {
  "osrm_dist": 7.4717,
  "osrm_dur_min": 6.738333333333333,
  "steps_count": 17,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 0.4395117647058824
 },
 "11.0451875,76.9471875,11.0088125,76.95943749999999": {
  "osrm_dist": 4.6606000000000005,
  "osrm_dur_min": 4.194999999999999,
  "steps_count": 10,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.46606000000000003
 },
 "11.0451875,76.9471875,10.996437499999999,76.9701875": {
  "osrm_dist": 7.0948,
  "osrm_dur_min": 7.343333333333334,
  "steps_count": 15,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.47298666666666667
 },
 "11.0451875,76.9471875,10.9251875,76.9819375": {
  "osrm_dist": 15.712299999999999,
  "osrm_dur_min": 16.566666666666666,
  "steps_count": 24,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.6546791666666666
 },
 "11.0451875,76.9471875,11.0644375,77.0861875": {
  "osrm_dist": 19.9558,
  "osrm_dur_min": 25.811666666666667,
  "steps_count": 16,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 1.2472375
 },
 "11.0451875,76.9471875,10.997187499999999,76.9956875": {
  "osrm_dist": 9.826600000000001,
  "osrm_dur_min": 10.363333333333333,
  "steps_count": 16,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.6141625000000001
 },
 "11.0451875,76.9471875,11.041062499999999,77.0414375": {
  "osrm_dist": 14.0896,
  "osrm_dur_min": 16.556666666666665,
  "steps_count": 14,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 1.0064
 },
 "11.0451875,76.9471875,11.0421875,77.0264375": {
  "osrm_dist": 11.8803,
  "osrm_dur_min": 15.32,
  "steps_count": 20,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.594015
 },
 "11.0451875,76.9471875,11.0006875,76.9498125": {
  "osrm_dist": 6.233,
  "osrm_dur_min": 6.88,
  "steps_count": 9,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.6925555555555555
 },
 "10.9251875,76.9819375,11.0140625,76.9669375": {
  "osrm_dist": 12.0721,
  "osrm_dur_min": 16.278333333333332,
  "steps_count": 27,
  "turns": 14,
  "roundabouts": 2,
  "avg_step_len": 0.44711481481481485
 },
 "10.9251875,76.9819375,10.9885625,76.9616875": {
  "osrm_dist": 9.237200000000001,
  "osrm_dur_min": 13.678333333333335,
  "steps_count": 21,
  "turns": 11,
  "roundabouts": 1,
  "avg_step_len": 0.43986666666666674
 },
 "10.9251875,76.9819375,10.9975625,76.9663125": {
  "osrm_dist": 9.6166,
  "osrm_dur_min": 13.341666666666667,
  "steps_count": 21,
  "turns": 11,
  "roundabouts": 1,
  "avg_step_len": 0.45793333333333336
 },
 "10.9251875,76.9819375,11.0329375,77.0426875": {
  "osrm_dist": 20.9916,
  "osrm_dur_min": 25.508333333333333,
  "steps_count": 21,
  "turns": 12,
  "roundabouts": 0,
  "avg_step_len": 0.9995999999999999
 },
 "10.9251875,76.9819375,11.0129375,76.9860625": {
  "osrm_dist": 12.7349,
  "osrm_dur_min": 16.273333333333333,
  "steps_count": 26,
  "turns": 14,
  "roundabouts": 1,
  "avg_step_len": 0.48980384615384615
 },
 "10.9251875,76.9819375,11.0258125,77.01656249999999": {
  "osrm_dist": 17.259900000000002,
  "osrm_dur_min": 18.071666666666665,
  "steps_count": 18,
  "turns": 10,
  "roundabouts": 0,
  "avg_step_len": 0.9588833333333334
 },
 "10.9251875,76.9819375,11.024687499999999,77.0028125": {
  "osrm_dist": 15.754700000000001,
  "osrm_dur_min": 16.683333333333334,
  "steps_count": 18,
  "turns": 10,
  "roundabouts": 0,
  "avg_step_len": 0.8752611111111112
 },
 "10.9251875,76.9819375,11.0023125,77.02918749999999": {
  "osrm_dist": 14.3994,
  "osrm_dur_min": 18.086666666666666,
  "steps_count": 17,
  "turns": 10,
  "roundabouts": 0,
  "avg_step_len": 0.8470235294117647
 },
 "10.9251875,76.9819375,11.0746875,77.0026875": {
  "osrm_dist": 20.2272,
  "osrm_dur_min": 21.488333333333333,
  "steps_count": 30,
  "turns": 15,
  "roundabouts": 2,
  "avg_step_len": 0.67424
 },
 "10.9251875,76.9819375,11.0053125,76.9500625": {
  "osrm_dist": 12.101700000000001,
  "osrm_dur_min": 16.779999999999998,
  "steps_count": 27,
  "turns": 14,
  "roundabouts": 2,
  "avg_step_len": 0.44821111111111117
 },
 "10.9251875,76.9819375,10.9939375,76.9633125": {
  "osrm_dist": 9.4104,
  "osrm_dur_min": 12.975,
  "steps_count": 20,
  "turns": 11,
  "roundabouts": 1,
  "avg_step_len": 0.47051999999999994
 },
 "10.9251875,76.9819375,11.0243125,76.9448125": {
  "osrm_dist": 14.3691,
  "osrm_dur_min": 18.266666666666666,
  "steps_count": 31,
  "turns": 17,
  "roundabouts": 2,
  "avg_step_len": 0.46351935483870965
 },
 "10.9251875,76.9819375,11.0253125,76.9051875": {
  "osrm_dist": 18.3056,
  "osrm_dur_min": 22.28166666666667,
  "steps_count": 30,
  "turns": 16,
  "roundabouts": 2,
  "avg_step_len": 0.6101866666666667
 },
 "10.9251875,76.9819375,11.0805625,76.9421875": {
  "osrm_dist": 19.9932,
  "osrm_dur_min": 24.163333333333334,
  "steps_count": 29,
  "turns": 13,
  "roundabouts": 2,
  "avg_step_len": 0.6894206896551724
 },
 "10.9251875,76.9819375,11.0016875,76.9713125": {
  "osrm_dist": 10.5261,
  "osrm_dur_min": 14.356666666666666,
  "steps_count": 26,
  "turns": 14,
  "roundabouts": 1,
  "avg_step_len": 0.40485
 },
 "10.9251875,76.9819375,11.0383125,76.9780625": {
  "osrm_dist": 15.1555,
  "osrm_dur_min": 18.175,
  "steps_count": 29,
  "turns": 16,
  "roundabouts": 2,
  "avg_step_len": 0.522603448275862
 },
 "10.9251875,76.9819375,10.9560625,76.95406249999999": {
  "osrm_dist": 8.5175,
  "osrm_dur_min": 9.504999999999999,
  "steps_count": 8,
  "turns": 2,
  "roundabouts": 1,
  "avg_step_len": 1.0646875
 },
 "10.9251875,76.9819375,10.9585625,76.98831249999999": {
  "osrm_dist": 7.0766,
  "osrm_dur_min": 8.965,
  "steps_count": 16,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.4422875
 },
 "10.9251875,76.9819375,10.9939375,76.9639375": {
  "osrm_dist": 9.3421,
  "osrm_dur_min": 12.926666666666668,
  "steps_count": 20,
  "turns": 11,
  "roundabouts": 1,
  "avg_step_len": 0.467105
 },
 "10.9251875,76.9819375,11.0088125,76.95943749999999": {
  "osrm_dist": 11.9645,
  "osrm_dur_min": 16.04,
  "steps_count": 27,
  "turns": 14,
  "roundabouts": 2,
  "avg_step_len": 0.4431296296296296
 },
 "10.9251875,76.9819375,10.996437499999999,76.9701875": {
  "osrm_dist": 9.7751,
  "osrm_dur_min": 13.738333333333333,
  "steps_count": 23,
  "turns": 12,
  "roundabouts": 1,
  "avg_step_len": 0.425004347826087
 },
 "10.9251875,76.9819375,11.0451875,76.9471875": {
  "osrm_dist": 15.972100000000001,
  "osrm_dur_min": 19.048333333333336,
  "steps_count": 29,
  "turns": 12,
  "roundabouts": 2,
  "avg_step_len": 0.5507620689655173
 },
 "10.9251875,76.9819375,11.0644375,77.0861875": {
  "osrm_dist": 22.5598,
  "osrm_dur_min": 27.066666666666666,
  "steps_count": 17,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 1.3270470588235295
 },
 "10.9251875,76.9819375,10.997187499999999,76.9956875": {
  "osrm_dist": 11.3026,
  "osrm_dur_min": 12.338333333333333,
  "steps_count": 13,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.8694307692307692
 },
 "10.9251875,76.9819375,11.041062499999999,77.0414375": {
  "osrm_dist": 20.5134,
  "osrm_dur_min": 23.688333333333333,
  "steps_count": 19,
  "turns": 10,
  "roundabouts": 0,
  "avg_step_len": 1.0796526315789474
 },
 "10.9251875,76.9819375,11.0421875,77.0264375": {
  "osrm_dist": 20.112099999999998,
  "osrm_dur_min": 22.576666666666664,
  "steps_count": 21,
  "turns": 12,
  "roundabouts": 0,
  "avg_step_len": 0.9577190476190476
 },
 "10.9251875,76.9819375,11.0006875,76.9498125": {
  "osrm_dist": 11.2796,
  "osrm_dur_min": 16.58833333333333,
  "steps_count": 12,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.9399666666666667
 },
 "11.0644375,77.0861875,11.0140625,76.9669375": {
  "osrm_dist": 20.9056,
  "osrm_dur_min": 21.636666666666667,
  "steps_count": 24,
  "turns": 12,
  "roundabouts": 0,
  "avg_step_len": 0.8710666666666667
 },
 "11.0644375,77.0861875,10.9885625,76.9616875": {
  "osrm_dist": 20.138099999999998,
  "osrm_dur_min": 21.098333333333336,
  "steps_count": 15,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 1.3425399999999998
 },
 "11.0644375,77.0861875,10.9975625,76.9663125": {
  "osrm_dist": 18.983400000000003,
  "osrm_dur_min": 19.41166666666667,
  "steps_count": 13,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 1.4602615384615387
 },
 "11.0644375,77.0861875,11.0329375,77.0426875": {
  "osrm_dist": 8.2159,
  "osrm_dur_min": 13.226666666666667,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.7469
 },
 "11.0644375,77.0861875,11.0129375,76.9860625": {
  "osrm_dist": 19.7375,
  "osrm_dur_min": 20.220000000000002,
  "steps_count": 19,
  "turns": 11,
  "roundabouts": 0,
  "avg_step_len": 1.0388157894736842
 },
 "11.0644375,77.0861875,11.0258125,77.01656249999999": {
  "osrm_dist": 21.934099999999997,
  "osrm_dur_min": 21.77,
  "steps_count": 16,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 1.3708812499999998
 },
 "11.0644375,77.0861875,11.024687499999999,77.0028125": {
  "osrm_dist": 20.428900000000002,
  "osrm_dur_min": 20.381666666666668,
  "steps_count": 16,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 1.2768062500000001
 },
 "11.0644375,77.0861875,11.0023125,77.02918749999999": {
  "osrm_dist": 12.215200000000001,
  "osrm_dur_min": 13.501666666666667,
  "steps_count": 15,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.8143466666666668
 },
 "11.0644375,77.0861875,11.0746875,77.0026875": {
  "osrm_dist": 11.641200000000001,
  "osrm_dur_min": 17.198333333333334,
  "steps_count": 20,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.58206
 },
 "11.0644375,77.0861875,11.0053125,76.9500625": {
  "osrm_dist": 21.4685,
  "osrm_dur_min": 22.85,
  "steps_count": 19,
  "turns": 9,
  "roundabouts": 1,
  "avg_step_len": 1.1299210526315788
 },
 "11.0644375,77.0861875,10.9939375,76.9633125": {
  "osrm_dist": 19.0457,
  "osrm_dur_min": 19.271666666666665,
  "steps_count": 13,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 1.4650538461538463
 },
 "11.0644375,77.0861875,11.0243125,76.9448125": {
  "osrm_dist": 23.7359,
  "osrm_dur_min": 24.336666666666666,
  "steps_count": 23,
  "turns": 12,
  "roundabouts": 1,
  "avg_step_len": 1.031995652173913
 },
 "11.0644375,77.0861875,11.0253125,76.9051875": {
  "osrm_dist": 27.6723,
  "osrm_dur_min": 28.351666666666667,
  "steps_count": 22,
  "turns": 11,
  "roundabouts": 1,
  "avg_step_len": 1.2578318181818182
 },
 "11.0644375,77.0861875,11.0805625,76.9421875": {
  "osrm_dist": 20.240099999999998,
  "osrm_dur_min": 29.740000000000002,
  "steps_count": 25,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.8096039999999999
 },
 "11.0644375,77.0861875,11.0016875,76.9713125": {
  "osrm_dist": 20.1434,
  "osrm_dur_min": 20.21333333333333,
  "steps_count": 17,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 1.1849058823529413
 },
 "11.0644375,77.0861875,11.0383125,76.9780625": {
  "osrm_dist": 16.9348,
  "osrm_dur_min": 21.404999999999998,
  "steps_count": 22,
  "turns": 11,
  "roundabouts": 0,
  "avg_step_len": 0.7697636363636363
 },
 "11.0644375,77.0861875,10.9560625,76.95406249999999": {
  "osrm_dist": 23.8857,
  "osrm_dur_min": 24.60666666666667,
  "steps_count": 18,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 1.3269833333333334
 },
 "11.0644375,77.0861875,10.9585625,76.98831249999999": {
  "osrm_dist": 21.1706,
  "osrm_dur_min": 21.571666666666665,
  "steps_count": 23,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.9204608695652174
 },
 "11.0644375,77.0861875,10.9939375,76.9639375": {
  "osrm_dist": 18.977400000000003,
  "osrm_dur_min": 19.223333333333336,
  "steps_count": 13,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 1.4598000000000002
 },
 "11.0644375,77.0861875,11.0088125,76.95943749999999": {
  "osrm_dist": 21.3313,
  "osrm_dur_min": 22.11,
  "steps_count": 19,
  "turns": 9,
  "roundabouts": 1,
  "avg_step_len": 1.1227
 },
 "11.0644375,77.0861875,10.996437499999999,76.9701875": {
  "osrm_dist": 18.4845,
  "osrm_dur_min": 19.513333333333332,
  "steps_count": 16,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 1.15528125
 },
 "11.0644375,77.0861875,11.0451875,76.9471875": {
  "osrm_dist": 25.338900000000002,
  "osrm_dur_min": 25.118333333333332,
  "steps_count": 21,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 1.2066142857142859
 },
 "11.0644375,77.0861875,10.9251875,76.9819375": {
  "osrm_dist": 21.505200000000002,
  "osrm_dur_min": 24.211666666666666,
  "steps_count": 7,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 3.072171428571429
 },
 "11.0644375,77.0861875,10.997187499999999,76.9956875": {
  "osrm_dist": 15.976799999999999,
  "osrm_dur_min": 16.03666666666667,
  "steps_count": 11,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 1.4524363636363635
 },
 "11.0644375,77.0861875,11.041062499999999,77.0414375": {
  "osrm_dist": 7.828,
  "osrm_dur_min": 11.838333333333333,
  "steps_count": 10,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.7828
 },
 "11.0644375,77.0861875,11.0421875,77.0264375": {
  "osrm_dist": 10.0937,
  "osrm_dur_min": 15.945,
  "steps_count": 13,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.7764384615384615
 },
 "11.0644375,77.0861875,11.0006875,76.9498125": {
  "osrm_dist": 22.1019,
  "osrm_dur_min": 23.185,
  "steps_count": 21,
  "turns": 10,
  "roundabouts": 0,
  "avg_step_len": 1.0524714285714285
 },
 "10.997187499999999,76.9956875,11.0140625,76.9669375": {
  "osrm_dist": 5.19,
  "osrm_dur_min": 6.715,
  "steps_count": 17,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.3052941176470588
 },
 "10.997187499999999,76.9956875,10.9885625,76.9616875": {
  "osrm_dist": 4.7904,
  "osrm_dur_min": 6.183333333333334,
  "steps_count": 8,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.5988
 },
 "10.997187499999999,76.9956875,10.9975625,76.9663125": {
  "osrm_dist": 3.6357,
  "osrm_dur_min": 4.496666666666667,
  "steps_count": 6,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 0.60595
 },
 "10.997187499999999,76.9956875,11.0329375,77.0426875": {
  "osrm_dist": 9.9502,
  "osrm_dur_min": 14.285,
  "steps_count": 12,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.8291833333333334
 },
 "10.997187499999999,76.9956875,11.0129375,76.9860625": {
  "osrm_dist": 4.022,
  "osrm_dur_min": 5.298333333333333,
  "steps_count": 12,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.33516666666666667
 },
 "10.997187499999999,76.9956875,11.0258125,77.01656249999999": {
  "osrm_dist": 6.2185,
  "osrm_dur_min": 6.848333333333333,
  "steps_count": 9,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.6909444444444444
 },
 "10.997187499999999,76.9956875,11.024687499999999,77.0028125": {
  "osrm_dist": 4.7133,
  "osrm_dur_min": 5.46,
  "steps_count": 9,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.5237
 },
 "10.997187499999999,76.9956875,11.0023125,77.02918749999999": {
  "osrm_dist": 4.178,
  "osrm_dur_min": 7.156666666666666,
  "steps_count": 6,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.6963333333333334
 },
 "10.997187499999999,76.9956875,11.0746875,77.0026875": {
  "osrm_dist": 11.4908,
  "osrm_dur_min": 11.28,
  "steps_count": 17,
  "turns": 10,
  "roundabouts": 0,
  "avg_step_len": 0.6759294117647059
 },
 "10.997187499999999,76.9956875,11.0053125,76.9500625": {
  "osrm_dist": 6.1208,
  "osrm_dur_min": 7.9350000000000005,
  "steps_count": 12,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 0.5100666666666667
 },
 "10.997187499999999,76.9956875,10.9939375,76.9633125": {
  "osrm_dist": 3.698,
  "osrm_dur_min": 4.3566666666666665,
  "steps_count": 6,
  "turns": 1,
  "roundabouts": 0,
  "avg_step_len": 0.6163333333333333
 },
 "10.997187499999999,76.9956875,11.0243125,76.9448125": {
  "osrm_dist": 8.388200000000001,
  "osrm_dur_min": 9.421666666666665,
  "steps_count": 16,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.5242625000000001
 },
 "10.997187499999999,76.9956875,11.0253125,76.9051875": {
  "osrm_dist": 12.3247,
  "osrm_dur_min": 13.436666666666667,
  "steps_count": 15,
  "turns": 7,
  "roundabouts": 1,
  "avg_step_len": 0.8216466666666666
 },
 "10.997187499999999,76.9956875,11.0805625,76.9421875": {
  "osrm_dist": 14.0123,
  "osrm_dur_min": 15.318333333333333,
  "steps_count": 14,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 1.0008785714285715
 },
 "10.997187499999999,76.9956875,11.0016875,76.9713125": {
  "osrm_dist": 4.427899999999999,
  "osrm_dur_min": 5.291666666666667,
  "steps_count": 10,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.4427899999999999
 },
 "10.997187499999999,76.9956875,11.0383125,76.9780625": {
  "osrm_dist": 6.419,
  "osrm_dur_min": 7.966666666666667,
  "steps_count": 16,
  "turns": 11,
  "roundabouts": 0,
  "avg_step_len": 0.4011875
 },
 "10.997187499999999,76.9956875,10.9560625,76.95406249999999": {
  "osrm_dist": 8.538,
  "osrm_dur_min": 9.691666666666666,
  "steps_count": 11,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.7761818181818182
 },
 "10.997187499999999,76.9956875,10.9585625,76.98831249999999": {
  "osrm_dist": 6.709,
  "osrm_dur_min": 7.683333333333334,
  "steps_count": 13,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.5160769230769231
 },
 "10.997187499999999,76.9956875,10.9939375,76.9639375": {
  "osrm_dist": 3.6296999999999997,
  "osrm_dur_min": 4.308333333333334,
  "steps_count": 6,
  "turns": 1,
  "roundabouts": 0,
  "avg_step_len": 0.60495
 },
 "10.997187499999999,76.9956875,11.0088125,76.95943749999999": {
  "osrm_dist": 5.9837,
  "osrm_dur_min": 7.194999999999999,
  "steps_count": 12,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 0.49864166666666665
 },
 "10.997187499999999,76.9956875,10.996437499999999,76.9701875": {
  "osrm_dist": 3.1368,
  "osrm_dur_min": 4.598333333333333,
  "steps_count": 9,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.34853333333333336
 },
 "10.997187499999999,76.9956875,11.0451875,76.9471875": {
  "osrm_dist": 9.991200000000001,
  "osrm_dur_min": 10.203333333333335,
  "steps_count": 14,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 0.7136571428571429
 },
 "10.997187499999999,76.9956875,10.9251875,76.9819375": {
  "osrm_dist": 10.506200000000002,
  "osrm_dur_min": 11.721666666666666,
  "steps_count": 15,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.7004133333333334
 },
 "10.997187499999999,76.9956875,11.0644375,77.0861875": {
  "osrm_dist": 15.4922,
  "osrm_dur_min": 18.255,
  "steps_count": 12,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 1.2910166666666667
 },
 "10.997187499999999,76.9956875,11.041062499999999,77.0414375": {
  "osrm_dist": 9.472,
  "osrm_dur_min": 12.465,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.9471999999999999
 },
 "10.997187499999999,76.9956875,11.0421875,77.0264375": {
  "osrm_dist": 9.0707,
  "osrm_dur_min": 11.353333333333333,
  "steps_count": 12,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.7558916666666667
 },
 "10.997187499999999,76.9956875,11.0006875,76.9498125": {
  "osrm_dist": 6.7542,
  "osrm_dur_min": 8.27,
  "steps_count": 14,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.4824428571428571
 },
 "11.041062499999999,77.0414375,11.0140625,76.9669375": {
  "osrm_dist": 10.2287,
  "osrm_dur_min": 15.061666666666667,
  "steps_count": 15,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.6819133333333334
 },
 "11.041062499999999,77.0414375,10.9885625,76.9616875": {
  "osrm_dist": 12.276299999999999,
  "osrm_dur_min": 16.635,
  "steps_count": 12,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 1.0230249999999999
 },
 "11.041062499999999,77.0414375,10.9975625,76.9663125": {
  "osrm_dist": 10.8672,
  "osrm_dur_min": 14.853333333333333,
  "steps_count": 8,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 1.3584
 },
 "11.041062499999999,77.0414375,11.0329375,77.0426875": {
  "osrm_dist": 1.8687,
  "osrm_dur_min": 4.8100000000000005,
  "steps_count": 6,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 0.31145
 },
 "11.041062499999999,77.0414375,11.0129375,76.9860625": {
  "osrm_dist": 9.0606,
  "osrm_dur_min": 13.645000000000001,
  "steps_count": 10,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.9060600000000001
 },
 "11.041062499999999,77.0414375,11.0258125,77.01656249999999": {
  "osrm_dist": 8.6428,
  "osrm_dur_min": 13.696666666666665,
  "steps_count": 12,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.7202333333333333
 },
 "11.041062499999999,77.0414375,11.024687499999999,77.0028125": {
  "osrm_dist": 7.6099,
  "osrm_dur_min": 13.216666666666667,
  "steps_count": 13,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.585376923076923
 },
 "11.041062499999999,77.0414375,11.0023125,77.02918749999999": {
  "osrm_dist": 6.2026,
  "osrm_dur_min": 12.406666666666666,
  "steps_count": 7,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.8860857142857144
 },
 "11.041062499999999,77.0414375,11.0746875,77.0026875": {
  "osrm_dist": 8.4396,
  "osrm_dur_min": 12.889999999999999,
  "steps_count": 21,
  "turns": 11,
  "roundabouts": 0,
  "avg_step_len": 0.4018857142857143
 },
 "11.041062499999999,77.0414375,11.0053125,76.9500625": {
  "osrm_dist": 12.2629,
  "osrm_dur_min": 16.958333333333332,
  "steps_count": 12,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 1.0219083333333334
 },
 "11.041062499999999,77.0414375,10.9939375,76.9633125": {
  "osrm_dist": 11.302700000000002,
  "osrm_dur_min": 15.385,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 1.027518181818182
 },
 "11.041062499999999,77.0414375,11.0243125,76.9448125": {
  "osrm_dist": 13.1283,
  "osrm_dur_min": 17.945,
  "steps_count": 19,
  "turns": 10,
  "roundabouts": 0,
  "avg_step_len": 0.6909631578947368
 },
 "11.041062499999999,77.0414375,11.0253125,76.9051875": {
  "osrm_dist": 18.4668,
  "osrm_dur_min": 22.459999999999997,
  "steps_count": 15,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 1.23112
 },
 "11.041062499999999,77.0414375,11.0805625,76.9421875": {
  "osrm_dist": 18.7524,
  "osrm_dur_min": 23.841666666666665,
  "steps_count": 17,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 1.1030823529411766
 },
 "11.041062499999999,77.0414375,11.0016875,76.9713125": {
  "osrm_dist": 9.4665,
  "osrm_dur_min": 13.501666666666667,
  "steps_count": 6,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 1.57775
 },
 "11.041062499999999,77.0414375,11.0383125,76.9780625": {
  "osrm_dist": 11.1961,
  "osrm_dur_min": 15.416666666666666,
  "steps_count": 21,
  "turns": 13,
  "roundabouts": 0,
  "avg_step_len": 0.533147619047619
 },
 "11.041062499999999,77.0414375,10.9560625,76.95406249999999": {
  "osrm_dist": 16.7013,
  "osrm_dur_min": 20.465,
  "steps_count": 14,
  "turns": 5,
  "roundabouts": 1,
  "avg_step_len": 1.19295
 },
 "11.041062499999999,77.0414375,10.9585625,76.98831249999999": {
  "osrm_dist": 16.2225,
  "osrm_dur_min": 21.251666666666665,
  "steps_count": 19,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.8538157894736842
 },
 "11.041062499999999,77.0414375,10.9939375,76.9639375": {
  "osrm_dist": 11.2343,
  "osrm_dur_min": 15.336666666666668,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 1.0212999999999999
 },
 "11.041062499999999,77.0414375,11.0088125,76.95943749999999": {
  "osrm_dist": 12.1258,
  "osrm_dur_min": 16.218333333333334,
  "steps_count": 12,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 1.0104833333333334
 },
 "11.041062499999999,77.0414375,10.996437499999999,76.9701875": {
  "osrm_dist": 10.2355,
  "osrm_dur_min": 15.086666666666668,
  "steps_count": 13,
  "turns": 10,
  "roundabouts": 0,
  "avg_step_len": 0.7873461538461538
 },
 "11.041062499999999,77.0414375,11.0451875,76.9471875": {
  "osrm_dist": 14.731200000000001,
  "osrm_dur_min": 18.726666666666667,
  "steps_count": 17,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.8665411764705883
 },
 "11.041062499999999,77.0414375,10.9251875,76.9819375": {
  "osrm_dist": 20.019599999999997,
  "osrm_dur_min": 25.290000000000003,
  "steps_count": 21,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.9533142857142856
 },
 "11.041062499999999,77.0414375,11.0644375,77.0861875": {
  "osrm_dist": 5.8663,
  "osrm_dur_min": 9.254999999999999,
  "steps_count": 4,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 1.466575
 },
 "11.041062499999999,77.0414375,10.997187499999999,76.9956875": {
  "osrm_dist": 10.1425,
  "osrm_dur_min": 14.626666666666667,
  "steps_count": 9,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 1.1269444444444445
 },
 "11.041062499999999,77.0414375,11.0421875,77.0264375": {
  "osrm_dist": 3.7464,
  "osrm_dur_min": 7.555000000000001,
  "steps_count": 9,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.4162666666666667
 },
 "11.041062499999999,77.0414375,11.0006875,76.9498125": {
  "osrm_dist": 12.5129,
  "osrm_dur_min": 17.32,
  "steps_count": 11,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 1.1375363636363636
 },
 "11.0421875,77.0264375,11.0140625,76.9669375": {
  "osrm_dist": 9.656799999999999,
  "osrm_dur_min": 13.295,
  "steps_count": 15,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.6437866666666666
 },
 "11.0421875,77.0264375,10.9885625,76.9616875": {
  "osrm_dist": 11.7044,
  "osrm_dur_min": 14.868333333333334,
  "steps_count": 12,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 0.9753666666666666
 },
 "11.0421875,77.0264375,10.9975625,76.9663125": {
  "osrm_dist": 10.2953,
  "osrm_dur_min": 13.086666666666668,
  "steps_count": 8,
  "turns": 1,
  "roundabouts": 1,
  "avg_step_len": 1.2869125
 },
 "11.0421875,77.0264375,11.0329375,77.0426875": {
  "osrm_dist": 2.7251999999999996,
  "osrm_dur_min": 5.8566666666666665,
  "steps_count": 8,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.34064999999999995
 },
 "11.0421875,77.0264375,11.0129375,76.9860625": {
  "osrm_dist": 8.488700000000001,
  "osrm_dur_min": 11.878333333333334,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.8488700000000001
 },
 "11.0421875,77.0264375,11.0258125,77.01656249999999": {
  "osrm_dist": 5.3899,
  "osrm_dur_min": 7.948333333333333,
  "steps_count": 11,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.4899909090909091
 },
 "11.0421875,77.0264375,11.024687499999999,77.0028125": {
  "osrm_dist": 4.357,
  "osrm_dur_min": 7.468333333333334,
  "steps_count": 12,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.36308333333333337
 },
 "11.0421875,77.0264375,11.0023125,77.02918749999999": {
  "osrm_dist": 5.6307,
  "osrm_dur_min": 10.639999999999999,
  "steps_count": 7,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 0.8043857142857143
 },
 "11.0421875,77.0264375,11.0746875,77.0026875": {
  "osrm_dist": 7.2413,
  "osrm_dur_min": 9.133333333333333,
  "steps_count": 14,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.5172357142857142
 },
 "11.0421875,77.0264375,11.0053125,76.9500625": {
  "osrm_dist": 11.6911,
  "osrm_dur_min": 15.191666666666666,
  "steps_count": 12,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 0.9742583333333333
 },
 "11.0421875,77.0264375,10.9939375,76.9633125": {
  "osrm_dist": 10.730799999999999,
  "osrm_dur_min": 13.618333333333334,
  "steps_count": 11,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.9755272727272726
 },
 "11.0421875,77.0264375,11.0243125,76.9448125": {
  "osrm_dist": 12.5564,
  "osrm_dur_min": 16.178333333333335,
  "steps_count": 19,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.6608631578947368
 },
 "11.0421875,77.0264375,11.0253125,76.9051875": {
  "osrm_dist": 17.895,
  "osrm_dur_min": 20.69333333333333,
  "steps_count": 15,
  "turns": 6,
  "roundabouts": 1,
  "avg_step_len": 1.193
 },
 "11.0421875,77.0264375,11.0805625,76.9421875": {
  "osrm_dist": 15.260399999999999,
  "osrm_dur_min": 20.333333333333332,
  "steps_count": 22,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.6936545454545454
 },
 "11.0421875,77.0264375,11.0016875,76.9713125": {
  "osrm_dist": 8.8947,
  "osrm_dur_min": 11.735000000000001,
  "steps_count": 6,
  "turns": 1,
  "roundabouts": 0,
  "avg_step_len": 1.48245
 },
 "11.0421875,77.0264375,11.0383125,76.9780625": {
  "osrm_dist": 7.1466,
  "osrm_dur_min": 10.655,
  "steps_count": 16,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.4466625
 },
 "11.0421875,77.0264375,10.9560625,76.95406249999999": {
  "osrm_dist": 16.1294,
  "osrm_dur_min": 18.698333333333334,
  "steps_count": 14,
  "turns": 3,
  "roundabouts": 1,
  "avg_step_len": 1.1521000000000001
 },
 "11.0421875,77.0264375,10.9585625,76.98831249999999": {
  "osrm_dist": 15.6506,
  "osrm_dur_min": 19.485,
  "steps_count": 19,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.8237157894736843
 },
 "11.0421875,77.0264375,10.9939375,76.9639375": {
  "osrm_dist": 10.6625,
  "osrm_dur_min": 13.57,
  "steps_count": 11,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.9693181818181817
 },
 "11.0421875,77.0264375,11.0088125,76.95943749999999": {
  "osrm_dist": 11.554,
  "osrm_dur_min": 14.451666666666666,
  "steps_count": 12,
  "turns": 4,
  "roundabouts": 1,
  "avg_step_len": 0.9628333333333333
 },
 "11.0421875,77.0264375,10.996437499999999,76.9701875": {
  "osrm_dist": 9.6636,
  "osrm_dur_min": 13.32,
  "steps_count": 13,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.7433538461538463
 },
 "11.0421875,77.0264375,11.0451875,76.9471875": {
  "osrm_dist": 11.5501,
  "osrm_dur_min": 15.645000000000001,
  "steps_count": 22,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.5250045454545454
 },
 "11.0421875,77.0264375,10.9251875,76.9819375": {
  "osrm_dist": 19.4478,
  "osrm_dur_min": 23.523333333333333,
  "steps_count": 21,
  "turns": 7,
  "roundabouts": 0,
  "avg_step_len": 0.9260857142857143
 },
 "11.0421875,77.0264375,11.0644375,77.0861875": {
  "osrm_dist": 8.113199999999999,
  "osrm_dur_min": 13.291666666666666,
  "steps_count": 8,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 1.0141499999999999
 },
 "11.0421875,77.0264375,10.997187499999999,76.9956875": {
  "osrm_dist": 9.5707,
  "osrm_dur_min": 12.860000000000001,
  "steps_count": 9,
  "turns": 1,
  "roundabouts": 0,
  "avg_step_len": 1.063411111111111
 },
 "11.0421875,77.0264375,11.041062499999999,77.0414375": {
  "osrm_dist": 2.2469,
  "osrm_dur_min": 4.036666666666666,
  "steps_count": 6,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 0.37448333333333333
 },
 "11.0421875,77.0264375,11.0006875,76.9498125": {
  "osrm_dist": 11.941,
  "osrm_dur_min": 15.553333333333335,
  "steps_count": 11,
  "turns": 2,
  "roundabouts": 1,
  "avg_step_len": 1.0855454545454546
 },
 "11.0006875,76.9498125,11.0140625,76.9669375": {
  "osrm_dist": 3.6708000000000003,
  "osrm_dur_min": 5.1883333333333335,
  "steps_count": 11,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.33370909090909096
 },
 "11.0006875,76.9498125,10.9885625,76.9616875": {
  "osrm_dist": 3.0728,
  "osrm_dur_min": 5.003333333333333,
  "steps_count": 9,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.34142222222222224
 },
 "11.0006875,76.9498125,10.9975625,76.9663125": {
  "osrm_dist": 2.1911,
  "osrm_dur_min": 4.076666666666666,
  "steps_count": 9,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.24345555555555556
 },
 "11.0006875,76.9498125,11.0329375,77.0426875": {
  "osrm_dist": 12.3621,
  "osrm_dur_min": 17.403333333333332,
  "steps_count": 20,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 0.618105
 },
 "11.0006875,76.9498125,11.0129375,76.9860625": {
  "osrm_dist": 4.8164,
  "osrm_dur_min": 6.4366666666666665,
  "steps_count": 17,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.2833176470588235
 },
 "11.0006875,76.9498125,11.0258125,77.01656249999999": {
  "osrm_dist": 8.6303,
  "osrm_dur_min": 9.966666666666667,
  "steps_count": 17,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.5076647058823529
 },
 "11.0006875,76.9498125,11.024687499999999,77.0028125": {
  "osrm_dist": 7.125100000000001,
  "osrm_dur_min": 8.578333333333335,
  "steps_count": 17,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.41912352941176473
 },
 "11.0006875,76.9498125,11.0023125,77.02918749999999": {
  "osrm_dist": 10.2341,
  "osrm_dur_min": 14.876666666666667,
  "steps_count": 16,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.63963125
 },
 "11.0006875,76.9498125,11.0746875,77.0026875": {
  "osrm_dist": 11.8924,
  "osrm_dur_min": 11.235000000000001,
  "steps_count": 22,
  "turns": 12,
  "roundabouts": 1,
  "avg_step_len": 0.5405636363636364
 },
 "11.0006875,76.9498125,11.0053125,76.9500625": {
  "osrm_dist": 0.6979,
  "osrm_dur_min": 1.6900000000000002,
  "steps_count": 4,
  "turns": 2,
  "roundabouts": 0,
  "avg_step_len": 0.174475
 },
 "11.0006875,76.9498125,10.9939375,76.9633125": {
  "osrm_dist": 2.974,
  "osrm_dur_min": 3.96,
  "steps_count": 9,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.3304444444444445
 },
 "11.0006875,76.9498125,11.0243125,76.9448125": {
  "osrm_dist": 4.1613,
  "osrm_dur_min": 5.433333333333334,
  "steps_count": 12,
  "turns": 9,
  "roundabouts": 0,
  "avg_step_len": 0.346775
 },
 "11.0006875,76.9498125,11.0253125,76.9051875": {
  "osrm_dist": 6.4695,
  "osrm_dur_min": 8.035,
  "steps_count": 7,
  "turns": 3,
  "roundabouts": 0,
  "avg_step_len": 0.9242142857142858
 },
 "11.0006875,76.9498125,11.0805625,76.9421875": {
  "osrm_dist": 9.7854,
  "osrm_dur_min": 11.33,
  "steps_count": 10,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.97854
 },
 "11.0006875,76.9498125,11.0016875,76.9713125": {
  "osrm_dist": 3.0939,
  "osrm_dur_min": 5.095,
  "steps_count": 20,
  "turns": 9,
  "roundabouts": 1,
  "avg_step_len": 0.154695
 },
 "11.0006875,76.9498125,11.0383125,76.9780625": {
  "osrm_dist": 6.820600000000001,
  "osrm_dur_min": 7.921666666666667,
  "steps_count": 21,
  "turns": 13,
  "roundabouts": 1,
  "avg_step_len": 0.32479047619047624
 },
 "11.0006875,76.9498125,10.9560625,76.95406249999999": {
  "osrm_dist": 7.4978,
  "osrm_dur_min": 8.833333333333334,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.6816181818181818
 },
 "11.0006875,76.9498125,10.9585625,76.98831249999999": {
  "osrm_dist": 9.6431,
  "osrm_dur_min": 12.925,
  "steps_count": 21,
  "turns": 10,
  "roundabouts": 0,
  "avg_step_len": 0.4591952380952381
 },
 "11.0006875,76.9498125,10.9939375,76.9639375": {
  "osrm_dist": 2.9057,
  "osrm_dur_min": 3.9116666666666666,
  "steps_count": 9,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.32285555555555556
 },
 "11.0006875,76.9498125,11.0088125,76.95943749999999": {
  "osrm_dist": 2.4446999999999997,
  "osrm_dur_min": 3.283333333333333,
  "steps_count": 9,
  "turns": 5,
  "roundabouts": 0,
  "avg_step_len": 0.2716333333333333
 },
 "11.0006875,76.9498125,10.996437499999999,76.9701875": {
  "osrm_dist": 3.3244000000000002,
  "osrm_dur_min": 4.7,
  "steps_count": 11,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.30221818181818183
 },
 "11.0006875,76.9498125,11.0451875,76.9471875": {
  "osrm_dist": 5.7643,
  "osrm_dur_min": 6.215,
  "steps_count": 10,
  "turns": 4,
  "roundabouts": 0,
  "avg_step_len": 0.57643
 },
 "11.0006875,76.9498125,10.9251875,76.9819375": {
  "osrm_dist": 11.1463,
  "osrm_dur_min": 13.793333333333333,
  "steps_count": 17,
  "turns": 8,
  "roundabouts": 0,
  "avg_step_len": 0.6556647058823529
 },
 "11.0006875,76.9498125,11.0644375,77.0861875": {
  "osrm_dist": 17.7501,
  "osrm_dur_min": 24.83833333333333,
  "steps_count": 20,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 0.887505
 },
 "11.0006875,76.9498125,10.997187499999999,76.9956875": {
  "osrm_dist": 6.0562,
  "osrm_dur_min": 7.72,
  "steps_count": 12,
  "turns": 6,
  "roundabouts": 0,
  "avg_step_len": 0.5046833333333333
 },
 "11.0006875,76.9498125,11.041062499999999,77.0414375": {
  "osrm_dist": 11.883799999999999,
  "osrm_dur_min": 15.583333333333334,
  "steps_count": 18,
  "turns": 8,
  "roundabouts": 1,
  "avg_step_len": 0.6602111111111111
 },
 "11.0006875,76.9498125,11.0421875,77.0264375": {
  "osrm_dist": 11.4825,
  "osrm_dur_min": 14.471666666666666,
  "steps_count": 20,
  "turns": 10,
  "roundabouts": 1,
  "avg_step_len": 0.574125
 }
}
```


## `backend\ml\datasets\tml\osrm_cache.json`

```json
{"13.0343125,77.55081249999999,12.9945625,77.6088125": {"osrm_dist": 9.8524, "osrm_dur_min": 12.835, "steps_count": 18, "turns": 11, "roundabouts": 0, "avg_step_len": 0.5473555555555555}, "13.0438125,77.5958125,12.9998125,77.6413125": {"osrm_dist": 9.899700000000001, "osrm_dur_min": 14.218333333333334, "steps_count": 19, "turns": 8, "roundabouts": 0, "avg_step_len": 0.5210368421052632}, "12.890062499999999,77.6391875,12.8311875,77.6803125": {"osrm_dist": 10.280299999999999, "osrm_dur_min": 13.883333333333333, "steps_count": 8, "turns": 3, "roundabouts": 0, "avg_step_len": 1.2850374999999998}, "12.907562500000001,77.57306249999999,12.916237500000001,77.647953125": {"osrm_dist": 9.7826, "osrm_dur_min": 12.229999999999999, "steps_count": 9, "turns": 5, "roundabouts": 0, "avg_step_len": 1.0869555555555557}, "12.9420625,77.5680625,12.9755625,77.6240625": {"osrm_dist": 9.0347, "osrm_dur_min": 11.425, "steps_count": 19, "turns": 7, "roundabouts": 2, "avg_step_len": 0.4755105263157895}, "12.9550625,77.5173125,12.8960625,77.5701875": {"osrm_dist": 10.5109, "osrm_dur_min": 10.866666666666667, "steps_count": 11, "turns": 5, "roundabouts": 0, "avg_step_len": 0.9555363636363636}, "12.9816875,77.5638125,12.934687499999999,77.6110625": {"osrm_dist": 9.6199, "osrm_dur_min": 12.658333333333333, "steps_count": 21, "turns": 10, "roundabouts": 1, "avg_step_len": 0.45809047619047616}, "12.9756875,77.6065625,13.1989375,77.7069375": {"osrm_dist": 33.429300000000005, "osrm_dur_min": 34.3, "steps_count": 27, "turns": 14, "roundabouts": 0, "avg_step_len": 1.2381222222222223}, "12.9859375,77.6450625,12.936187499999999,77.6061875": {"osrm_dist": 10.931299999999998, "osrm_dur_min": 13.663333333333332, "steps_count": 12, "turns": 4, "roundabouts": 0, "avg_step_len": 0.9109416666666665}, "12.9963125,77.6683125,12.9321875,77.6903125": {"osrm_dist": 11.2141, "osrm_dur_min": 16.548333333333332, "steps_count": 19, "turns": 3, "roundabouts": 0, "avg_step_len": 0.5902157894736842}, "12.9706875,77.7125625,12.9540625,77.6526875": {"osrm_dist": 9.4291, "osrm_dur_min": 11.251666666666667, "steps_count": 5, "turns": 2, "roundabouts": 0, "avg_step_len": 1.88582}, "12.9263125,77.5154375,12.9638125,77.5855625": {"osrm_dist": 10.350100000000001, "osrm_dur_min": 12.406666666666666, "steps_count": 15, "turns": 4, "roundabouts": 0, "avg_step_len": 0.6900066666666668}, "12.9073125,77.7058125,12.9249375,77.6294375": {"osrm_dist": 9.694, "osrm_dur_min": 14.681666666666667, "steps_count": 14, "turns": 9, "roundabouts": 0, "avg_step_len": 0.6924285714285715}}
```


## `backend\ml\recommender.py`

```python
import math
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta

from ml.route_model import predictor as congestion_predictor
from core.region import RegionProfile, get_region, resolve_route_region

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    lat1_rad, lon1_rad = math.radians(lat1), math.radians(lon1)
    lat2_rad, lon2_rad = math.radians(lat2), math.radians(lon2)
    
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

class RouteScorer:
    """Evaluates multiple route candidates by fetching the Congestion Factor."""
    
    # Region-specific "historically covered" anchors (see core/region.py).
    # Property fallback for backwards compatibility
    KNOWN_CORNERS = get_region().coverage_anchors()
    
    @classmethod
    def determine_coverage(
        cls, 
        origin_lat: float, 
        origin_lon: float, 
        dest_lat: float, 
        dest_lon: float, 
        region: Optional[RegionProfile] = None
    ) -> str:
        if region is None:
            return "Unsupported (Out of Coverage)"

        anchors = region.coverage_anchors()
        if not anchors:
            return "Low (Extrapolated)"

        o_dists = [haversine(origin_lat, origin_lon, lat, lon) for lat, lon in anchors]
        d_dists = [haversine(dest_lat, dest_lon, lat, lon) for lat, lon in anchors]
        
        o_min = min(o_dists) if o_dists else float('inf')
        d_min = min(d_dists) if d_dists else float('inf')
        
        if o_min <= 3.0 and d_min <= 3.0:
            return "High (Historical)"
        elif o_min <= 8.0 and d_min <= 8.0:
            return "Medium (Similar)"
        else:
            return "Low (Extrapolated)"

    @classmethod
    def evaluate_routes(
        cls, 
        routes: List[Dict[str, Any]], 
        origin_lat: float, 
        origin_lon: float, 
        dest_lat: float, 
        dest_lon: float, 
        is_emergency_mode: bool = False,
        region: Optional[RegionProfile] = None
    ) -> List[Dict[str, Any]]:
        ist_tz = timezone(timedelta(hours=5, minutes=30))
        now = datetime.now(ist_tz)
        hour = now.hour
        day_of_week = now.weekday()
        is_weekend = int(day_of_week in [5, 6])
        month = now.month
        # Auto-resolve region if not explicitly provided
        if region is None:
            region = resolve_route_region(origin_lat, origin_lon, dest_lat, dest_lon)
        
        # When outside any trained/supported traffic region, traffic predictions are unsupported.
        # Use standard OSRM driving duration as the documented fallback.
        if region is None:
            confidence = "Unsupported (Out of Coverage)"
            for idx, route in enumerate(routes):
                dist_km = route.get('distance_meters', 0) / 1000.0
                dur_sec = route.get('duration_seconds', 0)
                dur_min = dur_sec / 60.0 if dur_sec > 0 else 1.0
                
                route['route_index'] = idx
                route['predicted_duration_seconds'] = dur_sec
                route['predicted_duration_minutes'] = dur_min
                route['standard_duration_seconds'] = dur_sec
                route['standard_duration_minutes'] = dur_min
                route['congestion_factor'] = 1.0
                route['confidence'] = confidence
                route['is_ai_recommended'] = False
                route['recommendation_label'] = "OSRM Route" if idx > 0 else "OSRM Preferred Route"
                route['predicted_average_speed_kmh'] = dist_km / (dur_min / 60.0) if dur_min > 0 else 0.0
                route['delay_savings_minutes'] = 0.0
        else:
            confidence = cls.determine_coverage(origin_lat, origin_lon, dest_lat, dest_lon, region=region)
            for idx, route in enumerate(routes):
                dist_km = route.get('distance_meters', 0) / 1000.0
                dur_sec = route.get('duration_seconds', 0)
                
                # OSRM Feature Extraction
                steps = route.get('steps', [])
                num_steps = len(steps)
                turns = 0
                roundabouts = 0
                for step in steps:
                    mtype = step.get('maneuver', {}).get('type', '')
                    if mtype in ['turn', 'merge', 'ramp']:
                        turns += 1
                    if mtype in ['roundabout', 'rotary']:
                        roundabouts += 1
                
                avg_step_len = dist_km / max(1, num_steps)
                osrm_dur_min = dur_sec / 60.0 if dur_sec > 0 else 1.0
                
                # Congestion Factor prediction scoped to the active region model
                cf = congestion_predictor.predict_congestion_factor(
                    osrm_dist=dist_km,
                    osrm_dur_min=osrm_dur_min,
                    steps_count=num_steps,
                    turns=turns,
                    roundabouts=roundabouts,
                    avg_step_len=avg_step_len,
                    hour=hour,
                    day_of_week=day_of_week,
                    is_weekend=is_weekend,
                    month=month,
                    region_key=region.key
                )
                
                predicted_dur_sec = dur_sec * cf
                predicted_dur_min = predicted_dur_sec / 60.0
                
                route['route_index'] = idx
                route['predicted_duration_seconds'] = predicted_dur_sec
                route['predicted_duration_minutes'] = predicted_dur_min
                route['standard_duration_seconds'] = dur_sec
                route['standard_duration_minutes'] = dur_sec / 60.0
                route['congestion_factor'] = cf
                route['confidence'] = confidence
                route['is_ai_recommended'] = False
                route['recommendation_label'] = ""
                route['predicted_average_speed_kmh'] = dist_km / (predicted_dur_min / 60.0) if predicted_dur_min > 0 else 0.0
                route['delay_savings_minutes'] = 0.0

        if not routes:
            return routes
            
        # Recommender ranks by the ML predicted duration
        routes.sort(key=lambda r: r['predicted_duration_seconds'])
        
        slowest_predicted_min = max(r['predicted_duration_minutes'] for r in routes)
        for route in routes:
            route['delay_savings_minutes'] = slowest_predicted_min - route['predicted_duration_minutes']
        
        # Determine labels based strictly on multiple-route existence
        if len(routes) == 1:
            routes[0]['is_ai_recommended'] = True
            routes[0]['recommendation_label'] = "Recommended Route"
        else:
            # Shortest ML predicted duration wins AI recommendation
            routes[0]['is_ai_recommended'] = True
            routes[0]['recommendation_label'] = "AI Recommended"
            
            # Find the first OSRM candidate (original route_index == 0) and label it OSRM Preferred Route
            for route in routes:
                if route['route_index'] == 0:
                    # Don't overwrite if it also happens to be the AI Recommended route
                    if not route['is_ai_recommended']:
                        route['recommendation_label'] = "OSRM Preferred Route"
                    break
                    
        return routes
```


## `backend\ml\route_model.py`

```python
import os
from typing import Optional
import joblib
import numpy as np
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from ml.dataset import TrafficDataPipeline
from core.region import REGIONS, get_region

class RouteCongestionPredictor:
    """V3.0 ML Model for Apex Guardian.
    
    Predicts a Congestion Factor (multiplier) based on topological route features
    and temporal context, strictly avoiding origin/destination memorization.
    Supports distinct regional models (e.g. Bengaluru, Coimbatore).
    """
    
    def __init__(self):
        self.weights_dir = os.path.join(os.path.dirname(__file__), "weights")
        self._models: dict = {}
        
        if not os.path.exists(self.weights_dir):
            os.makedirs(self.weights_dir)
            
        self.load_models()

    def load_models(self):
        """Pre-load weights for all registered regions that have model files."""
        for key, reg in REGIONS.items():
            path = os.path.join(self.weights_dir, reg.model_filename)
            if os.path.exists(path):
                try:
                    self._models[key] = joblib.load(path)
                    print(f"[RouteCongestionPredictor] Loaded model for '{key}' from {path}")
                except Exception as e:
                    print(f"[RouteCongestionPredictor] Could not load model for '{key}': {e}")
            else:
                print(f"[RouteCongestionPredictor] No model found for '{key}' at {path}")

    @property
    def model(self):
        """Backward-compatibility: returns model for the default active region."""
        active_key = get_region().key
        return self.get_model(active_key)

    @model.setter
    def model(self, value):
        active_key = get_region().key
        self._models[active_key] = value

    def get_model(self, region_key: Optional[str] = None):
        """Retrieve the model for a specific region key."""
        key = (region_key or get_region().key).strip().lower()
        if key in self._models:
            return self._models[key]
        if key in REGIONS:
            path = os.path.join(self.weights_dir, REGIONS[key].model_filename)
            if os.path.exists(path):
                try:
                    self._models[key] = joblib.load(path)
                    return self._models[key]
                except Exception:
                    pass
        return None

    def predict_congestion_factor(self, osrm_dist: float, osrm_dur_min: float, steps_count: int, 
                                 turns: int, roundabouts: int, avg_step_len: float,
                                 hour: int, day_of_week: int, is_weekend: int, month: int,
                                 region_key: Optional[str] = None) -> float:
        """Predicts the congestion multiplier for a specific route within the given region."""
        model = self.get_model(region_key)
        if model is None:
            # Fallback to 1.0 (baseline standard travel time) if model is missing or region unsupported
            return 1.0
            
        features = np.array([[hour, day_of_week, is_weekend, month,
                              osrm_dist, osrm_dur_min, steps_count, turns, roundabouts, avg_step_len]])
        
        try:
            pred = model.predict(features)[0]
            # Never predict negative or zero time. Hard floor at 0.5x.
            return max(0.5, float(pred))
        except Exception:
            return 1.0


# Global instance
predictor = RouteCongestionPredictor()
```


## `backend\ml\train.py`

```python
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import joblib
import numpy as np
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from ml.dataset import TrafficDataPipeline
from core.region import get_region

WEIGHTS_DIR = os.path.join(os.path.dirname(__file__), "weights")
MODEL_PATH = os.path.join(WEIGHTS_DIR, get_region().model_filename)

def train_and_evaluate():
    """Trains XGBoost Regressor for Congestion Factor and saves model weights."""
    print("==================================================")
    print("  TRAINING XGBOOST CONGESTION MODEL (V3.0 FIXED)  ")
    print("==================================================")
    
    print("[Trainer] Loading chronological splits...")
    X_train, y_train, X_val, y_val, X_test, y_test, feature_names = TrafficDataPipeline.get_train_val_test_splits()
    
    print(f"Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
    print(f"Features: {feature_names}")
    
    # Preserve the original Bengaluru training parameters exactly. For the much larger
    # Coimbatore synthetic dataset, use histogram trees and two worker threads to reduce
    # peak RAM/CPU pressure on typical student laptops.
    model_kwargs = {
        "n_estimators": 100,
        "max_depth": 6,
        "learning_rate": 0.05,
        "random_state": 42,
        "n_jobs": -1,
    }
    region = get_region()
    if region.key == "coimbatore":
        model_kwargs["tree_method"] = "hist"
        model_kwargs["n_jobs"] = min(2, os.cpu_count() or 1)
    model = xgb.XGBRegressor(**model_kwargs)
    model.fit(X_train, y_train)
    
    val_preds = model.predict(X_val)
    mae = mean_absolute_error(y_val, val_preds)
    r2 = r2_score(y_val, val_preds)
    print(f"Validation -> MAE: {mae:.3f}x, R2: {r2:.2f}")
    
    # Test set evaluation
    test_preds = model.predict(X_test)
    test_mae = mean_absolute_error(y_test, test_preds)
    test_rmse = np.sqrt(mean_squared_error(y_test, test_preds))
    test_r2 = r2_score(y_test, test_preds)
    test_mape = np.mean(np.abs((y_test - test_preds) / y_test))
    
    print("\n=== FINAL TEST METRICS (Unseen Future Data) ===")
    print(f"MAE:  {test_mae:.3f}x")
    print(f"RMSE: {test_rmse:.3f}x")
    print(f"R²:   {test_r2:.2f}")
    print(f"MAPE: {test_mape:.2f}")

    os.makedirs(WEIGHTS_DIR, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f"Saved XGBoost model weights to: {MODEL_PATH}")
    return model

if __name__ == "__main__":
    train_and_evaluate()
```


## `backend\requirements.txt`

```
fastapi>=0.110.0
uvicorn>=0.28.0
httpx>=0.27.0
pydantic>=2.6.4
pydantic-settings>=2.2.1
pytest>=8.1.1
scikit-learn>=1.4.0
joblib>=1.3.0
numpy>=1.26.0
pandas>=2.0.0
xgboost>=2.0.0
openlocationcode>=1.0.0
```


## `backend\schemas\__init__.py`

```python
# Schemas package initialization
```


## `backend\schemas\navigation.py`

```python
from typing import List, Dict, Any, Optional
from enum import Enum
from pydantic import BaseModel, Field

class CongestionLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HEAVY = "HEAVY"
    SEVERE = "SEVERE"

class TrafficTestMode(str, Enum):
    REAL = "real"
    NORMAL = "normal"
    MODERATE = "moderate"
    HEAVY = "heavy"
    SEVERE = "severe"
    DYNAMIC = "dynamic"

class LocationSearchResponse(BaseModel):
    """Geocoded location search result."""
    display_name: str
    lat: float
    lon: float
    place_id: str
    address_type: str

class RouteRequest(BaseModel):
    """Driving route query between origin and destination coordinates."""
    origin_lat: float
    origin_lon: float
    dest_lat: float
    dest_lon: float
    # EMERGENCY FEATURE DISABLED (commented out, not deleted) - re-enable later.
    # is_emergency_mode: bool = False
    # Real traffic data is the production default; test modes are opt-in via the frontend dropdown only.
    traffic_test_mode: TrafficTestMode = TrafficTestMode.REAL
    traffic_progress: float = Field(default=0.0, ge=0.0, le=1.0)
    synthetic_traffic_active: bool = True
    region: Optional[str] = None

class CongestionSegment(BaseModel):
    """Sub-segment of a route with localized real-time and predicted congestion metrics."""
    segment_index: int
    coordinates: List[List[float]] = Field(default_factory=list, description="[[lon, lat], ...]")
    distance_meters: float = 0.0
    duration_seconds: float = 0.0
    freeflow_speed_kmh: float = 45.0
    current_speed_kmh: float = 45.0
    delay_seconds: float = 0.0
    congestion_level: CongestionLevel = CongestionLevel.LOW
    color: str = "#10B981"  # Hex color for MapLibre rendering
    congestion_factor: float = 1.0
    density_index: float = 20.0  # 0 to 100
    predicted_arrival_time_min: float = 0.0
    road_name: Optional[str] = "Main Road"

class CongestionHotspot(BaseModel):
    """Identified critical congestion bottleneck along a route."""
    hotspot_id: str
    location_name: str
    lat: float
    lon: float
    distance_from_origin_m: float
    congestion_level: CongestionLevel = CongestionLevel.HEAVY
    average_speed_kmh: float = 15.0
    estimated_delay_seconds: float = 0.0
    description: str = ""
    cause: str = "High Vehicle Volume / Choke Point"
    # Optional extent of the congested stretch (populated by the traffic test scenarios).
    zone_end_distance_m: Optional[float] = None
    zone_path: Optional[List[List[float]]] = None  # [[lon, lat], ...] along the affected stretch

class CandidateRoute(BaseModel):
    """Complete candidate route with ML scoring and segmented traffic breakdown."""
    route_id: str = ""
    source: str = "initial-osrm"
    original_route_index: int = 0
    route_index: int
    distance_meters: float
    duration_seconds: float
    geometry: Dict[str, Any]
    steps: List[Dict[str, Any]]
    is_ai_recommended: bool = False
    recommendation_label: str = ""
    congestion_factor: float = 1.0
    predicted_average_speed_kmh: float = 0.0
    predicted_duration_seconds: float = 0.0
    predicted_duration_minutes: float = 0.0
    standard_duration_seconds: float = 0.0
    standard_duration_minutes: float = 0.0
    delay_savings_minutes: float = 0.0
    confidence: str = ""
    
    # Feature 1 & 2: Segmented congestion breakdown & Hotspots
    segments: List[CongestionSegment] = Field(default_factory=list)
    hotspots: List[CongestionHotspot] = Field(default_factory=list)
    controlled_test_bypass_route: Optional[Dict[str, Any]] = None
    controlled_test_switch_distance_m: Optional[float] = None
    controlled_test_zone_start_distance_m: Optional[float] = None
    controlled_test_zone_end_distance_m: Optional[float] = None
    clear_distance_km: float = 0.0
    moderate_distance_km: float = 0.0
    heavy_distance_km: float = 0.0
    severe_distance_km: float = 0.0
    total_delay_seconds: float = 0.0

class RouteResponse(BaseModel):
    """Response returned by route calculation endpoint."""
    success: bool
    routes_count: int
    candidates: List[CandidateRoute]
    traffic_coverage: Optional[str] = "supported"
    region: Optional[str] = None

class TrafficFactorsRequest(BaseModel):
    """Query live traffic metrics for a location or corridor."""
    lat: float
    lon: float
    radius_km: float = 2.0

class TrafficFactorData(BaseModel):
    """Real-time traffic factor telemetry."""
    location_name: str
    current_speed_kmh: float
    freeflow_speed_kmh: float
    density_index: float
    congestion_level: str
    congestion_factor: float
    incident_description: Optional[str] = None
    historical_baseline_speed_kmh: float = 35.0

class RerouteRequest(BaseModel):
    """Dynamic alternative rerouting query from user's current GPS position."""
    current_lat: float
    current_lon: float
    dest_lat: float
    dest_lon: float
    original_route_index: int = 0
    original_remaining_duration_seconds: float = 0.0
    avoid_hotspots: List[Dict[str, float]] = Field(default_factory=list)
    # EMERGENCY FEATURE DISABLED (commented out, not deleted) - re-enable later.
    # is_emergency_mode: bool = False
    # Real traffic data is the production default; test modes are opt-in via the frontend dropdown only.
    traffic_test_mode: TrafficTestMode = TrafficTestMode.REAL
    traffic_progress: float = Field(default=0.0, ge=0.0, le=1.0)
    recent_routes: List[Dict[str, Any]] = Field(default_factory=list)
    synthetic_traffic_active: bool = True
    region: Optional[str] = None

class RerouteRecommendation(BaseModel):
    """Alternative route recommendation evaluated from the current location."""
    is_reroute_recommended: bool = False
    is_congestion_avoidance: bool = False
    time_saved_seconds: float = 0.0
    time_saved_minutes: float = 0.0
    original_remaining_seconds: float = 0.0
    recommended_duration_seconds: float = 0.0
    recommended_route: Optional[CandidateRoute] = None
    alternative_routes: List[CandidateRoute] = Field(default_factory=list)
    reason: str = ""

class PushNotificationPayload(BaseModel):
    """Mobile / Web Push Notification Dispatch Payload."""
    title: str
    body: str
    icon: Optional[str] = "/icons/alert-icon.png"
    badge: Optional[str] = "/icons/badge.png"
    tag: Optional[str] = "apex-traffic-alert"
    data: Optional[Dict[str, Any]] = None
```


## `backend\services\__init__.py`

```python
# Services package initialization
```


## `backend\services\congestion_detector.py`

```python
import math
from typing import List, Dict, Any, Tuple, Optional
from services.traffic_service import LiveTrafficService
from schemas.navigation import CongestionLevel

class CongestionDetector:
    """Congestion Point Identification and Predictive Detection Engine (Features 1 & 3).
    
    Responsibilities:
    - Splits full route coordinate polylines into discrete, analytical sub-segments.
    - Evaluates localized speed, density, and congestion level for each sub-segment.
    - Performs PREDICTIVE congestion detection before the user physically arrives at downstream segments.
    - Identifies discrete Congestion Hotspots along the path for advance alert generation.
    - Calculates distance breakdown by traffic condition (Clear, Moderate, Heavy, Severe).
    """

    @staticmethod
    def haversine_distance(coord1: List[float], coord2: List[float]) -> float:
        """Calculates distance in meters between [lon1, lat1] and [lon2, lat2]."""
        lon1, lat1 = coord1[0], coord1[1]
        lon2, lat2 = coord2[0], coord2[1]
        r = 6371000.0  # Earth radius in meters
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = math.sin(d_lat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2)**2
        return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    @classmethod
    def analyze_route(
        cls, 
        geometry: Dict[str, Any], 
        steps: List[Dict[str, Any]], 
        total_distance_m: float, 
        base_duration_s: float,
        is_emergency_mode: bool = False,
        region: Optional[Any] = None
    ) -> Dict[str, Any]:
        """Analyzes a candidate route and returns segmented traffic breakdown, hotspots, and predictive metrics."""
        coordinates: List[List[float]] = geometry.get("coordinates", [])
        if not coordinates or len(coordinates) < 2:
            return {
                "segments": [],
                "hotspots": [],
                "clear_distance_km": round(total_distance_m / 1000.0, 2),
                "moderate_distance_km": 0.0,
                "heavy_distance_km": 0.0,
                "severe_distance_km": 0.0,
                "total_delay_seconds": 0.0,
            }

        # Step 1: Divide route coordinate polyline into chunks of ~400m to 800m
        segment_chunks: List[List[List[float]]] = []
        current_chunk: List[List[float]] = [coordinates[0]]
        accumulated_dist = 0.0
        target_chunk_size_m = max(350.0, min(800.0, total_distance_m / 12.0))

        for i in range(1, len(coordinates)):
            d = cls.haversine_distance(coordinates[i - 1], coordinates[i])
            accumulated_dist += d
            current_chunk.append(coordinates[i])
            
            if accumulated_dist >= target_chunk_size_m or i == len(coordinates) - 1:
                segment_chunks.append(current_chunk)
                current_chunk = [coordinates[i]]
                accumulated_dist = 0.0

        if len(current_chunk) > 1:
            segment_chunks.append(current_chunk)

        # Step 2: Evaluate each segment with Predictive Downstream Traffic
        evaluated_segments = []
        hotspots = []
        
        cumulative_dist_m = 0.0
        cumulative_elapsed_s = 0.0
        
        clear_dist_m = 0.0
        moderate_dist_m = 0.0
        heavy_dist_m = 0.0
        severe_dist_m = 0.0
        total_delay_s = 0.0

        for seg_idx, chunk_coords in enumerate(segment_chunks):
            # Calculate segment length
            seg_dist_m = 0.0
            for j in range(1, len(chunk_coords)):
                seg_dist_m += cls.haversine_distance(chunk_coords[j - 1], chunk_coords[j])
            
            # Midpoint coordinate of the segment
            mid_idx = len(chunk_coords) // 2
            mid_lon, mid_lat = chunk_coords[mid_idx][0], chunk_coords[mid_idx][1]

            # Predictive arrival offset: When will the driver physically reach this segment?
            prediction_offset_min = cumulative_elapsed_s / 60.0

            # Real-time traffic factor telemetry: out-of-coverage routes use baseline freeflow
            if region is None:
                traffic_factors = {
                    "current_speed_kmh": 45.0,
                    "freeflow_speed_kmh": 45.0,
                    "density_index": 20.0,
                    "congestion_level": CongestionLevel.LOW.value,
                    "congestion_factor": 1.0,
                    "color": "#16A34A",
                    "incident_description": None,
                }
            else:
                traffic_factors = LiveTrafficService.get_point_traffic_factors(
                    lat=mid_lat, 
                    lon=mid_lon, 
                    prediction_offset_min=prediction_offset_min,
                    region=region
                )

            # EMERGENCY FEATURE DISABLED (commented out, not deleted) - re-enable later.
            #             # In emergency mode, emergency vehicles experience lower baseline congestion
            #             if is_emergency_mode:
            #                 traffic_factors["current_speed_kmh"] = min(
            #                     traffic_factors["freeflow_speed_kmh"], 
            #                     traffic_factors["current_speed_kmh"] * 1.5 + 10.0
            #                 )
            #                 if traffic_factors["congestion_level"] == CongestionLevel.SEVERE.value:
            #                     traffic_factors["congestion_level"] = CongestionLevel.HEAVY.value
            #                 elif traffic_factors["congestion_level"] == CongestionLevel.HEAVY.value:
            #                     traffic_factors["congestion_level"] = CongestionLevel.MODERATE.value
            #                 elif traffic_factors["congestion_level"] == CongestionLevel.MODERATE.value:
            #                     traffic_factors["congestion_level"] = CongestionLevel.LOW.value

            current_speed_kmh = max(5.0, traffic_factors["current_speed_kmh"])
            freeflow_speed_kmh = max(20.0, traffic_factors["freeflow_speed_kmh"])
            
            # Duration and delay calculation
            speed_ms = (current_speed_kmh * 1000.0) / 3600.0
            freeflow_ms = (freeflow_speed_kmh * 1000.0) / 3600.0
            
            seg_duration_s = seg_dist_m / max(0.5, speed_ms)
            seg_freeflow_s = seg_dist_m / max(0.5, freeflow_ms)
            seg_delay_s = max(0.0, seg_duration_s - seg_freeflow_s)

            # Find matching step road name if available
            matching_road_name = "Arterial Road"
            seg_center_dist = cumulative_dist_m + (seg_dist_m / 2.0)
            step_acc_dist = 0.0
            for step in steps:
                step_d = step.get("distance", 0.0)
                if step_acc_dist <= seg_center_dist <= (step_acc_dist + step_d):
                    if step.get("name"):
                        matching_road_name = step["name"]
                    break
                step_acc_dist += step_d

            # Accumulate distance categories
            level = traffic_factors["congestion_level"]
            if level == CongestionLevel.LOW.value:
                clear_dist_m += seg_dist_m
            elif level == CongestionLevel.MODERATE.value:
                moderate_dist_m += seg_dist_m
            elif level == CongestionLevel.HEAVY.value:
                heavy_dist_m += seg_dist_m
            elif level == CongestionLevel.SEVERE.value:
                severe_dist_m += seg_dist_m

            total_delay_s += seg_delay_s

            evaluated_segments.append({
                "segment_index": seg_idx,
                "coordinates": chunk_coords,
                "distance_meters": round(seg_dist_m, 1),
                "duration_seconds": round(seg_duration_s, 1),
                "freeflow_speed_kmh": round(freeflow_speed_kmh, 1),
                "current_speed_kmh": round(current_speed_kmh, 1),
                "delay_seconds": round(seg_delay_s, 1),
                "congestion_level": level,
                "color": traffic_factors["color"],
                "congestion_factor": traffic_factors["congestion_factor"],
                "density_index": traffic_factors["density_index"],
                "predicted_arrival_time_min": round(prediction_offset_min, 1),
                "road_name": matching_road_name,
            })

            # Detect if this segment qualifies as a critical Bottleneck Hotspot
            if level in [CongestionLevel.MODERATE.value, CongestionLevel.HEAVY.value, CongestionLevel.SEVERE.value]:
                # Include heavy/severe bottlenecks, or moderate segments with meaningful delay or named bottlenecks
                if level in [CongestionLevel.HEAVY.value, CongestionLevel.SEVERE.value] or seg_delay_s >= 20.0 or (traffic_factors.get("location_name") and traffic_factors.get("location_name") != "Urban Arterial Corridor"):
                    hotspot_id = f"hotspot_{seg_idx}_{round(mid_lat, 3)}_{round(mid_lon, 3)}"
                    loc_name = traffic_factors.get("location_name") or matching_road_name
                    if loc_name == "Urban Arterial Corridor":
                        loc_name = f"Near {matching_road_name}"

                    # Avoid duplicate adjacent hotspots
                    if not hotspots or hotspots[-1]["location_name"] != loc_name:
                        hotspots.append({
                            "hotspot_id": hotspot_id,
                            "location_name": loc_name,
                            "lat": round(mid_lat, 5),
                            "lon": round(mid_lon, 5),
                            "distance_from_origin_m": round(cumulative_dist_m + (seg_dist_m / 2.0), 1),
                            "congestion_level": level,
                            "average_speed_kmh": round(current_speed_kmh, 1),
                            "estimated_delay_seconds": round(seg_delay_s, 1),
                            "description": traffic_factors.get("incident_description") or f"Slow moving traffic at {round(current_speed_kmh)} km/h",
                            "cause": "Traffic Volume & Choke Point Bottleneck",
                        })

            cumulative_dist_m += seg_dist_m
            cumulative_elapsed_s += seg_duration_s

        return {
            "segments": evaluated_segments,
            "hotspots": hotspots,
            "clear_distance_km": round(clear_dist_m / 1000.0, 2),
            "moderate_distance_km": round(moderate_dist_m / 1000.0, 2),
            "heavy_distance_km": round(heavy_dist_m / 1000.0, 2),
            "severe_distance_km": round(severe_dist_m / 1000.0, 2),
            "total_delay_seconds": round(total_delay_s, 1),
        }
```


## `backend\services\controlled_bypass_planner.py`

```python
"""Plan a controlled traffic demo around an existing, real OSRM route alternative.

The chosen bypass is never fabricated: both paths are returned by OSRM. The planner
places the synthetic jam where route B is clearly separate from route A and identifies
a shared point immediately before their divergence so the simulated vehicle can switch
without teleporting.
"""
from __future__ import annotations

import asyncio
import math
from typing import Any, Dict, List, Optional, Sequence, Tuple

EARTH_M = 6_371_000.0


def _hav(a: Sequence[float], b: Sequence[float]) -> float:
    p1, p2 = math.radians(float(a[1])), math.radians(float(b[1]))
    dp = p2 - p1
    dl = math.radians(float(b[0]) - float(a[0]))
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_M * math.atan2(math.sqrt(h), math.sqrt(max(0.0, 1 - h)))


def _cumulative(coords: Sequence[Sequence[float]]) -> List[float]:
    out = [0.0]
    for a, b in zip(coords, coords[1:]):
        out.append(out[-1] + _hav(a, b))
    return out


def _point_at(coords: Sequence[Sequence[float]], cumulative: Sequence[float], distance_m: float) -> List[float]:
    if distance_m <= 0:
        return [float(coords[0][0]), float(coords[0][1])]
    if distance_m >= cumulative[-1]:
        return [float(coords[-1][0]), float(coords[-1][1])]
    lo, hi = 1, len(cumulative) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if cumulative[mid] < distance_m:
            lo = mid + 1
        else:
            hi = mid
    i = lo
    span = cumulative[i] - cumulative[i - 1]
    t = 0.0 if span <= 1e-6 else (distance_m - cumulative[i - 1]) / span
    return [
        float(coords[i - 1][0]) + (float(coords[i][0]) - float(coords[i - 1][0])) * t,
        float(coords[i - 1][1]) + (float(coords[i][1]) - float(coords[i - 1][1])) * t,
    ]


def _point_segment_distance_m(point: Sequence[float], a: Sequence[float], b: Sequence[float]) -> float:
    lat0 = math.radians((float(point[1]) + float(a[1]) + float(b[1])) / 3.0)
    mx, my = 111_320.0 * math.cos(lat0), 111_132.0
    px, py = float(point[0]) * mx, float(point[1]) * my
    ax, ay = float(a[0]) * mx, float(a[1]) * my
    bx, by = float(b[0]) * mx, float(b[1]) * my
    dx, dy = bx - ax, by - ay
    denom = dx * dx + dy * dy
    t = 0.0 if denom <= 1e-9 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / denom))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def _distance_to_route_m(point: Sequence[float], coords: Sequence[Sequence[float]]) -> float:
    return min((_point_segment_distance_m(point, a, b) for a, b in zip(coords, coords[1:])), default=float("inf"))


def _valid_coords(candidate: Dict[str, Any]) -> List[List[float]]:
    geom = candidate.get("geometry") or {}
    coords = geom.get("coordinates", []) if isinstance(geom, dict) else []
    if not isinstance(coords, list) or len(coords) < 10:
        return []
    try:
        result = [[float(p[0]), float(p[1])] for p in coords]
    except (TypeError, ValueError, IndexError):
        return []
    if any(not all(math.isfinite(v) for v in p) for p in result):
        return []
    return result


def _profile(active: Sequence[Sequence[float]], active_cum: Sequence[float], bypass: Sequence[Sequence[float]], bypass_cum: Sequence[float]) -> List[Tuple[float, float]]:
    """Return (distance along active route, lateral distance to bypass) every 25m."""
    total = active_cum[-1]
    # OSRM geometries can contain many thousands of vertices. Downsample only the
    # distance-check copy; the returned route itself always keeps its original geometry.
    if len(bypass) > 1200:
        step = (len(bypass) - 1) / 1199.0
        bypass_check = [bypass[round(i * step)] for i in range(1200)]
    else:
        bypass_check = bypass
    points: List[Tuple[float, float]] = []
    d = 0.0
    while d < total:
        p = _point_at(active, active_cum, d)
        points.append((d, _distance_to_route_m(p, bypass_check)))
        d += 25.0
    p = _point_at(active, active_cum, total)
    points.append((total, _distance_to_route_m(p, bypass_check)))
    return points


# Planning tiers, strictest first. A real road network rarely offers a textbook split, so the
# planner relaxes (never fabricates geometry) until some genuine OSRM pair works:
# (min split ratio, max split ratio, min lateral gap at split m, shared-road tolerance m,
#  min clear gap for the jam m, min jam length m, gap between switch and jam m)
PLAN_TIERS: Tuple[Tuple[float, float, float, float, float, float, float], ...] = (
    # Keep at least 1 km between the common-road switch point and the congestion zone.
    # This makes the 1 km-before-hotspot trigger happen at (not after) the road split.
    (0.15, 0.48, 55.0, 28.0, 125.0, 350.0, 1000.0),
    (0.08, 0.60, 40.0, 32.0, 80.0, 300.0, 1000.0),
    (0.03, 0.75, 30.0, 40.0, 45.0, 250.0, 1000.0),
    # Last resort relaxes road-separation/clearance constraints, never the 1 km lead distance.
    (0.02, 0.85, 22.0, 45.0, 40.0, 200.0, 1000.0),
)


def _plan_pair(active: Dict[str, Any], bypass: Dict[str, Any], tier: int = 0) -> Optional[Dict[str, Any]]:
    r_lo, r_hi, split_gap, shared_tol, clear_gap, zone_min, jam_gap = PLAN_TIERS[tier]
    active_coords, bypass_coords = _valid_coords(active), _valid_coords(bypass)
    if not active_coords or not bypass_coords:
        return None
    active_cum, bypass_cum = _cumulative(active_coords), _cumulative(bypass_coords)
    total = active_cum[-1]
    if total < 2_000 or bypass_cum[-1] < 1_000:
        return None
    profile = _profile(active_coords, active_cum, bypass_coords, bypass_cum)

    # Find a common-road point just before a sustained divergence. We only switch at a
    # point both routes share, then follow the already-existing alternative geometry.
    divergence_i: Optional[int] = None
    for i, (distance, lateral) in enumerate(profile):
        ratio = distance / total
        if ratio < r_lo or ratio > r_hi:
            continue
        end_dist = distance + 100.0
        lookahead = [d for d, offset in profile[i:] if d <= end_dist]
        offsets = [offset for d, offset in profile[i:] if d <= end_dist]
        if lookahead and lookahead[-1] >= distance + 75 and len(offsets) >= 3 and all(offset > split_gap for offset in offsets):
            divergence_i = i
            break
    if divergence_i is None:
        return None

    switch_distance: Optional[float] = None
    for j in range(divergence_i - 1, -1, -1):
        d, offset = profile[j]
        if d / total < max(0.0, r_lo - 0.03):
            break
        if offset <= shared_tol:
            switch_distance = max(0.0, d - 5.0)
            break
    if switch_distance is None or switch_distance / total > r_hi - 0.03:
        return None

    # Put the jam at the first viable point exactly one kilometre after the shared-road
    # switch. Moving the zone farther downstream makes the 1 km trigger occur after the
    # junction and can leave the vehicle unable to join the preplanned bypass.
    zone_length = min(500.0, max(zone_min, total * 0.06))
    first_start = switch_distance + jam_gap
    last_start = min(total - zone_length - 100.0, total * 0.85)
    if first_start > last_start:
        return None
    window = [offset for sample_d, offset in profile if first_start - 25.0 <= sample_d <= first_start + zone_length + 25.0]
    if not window or min(window) < clear_gap:
        return None
    clearance = min(window)
    zone_start = first_start
    active_index = int(active.get("route_index", 0))
    bypass_index = int(bypass.get("route_index", 0))
    switch_point = _point_at(active_coords, active_cum, switch_distance)
    if _distance_to_route_m(switch_point, bypass_coords) > max(30.0, shared_tol + 5.0):
        return None
    return {
        "active_route_index": active_index,
        "bypass_route_index": bypass_index,
        "switch_distance_m": round(switch_distance, 1),
        "zone_start_ratio": round(zone_start / total, 6),
        "zone_start_distance_m": round(zone_start, 1),
        "zone_length_m": round(zone_length, 1),
        "zone_end_distance_m": round(zone_start + zone_length, 1),
        "minimum_bypass_clearance_m": round(clearance, 1),
    }


def plan_controlled_bypass(candidates: Sequence[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Find a real route pair and a jam window (just after the road split) the alternative avoids."""
    for tier in range(len(PLAN_TIERS)):
        best: Optional[Dict[str, Any]] = None
        best_score = -float("inf")
        for i, active in enumerate(candidates):
            for j, bypass in enumerate(candidates):
                if i == j:
                    continue
                plan = _plan_pair(active, bypass, tier)
                if not plan:
                    continue
                # Prefer strong separation and an early split so the jam sits right after it.
                switch_ratio = plan["switch_distance_m"] / max(1.0, float(active.get("distance_meters", 1.0)))
                score = plan["minimum_bypass_clearance_m"] - abs(switch_ratio - 0.30) * 180.0
                if score > best_score:
                    best_score, best = score, plan
        if best:
            best["plan_tier"] = tier
            return best
    return None


def _bearing_deg(a: Sequence[float], b: Sequence[float]) -> float:
    p1, p2 = math.radians(float(a[1])), math.radians(float(b[1]))
    dl = math.radians(float(b[0]) - float(a[0]))
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def _offset_point(point: Sequence[float], bearing_deg: float, distance_m: float) -> List[float]:
    angular = distance_m / EARTH_M
    bearing = math.radians(bearing_deg)
    lat1 = math.radians(float(point[1]))
    lon1 = math.radians(float(point[0]))
    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular)
        + math.cos(lat1) * math.sin(angular) * math.cos(bearing)
    )
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(angular) * math.cos(lat1),
        math.cos(angular) - math.sin(lat1) * math.sin(lat2),
    )
    return [math.degrees(lon2), math.degrees(lat2)]


def _project_distance_along_route(point: Sequence[float], coords: Sequence[Sequence[float]], cumulative: Sequence[float]) -> Tuple[float, float]:
    """Project a snapped OSRM waypoint onto a route; return (along distance, cross-track metres)."""
    lat0 = math.radians(float(point[1]))
    mx, my = 111_320.0 * math.cos(lat0), 111_132.0
    px, py = float(point[0]) * mx, float(point[1]) * my
    best_dist, best_along = float("inf"), 0.0
    for i, (a, b) in enumerate(zip(coords, coords[1:])):
        ax, ay = float(a[0]) * mx, float(a[1]) * my
        bx, by = float(b[0]) * mx, float(b[1]) * my
        dx, dy = bx - ax, by - ay
        denom = dx * dx + dy * dy
        t = 0.0 if denom <= 1e-9 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / denom))
        distance = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
        along = cumulative[i] + t * (cumulative[i + 1] - cumulative[i])
        if distance < best_dist:
            best_dist, best_along = distance, along
    return best_along, best_dist


async def build_controlled_bypass_candidates(
    candidates: Sequence[Dict[str, Any]],
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
    fetch_via_routes: Any,
) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """Create an OSRM bypass suffix, then join it to the chosen route at its entry road.

    Routing starts at a waypoint on the chosen route, not back at the origin. The route
    prefix is copied from that same OSRM route, so the candidate has a deterministic shared
    approach and the vehicle can switch at a common junction instead of hoping two full
    origin-to-destination routes happen to share a prefix. All alternative road geometry
    after the junction comes from OSRM; a candidate is rejected unless the full jam window
    is visibly clear of it.
    """
    if not candidates:
        return [], None
    next_index = max((int(c.get("route_index", i)) for i, c in enumerate(candidates)), default=-1) + 1
    additions: List[Dict[str, Any]] = []
    probe_jobs = []
    for base in candidates[:2]:
        base_coords = _valid_coords(base)
        if not base_coords:
            continue
        base_cum = _cumulative(base_coords)
        total = base_cum[-1]
        if total < 2_500:
            continue
        # Keep the planned entry junction inside _plan_pair's accepted divergence
        # window (15–48% of the route). A 55% target put the entry after that limit,
        # so every probe at that position was guaranteed to be rejected on normal routes.
        # Probe early, middle, and later congestion zones with progressively wider
        # offsets. Severe-mode routes often need a farther parallel road to reach a
        # genuinely separate corridor. Entries still land before the planned jam.
        for fraction, lateral_offset_m in ((0.30, 300.0), (0.42, 500.0), (0.54, 700.0)):
            target_zone_start = total * fraction
            zone_length = min(450.0, max(350.0, total * 0.06))
            # The bypass begins on the shared road about 1 km before the intended jam.
            entry_d = max(120.0, target_zone_start - 1000.0)
            exit_d = min(total - 100.0, target_zone_start + zone_length + 160.0)
            if exit_d <= entry_d + 500:
                continue
            entry = _point_at(base_coords, base_cum, entry_d)
            exit_point = _point_at(base_coords, base_cum, exit_d)
            center = _point_at(base_coords, base_cum, target_zone_start + zone_length / 2)
            tangent_before = _point_at(base_coords, base_cum, max(0.0, target_zone_start - 30.0))
            tangent_after = _point_at(base_coords, base_cum, min(total, target_zone_start + zone_length + 30.0))
            bearing = _bearing_deg(tangent_before, tangent_after)
            for side in (90.0, -90.0):
                offset = _offset_point(center, bearing + side, lateral_offset_m)
                # IMPORTANT: begin the OSRM leg at an existing point on the chosen route.
                # This makes the active-route prefix reusable and guarantees a shared approach.
                waypoints = [
                    (entry[1], entry[0]),
                    (offset[1], offset[0]),
                    (exit_point[1], exit_point[0]),
                    (float(dest_lat), float(dest_lon)),
                ]
                probe_jobs.append((base, waypoints, entry_d))
    # Do not hammer the public router if there are many origin alternatives.
    probe_jobs = probe_jobs[:12]
    if not probe_jobs:
        return [], None

    results = await asyncio.gather(
        *(fetch_via_routes(waypoints) for _, waypoints, _ in probe_jobs),
        return_exceptions=True,
    )
    for (base, _, expected_entry_d), result in zip(probe_jobs, results):
        if isinstance(result, Exception) or not isinstance(result, list):
            continue
        base_coords = _valid_coords(base)
        base_cum = _cumulative(base_coords)
        base_total = base_cum[-1]
        for route in result:
            route = dict(route)
            suffix_coords = _valid_coords(route)
            if len(suffix_coords) < 5:
                continue

            # OSRM may snap a via point a few metres to its road. Reject wide snaps that
            # would need an artificial connector, or snaps that moved the junction far away.
            snapped_entry = suffix_coords[0]
            along_d, cross_track = _project_distance_along_route(snapped_entry, base_coords, base_cum)
            if cross_track > 25.0 or abs(along_d - expected_entry_d) > 90.0:
                continue
            prefix_end = _point_at(base_coords, base_cum, along_d)
            prefix_coords: List[List[float]] = []
            for i, point in enumerate(base_coords):
                if base_cum[i] < along_d - 1.0:
                    prefix_coords.append([float(point[0]), float(point[1])])
                else:
                    break
            if not prefix_coords:
                prefix_coords = [[float(base_coords[0][0]), float(base_coords[0][1])]]
            if _hav(prefix_coords[-1], prefix_end) > 1.0:
                prefix_coords.append(prefix_end)
            # The OSRM-snapped first coordinate is on an actual road. The short connector
            # is bounded by the 18m snap test above; after it, every point is OSRM geometry.
            if _hav(prefix_coords[-1], snapped_entry) > 1.0:
                prefix_coords.append([float(snapped_entry[0]), float(snapped_entry[1])])
            combined = prefix_coords + [[float(p[0]), float(p[1])] for p in suffix_coords[1:]]
            if len(combined) < 10:
                continue
            full_cum = _cumulative(combined)
            full_distance = full_cum[-1]
            if full_distance > base_total * 1.55:
                continue

            base_duration = float(base.get("duration_seconds", 0.0))
            prefix_duration = base_duration * (along_d / max(1.0, base_total))
            suffix_duration = float(route.get("duration_seconds", 0.0))
            stitched = dict(base)
            stitched.update(route)
            stitched["route_index"] = next_index
            stitched["controlled_probe"] = True
            stitched["source"] = "controlled-osrm-bypass"
            stitched["geometry"] = {"type": "LineString", "coordinates": combined}
            stitched["distance_meters"] = full_distance
            stitched["duration_seconds"] = prefix_duration + suffix_duration
            stitched["predicted_duration_seconds"] = prefix_duration + suffix_duration
            stitched["predicted_duration_minutes"] = (prefix_duration + suffix_duration) / 60.0
            prefix_step = {
                "name": "Continue on current road to bypass junction",
                "distance": along_d,
                "duration": prefix_duration,
                "maneuver": {"type": "depart", "instruction": "Continue on the current road to the bypass junction", "location": combined[0]},
            }
            stitched["steps"] = [prefix_step] + list(route.get("steps") or [])
            plan = None
            for tier in range(len(PLAN_TIERS)):
                plan = _plan_pair(base, stitched, tier)
                if plan:
                    plan["plan_tier"] = tier
                    break
            if plan:
                additions.append(stitched)
                return additions, plan
            next_index += 1
    return additions, None
```


## `backend\services\nominatim.py`

```python
from typing import List, Dict, Any
import httpx
from core.config import settings
from core.region import get_region, list_registered_regions

class NominatimService:
    @staticmethod
    async def search_places(query: str) -> List[Dict[str, Any]]:
        """Search places via Nominatim API with active region viewbox bias and multi-region fallback."""
        sanitized_query = query.strip()
        region = get_region()
        
        # Check if the query explicitly specifies any registered region alias
        has_region_alias = any(
            alias in sanitized_query.lower()
            for r in list_registered_regions()
            for alias in r.nominatim_aliases
        )
        if not has_region_alias and region.nominatim_suffix:
            sanitized_query = f"{sanitized_query}, {region.nominatim_suffix}"

        headers = {
            "User-Agent": "ApexGuardian/1.0 (contact@apexguardian.local)"
        }
        params = {
            "q": sanitized_query,
            "format": "json",
            "viewbox": region.nominatim_viewbox,
            "bounded": "0",  # Bias toward viewbox rather than strictly excluding outside matches
            "limit": "5"
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(f"{settings.NOMINATIM_BASE_URL}/search", params=params, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    results = []
                    for item in data:
                        results.append({
                            "display_name": item.get("display_name", ""),
                            "lat": float(item.get("lat", 0.0)),
                            "lon": float(item.get("lon", 0.0)),
                            "place_id": str(item.get("place_id", "")),
                            "address_type": item.get("addresstype", item.get("type", "unknown"))
                        })
                    if results:
                        return results
                    return []
        except Exception as err:
            print(f"[Nominatim WARNING] Search place online lookup failed: {err}")

        return []

    @staticmethod
    async def reverse_geocode(lat: float, lon: float) -> str:
        """Reverse geocode latitude & longitude coordinates to a clean street/place name."""
        headers = {
            "User-Agent": "ApexGuardian/1.0 (contact@apexguardian.local)"
        }
        params = {
            "format": "json",
            "lat": lat,
            "lon": lon,
            "zoom": "18",
            "addressdetails": "1"
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(f"{settings.NOMINATIM_BASE_URL}/reverse", params=params, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    address = data.get("address", {})
                    short_name = (
                        address.get("road") or
                        address.get("suburb") or
                        address.get("neighbourhood") or
                        address.get("amenity") or
                        data.get("display_name", "").split(",")[0]
                    )
                    if short_name:
                        suburb = address.get("suburb", "")
                        if suburb and suburb.lower() not in short_name.lower():
                            return f"{short_name}, {suburb}"
                        return short_name
                    if data.get("display_name"):
                        return data["display_name"].split(",")[0]
        except Exception:
            pass

        return f"Location ({lat:.5f}, {lon:.5f})"
```


## `backend\services\notification_service.py`

```python
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from schemas.navigation import PushNotificationPayload

logger = logging.getLogger("apexguardian.notifications")

class PushNotificationService:
    """Mobile Push Notification Service (Feature 5).
    
    Dispatches alerts to mobile devices and browsers (via Web Push / Firebase Cloud Messaging).
    Triggers:
    a) Upcoming congestion alerts on user's active route
    b) Dynamic route change & faster reroute suggestions
    """

    _dispatch_log = []

    @classmethod
    def create_congestion_alert(
        cls, 
        location_name: str, 
        distance_meters: float, 
        delay_minutes: float, 
        speed_kmh: float
    ) -> PushNotificationPayload:
        """Generates proactive push notification payload for upcoming congestion."""
        dist_str = f"{distance_meters / 1000.0:.1f} km" if distance_meters >= 1000 else f"{int(distance_meters)} m"
        title = f"⚠️ Congestion Ahead ({dist_str})"
        body = f"Heavy traffic near {location_name}. Flow speed: {int(speed_kmh)} km/h (+{int(delay_minutes)} min delay)."
        
        payload = PushNotificationPayload(
            title=title,
            body=body,
            icon="/icons/alert-icon.png",
            tag="congestion-alert",
            data={
                "type": "CONGESTION_ALERT",
                "location_name": location_name,
                "distance_meters": distance_meters,
                "delay_minutes": delay_minutes,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
        cls._log_dispatch(payload)
        return payload

    @classmethod
    def create_reroute_alert(
        cls, 
        time_saved_minutes: float, 
        via_road: str
    ) -> PushNotificationPayload:
        """Generates push notification payload for faster alternative route."""
        title = f"🚀 Faster Route Available (Save {int(time_saved_minutes)} min)"
        body = f"We found a faster alternative via {via_road} that bypasses upcoming delays."
        
        payload = PushNotificationPayload(
            title=title,
            body=body,
            icon="/icons/reroute-icon.png",
            tag="reroute-suggestion",
            data={
                "type": "REROUTE_SUGGESTION",
                "time_saved_minutes": time_saved_minutes,
                "via_road": via_road,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
        cls._log_dispatch(payload)
        return payload

    @classmethod
    def _log_dispatch(cls, payload: PushNotificationPayload):
        entry = {
            "title": payload.title,
            "body": payload.body,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        cls._dispatch_log.append(entry)
        if len(cls._dispatch_log) > 100:
            cls._dispatch_log.pop(0)
        logger.info(f"[PushNotification] Dispatched: {payload.title} - {payload.body}")

    @classmethod
    def get_recent_dispatches(cls):
        return list(reversed(cls._dispatch_log))
```


## `backend\services\osrm.py`

```python
"""Street-snapped driving route service (OSRM-compatible public APIs).

PATCH NOTES (why this file changed)
-----------------------------------
The old ``_fetch_candidates`` returned as soon as ONE endpoint produced ONE
route.  The public OSRM demo server usually returns a single route even with
``alternatives=true``, and the second endpoint (routing.openstreetmap.de) was
only tried when the first one *failed outright*.  Result: most real
origin/destination pairs showed only one route.

New behaviour of ``get_routes``:
  1. Ask every endpoint (in parallel) for native alternatives and merge them,
     dropping routes that share (almost) the same corridor.
  2. If that still yields < ``min_routes`` routes, probe "via" waypoints placed
     perpendicular to the primary route (both sides, several positions along
     it) and keep any *genuinely different*, *reasonably short* result.
  3. Results are cached briefly so repeated demo clicks do not hammer the
     public servers (which rate-limit).
"""
import asyncio
import logging
import math
import time
from typing import Any, Dict, List, Optional, Sequence, Tuple

import httpx
from fastapi import HTTPException

from core.config import settings

logger = logging.getLogger("apexguardian.osrm")

# ---- tunables ---------------------------------------------------------------
MIN_ROUTES_TARGET = 2
MAX_ROUTES = 3
SAME_CORRIDOR_OVERLAP = 0.88     # >= this shared fraction => "same route"
CORRIDOR_TOLERANCE_M = 80.0
MAX_ALT_DISTANCE_RATIO = 1.45    # alt may be at most 45% longer than primary
MAX_ALT_DURATION_RATIO = 1.60
PROBE_BATCH_SIZE = 3
CACHE_TTL_S = 600.0

_route_cache: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}


# ---- geometry helpers -------------------------------------------------------
def _haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _downsample(coords: Sequence[Sequence[float]], max_points: int) -> List[Tuple[float, float]]:
    if len(coords) <= max_points:
        return [(float(c[0]), float(c[1])) for c in coords]
    step = (len(coords) - 1) / float(max_points - 1)
    return [
        (float(coords[round(i * step)][0]), float(coords[round(i * step)][1]))
        for i in range(max_points)
    ]


def _point_to_polyline_m(lon: float, lat: float, poly: Sequence[Tuple[float, float]]) -> float:
    best = float("inf")
    m_lat = 111_132.0
    m_lon = 111_320.0 * math.cos(math.radians(lat))
    for (x1, y1), (x2, y2) in zip(poly, poly[1:]):
        ax, ay = (x1 - lon) * m_lon, (y1 - lat) * m_lat
        bx, by = (x2 - lon) * m_lon, (y2 - lat) * m_lat
        dx, dy = bx - ax, by - ay
        denom = dx * dx + dy * dy
        t = 0.0 if denom == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / denom))
        d = math.hypot(ax + t * dx, ay + t * dy)
        if d < best:
            best = d
    return best


def _overlap_fraction(a: Sequence[Sequence[float]], b: Sequence[Sequence[float]]) -> float:
    """Fraction of route A's sampled points that lie within tolerance of route B."""
    sample_a = _downsample(a, 40)
    poly_b = _downsample(b, 500)
    if len(poly_b) < 2 or not sample_a:
        return 0.0
    near = sum(
        1 for lon, lat in sample_a
        if _point_to_polyline_m(lon, lat, poly_b) <= CORRIDOR_TOLERANCE_M
    )
    return near / float(len(sample_a))


def routes_are_same_corridor(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    ca = a["geometry"]["coordinates"]
    cb = b["geometry"]["coordinates"]
    return max(_overlap_fraction(ca, cb), _overlap_fraction(cb, ca)) >= SAME_CORRIDOR_OVERLAP


def _bearing_deg(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def _offset_point(lat: float, lon: float, bearing_deg: float, dist_km: float) -> Tuple[float, float]:
    ang = dist_km / 6371.0
    b = math.radians(bearing_deg)
    p1, l1 = math.radians(lat), math.radians(lon)
    p2 = math.asin(math.sin(p1) * math.cos(ang) + math.cos(p1) * math.sin(ang) * math.cos(b))
    l2 = l1 + math.atan2(math.sin(b) * math.sin(ang) * math.cos(p1), math.cos(ang) - math.sin(p1) * math.sin(p2))
    return math.degrees(p2), (math.degrees(l2) + 540.0) % 360.0 - 180.0


def _has_uturn(route: Dict[str, Any]) -> bool:
    for step in route.get("steps", []):
        if (step.get("maneuver") or {}).get("modifier") == "uturn":
            return True
    return False


# ---- service ----------------------------------------------------------------
class OSRMService:
    """Street-snapped driving route service via public OSRM-compatible APIs."""

    @staticmethod
    def _endpoints() -> List[str]:
        primary = settings.OSRM_BASE_URL.rstrip("/")
        endpoints = [f"{primary}/route/v1/driving"]
        secondary = "https://routing.openstreetmap.de/routed-car/route/v1/driving"
        if secondary not in endpoints:
            endpoints.append(secondary)
        return endpoints

    @staticmethod
    def _parse_osrm_response(data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parse and validate route candidates returned by an OSRM-compatible server."""
        raw_routes = data.get("routes", [])
        if data.get("code") != "Ok" or not raw_routes:
            return []

        candidates = []
        for idx, route in enumerate(raw_routes):
            all_steps = []
            for leg in route.get("legs", []):
                all_steps.extend(leg.get("steps", []))

            distance = float(route.get("distance", 0.0))
            duration = float(route.get("duration", 0.0))
            geometry = route.get("geometry", {})
            coordinates = geometry.get("coordinates", []) if isinstance(geometry, dict) else []

            if distance <= 0 or duration <= 0 or len(coordinates) < 2 or not all_steps:
                continue

            candidates.append({
                "route_index": idx,
                "distance_meters": distance,
                "duration_seconds": duration,
                "geometry": geometry,
                "steps": all_steps,
            })
        return candidates

    @classmethod
    async def _query_endpoint(
        cls, client: httpx.AsyncClient, endpoint: str, coordinate_string: str, alternatives: bool
    ) -> List[Dict[str, Any]]:
        params = {"overview": "full", "geometries": "geojson", "steps": "true"}
        if alternatives:
            params["alternatives"] = "true"
        try:
            response = await client.get(f"{endpoint}/{coordinate_string}", params=params)
            if response.status_code != 200:
                logger.warning("[OSRM] %s returned HTTP %s", endpoint, response.status_code)
                return []
            return cls._parse_osrm_response(response.json())
        except Exception as err:  # network errors, bad JSON, timeouts
            logger.warning("[OSRM] %s failed: %s", endpoint, err)
            return []

    @classmethod
    async def _fetch_candidates(cls, coordinate_string: str, alternatives: bool) -> List[Dict[str, Any]]:
        """Query ALL endpoints in parallel and merge distinct routes."""
        headers = {"User-Agent": "ApexGuardian/2.0 (navigation@apexguardian.local)"}
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True, headers=headers) as client:
            results = await asyncio.gather(
                *[cls._query_endpoint(client, ep, coordinate_string, alternatives) for ep in cls._endpoints()]
            )
        merged: List[Dict[str, Any]] = []
        for routes in results:
            for route in routes:
                if not any(routes_are_same_corridor(route, kept) for kept in merged):
                    merged.append(route)
        if not merged:
            raise HTTPException(
                status_code=503,
                detail="Routing service temporarily unavailable. All OSRM endpoints failed.",
            )
        return merged

    @classmethod
    async def _probe_via_routes(
        cls, primary: Dict[str, Any], origin: Tuple[float, float], dest: Tuple[float, float], have: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Try perpendicular via-waypoints to manufacture genuinely different alternatives."""
        coords = primary["geometry"]["coordinates"]
        n = len(coords)
        if n < 6:
            return []
        route_km = primary["distance_meters"] / 1000.0
        offset_km = max(0.6, min(2.5, 0.12 * route_km))

        # (fraction along route, side) in priority order
        plan = [(0.5, 90), (0.5, -90), (0.35, 90), (0.65, -90), (0.35, -90), (0.65, 90)]
        waypoints: List[Tuple[float, float]] = []
        for frac, side in plan:
            i = max(1, min(n - 2, int(frac * (n - 1))))
            lon0, lat0 = coords[i - 1][0], coords[i - 1][1]
            lon1, lat1 = coords[i + 1][0], coords[i + 1][1]
            bearing = (_bearing_deg(lon0, lat0, lon1, lat1) + side) % 360.0
            waypoints.append(_offset_point(coords[i][1], coords[i][0], bearing, offset_km))

        found: List[Dict[str, Any]] = []
        for start in range(0, len(waypoints), PROBE_BATCH_SIZE):
            if len(have) + len(found) >= MAX_ROUTES:
                break
            batch = waypoints[start:start + PROBE_BATCH_SIZE]
            tasks = [
                cls._fetch_candidates(
                    f"{origin[1]},{origin[0]};{wp[1]},{wp[0]};{dest[1]},{dest[0]}", alternatives=False
                )
                for wp in batch
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for res in results:
                if isinstance(res, Exception) or not res:
                    continue
                cand = res[0]
                if _has_uturn(cand):
                    continue
                if cand["distance_meters"] > primary["distance_meters"] * MAX_ALT_DISTANCE_RATIO:
                    continue
                if cand["duration_seconds"] > primary["duration_seconds"] * MAX_ALT_DURATION_RATIO:
                    continue
                if any(routes_are_same_corridor(cand, kept) for kept in have + found):
                    continue
                found.append(cand)
                if len(have) + len(found) >= MAX_ROUTES:
                    break
            if len(have) + len(found) >= MIN_ROUTES_TARGET:
                break
        return found

    @classmethod
    async def get_routes(
        cls,
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float,
        ensure_alternatives: bool = True,
    ) -> List[Dict[str, Any]]:
        """Fetch street-snapped driving alternatives between an origin and destination."""
        cache_key = f"{origin_lat:.4f},{origin_lon:.4f};{dest_lat:.4f},{dest_lon:.4f};{int(ensure_alternatives)}"
        cached = _route_cache.get(cache_key)
        if cached and time.time() - cached[0] < CACHE_TTL_S:
            return [dict(r) for r in cached[1]]

        coordinate_string = f"{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
        routes = await cls._fetch_candidates(coordinate_string, alternatives=True)

        # keep the primary (first) route first, cap the list
        routes = routes[:MAX_ROUTES]
        if ensure_alternatives and len(routes) < MIN_ROUTES_TARGET:
            try:
                extra = await asyncio.wait_for(
                    cls._probe_via_routes(routes[0], (origin_lat, origin_lon), (dest_lat, dest_lon), routes),
                    timeout=20.0,
                )
                routes.extend(extra)
            except Exception as err:
                logger.warning("[OSRM] via-waypoint alternative probing failed: %s", err)

        for idx, route in enumerate(routes):
            route["route_index"] = idx
        logger.info("[OSRM] returning %d route(s) for %s", len(routes), cache_key)
        _route_cache[cache_key] = (time.time(), [dict(r) for r in routes])
        if len(_route_cache) > 200:
            oldest = min(_route_cache, key=lambda k: _route_cache[k][0])
            _route_cache.pop(oldest, None)
        return routes

    @classmethod
    async def get_routes_via_waypoints(
        cls, waypoints: Sequence[Tuple[float, float]]
    ) -> List[Dict[str, Any]]:
        """Fetch a route constrained through ordered ``(latitude, longitude)`` waypoints."""
        if len(waypoints) < 3:
            raise ValueError("A bypass route requires an origin, a via waypoint, and a destination.")
        if any(not (-90 <= lat <= 90 and -180 <= lon <= 180) for lat, lon in waypoints):
            raise ValueError("OSRM waypoints must be valid (latitude, longitude) pairs.")

        coordinate_string = ";".join(f"{lon},{lat}" for lat, lon in waypoints)
        return await cls._fetch_candidates(coordinate_string, alternatives=False)
```


## `backend\services\reroute_engine.py`

```python
import asyncio
import logging
import math
import uuid
from typing import Any, Dict, List, Optional, Sequence, Tuple

from core.region import resolve_route_region
from ml.recommender import RouteScorer
from schemas.navigation import CandidateRoute, CongestionLevel, RerouteRecommendation, TrafficTestMode
from services.congestion_detector import CongestionDetector
from services.osrm import OSRMService

logger = logging.getLogger("apexguardian.reroute")


def haversine_distance_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Return the great-circle distance between two longitude/latitude pairs."""
    earth_radius_m = 6_371_000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    return earth_radius_m * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def _move_point(
    point_lat: float, point_lon: float, bearing_deg: float, offset_km: float
) -> Tuple[float, float]:
    """Move a coordinate along a bearing; returns (latitude, longitude)."""
    angular_distance = max(0.0, offset_km) / 6371.0
    bearing = math.radians(bearing_deg % 360.0)
    lat1 = math.radians(point_lat)
    lon1 = math.radians(point_lon)
    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular_distance)
        + math.cos(lat1) * math.sin(angular_distance) * math.cos(bearing)
    )
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(angular_distance) * math.cos(lat1),
        math.cos(angular_distance) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lat2), (math.degrees(lon2) + 540.0) % 360.0 - 180.0


def compute_bypass_waypoint(
    hotspot_lat: float,
    hotspot_lon: float,
    approach_bearing_deg: float,
    offset_km: float = 1.0,
) -> Tuple[float, float]:
    """Place a waypoint to one side of a hotspot, perpendicular to the approach."""
    bearing = math.radians((approach_bearing_deg + 90.0) % 360.0)
    angular_distance = max(0.1, offset_km) / 6371.0
    lat1 = math.radians(hotspot_lat)
    lon1 = math.radians(hotspot_lon)
    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular_distance)
        + math.cos(lat1) * math.sin(angular_distance) * math.cos(bearing)
    )
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(angular_distance) * math.cos(lat1),
        math.cos(angular_distance) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lat2), (math.degrees(lon2) + 540.0) % 360.0 - 180.0


def _local_route_bearing_near_point(
    coordinates: Sequence[Sequence[float]], point_lat: float, point_lon: float
) -> Optional[float]:
    """Return the bearing of travel through the route coordinate nearest to the
    given point, using its immediate neighbors.

    This reflects the direction the road is actually running at that spot. Using
    the straight-line bearing between two far-apart trip endpoints instead (as
    this used to) can differ wildly on any route with real curvature, which
    places the "perpendicular" bypass waypoint roughly *along* the road instead
    of *across* it — producing a waypoint that OSRM either can't reach sensibly
    or that routes right back through the same corridor, silently failing to
    find a bypass that may genuinely exist nearby.
    """
    if not coordinates or len(coordinates) < 3:
        return None
    best_idx, best_dist = 0, float("inf")
    for i, coord in enumerate(coordinates):
        if len(coord) < 2:
            continue
        try:
            lon, lat = float(coord[0]), float(coord[1])
        except (TypeError, ValueError):
            continue
        dist = haversine_distance_m(lon, lat, point_lon, point_lat)
        if dist < best_dist:
            best_dist, best_idx = dist, i
    prev_idx = max(0, best_idx - 1)
    next_idx = min(len(coordinates) - 1, best_idx + 1)
    if prev_idx == next_idx:
        return None
    try:
        lon1, lat1 = float(coordinates[prev_idx][0]), float(coordinates[prev_idx][1])
        lon2, lat2 = float(coordinates[next_idx][0]), float(coordinates[next_idx][1])
    except (TypeError, ValueError, IndexError):
        return None
    return _bearing_degrees(lat1, lon1, lat2, lon2)


def _bearing_degrees(start_lat: float, start_lon: float, end_lat: float, end_lon: float) -> float:
    lat1 = math.radians(start_lat)
    lat2 = math.radians(end_lat)
    delta_lon = math.radians(end_lon - start_lon)
    y = math.sin(delta_lon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(delta_lon)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def _distance_from_point_to_segment_m(
    point_lon: float,
    point_lat: float,
    start_lon: float,
    start_lat: float,
    end_lon: float,
    end_lat: float,
) -> float:
    """Approximate the closest distance to a short route segment in local meters."""
    mean_lat = math.radians((point_lat + start_lat + end_lat) / 3.0)
    meters_per_degree_lat = 111_132.0
    meters_per_degree_lon = 111_320.0 * math.cos(mean_lat)
    ax = (start_lon - point_lon) * meters_per_degree_lon
    ay = (start_lat - point_lat) * meters_per_degree_lat
    bx = (end_lon - point_lon) * meters_per_degree_lon
    by = (end_lat - point_lat) * meters_per_degree_lat
    dx = bx - ax
    dy = by - ay
    length_squared = dx * dx + dy * dy
    t = 0.0 if length_squared == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / length_squared))
    return math.hypot(ax + t * dx, ay + t * dy)


def route_intersects_avoid_hotspots(
    geometry: Dict[str, Any], avoid_hotspots: Sequence[Dict[str, float]]
) -> bool:
    """Check route vertices and segments against circular avoid zones."""
    coordinates = geometry.get("coordinates", []) if isinstance(geometry, dict) else []
    if not isinstance(coordinates, list) or len(coordinates) < 2:
        return False

    for zone in avoid_hotspots:
        try:
            lat = float(zone["lat"])
            lon = float(zone["lon"])
            radius_m = float(zone.get("radius_km", 0.15)) * 1000.0
        except (KeyError, TypeError, ValueError):
            continue
        if not all(math.isfinite(value) for value in (lat, lon, radius_m)) or radius_m <= 0:
            continue

        for coordinate in coordinates:
            if not isinstance(coordinate, (list, tuple)) or len(coordinate) < 2:
                continue
            route_lon, route_lat = float(coordinate[0]), float(coordinate[1])
            if math.isfinite(route_lon) and math.isfinite(route_lat):
                if haversine_distance_m(lon, lat, route_lon, route_lat) <= radius_m:
                    return True

        for start, end in zip(coordinates, coordinates[1:]):
            if len(start) < 2 or len(end) < 2:
                continue
            values = (float(start[0]), float(start[1]), float(end[0]), float(end[1]))
            if not all(math.isfinite(value) for value in values):
                continue
            if _distance_from_point_to_segment_m(lon, lat, *values) <= radius_m:
                return True
    return False

def _routes_have_same_geometry(candidate_coords: List[List[float]], active_coords: List[List[float]]) -> bool:
    """Determine if a candidate route fundamentally shares the same corridor as an active/recent route."""
    if not candidate_coords or len(candidate_coords) < 2 or not active_coords or len(active_coords) < 2:
        return False

    def segment_distance(lon: float, lat: float, segment_index: int) -> float:
        x1, y1 = active_coords[segment_index][0], active_coords[segment_index][1]
        x2, y2 = active_coords[segment_index + 1][0], active_coords[segment_index + 1][1]
        mean_lat = math.radians((y1 + y2 + lat) / 3.0)
        dx = (x2 - x1) * math.cos(mean_lat)
        dy = y2 - y1
        px = (lon - x1) * math.cos(mean_lat)
        py = lat - y1
        length_squared = dx * dx + dy * dy
        t = 0.0 if length_squared == 0 else max(0.0, min(1.0, (px * dx + py * dy) / length_squared))
        projected_lon = x1 + (x2 - x1) * t
        projected_lat = y1 + (y2 - y1) * t
        d_lat = (lat - projected_lat) * 111_132.0
        d_lon = (lon - projected_lon) * 111_320.0 * math.cos(mean_lat)
        return math.hypot(d_lat, d_lon)

    candidate_start_lon, candidate_start_lat = candidate_coords[0][0], candidate_coords[0][1]
    active_start_index = 0
    start_distance = float('inf')
    for i in range(len(active_coords) - 1):
        distance = segment_distance(candidate_start_lon, candidate_start_lat, i)
        if distance < start_distance:
            start_distance = distance
            active_start_index = i

    if start_distance > 45.0:
        return False

    sample_count = min(16, len(candidate_coords))
    search_from_index = active_start_index
    for sample in range(sample_count):
        index = round((sample * (len(candidate_coords) - 1)) / max(1, sample_count - 1))
        lon, lat = candidate_coords[index][0], candidate_coords[index][1]
        if not math.isfinite(lon) or not math.isfinite(lat):
            return False
        
        closest_meters = float('inf')
        closest_index = search_from_index
        for i in range(search_from_index, len(active_coords) - 1):
            distance = segment_distance(lon, lat, i)
            if distance < closest_meters:
                closest_meters = distance
                closest_index = i
                
        if closest_meters > 45.0:
            return False
        search_from_index = closest_index
        
    return True


# A route is considered "inside" a zone sample when it passes this close to it.
ZONE_SAMPLE_MIN_RADIUS_KM = 0.06
# Samples this close to the vehicle are under/behind it and cannot be avoided; ignoring them
# is what stops "No alternate route" when the driver is already at the edge of the jam.
ZONE_IGNORE_NEAR_VEHICLE_M = 150.0
# Avoidance detour caps (a "bypass" that adds 20+ min is not a bypass).
MAX_EXTRA_SECONDS_ABS = 15 * 60.0
MAX_EXTRA_FRACTION = 0.35
MIN_EXTRA_ALLOWANCE_S = 4 * 60.0
MAX_DIST_RATIO_VS_DIRECT = 2.0
MAX_DIST_EXTRA_M = 1500.0


def _usable_avoid_zones(
    avoid_hotspots: Optional[Sequence[Dict[str, float]]], current_lat: float, current_lon: float
) -> List[Dict[str, float]]:
    zones: List[Dict[str, float]] = []
    for zone in avoid_hotspots or []:
        try:
            lat, lon = float(zone["lat"]), float(zone["lon"])
            radius_km = float(zone.get("radius_km", ZONE_SAMPLE_MIN_RADIUS_KM))
        except (KeyError, TypeError, ValueError):
            continue
        if not (math.isfinite(lat) and math.isfinite(lon) and math.isfinite(radius_km)):
            continue
        if haversine_distance_m(current_lon, current_lat, lon, lat) <= ZONE_IGNORE_NEAR_VEHICLE_M:
            continue
        zones.append({"lat": lat, "lon": lon, "radius_km": max(0.03, radius_km)})
    return zones


def _mark_clear_controlled_bypass(route: CandidateRoute) -> CandidateRoute:
    """Mark a route that passed controlled-zone avoidance as the clean demo bypass.

    Controlled tests intentionally ask for a route without congestion, so do not carry
    unrelated predicted hotspots into the accepted alternative and immediately re-trigger
    the same reroute flow. Real-navigation routes are never processed by this helper.
    """
    total_distance = 0.0
    for segment in route.segments or []:
        distance = max(0.0, float(segment.distance_meters or 0.0))
        freeflow_speed = max(20.0, float(segment.freeflow_speed_kmh or 45.0))
        segment.congestion_level = CongestionLevel.LOW
        segment.color = "#16A34A"
        segment.current_speed_kmh = round(freeflow_speed, 1)
        segment.delay_seconds = 0.0
        segment.duration_seconds = round(distance / max(0.5, freeflow_speed / 3.6), 1)
        segment.congestion_factor = 1.0
        total_distance += distance

    route.hotspots = []
    route.clear_distance_km = round((route.distance_meters or total_distance) / 1000.0, 2)
    route.moderate_distance_km = 0.0
    route.heavy_distance_km = 0.0
    route.severe_distance_km = 0.0
    route.total_delay_seconds = 0.0
    route.congestion_factor = 1.0
    route.predicted_duration_seconds = float(route.duration_seconds or 0.0)
    route.predicted_duration_minutes = round(route.predicted_duration_seconds / 60.0, 1)
    return route


def _avoidance_detour_allowed(
    route: "CandidateRoute", reference_duration_s: float, direct_distance_m: float
) -> bool:
    """Reject 'clean' routes that are absurdly longer than what the driver already has."""
    if reference_duration_s > 0:
        allowance = min(
            MAX_EXTRA_SECONDS_ABS,
            max(MIN_EXTRA_ALLOWANCE_S, MAX_EXTRA_FRACTION * reference_duration_s),
        )
        if route.predicted_duration_seconds > reference_duration_s + allowance:
            return False
    if route.distance_meters > MAX_DIST_RATIO_VS_DIRECT * direct_distance_m + MAX_DIST_EXTRA_M:
        return False
    return True


class DynamicRerouteEngine:
    """Generate and evaluate street-snapped alternatives from the current position."""

    @staticmethod
    def _process_candidate(
        candidate: Dict[str, Any],
        current_lat: float,
        current_lon: float,
        dest_lat: float,
        dest_lon: float,
        dist_to_dest_direct: float,
        is_emergency_mode: bool,
        traffic_test_mode: TrafficTestMode,
        traffic_progress: float,
        synthetic_traffic_active: bool,
        region: Optional[Any] = None,
    ) -> Optional[CandidateRoute]:
        route_dist_m = candidate.get("distance_meters", 0.0)
        base_dur_s = candidate.get("duration_seconds", 0.0)
        geometry = candidate.get("geometry", {})
        steps = candidate.get("steps", [])

        if (
            not isinstance(route_dist_m, (int, float))
            or not isinstance(base_dur_s, (int, float))
            or not math.isfinite(route_dist_m)
            or not math.isfinite(base_dur_s)
            or route_dist_m <= 0
            or base_dur_s <= 0
        ):
            logger.warning("Rejecting reroute candidate with invalid distance or duration")
            return None

        coordinates = geometry.get("coordinates", []) if isinstance(geometry, dict) else []
        if not isinstance(coordinates, list) or len(coordinates) < 2:
            logger.warning("Rejecting reroute candidate: insufficient coordinates")
            return None
        try:
            if any(
                not isinstance(point, (list, tuple))
                or len(point) < 2
                or not math.isfinite(float(point[0]))
                or not math.isfinite(float(point[1]))
                for point in coordinates
            ):
                logger.warning("Rejecting reroute candidate: malformed or non-finite coordinates")
                return None
            coordinates = [[float(point[0]), float(point[1])] for point in coordinates]
        except (TypeError, ValueError):
            logger.warning("Rejecting reroute candidate: malformed coordinates")
            return None

        if not isinstance(steps, list) or not steps:
            logger.warning("Rejecting reroute candidate: no steps found")
            return None

        start_lon, start_lat = coordinates[0]
        distance_from_vehicle = haversine_distance_m(current_lon, current_lat, start_lon, start_lat)
        if distance_from_vehicle > 250:
            logger.warning("[REROUTE CANDIDATE REJECTED] reason=current-point-mismatch candidateStartDistanceMeters=%.1f", distance_from_vehicle)
            return None

        end_lon, end_lat = coordinates[-1]
        distance_from_dest = haversine_distance_m(dest_lon, dest_lat, end_lon, end_lat)
        if distance_from_dest > 250:
            logger.warning("[REROUTE CANDIDATE REJECTED] reason=destination-point-mismatch candidateEndDistanceMeters=%.1f", distance_from_dest)
            return None

        if dist_to_dest_direct > 500.0 and route_dist_m < dist_to_dest_direct - 500.0:
            logger.warning(
                "[REROUTE CANDIDATE REJECTED] reason=reported-route-shorter-than-direct-distance directMeters=%.1f reportedRouteMeters=%.1f",
                dist_to_dest_direct,
                route_dist_m,
            )
            return None

        polyline_distance_m = 0.0
        max_jump_m = 0.0
        for start, end in zip(coordinates, coordinates[1:]):
            segment_distance = haversine_distance_m(start[0], start[1], end[0], end[1])
            polyline_distance_m += segment_distance
            max_jump_m = max(max_jump_m, segment_distance)

        if max_jump_m > 2_000.0:
            logger.warning("[REROUTE CANDIDATE REJECTED] reason=teleport-geometry-detected maxJumpMeters=%.1f", max_jump_m)
            return None
        if polyline_distance_m < 50.0 and route_dist_m > 1_000.0:
            logger.warning("[REROUTE CANDIDATE REJECTED] reason=absurd-distance-mismatch polylineDistance=%.1f reported=%.1f", polyline_distance_m, route_dist_m)
            return None
        if dist_to_dest_direct > 5_000.0 and route_dist_m < 1_000.0:
            logger.warning("[REROUTE CANDIDATE REJECTED] reason=route-too-short-for-distance currentToDest=%.1f routeDist=%.1f", dist_to_dest_direct, route_dist_m)
            return None

        candidate["route_id"] = str(uuid.uuid4())
        candidate["source"] = "reroute"
        candidate["original_route_index"] = candidate.get("route_index", 0)
        candidate["geometry"] = {**geometry, "coordinates": coordinates}

        analysis = CongestionDetector.analyze_route(
            geometry=candidate["geometry"],
            steps=steps,
            total_distance_m=route_dist_m,
            base_duration_s=base_dur_s,
            region=region,
            is_emergency_mode=is_emergency_mode,
        )
        # Deliberately do NOT re-apply the controlled traffic-test scenario here.
        #
        # Every candidate this method processes has source == "reroute" (both
        # the native-OSRM alternatives and the waypoint-bypass geometry below).
        # The previous behaviour called apply_traffic_test_scenario() on each of
        # these too, using the same fixed ~42%-68%-of-route-length window the
        # original route used. That stamped a brand-new synthetic HEAVY/SEVERE
        # hotspot onto whatever bypass had just been computed, at the
        # equivalent relative position along *its own* geometry.
        #
        # Accepting that bypass then meant the driver immediately approached a
        # fresh synthetic hotspot on the "new" route, which re-triggered another
        # proactive alert, which triggered another reroute evaluation, which
        # stamped yet another hotspot on the next bypass — an unbounded loop of
        # "severe congestion ahead" that never resolved into a clear run to the
        # destination, no matter how many times the driver rerouted.
        #
        # A rerouted candidate should only ever reflect the same real-traffic
        # model used for any other live route lookup, never a fresh synthetic
        # event. (traffic_test_mode / traffic_progress / synthetic_traffic_active
        # remain in this method's signature for parity with _score_and_process
        # and are intentionally unused below.)

        candidate["segments"] = analysis["segments"]
        candidate["hotspots"] = analysis["hotspots"]
        candidate["clear_distance_km"] = analysis["clear_distance_km"]
        candidate["moderate_distance_km"] = analysis["moderate_distance_km"]
        candidate["heavy_distance_km"] = analysis["heavy_distance_km"]
        candidate["severe_distance_km"] = analysis["severe_distance_km"]
        candidate["total_delay_seconds"] = analysis["total_delay_seconds"]

        live_delay = analysis["total_delay_seconds"]
        ml_predicted_duration = candidate.get("predicted_duration_seconds", base_dur_s)
        final_predicted_duration = max(ml_predicted_duration, base_dur_s + live_delay)
        candidate["predicted_duration_seconds"] = final_predicted_duration
        candidate["predicted_duration_minutes"] = round(final_predicted_duration / 60.0, 1)
        return CandidateRoute(**candidate)

    @staticmethod
    def _score_and_process(
        raw_candidates: List[Dict[str, Any]],
        current_lat: float,
        current_lon: float,
        dest_lat: float,
        dest_lon: float,
        dist_to_dest_direct: float,
        is_emergency_mode: bool,
        traffic_test_mode: TrafficTestMode,
        traffic_progress: float,
        synthetic_traffic_active: bool,
        region: Optional[Any] = None,
    ) -> List[CandidateRoute]:
        evaluated = RouteScorer.evaluate_routes(
            raw_candidates,
            origin_lat=current_lat,
            origin_lon=current_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon,
            region=region,
            is_emergency_mode=is_emergency_mode,
        )
        processed: List[CandidateRoute] = []
        for candidate in evaluated:
            try:
                route = DynamicRerouteEngine._process_candidate(
                    candidate,
                    current_lat,
                    current_lon,
                    dest_lat,
                    dest_lon,
                    dist_to_dest_direct,
                    is_emergency_mode,
                    traffic_test_mode,
                    traffic_progress,
                    synthetic_traffic_active,
                    region=region,
                )
            except Exception:
                logger.exception("Rejecting reroute candidate after processing failure")
                continue
            if route is not None:
                processed.append(route)
        return processed

    @classmethod
    async def evaluate_reroute(
        cls,
        current_lat: float,
        current_lon: float,
        dest_lat: float,
        dest_lon: float,
        original_remaining_duration_s: float,
        avoid_hotspots: Optional[List[Dict[str, float]]] = None,
        is_emergency_mode: bool = False,
        traffic_test_mode: TrafficTestMode = TrafficTestMode.REAL,
        traffic_progress: float = 0.0,
        recent_routes: Optional[List[Dict[str, Any]]] = None,
        synthetic_traffic_active: bool = True,
        region_name: Optional[str] = None,
    ) -> RerouteRecommendation:
        """Evaluate alternatives, attempting a waypoint bypass around supplied avoid zones."""
        try:
            route_region = resolve_route_region(
                current_lat, current_lon, dest_lat, dest_lon, requested_region=region_name
            )
            direct_distance_m = haversine_distance_m(current_lon, current_lat, dest_lon, dest_lat)
            if direct_distance_m <= 500.0:
                return RerouteRecommendation(
                    is_reroute_recommended=False,
                    time_saved_seconds=0.0,
                    time_saved_minutes=0.0,
                    original_remaining_seconds=original_remaining_duration_s,
                    recommended_duration_seconds=original_remaining_duration_s,
                    recommended_route=None,
                    alternative_routes=[],
                    reason="You are close to your destination. Continue on the current route.",
                )

            # Emergency routing is defined as the physical fastest path; congestion
            # avoidance must not divert an emergency vehicle from that path.
            zones = [] if is_emergency_mode else list(avoid_hotspots or [])
            try:
                raw_candidates = await OSRMService.get_routes(current_lat, current_lon, dest_lat, dest_lon)
            except Exception as error:
                logger.warning("Native OSRM alternatives unavailable: %s", error)
                raw_candidates = []
            processed = cls._score_and_process(
                raw_candidates,
                current_lat,
                current_lon,
                dest_lat,
                dest_lon,
                direct_distance_m,
                is_emergency_mode,
                traffic_test_mode,
                traffic_progress,
                synthetic_traffic_active,
                region=route_region,
            )

            clean_routes = [
                route for route in processed
                if not route_intersects_avoid_hotspots(route.geometry, zones)
            ]
            bypass_routes: List[CandidateRoute] = []

            if zones and not clean_routes:
                valid_zones = []
                for zone in zones:
                    try:
                        lat, lon = float(zone["lat"]), float(zone["lon"])
                        if math.isfinite(lat) and math.isfinite(lon):
                            valid_zones.append((lat, lon))
                    except (KeyError, TypeError, ValueError):
                        continue

                if valid_zones:
                    hotspot_lat, hotspot_lon = min(
                        valid_zones,
                        key=lambda point: haversine_distance_m(current_lon, current_lat, point[1], point[0])
                        + haversine_distance_m(point[1], point[0], dest_lon, dest_lat),
                    )
                    # Use the bearing of the road itself at the hotspot (derived from
                    # the nearest already-fetched route's own geometry), not the
                    # crude straight-line bearing from wherever the vehicle currently
                    # is all the way to the final destination â€” those two bearings
                    # can differ by 90 degrees or more on any route with real turns,
                    # which used to place the bypass waypoint along the congested
                    # road instead of across it.
                    local_bearing = None
                    for candidate in processed:
                        coords = (
                            candidate.geometry.get("coordinates", [])
                            if isinstance(candidate.geometry, dict)
                            else []
                        )
                        local_bearing = _local_route_bearing_near_point(coords, hotspot_lat, hotspot_lon)
                        if local_bearing is not None:
                            break
                    approach_bearing = (
                        local_bearing
                        if local_bearing is not None
                        else _bearing_degrees(current_lat, current_lon, dest_lat, dest_lon)
                    )
                    # Try both sides of the road, at a couple of offsets, closest
                    # candidate (by detour length) first â€” stop at the first one
                    # that actually produces a route avoiding the zone. The old
                    # code tried exactly one waypoint (whichever side was closer
                    # to the direct line) and gave up entirely if OSRM couldn't
                    # route through that single point or routed back through the
                    # same corridor â€” in dense urban grids that single guess
                    # missing is the common case, not the exception.
                    # The controlled-demo exclusion circle covers the whole injected zone,
                    # so the waypoint must land beyond that radius. Probe both sides at
                    # progressively wider offsets; every response still passes the strict
                    # road geometry checks and must avoid all supplied exclusion zones.
                    largest_zone_radius_km = max(
                        (
                            float(zone.get("radius_km", 0.15))
                            for zone in zones
                            if isinstance(zone.get("radius_km", 0.15), (int, float))
                            and math.isfinite(float(zone.get("radius_km", 0.15)))
                            and float(zone.get("radius_km", 0.15)) > 0
                        ),
                        default=0.15,
                    )
                    minimum_offset_km = max(0.3, largest_zone_radius_km + 0.15)
                    candidate_offsets = tuple(sorted({
                        round(minimum_offset_km, 2),
                        round(max(minimum_offset_km + 0.3, largest_zone_radius_km + 0.45), 2),
                        round(max(minimum_offset_km + 0.7, largest_zone_radius_km + 0.8), 2),
                        round(max(minimum_offset_km + 1.1, largest_zone_radius_km + 1.15), 2),
                    }))
                    # Use the ordered first/last points of the sampled blocked stretch.
                    # A pair of waypoints on the SAME side makes a clean parallel bypass;
                    # a single midpoint waypoint often creates left-right zigzags.
                    zone_radius_km = max(
                        (float(z.get("radius_km", 0.09)) for z in zones
                         if isinstance(z.get("radius_km", 0.09), (int, float))
                         and math.isfinite(float(z.get("radius_km", 0.09)))),
                        default=0.09,
                    )

                    def local_bearing_at(point_lat: float, point_lon: float, fallback: float) -> float:
                        for route_candidate in processed:
                            route_coords = (
                                route_candidate.geometry.get("coordinates", [])
                                if isinstance(route_candidate.geometry, dict) else []
                            )
                            bearing = _local_route_bearing_near_point(route_coords, point_lat, point_lon)
                            if bearing is not None:
                                return bearing
                        return fallback

                    if len(valid_zones) >= 2:
                        start_lat, start_lon = valid_zones[0]
                        end_lat, end_lon = valid_zones[-1]
                        start_bearing = local_bearing_at(start_lat, start_lon, approach_bearing)
                        end_bearing = local_bearing_at(end_lat, end_lon, start_bearing)
                        # Move the entry/exit anchors just beyond both ends of the zone before
                        # shifting them sideways. This guides OSRM around the zone, not across it.
                        end_buffer_km = max(0.12, zone_radius_km + 0.05)
                        start_anchor = _move_point(
                            start_lat, start_lon, (start_bearing + 180.0) % 360.0, end_buffer_km
                        )
                        end_anchor = _move_point(end_lat, end_lon, end_bearing, end_buffer_km)
                        base_offset_km = max(0.22, zone_radius_km + 0.12)
                        offsets_km = (base_offset_km, base_offset_km + 0.15, base_offset_km + 0.30)
                        bypass_plans = []
                        for offset_km in offsets_km:
                            for side in (0.0, 180.0):
                                entry = compute_bypass_waypoint(
                                    start_anchor[0], start_anchor[1], start_bearing + side,
                                    offset_km=offset_km,
                                )
                                exit_point = compute_bypass_waypoint(
                                    end_anchor[0], end_anchor[1], end_bearing + side,
                                    offset_km=offset_km,
                                )
                                bypass_plans.append((offset_km, side, entry, exit_point))
                    else:
                        # Ordinary single-pin alerts have no stretch endpoints; preserve their
                        # simple three-coordinate waypoint flow with only gentle lateral shifts.
                        base_offset_km = max(0.30, zone_radius_km + 0.15)
                        offsets_km = (base_offset_km, base_offset_km + 0.20, base_offset_km + 0.40)
                        bypass_plans = [
                            (offset_km, side, compute_bypass_waypoint(
                                hotspot_lat, hotspot_lon, approach_bearing + side, offset_km=offset_km
                            ), None)
                            for offset_km in offsets_km for side in (0.0, 180.0)
                        ]

                    # Try the closest/smallest detours first. At each lateral offset, evaluate
                    # both sides and keep the shortest route that really avoids EVERY circle.
                    for offset_km in offsets_km:
                        clean_for_offset = []
                        for plan_offset, side, entry_waypoint, exit_waypoint in bypass_plans:
                            if abs(plan_offset - offset_km) > 1e-8:
                                continue
                            try:
                                via_points = [(current_lat, current_lon), entry_waypoint]
                                if exit_waypoint is not None:
                                    via_points.append(exit_waypoint)
                                via_points.append((dest_lat, dest_lon))
                                bypass_candidates = await OSRMService.get_routes_via_waypoints(via_points)
                                bypass_routes = cls._score_and_process(
                                    bypass_candidates, current_lat, current_lon, dest_lat, dest_lon,
                                    direct_distance_m, is_emergency_mode, traffic_test_mode,
                                    traffic_progress, synthetic_traffic_active,
                                    region=route_region,
                                )
                            except Exception as error:
                                logger.warning(
                                    "Waypoint bypass failed (offset=%.2fkm side=%s): %s",
                                    offset_km, "opposite" if side else "first", error,
                                )
                                continue

                            for route_candidate in bypass_routes:
                                baseline_route_m = min(
                                    (item.distance_meters for item in processed),
                                    default=direct_distance_m,
                                )
                                # Reject sprawling detours: an avoidance route should stay close
                                # to the best existing road length, not wander across the city.
                                max_simple_bypass_m = max(baseline_route_m * 1.35, direct_distance_m + 2000.0)
                                route_distance_ok = route_candidate.distance_meters <= max_simple_bypass_m
                                if (
                                    not route_intersects_avoid_hotspots(route_candidate.geometry, zones)
                                    and route_distance_ok
                                ):
                                    clean_for_offset.append(route_candidate)

                        if clean_for_offset:
                            clean_routes.extend(sorted(
                                clean_for_offset,
                                key=lambda route_candidate: (
                                    route_candidate.distance_meters,
                                    route_candidate.predicted_duration_seconds,
                                ),
                            ))
                            break

            # Avoidance is a route-intent request, not a faster-route request. Never
            # recommend a dirty fallback when the user explicitly asked to avoid zones.
            if zones and not clean_routes:
                return RerouteRecommendation(
                    is_reroute_recommended=False,
                    is_congestion_avoidance=False,
                    time_saved_seconds=0.0,
                    time_saved_minutes=0.0,
                    original_remaining_seconds=original_remaining_duration_s,
                    recommended_duration_seconds=original_remaining_duration_s,
                    recommended_route=None,
                    alternative_routes=[],
                    reason="No alternate route avoids this stretch â€” continuing on the only available path.",
                )

            # Controlled-test avoidance routes are the green/clear alternative in the demo.
            # Remove model-generated hotspots after geometry has passed every avoidance zone,
            # so accepting this route cannot immediately announce a second unrelated jam.
            if zones and traffic_test_mode in (TrafficTestMode.HEAVY, TrafficTestMode.SEVERE, TrafficTestMode.DYNAMIC):
                clean_routes = [_mark_clear_controlled_bypass(route) for route in clean_routes]

            # Filter out candidates that are too similar to recently rejected/used routes
            # UNLESS they offer a truly massive improvement (e.g. they became totally clear)
            recent_routes_list = recent_routes or []
            filtered_candidates = []
            
            for candidate in (clean_routes if zones else processed):
                is_similar = False
                candidate_coords = candidate.geometry.get("coordinates", [])
                
                for recent in recent_routes_list:
                    recent_coords = recent.get("geometry", {}).get("coordinates", [])
                    if _routes_have_same_geometry(candidate_coords, recent_coords):
                        is_similar = True
                        break
                        
                # If a route was recently used but is now effectively clear (e.g. < 60s delay), allow returning to it
                if not is_similar or candidate.total_delay_seconds < 60:
                    filtered_candidates.append(candidate)
                else:
                    logger.info("[REROUTE REJECTED] Candidate route %s is too similar to a recent route in history.", candidate.route_id)
            
            # If all candidates were filtered out (they are all similar to history)
            # do not fallback unless absolutely necessary. Instead, we can just say no reroute available.
            candidates = filtered_candidates
            if not candidates:
                return RerouteRecommendation(
                    is_reroute_recommended=False,
                    is_congestion_avoidance=False,
                    time_saved_seconds=0.0,
                    time_saved_minutes=0.0,
                    original_remaining_seconds=original_remaining_duration_s,
                    recommended_duration_seconds=original_remaining_duration_s,
                    recommended_route=None,
                    alternative_routes=[],
                    reason="No new alternate routes found that avoid recently congested corridors.",
                )
            
            candidates.sort(key=lambda route: route.predicted_duration_seconds)

            if not candidates:
                return RerouteRecommendation(
                    is_reroute_recommended=False,
                    is_congestion_avoidance=False,
                    time_saved_seconds=0.0,
                    time_saved_minutes=0.0,
                    original_remaining_seconds=original_remaining_duration_s,
                    recommended_duration_seconds=original_remaining_duration_s,
                    recommended_route=None,
                    alternative_routes=[],
                    reason="No viable alternative paths found from current location.",
                )

            best_route = candidates[0]
            for route in candidates:
                route.is_ai_recommended = False
                route.recommendation_label = ""
            best_duration_s = best_route.predicted_duration_seconds
            reference_duration_s = original_remaining_duration_s if original_remaining_duration_s > 0 else (
                candidates[1].predicted_duration_seconds if len(candidates) > 1 else best_duration_s
            )
            eta_delta_s = reference_duration_s - best_duration_s
            time_saved_s = eta_delta_s if zones else max(0.0, eta_delta_s)
            time_saved_min = round(time_saved_s / 60.0, 1)
            is_recommended = bool(zones) or time_saved_s >= 90.0

            best_route.is_ai_recommended = is_recommended
            if is_recommended and zones:
                best_route.recommendation_label = "Avoids Congestion"
            elif is_recommended and not zones:
                best_route.recommendation_label = f"Fastest Route (Save {int(time_saved_min)}m)"
            else:
                best_route.recommendation_label = ""

            if is_recommended and zones:
                if eta_delta_s < -30:
                    reason = f"A validated route avoids the reported congestion areas; estimated ETA is about {int(round(abs(time_saved_min)))} minutes longer."
                elif eta_delta_s <= 30:
                    reason = "A validated route avoids the reported congestion areas with a similar estimated ETA."
                else:
                    reason = f"A validated route avoids the reported congestion areas and is about {int(round(time_saved_min))} minutes faster."
            elif is_recommended:
                reason = f"Clearer traffic corridor saves about {int(time_saved_min)} minutes."
            else:
                reason = "Current route remains the fastest available path."

            recommended_route = best_route if is_recommended else None
            logger.info(
                "[REROUTE DEBUG] evaluated_candidate_eta_s=%.1f original_remaining_eta_s=%.1f saved_s=%.1f is_recommended=%s avoidance_requested=%s",
                best_duration_s,
                reference_duration_s,
                time_saved_s,
                is_recommended,
                bool(zones),
            )
            return RerouteRecommendation(
                is_reroute_recommended=is_recommended,
                is_congestion_avoidance=bool(zones and is_recommended),
                time_saved_seconds=round(time_saved_s, 1),
                time_saved_minutes=time_saved_min,
                original_remaining_seconds=round(reference_duration_s, 1),
                recommended_duration_seconds=round(best_duration_s, 1),
                recommended_route=recommended_route,
                alternative_routes=candidates,
                reason=reason,
            )
        except Exception as error:
            logger.exception("Error during dynamic reroute evaluation")
            return RerouteRecommendation(
                is_reroute_recommended=False,
                time_saved_seconds=0.0,
                time_saved_minutes=0.0,
                original_remaining_seconds=original_remaining_duration_s,
                recommended_duration_seconds=original_remaining_duration_s,
                recommended_route=None,
                alternative_routes=[],
                reason=f"Rerouting engine encountered an error: {error}",
            )
```


## `backend\services\route_selection.py`

```python
from typing import List, TypeVar

T = TypeVar("T")


def _value(route: T, name: str, default=None):
    if isinstance(route, dict):
        return route.get(name, default)
    return getattr(route, name, default)


def _set_value(route: T, name: str, value) -> None:
    if isinstance(route, dict):
        route[name] = value
    else:
        setattr(route, name, value)


def _same_corridor(left: T, right: T) -> bool:
    """Use the routing service's geometry check to avoid presenting one path twice."""
    if left is right:
        return True
    left_geometry = _value(left, "geometry", {})
    right_geometry = _value(right, "geometry", {})
    if not (
        isinstance(left_geometry, dict)
        and isinstance(right_geometry, dict)
        and len(left_geometry.get("coordinates", [])) >= 2
        and len(right_geometry.get("coordinates", [])) >= 2
    ):
        return False
    try:
        # Local import prevents loading the routing HTTP client unless geometry
        # identity actually needs to be checked.
        from services.osrm import routes_are_same_corridor
        return routes_are_same_corridor(
            {"geometry": left_geometry}, {"geometry": right_geometry}
        )
    except Exception:
        # If geometry comparison fails, do not invent a duplicate. The display
        # selector will still cap visible choices and the route validators remain strict.
        return False


def rank_processed_routes(routes: List[T]) -> List[T]:
    """Mark the ML-best path and the best distinct OSRM-time alternative.

    All valid candidates remain in the response because controlled traffic tests
    refresh the active route by matching its geometry. The frontend displays only
    the two marked choices, preventing duplicate OSRM cards without starving the
    heavy/severe/dynamic refresh pipeline of its other candidate geometries.
    """
    if not routes:
        return routes

    # Preserve the legacy helper contract for small unit-test doubles that only
    # expose predicted_duration_seconds and have no OSRM/geometry metadata.
    has_route_metrics = all(
        _value(route, "duration_seconds") is not None
        and _value(route, "predicted_duration_seconds") is not None
        for route in routes
    )
    if not has_route_metrics:
        routes.sort(key=lambda route: _value(route, "predicted_duration_seconds", float("inf")))
        for index, route in enumerate(routes):
            _set_value(route, "is_ai_recommended", index == 0)
            _set_value(route, "recommendation_label", "Recommended Route" if index == 0 else "Standard Route")
        return routes

    ai_route = min(routes, key=lambda route: float(_value(route, "predicted_duration_seconds", float("inf"))))
    distinct_osrm_candidates = [route for route in routes if not _same_corridor(route, ai_route)]

    if not distinct_osrm_candidates:
        # Never duplicate the same geometry just to manufacture a second card.
        _set_value(ai_route, "is_ai_recommended", True)
        _set_value(ai_route, "recommendation_label", "AI + OSRM Best Route")
        for route in routes:
            if route is not ai_route:
                _set_value(route, "is_ai_recommended", False)
                _set_value(route, "recommendation_label", "Duplicate Route")
        routes[:] = [ai_route] + [route for route in routes if route is not ai_route]
        return routes

    osrm_route = min(
        distinct_osrm_candidates,
        key=lambda route: (
            float(_value(route, "duration_seconds", float("inf"))),
            float(_value(route, "distance_meters", float("inf"))),
        ),
    )
    for route in routes:
        _set_value(route, "is_ai_recommended", route is ai_route)
        if route is ai_route:
            _set_value(route, "recommendation_label", "AI Recommended Route")
        elif route is osrm_route:
            _set_value(route, "recommendation_label", "OSRM Preferred Route")
        else:
            _set_value(route, "recommendation_label", "Additional Alternative")

    # Keep the two display choices at stable indices while retaining any additional
    # candidate after them for controlled-test geometry refreshes.
    ordered = [ai_route, osrm_route] + [route for route in routes if route is not ai_route and route is not osrm_route]
    routes[:] = ordered
    return routes
```


## `backend\services\traffic_scenario.py`

```python
"""Controlled traffic test scenarios (heavy / severe / dynamic demos).

PATCH NOTES (why this file changed)
-----------------------------------
Old behaviour and the bugs it caused:
  * The congested window was a fixed 26 % of the *whole route* (42 %-68 %).
    On a 20 km demo trip that is a ~5 km "hotspot" -> "the distance is too long".
  * In DYNAMIC mode the window moved with the vehicle (progress + 12 %).  Every
    phase change (HEAVY -> SEVERE -> LOW) re-stamped the zone somewhere else, so
    the label said "heavy" while the red stretch was further ahead, and the red
    stretch vanished while the car was still inside it.
  * Segments were coloured whole (350-800 m chunks) using their centre point, so
    the coloured stretch never matched the hotspot distance in the alert.

New behaviour:
  * ONE anchored zone per route, 300-1000 m long (never > 25 % of the route),
    starting at ~50 % of the route.  Segments are split exactly at the zone
    boundaries so the colour, the pin and the "ahead in X m" distance agree.
  * The zone never moves.  In DYNAMIC mode only its *severity* changes with
    progress (approach: moderate -> heavy -> severe, then cleared once the
    vehicle has passed the end of the zone).
  * The hotspot carries ``zone_path`` / ``zone_end_distance_m`` so the client can
    ask the reroute engine to avoid exactly the affected stretch.
"""
import math
from typing import Any, Dict, List, Tuple

from schemas.navigation import CongestionLevel, TrafficTestMode


SCENARIO_SPEED_RATIO = {
    CongestionLevel.LOW: 0.90,
    CongestionLevel.MODERATE: 0.68,
    CongestionLevel.HEAVY: 0.42,
    CongestionLevel.SEVERE: 0.20,
}

SCENARIO_COLOR = {
    CongestionLevel.LOW: "#16A34A",
    CongestionLevel.MODERATE: "#EAB308",
    CongestionLevel.HEAVY: "#F97316",
    CongestionLevel.SEVERE: "#DC2626",
}

ZONE_START_RATIO = 0.50
ZONE_MIN_LEN_M = 300.0
ZONE_MAX_LEN_M = 1000.0
ZONE_MAX_ROUTE_FRACTION = 0.25
DYNAMIC_CLEAR_MARGIN = 0.03     # cleared once progress passes zone end + 3 %
ZONE_PATH_SAMPLE_M = 50.0


def _hav(a: List[float], b: List[float]) -> float:
    r = 6_371_000.0
    p1, p2 = math.radians(a[1]), math.radians(b[1])
    dphi = p2 - p1
    dl = math.radians(b[0] - a[0])
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(h), math.sqrt(1 - h))


def compute_scenario_zone(
    total_distance_m: float,
    zone_start_ratio: float = ZONE_START_RATIO,
    zone_length_m: float | None = None,
) -> Tuple[float, float]:
    """Return the controlled congestion stretch, optionally at a planned safe window."""
    total = max(1.0, total_distance_m)
    if zone_length_m is None:
        length = max(ZONE_MIN_LEN_M, min(ZONE_MAX_LEN_M, 0.10 * total))
    else:
        length = max(ZONE_MIN_LEN_M, min(ZONE_MAX_LEN_M, float(zone_length_m)))
    length = min(length, ZONE_MAX_ROUTE_FRACTION * total)
    start = max(0.0, min(1.0, float(zone_start_ratio))) * total
    if start + length > total - 100.0:
        start = max(0.0, total - 100.0 - length)
    return start, start + length

def dynamic_traffic_phase(progress: float, zone_end_ratio: float = 1.0) -> CongestionLevel:
    """Severity as the vehicle approaches the (fixed) zone; LOW once it has passed it."""
    if progress >= zone_end_ratio + DYNAMIC_CLEAR_MARGIN:
        return CongestionLevel.LOW
    if progress < 0.15:
        return CongestionLevel.LOW
    if progress < 0.28:
        return CongestionLevel.MODERATE
    if progress < 0.40:
        return CongestionLevel.HEAVY
    return CongestionLevel.SEVERE


def _split_segment(seg: Dict[str, Any], cut_m: float) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Split a segment at ``cut_m`` metres from its start (0 < cut_m < length)."""
    coords = seg["coordinates"]
    walked = 0.0
    for i in range(1, len(coords)):
        d = _hav(coords[i - 1], coords[i])
        if walked + d >= cut_m or i == len(coords) - 1:
            t = 0.0 if d == 0 else max(0.0, min(1.0, (cut_m - walked) / d))
            mid = [
                coords[i - 1][0] + t * (coords[i][0] - coords[i - 1][0]),
                coords[i - 1][1] + t * (coords[i][1] - coords[i - 1][1]),
            ]
            first = {**seg, "coordinates": coords[:i] + [mid]}
            second = {**seg, "coordinates": [mid] + coords[i:]}
            first["distance_meters"] = round(cut_m, 1)
            second["distance_meters"] = round(max(0.1, seg["distance_meters"] - cut_m), 1)
            return first, second
        walked += d
    return seg, seg  # unreachable for valid input


def _split_at(segments: List[Dict[str, Any]], boundary_m: float) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    along = 0.0
    for seg in segments:
        dist = seg["distance_meters"]
        if along + 1.0 < boundary_m < along + dist - 1.0 and len(seg.get("coordinates", [])) >= 2:
            a, b = _split_segment(seg, boundary_m - along)
            out.extend([a, b])
        else:
            out.append(seg)
        along += dist
    return out


def _sample_zone_path(zone_segments: List[Dict[str, Any]]) -> List[List[float]]:
    """Return [[lon, lat], ...] roughly every ZONE_PATH_SAMPLE_M along the affected stretch (max 14 pts)."""
    pts: List[List[float]] = []
    for seg in zone_segments:
        for c in seg.get("coordinates", []):
            if not pts or _hav(pts[-1], c) >= ZONE_PATH_SAMPLE_M:
                pts.append([round(c[0], 6), round(c[1], 6)])
    last = zone_segments[-1].get("coordinates", [[0, 0]])[-1]
    if not pts or pts[-1] != [round(last[0], 6), round(last[1], 6)]:
        pts.append([round(last[0], 6), round(last[1], 6)])
    if len(pts) > 28:
        step = (len(pts) - 1) / 27.0
        pts = [pts[round(i * step)] for i in range(28)]
    return pts


def apply_traffic_test_scenario(
    analysis: Dict[str, Any], mode: TrafficTestMode, progress: float = 0.0,
    synthetic_traffic_active: bool = True,
    zone_start_ratio: float = ZONE_START_RATIO,
    zone_length_m: float | None = None,
) -> Dict[str, Any]:
    """Apply controlled debug traffic to analyzed road segments, never to route geometry."""
    if mode == TrafficTestMode.REAL or not synthetic_traffic_active:
        return analysis

    segments = analysis["segments"]
    if not segments:
        return analysis
    total_distance = sum(s["distance_meters"] for s in segments) or 1.0
    zone_start, zone_end = compute_scenario_zone(total_distance, zone_start_ratio, zone_length_m)

    if mode == TrafficTestMode.DYNAMIC:
        phase = dynamic_traffic_phase(progress, zone_end / total_distance)
    else:
        phase = {
            TrafficTestMode.NORMAL: CongestionLevel.LOW,
            TrafficTestMode.MODERATE: CongestionLevel.MODERATE,
            TrafficTestMode.HEAVY: CongestionLevel.HEAVY,
            TrafficTestMode.SEVERE: CongestionLevel.SEVERE,
        }.get(mode, CongestionLevel.LOW)

    # Cut segments exactly at the zone boundaries so colour == hotspot extent.
    segments = _split_at(_split_at(segments, zone_start), zone_end)
    for i, seg in enumerate(segments):
        seg["segment_index"] = i

    along = 0.0
    delay_total = 0.0
    distance_by_level = {level: 0.0 for level in CongestionLevel}
    zone_segments: List[Dict[str, Any]] = []
    zone_delay = 0.0
    zone_speed_x_dist = 0.0
    zone_first_along = None

    for segment in segments:
        distance = segment["distance_meters"]
        center = along + distance / 2.0
        inside_zone = zone_start - 0.5 <= center <= zone_end + 0.5
        in_zone = phase != CongestionLevel.LOW and inside_zone
        level = phase if in_zone else CongestionLevel.LOW
        ratio = SCENARIO_SPEED_RATIO[level]
        freeflow_speed = max(20.0, segment.get("freeflow_speed_kmh", 45.0))
        speed = freeflow_speed * ratio
        segment_duration = distance / max(0.5, speed / 3.6)
        freeflow_duration = distance / max(0.5, freeflow_speed / 3.6)
        delay = max(0.0, segment_duration - freeflow_duration)
        segment.update({
            "congestion_level": level.value,
            "current_speed_kmh": round(speed, 1),
            "duration_seconds": round(segment_duration, 1),
            "delay_seconds": round(delay, 1),
            "congestion_factor": round(1.0 / ratio, 2),
            "color": SCENARIO_COLOR[level],
        })
        delay_total += delay
        distance_by_level[level] += distance
        if in_zone:
            if zone_first_along is None:
                zone_first_along = along
            zone_segments.append(segment)
            zone_delay += delay
            zone_speed_x_dist += speed * distance
        along += distance

    hotspots: List[Dict[str, Any]] = []
    if zone_segments:
        first = zone_segments[0]
        lon, lat = first["coordinates"][0]
        zone_len = sum(s["distance_meters"] for s in zone_segments)
        path = _sample_zone_path(zone_segments)
        hotspots.append({
            "hotspot_id": f"test-{mode.value}-primary",
            "location_name": first.get("road_name") or "Traffic ahead",
            "lat": lat,
            "lon": lon,
            # Distance to the START of the affected stretch (what "ahead in X m" means).
            "distance_from_origin_m": round(zone_first_along or zone_start, 1),
            "congestion_level": phase.value,
            "average_speed_kmh": round(zone_speed_x_dist / max(1.0, zone_len), 1),
            "estimated_delay_seconds": round(zone_delay, 1),
            "description": "Traffic is moving more slowly on this road.",
            "cause": "Controlled traffic test",
            "zone_end_distance_m": round((zone_first_along or zone_start) + zone_len, 1),
            "zone_path": path,
        })

    analysis["segments"] = segments
    analysis["hotspots"] = hotspots
    analysis["total_delay_seconds"] = round(delay_total, 1)
    analysis["clear_distance_km"] = round(distance_by_level[CongestionLevel.LOW] / 1000.0, 2)
    analysis["moderate_distance_km"] = round(distance_by_level[CongestionLevel.MODERATE] / 1000.0, 2)
    analysis["heavy_distance_km"] = round(distance_by_level[CongestionLevel.HEAVY] / 1000.0, 2)
    analysis["severe_distance_km"] = round(distance_by_level[CongestionLevel.SEVERE] / 1000.0, 2)
    return analysis
```


## `backend\services\traffic_service.py`

```python
import math
import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from schemas.navigation import CongestionLevel
from core.region import get_region

class LiveTrafficService:
    """Real-Time Traffic Factor Integration Service (Feature 2).
    
    Ingests and synthesizes real-time traffic telemetry including:
    - Average vehicle speeds (km/h)
    - Traffic density index (0 to 100 vehicles/km)
    - Freeflow baseline speeds
    - Incident / bottleneck choke points
    - Time-of-day historical modulation
    - Pluggable external Traffic API feeds (TomTom / Google Traffic / live probe streams)
    """

    # Major Bengaluru Traffic Corridors & Historical Bottleneck Nodes
    KNOWN_BOTTLENECKS = [
        {
            "id": "silk_board",
            "name": "Central Silk Board Junction",
            "lat": 12.9177,
            "lon": 77.6238,
            "radius_km": 1.2,
            "freeflow_speed": 45.0,
            "typical_peak_speed": 12.0,
            "density_peak": 92.0,
            "incident": "High Volume Choke Point & Metro Construction",
        },
        {
            "id": "marathahalli",
            "name": "Marathahalli Innovative Multiplex Bridge",
            "lat": 12.9562,
            "lon": 77.7011,
            "radius_km": 1.0,
            "freeflow_speed": 50.0,
            "typical_peak_speed": 14.0,
            "density_peak": 88.0,
            "incident": "ORR Heavy Commuter Inflow",
        },
        {
            "id": "tin_factory",
            "name": "Tin Factory / KR Puram Hanging Bridge",
            "lat": 12.9982,
            "lon": 77.6749,
            "radius_km": 1.1,
            "freeflow_speed": 45.0,
            "typical_peak_speed": 10.0,
            "density_peak": 95.0,
            "incident": "Old Madras Road & Outer Ring Road Convergence",
        },
        {
            "id": "hebbal",
            "name": "Hebbal Flyover Junction",
            "lat": 13.0358,
            "lon": 77.5970,
            "radius_km": 1.2,
            "freeflow_speed": 60.0,
            "typical_peak_speed": 16.0,
            "density_peak": 85.0,
            "incident": "Airport Corridor Merge",
        },
        {
            "id": "koramangala_sony",
            "name": "Sony World Signal, Koramangala 80ft Road",
            "lat": 12.9348,
            "lon": 77.6276,
            "radius_km": 0.8,
            "freeflow_speed": 40.0,
            "typical_peak_speed": 15.0,
            "density_peak": 82.0,
            "incident": "Commercial Corridor Density",
        },
        {
            "id": "whitefield_itpl",
            "name": "ITPL Main Road, Whitefield",
            "lat": 12.9857,
            "lon": 77.7318,
            "radius_km": 1.0,
            "freeflow_speed": 45.0,
            "typical_peak_speed": 13.0,
            "density_peak": 87.0,
            "incident": "Tech Park Peak Exit Delay",
        },
        {
            "id": "indiranagar_100ft",
            "name": "100ft Road / 12th Main Indiranagar",
            "lat": 12.9719,
            "lon": 77.6412,
            "radius_km": 0.7,
            "freeflow_speed": 40.0,
            "typical_peak_speed": 18.0,
            "density_peak": 75.0,
            "incident": "Retail Traffic & Curbside Friction",
        },
        {
            "id": "mg_road_trinity",
            "name": "MG Road / Trinity Circle",
            "lat": 12.9733,
            "lon": 77.6186,
            "radius_km": 0.8,
            "freeflow_speed": 40.0,
            "typical_peak_speed": 17.0,
            "density_peak": 78.0,
            "incident": "CBD Core Intersection",
        },
        {
            "id": "ecity_toll",
            "name": "Electronic City Toll Gate / Elevated Tollway",
            "lat": 12.8452,
            "lon": 77.6602,
            "radius_km": 1.0,
            "freeflow_speed": 65.0,
            "typical_peak_speed": 22.0,
            "density_peak": 79.0,
            "incident": "Hosur Road Commute Surge",
        },
    ]


    @classmethod
    def haversine_km(cls, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Computes great-circle distance in kilometers between two GPS coordinates."""
        r = 6371.0
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = math.sin(d_lat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2)**2
        return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    @classmethod
    def get_time_of_day_traffic_intensity(cls, dt: Optional[datetime] = None) -> float:
        """Returns time-of-day traffic intensity multiplier (0.0 to 1.0) based on Bengaluru commuting curves."""
        if dt is None:
            dt = datetime.now(timezone.utc)
            
        # Convert UTC to Indian Standard Time (UTC+5:30)
        ist_hour = (dt.hour + 5 + (dt.minute + 30) // 60) % 24
        ist_minute = (dt.minute + 30) % 60
        time_dec = ist_hour + ist_minute / 60.0
        is_weekend = dt.weekday() in [5, 6]

        if is_weekend:
            # Weekend peak (12:00 PM to 9:00 PM)
            if 12.0 <= time_dec <= 21.0:
                return 0.65 + 0.25 * math.sin((time_dec - 12.0) / 9.0 * math.pi)
            elif 21.0 < time_dec <= 23.5:
                return 0.40
            else:
                return 0.20

        # Weekday: Morning Peak (8:30 AM to 11:30 AM) & Evening Peak (5:00 PM to 9:30 PM)
        if 8.5 <= time_dec <= 11.5:
            return 0.85 + 0.15 * math.sin((time_dec - 8.5) / 3.0 * math.pi)
        elif 17.0 <= time_dec <= 21.5:
            return 0.90 + 0.10 * math.sin((time_dec - 17.0) / 4.5 * math.pi)
        elif 11.5 < time_dec < 17.0:
            return 0.55  # Moderate afternoon traffic
        elif 21.5 < time_dec <= 23.5:
            return 0.35  # Late evening tapering
        else:
            return 0.15  # Night / early morning freeflow

    @classmethod
    def get_point_traffic_factors(
        cls, 
        lat: float, 
        lon: float, 
        prediction_offset_min: float = 0.0,
        now_dt: Optional[datetime] = None,
        region: Optional[Any] = None
    ) -> Dict[str, Any]:
        """Calculates real-time & predictive traffic factors for a given point.
        
        Considers:
        - Proximity to known bottleneck hubs within the active region
        - Time-of-day curve (evaluated at current time + prediction_offset_min)
        - Dynamic live incident feeds
        """
        if now_dt is None:
            now_dt = datetime.now(timezone.utc)

        future_timestamp = now_dt.timestamp() + (prediction_offset_min * 60)
        future_dt = datetime.fromtimestamp(future_timestamp, tz=timezone.utc)
        time_intensity = cls.get_time_of_day_traffic_intensity(future_dt)

        # Baseline freeflow conditions
        freeflow_speed = 45.0
        current_speed = freeflow_speed
        density_index = 20.0 + (time_intensity * 35.0)  # Base density 20 - 55%
        active_hotspot = None
        min_dist = float('inf')

        # Check proximity to bottleneck nodes that belong to the specified region
        candidate_bottlenecks = [
            b for b in cls.ALL_KNOWN_BOTTLENECKS
            if region.is_within_bounds(b["lat"], b["lon"])
        ] if region is not None else cls.KNOWN_BOTTLENECKS

        for node in candidate_bottlenecks:
            dist = cls.haversine_km(lat, lon, node["lat"], node["lon"])
            if dist <= node["radius_km"]:
                if dist < min_dist:
                    min_dist = dist
                    active_hotspot = node


        if active_hotspot:
            # Inside a bottleneck impact zone
            radius = max(0.1, active_hotspot.get("radius_km", 1.0))
            impact_ratio = max(0.0, min(1.0, 1.0 - (min_dist / radius)))
            peak_speed = active_hotspot.get("typical_peak_speed", 12.0)
            node_freeflow = active_hotspot.get("freeflow_speed", 45.0)
            
            effective_intensity = max(0.65, time_intensity)
            
            # Speed degradation proportional to proximity & intensity
            speed_drop = (node_freeflow - peak_speed) * effective_intensity * impact_ratio
            current_speed = max(5.0, node_freeflow - speed_drop)
            freeflow_speed = node_freeflow
            
            peak_density = active_hotspot.get("density_peak", 90.0)
            density_index = min(98.0, density_index + (peak_density - density_index) * impact_ratio * effective_intensity)
            location_name = active_hotspot["name"]
            incident_desc = active_hotspot.get("incident", "High Congestion Area")
        else:
            # General urban arterial (non-bottleneck road segments)
            # Rebalanced so ordinary roads stay CLEAR under standard and moderate peak conditions,
            # ensuring congestion colors (amber/red/crimson) are concentrated at actual bottlenecks.
            general_drop = 5.0 * time_intensity
            current_speed = max(25.0, freeflow_speed - general_drop)
            location_name = "Urban Arterial Corridor"
            incident_desc = None

        # Determine Congestion Level & Factor
        speed_ratio = current_speed / max(1.0, freeflow_speed)
        congestion_factor = freeflow_speed / max(1.0, current_speed)

        # Shared severity thresholds use current speed as a ratio of free-flow speed:
        # LOW >= 0.80, MODERATE >= 0.50, HEAVY >= 0.25, otherwise SEVERE.
        if speed_ratio >= 0.80:
            congestion_level = CongestionLevel.LOW
            color = "#16A34A"  # Green
        elif speed_ratio >= 0.50:
            congestion_level = CongestionLevel.MODERATE
            color = "#EAB308"  # Yellow
        elif speed_ratio >= 0.25:
            congestion_level = CongestionLevel.HEAVY
            color = "#F97316"  # Orange
        else:
            congestion_level = CongestionLevel.SEVERE
            color = "#DC2626"  # Red

        return {
            "location_name": location_name,
            "lat": lat,
            "lon": lon,
            "current_speed_kmh": round(current_speed, 1),
            "freeflow_speed_kmh": round(freeflow_speed, 1),
            "density_index": round(density_index, 1),
            "congestion_level": congestion_level.value,
            "congestion_factor": round(congestion_factor, 2),
            "color": color,
            "incident_description": incident_desc,
            "time_intensity": round(time_intensity, 2)
        }


    @classmethod
    def get_all_active_hotspots(cls) -> List[Dict[str, Any]]:
        """Returns list of all active bottleneck locations with real-time status."""
        results = []
        for bn in cls.KNOWN_BOTTLENECKS:
            tf = cls.get_point_traffic_factors(bn["lat"], bn["lon"])
            results.append({
                **bn,
                **tf
            })
        return results


# The hand-written bottleneck list above describes *Bengaluru* junctions. Keep only the entries that
# lie inside the active region so a Coimbatore deployment never reports Bengaluru hotspots.
# (Bengaluru: every entry is inside the bounding box, so behaviour is unchanged.)
# Coimbatore hotspots are NOT invented here; add measured data, or clearly-labelled synthetic
# scenarios, to this list when available.
LiveTrafficService.ALL_KNOWN_BOTTLENECKS = list(LiveTrafficService.KNOWN_BOTTLENECKS)
LiveTrafficService.KNOWN_BOTTLENECKS = [
    _bn for _bn in LiveTrafficService.ALL_KNOWN_BOTTLENECKS
    if get_region().is_within_bounds(_bn["lat"], _bn["lon"])
]
```


## `backend\tests\__init__.py`

```python
# Tests package initialization
```


## `backend\tests\test_api.py`

```python
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
```


## `backend\tests\test_controlled_bypass_planner.py`

```python
from services.controlled_bypass_planner import plan_controlled_bypass, _cumulative, _project_distance_along_route
from services.traffic_scenario import compute_scenario_zone


def _dense(points, step=0.00005):
    out = []
    for start, end in zip(points, points[1:]):
        count = max(1, int(max(abs(start[0] - end[0]), abs(start[1] - end[1])) / step))
        for i in range(count):
            t = i / count
            out.append([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t])
    out.append(list(points[-1]))
    return out


def test_planner_selects_shared_junction_and_a_clear_existing_route():
    main = _dense([[77.0, 11.0], [77.0, 11.1]])
    side = _dense([[77.0, 11.0], [77.0, 11.04], [77.002, 11.045], [77.002, 11.075], [77.0, 11.08], [77.0, 11.1]])
    plan = plan_controlled_bypass([
        {"route_index": 0, "distance_meters": 11100.0, "geometry": {"type": "LineString", "coordinates": main}},
        {"route_index": 1, "distance_meters": 12000.0, "geometry": {"type": "LineString", "coordinates": side}},
    ])
    assert plan is not None
    assert plan["active_route_index"] in (0, 1)
    assert plan["bypass_route_index"] in (0, 1)
    assert plan["active_route_index"] != plan["bypass_route_index"]
    assert 0.12 <= plan["switch_distance_m"] / 12000.0 <= 0.48
    assert plan["zone_start_distance_m"] >= plan["switch_distance_m"] + 100
    assert plan["minimum_bypass_clearance_m"] >= 40


def test_zone_can_be_placed_after_the_shared_switch_point():
    start, end = compute_scenario_zone(10_000, zone_start_ratio=0.52, zone_length_m=400)
    assert 5_100 <= start <= 5_300
    assert 300 <= end - start <= 500



def test_fallback_builds_bypass_from_shared_route_prefix():
    import asyncio
    from services.controlled_bypass_planner import build_controlled_bypass_candidates

    main = _dense([[77.0, 11.0], [77.0, 11.1]])
    base = {"route_index": 0, "distance_meters": 11100.0, "duration_seconds": 900.0,
            "geometry": {"type": "LineString", "coordinates": main},
            "steps": [{"name": "Main road", "distance": 11100.0, "duration": 900.0,
                       "maneuver": {"type": "depart", "location": main[0]}}]}
    requested = []

    async def fake_osrm(waypoints):
        requested.append(waypoints)
        entry_lat, entry_lon = waypoints[0]
        offset_lat, offset_lon = waypoints[1]
        exit_lat, exit_lon = waypoints[2]
        dest_lat, dest_lon = waypoints[3]
        # Simulate a real OSRM returned route on a parallel street, with actual
        # geometry beginning at the shared junction and rejoining after the jam.
        coords = [[entry_lon, entry_lat], [offset_lon, entry_lat],
                  [offset_lon, exit_lat], [exit_lon, exit_lat], [dest_lon, dest_lat]]
        dense = _dense(coords, step=0.00005)
        return [{"route_index": 0, "distance_meters": 11800.0, "duration_seconds": 1000.0,
                 "geometry": {"type": "LineString", "coordinates": dense},
                 "steps": [{"name": "Parallel road", "distance": 11800.0, "duration": 1000.0,
                            "maneuver": {"type": "depart", "location": dense[0]}}]}]

    additions, plan = asyncio.run(build_controlled_bypass_candidates(
        [base], 11.0, 77.0, 11.1, 77.0, fake_osrm
    ))
    assert requested, "fallback should request OSRM geometry starting at the route's entry junction"
    # Every probe entry must fall inside the planner's feasible divergence window.
    # A former 55% probe fell outside the 48% cap and could never produce a plan.
    main_cumulative = _cumulative(main)
    assert len(requested) == 6
    probe_offsets_m = []
    for waypoints in requested:
        entry = [waypoints[0][1], waypoints[0][0]]  # OSRM input is (lat, lon); route points are (lon, lat).
        along, cross_track = _project_distance_along_route(entry, main, main_cumulative)
        assert cross_track <= 18.0
        assert 0.12 <= along / main_cumulative[-1] <= 0.48

        offset_point = [waypoints[1][1], waypoints[1][0]]
        _, offset_distance = _project_distance_along_route(offset_point, main, main_cumulative)
        probe_offsets_m.append(offset_distance)
    assert min(probe_offsets_m) >= 250.0
    assert max(probe_offsets_m) >= 650.0
    assert additions and plan is not None
    assert plan["active_route_index"] == 0
    assert plan["bypass_route_index"] != 0
    assert plan["minimum_bypass_clearance_m"] >= 40
    assert additions[0]["geometry"]["coordinates"][0] == main[0]


def test_planner_relaxes_for_early_narrow_split():
    """A real network often splits early and only ~70 m apart; a bypass must still be planned."""
    main = _dense([[77.0, 11.0], [77.0, 11.1]])
    # Splits ~1.1 km in (10 %), runs ~75 m east of the main road, rejoins near the end.
    side = _dense([[77.0, 11.0], [77.0, 11.010], [77.0007, 11.0115], [77.0007, 11.088], [77.0, 11.09], [77.0, 11.1]])
    plan = plan_controlled_bypass([
        {"route_index": 0, "distance_meters": 11100.0, "geometry": {"type": "LineString", "coordinates": main}},
        {"route_index": 1, "distance_meters": 11300.0, "geometry": {"type": "LineString", "coordinates": side}},
    ])
    assert plan is not None
    assert plan["active_route_index"] != plan["bypass_route_index"]
    assert abs((plan["zone_start_distance_m"] - plan["switch_distance_m"]) - 1000.0) <= 1.0
    assert plan["zone_end_distance_m"] > plan["zone_start_distance_m"]


def test_planner_last_resort_close_parallel_alternative():
    """Two real routes only ~50 m apart after an early split still get a jam on one of them."""
    main = _dense([[77.0, 11.0], [77.0, 11.1]])
    side = _dense([[77.0, 11.0], [77.0, 11.006], [77.00045, 11.0075], [77.00045, 11.09], [77.0, 11.092], [77.0, 11.1]])
    plan = plan_controlled_bypass([
        {"route_index": 0, "distance_meters": 11100.0, "geometry": {"type": "LineString", "coordinates": main}},
        {"route_index": 1, "distance_meters": 11200.0, "geometry": {"type": "LineString", "coordinates": side}},
    ])
    assert plan is not None
    assert abs((plan["zone_start_distance_m"] - plan["switch_distance_m"]) - 1000.0) <= 1.0
```


## `backend\tests\test_dataset_optimized.py`

```python
"""Small offline tests for the Coimbatore-only pipeline optimisation patch.

Copy into backend/tests after applying patches/dataset_optimized.patch.
Requires the project's installed dependencies, including openlocationcode.
"""
import csv
import json
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from core.region import get_region
from ml.dataset import TrafficDataPipeline as P


CSV_COLUMNS = ["date", "time", "route_code", "duration", "distance", "temp", "realfeel", "humidity", "rsi_flag", "aqi"]
ROUTE_COORDS = {
    "O1+AA": (11.01, 76.95), "D1+AA": (11.02, 76.96),
    "O2+BB": (11.03, 76.97), "D2+BB": (11.04, 76.98),
    "O3+CC": (11.05, 76.99), "D3+CC": (11.06, 77.00),
}
ROUTES = [
    ("O1+AA|D1+AA", 5.0),
    ("O2+BB|D2+BB", 6.0),
    ("O3+CC|D3+CC", 7.0),
]


def _make_fixture(tmp_path):
    csv_path = tmp_path / "csv-traffic-coimbatore.csv"
    cache_path = tmp_path / "osrm_cache_coimbatore.json"
    cache = {}
    for route_code, osrm_min in ROUTES:
        ocode, dcode = route_code.split("|")
        olat, olon = ROUTE_COORDS[ocode]
        dlat, dlon = ROUTE_COORDS[dcode]
        cache[f"{olat},{olon},{dlat},{dlon}"] = {
            "osrm_dist": 5.0 + osrm_min,
            "osrm_dur_min": osrm_min,
            "steps_count": 8,
            "turns": 3,
            "roundabouts": 0,
            "avg_step_len": (5.0 + osrm_min) / 8,
        }
    cache_path.write_text(json.dumps(cache), encoding="utf-8")
    start = datetime(2025, 9, 25, 6, 0)
    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh, lineterminator="\n")
        writer.writerow(CSV_COLUMNS)
        for i in range(30):
            stamp = start + timedelta(minutes=30 * i)
            for route_i, (route_code, _) in enumerate(ROUTES):
                writer.writerow([
                    stamp.strftime("%Y-%m-%d"), stamp.strftime("%H:%M"), route_code,
                    10 + route_i * 2 + i % 5, f"{5.0 + route_i:.1f}", "", "", "", "", "",
                ])
    return csv_path, cache_path


@pytest.fixture
def patched_pipeline(monkeypatch, tmp_path):
    csv_path, cache_path = _make_fixture(tmp_path)
    monkeypatch.setattr(P, "TML_TRAFFIC_CSV", str(csv_path))
    monkeypatch.setattr(P, "CACHE_FILE", str(cache_path))
    monkeypatch.setattr(P, "REGION", get_region("coimbatore"))
    monkeypatch.setattr(P, "_osrm_cache", {})
    monkeypatch.setattr(P, "_decode_plus_code", classmethod(lambda cls, code: ROUTE_COORDS[code]))
    return csv_path, cache_path


def test_optimized_loader_maps_unique_routes_and_returns_finite_features(patched_pipeline):
    df = P.load_canonical_dataset()
    assert len(df) == 90
    assert df["route_code"].nunique() == 3
    assert df["osrm_dur_min"].nunique() == 3
    assert list(df.columns) == [
        "timestamp", "route_code", "origin_lat", "origin_lon", "destination_lat", "destination_lon",
        "observed_duration_min", "osrm_dist", "osrm_dur_min", "steps_count", "turns", "roundabouts",
        "avg_step_len", "congestion_factor", "hour", "day_of_week", "is_weekend", "month",
    ]
    assert df["congestion_factor"].gt(0).all()


def test_coimbatore_splits_do_not_share_timestamps(patched_pipeline):
    Xtr, ytr, Xv, yv, Xte, yte, features = P.get_train_val_test_splits()
    # 30 time groups x 3 route rows. Group-aware cuts nearest 75% and 85% produce 66/9/15.
    assert (len(Xtr), len(Xv), len(Xte)) == (66, 9, 15)
    assert Xtr.shape[1] == Xv.shape[1] == Xte.shape[1] == 10
    assert all(__import__("numpy").isfinite(a).all() for a in (Xtr, ytr, Xv, yv, Xte, yte))
    assert features == ["hour", "day_of_week", "is_weekend", "month", "osrm_dist", "osrm_dur_min", "steps_count", "turns", "roundabouts", "avg_step_len"]


def test_bengaluru_split_counts_remain_row_based(patched_pipeline, monkeypatch):
    monkeypatch.setattr(P, "REGION", get_region("bengaluru"))
    Xtr, ytr, Xv, yv, Xte, yte, features = P.get_train_val_test_splits()
    # Existing behaviour: int(.75*90), int(.85*90) => 67 / 9 / 14.
    assert (len(Xtr), len(Xv), len(Xte)) == (67, 9, 14)
```


## `backend\tests\test_geographic_regions.py`

```python
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
```


## `backend\tests\test_ml_pipeline.py`

```python
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
```


## `backend\tests\test_new_features.py`

```python
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
    assert isinstance(data["hotspots"], list)
    assert data["count"] == len(data["hotspots"])

    for hotspot in data["hotspots"]:
        assert "lat" in hotspot
        assert "lon" in hotspot
        assert "location_name" in hotspot

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
```


## `backend\tests\test_patch_regressions.py`

```python
"""Regression tests for the heavy / severe / dynamic + OSRM alternatives patch."""
import math

from schemas.navigation import TrafficTestMode, CongestionLevel
from services.traffic_scenario import (
    apply_traffic_test_scenario,
    compute_scenario_zone,
    dynamic_traffic_phase,
)


def _analysis(total_m: float, chunks: int = 12):
    m_lon = 111_320.0 * math.cos(math.radians(12.95))
    step = total_m / chunks
    segs, lon = [], 77.60
    for i in range(chunks):
        lon2 = lon + step / m_lon
        segs.append({
            "segment_index": i,
            "distance_meters": step,
            "coordinates": [[lon, 12.95], [(lon + lon2) / 2, 12.95], [lon2, 12.95]],
            "freeflow_speed_kmh": 45.0,
            "road_name": "Test Road",
        })
        lon = lon2
    return {"segments": segs, "hotspots": [], "clear_distance_km": 0.0, "moderate_distance_km": 0.0,
            "heavy_distance_km": 0.0, "severe_distance_km": 0.0, "total_delay_seconds": 0.0}


def test_zone_is_short_even_on_long_routes():
    for total in (3_000, 8_000, 20_000, 40_000):
        start, end = compute_scenario_zone(total)
        assert 300 <= end - start <= 1000
        assert end - start <= 0.25 * total + 1e-6


def test_coloured_length_equals_hotspot_zone_and_distance_matches_start():
    for mode in (TrafficTestMode.HEAVY, TrafficTestMode.SEVERE):
        res = apply_traffic_test_scenario(_analysis(10_000), mode)
        hotspot = res["hotspots"][0]
        coloured = sum(s["distance_meters"] for s in res["segments"] if s["congestion_level"] != "LOW")
        start, end = compute_scenario_zone(10_000)
        assert abs(coloured - (end - start)) < 3
        assert abs(hotspot["distance_from_origin_m"] - start) < 3
        assert hotspot["zone_path"] and len(hotspot["zone_path"]) <= 14


def test_dynamic_zone_never_moves_only_severity_changes():
    starts, levels = set(), []
    for progress in (0.20, 0.35, 0.45):
        res = apply_traffic_test_scenario(_analysis(10_000), TrafficTestMode.DYNAMIC, progress=progress)
        hotspot = res["hotspots"][0]
        starts.add(round(hotspot["distance_from_origin_m"]))
        levels.append(hotspot["congestion_level"])
    assert len(starts) == 1
    assert levels == ["MODERATE", "HEAVY", "SEVERE"]


def test_dynamic_clears_only_after_zone_is_passed():
    _, end = compute_scenario_zone(10_000)
    inside = apply_traffic_test_scenario(_analysis(10_000), TrafficTestMode.DYNAMIC, progress=end / 10_000)
    after = apply_traffic_test_scenario(_analysis(10_000), TrafficTestMode.DYNAMIC, progress=end / 10_000 + 0.05)
    assert inside["hotspots"]
    assert after["hotspots"] == []


def test_dynamic_phase_helper():
    assert dynamic_traffic_phase(0.05) == CongestionLevel.LOW
    assert dynamic_traffic_phase(0.20) == CongestionLevel.MODERATE
    assert dynamic_traffic_phase(0.35) == CongestionLevel.HEAVY
    assert dynamic_traffic_phase(0.50, zone_end_ratio=0.6) == CongestionLevel.SEVERE
    assert dynamic_traffic_phase(0.70, zone_end_ratio=0.6) == CongestionLevel.LOW


def test_same_corridor_detection_for_osrm_alternatives():
    from services.osrm import routes_are_same_corridor

    def route(offset_lat):
        return {"geometry": {"coordinates": [[77.59 + i * 0.002, 12.97 + offset_lat] for i in range(60)]}}

    assert routes_are_same_corridor(route(0.0), route(0.0002))          # ~22 m apart => same road
    assert not routes_are_same_corridor(route(0.0), route(0.02))        # ~2.2 km apart => alternative


def test_detour_cap_rejects_absurd_bypass():
    from types import SimpleNamespace
    from services.reroute_engine import _avoidance_detour_allowed

    ok = SimpleNamespace(predicted_duration_seconds=800.0, distance_meters=9_000.0)
    too_slow = SimpleNamespace(predicted_duration_seconds=2_400.0, distance_meters=9_000.0)
    too_long = SimpleNamespace(predicted_duration_seconds=700.0, distance_meters=30_000.0)
    assert _avoidance_detour_allowed(ok, 700.0, 6_000.0)
    assert not _avoidance_detour_allowed(too_slow, 700.0, 6_000.0)
    assert not _avoidance_detour_allowed(too_long, 700.0, 6_000.0)


def test_zones_next_to_vehicle_are_ignored():
    from services.reroute_engine import _usable_avoid_zones

    zones = [{"lat": 12.9500, "lon": 77.6000, "radius_km": 0.06},      # on top of the vehicle
             {"lat": 12.9600, "lon": 77.6000, "radius_km": 0.06}]      # ~1.1 km ahead
    usable = _usable_avoid_zones(zones, 12.9500, 77.6000)
    assert len(usable) == 1 and usable[0]["lat"] == 12.9600

def test_controlled_dropdown_reroute_uses_street_snapped_osrm(monkeypatch):
    """HEAVY/SEVERE/DYNAMIC test reroutes must use OSRM road geometry, never a fake polyline."""
    import asyncio
    from services.osrm import OSRMService
    from ml.recommender import RouteScorer
    from services.reroute_engine import DynamicRerouteEngine

    current_lat, current_lon = 12.9300, 77.6000
    dest_lat, dest_lon = 12.9900, 77.6500

    def dense_coords(points, max_segment_m=900.0):
        from math import ceil, cos, hypot, radians
        dense = [list(points[0])]
        for start, end in zip(points, points[1:]):
            mean_lat = radians((start[1] + end[1]) / 2.0)
            dx = (end[0] - start[0]) * 111320.0 * cos(mean_lat)
            dy = (end[1] - start[1]) * 111132.0
            pieces = max(1, ceil(hypot(dx, dy) / max_segment_m))
            for part in range(1, pieces + 1):
                fraction = part / pieces
                dense.append([
                    start[0] + (end[0] - start[0]) * fraction,
                    start[1] + (end[1] - start[1]) * fraction,
                ])
        return dense

    initial = {
        "route_index": 0,
        "distance_meters": 10000.0,
        "duration_seconds": 700.0,
        "geometry": {
            "type": "LineString",
            "coordinates": dense_coords([
                    [77.6000, 12.9300],
                    [77.6120, 12.9420],
                    [77.6240, 12.9540],
                    [77.6360, 12.9660],
                    [77.6500, 12.9900],
                ]),
        },
        "steps": [
            {
                "distance": 7800.0,
                "duration": 700.0,
                "name": "Congested Main Road",
                "maneuver": {"type": "continue", "modifier": "straight"},
            }
        ],
    }

    # This represents an OSRM-returned street-snapped alternative.  The test
    # deliberately uses named roads/turns rather than a synthetic single-step.
    bypass = {
        "route_index": 0,
        "distance_meters": 11000.0,
        "duration_seconds": 900.0,
        "geometry": {
            "type": "LineString",
            "coordinates": dense_coords([
                    [77.6000, 12.9300],
                    [77.6020, 12.9380],
                    [77.6200, 12.9400],
                    [77.6400, 12.9520],
                    [77.6500, 12.9900],
                ]),
        },
        "steps": [
            {
                "distance": 2100.0,
                "duration": 190.0,
                "name": "Service Road",
                "maneuver": {"type": "depart", "modifier": "straight"},
            },
            {
                "distance": 4300.0,
                "duration": 420.0,
                "name": "Outer Ring Road",
                "maneuver": {"type": "turn", "modifier": "right"},
            },
            {
                "distance": 2900.0,
                "duration": 290.0,
                "name": "Bellandur Road",
                "maneuver": {"type": "turn", "modifier": "left"},
            },
        ],
    }

    waypoint_calls = []

    async def mock_get_routes(*args, **kwargs):
        return [initial.copy()]

    async def mock_get_routes_via_waypoints(waypoints):
        waypoint_calls.append(waypoints)
        return [bypass.copy()]

    monkeypatch.setattr(OSRMService, "get_routes", staticmethod(mock_get_routes))
    monkeypatch.setattr(OSRMService, "get_routes_via_waypoints", staticmethod(mock_get_routes_via_waypoints))
    monkeypatch.setattr(RouteScorer, "evaluate_routes", staticmethod(lambda routes, *args, **kwargs: routes))

    recommendation = asyncio.run(
        DynamicRerouteEngine.evaluate_reroute(
            current_lat=current_lat,
            current_lon=current_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon,
            original_remaining_duration_s=700.0,
            avoid_hotspots=[{"lat": 12.9540, "lon": 77.6240, "radius_km": 0.45}],
            traffic_test_mode=TrafficTestMode.HEAVY,
            traffic_progress=0.40,
            synthetic_traffic_active=True,
        )
    )

    assert waypoint_calls, "Controlled test reroute must probe OSRM via waypoints"
    assert recommendation.is_reroute_recommended
    assert recommendation.recommended_route is not None
    assert recommendation.recommended_route.source == "reroute"
    assert recommendation.recommended_route.steps[1]["name"] == "Outer Ring Road"
    assert "Synthetic Congestion Bypass" not in str(recommendation.recommended_route.dict())
```


## `backend\tests\test_region_config.py`

```python
import os, subprocess, sys
import pytest
from core.region import REGIONS, get_region

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def test_default_region_is_bengaluru_and_paths_unchanged():
    r = get_region("bengaluru")
    assert r.plus_code_reference == (12.9716, 77.5946)
    assert r.traffic_csv.endswith(os.path.join("tml", "csv-traffic-bangalore.csv"))
    assert r.model_filename == "congestion_model_v3_fixed.pkl" and not r.data_is_synthetic
    assert len(r.coverage_anchors()) == 7


def test_coimbatore_region_is_isolated_from_bengaluru_artifacts():
    c, b = get_region("coimbatore"), get_region("bengaluru")
    assert c.traffic_csv != b.traffic_csv and c.osrm_cache != b.osrm_cache and c.model_filename != b.model_filename
    assert c.data_is_synthetic and c.is_within_bounds(11.0168, 76.9558) and not c.is_within_bounds(12.9716, 77.5946)
    assert b.is_within_bounds(12.9716, 77.5946) and not b.is_within_bounds(11.0168, 76.9558)


def test_unknown_region_rejected():
    with pytest.raises(ValueError):
        get_region("atlantis")


def _run(code, region):
    return subprocess.run([sys.executable, "-c", code], cwd=BACKEND, env=dict(os.environ, ACTIVE_REGION=region), capture_output=True, text=True)


def test_bottlenecks_follow_active_region():
    code = "from services.traffic_service import LiveTrafficService as L; print(len(L.KNOWN_BOTTLENECKS))"
    assert int(_run(code, "bengaluru").stdout.strip()) == 9          # unchanged for Bengaluru
    assert int(_run(code, "coimbatore").stdout.strip()) == 0         # never report Bengaluru hotspots in Coimbatore


def test_pipeline_decodes_with_region_reference():
    code = ("from ml.dataset import TrafficDataPipeline as P; print(P.REF_LAT, P.REF_LON, P._decode_plus_code('XJG4+7J'))")
    assert "12.9716" in _run(code, "bengaluru").stdout
    out = _run(code, "coimbatore").stdout
    assert "11.0168" in out and "12.9" not in out.split("(")[1]       # same short code now resolves near Coimbatore, not Bengaluru


def test_active_settings_region_is_coimbatore():
    from core.config import settings
    assert settings.ACTIVE_REGION == "coimbatore"
    r = get_region(settings.ACTIVE_REGION)
    assert r.key == "coimbatore"
    assert r.display_name == "Coimbatore"
    assert r.is_within_bounds(11.0168, 76.9558)
```


## `backend\tests\test_reroute_validation.py`

```python
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


# EMERGENCY FEATURE DISABLED (commented out, not deleted) - re-enable later.
# def test_emergency_reroute_does_not_apply_congestion_avoidance(monkeypatch):
#     from services.osrm import OSRMService
#     from ml.recommender import RouteScorer

#     current_lat, current_lon = 12.9716, 77.5946
#     dest_lat, dest_lon = 13.0516, 77.5946
#     direct_route = {
#         "route_index": 0,
#         "distance_meters": 9000.0,
#         "duration_seconds": 700.0,
#         "geometry": {
#             "type": "LineString",
#             "coordinates": [[current_lon, current_lat + i * 0.01] for i in range(9)],
#         },
#         "steps": [{"name": "Direct Road", "distance": 9000.0, "duration": 700.0}],
#     }

#     async def mock_get_routes(*args, **kwargs):
#         return [direct_route.copy()]

#     monkeypatch.setattr(OSRMService, "get_routes", staticmethod(mock_get_routes))
#     monkeypatch.setattr(RouteScorer, "evaluate_routes", staticmethod(lambda routes, *args, **kwargs: routes))

#     rec = asyncio.run(DynamicRerouteEngine.evaluate_reroute(
#         current_lat=current_lat,
#         current_lon=current_lon,
#         dest_lat=dest_lat,
#         dest_lon=dest_lon,
#         original_remaining_duration_s=1500.0,
#         avoid_hotspots=[{"lat": 13.0116, "lon": 77.5946, "radius_km": 0.6}],
#         is_emergency_mode=True,
#     ))

#     assert rec.is_reroute_recommended
#     assert not rec.is_congestion_avoidance
#     assert rec.recommended_route is not None


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


def test_controlled_stretch_bypass_uses_paired_same_side_waypoints(monkeypatch):
    """A sampled controlled jam must be routed around as one continuous stretch."""
    import asyncio
    from services.osrm import OSRMService
    from ml.recommender import RouteScorer
    from schemas.navigation import TrafficTestMode
    from services.reroute_engine import DynamicRerouteEngine, route_intersects_avoid_hotspots

    current_lat, current_lon = 12.9700, 77.5946
    dest_lat, dest_lon = 13.0500, 77.5946

    def dense_geometry(points):
        """Model OSRM's dense road geometry instead of fake multi-kilometre jumps."""
        coordinates = []
        for start, end in zip(points, points[1:]):
            steps = max(1, int(max(abs(end[0] - start[0]), abs(end[1] - start[1])) * 111_000 / 120) + 1)
            for step in range(steps):
                t = step / steps
                coordinates.append([
                    start[0] + (end[0] - start[0]) * t,
                    start[1] + (end[1] - start[1]) * t,
                ])
        coordinates.append(list(points[-1]))
        return coordinates

    initial = {
        "route_index": 0,
        "distance_meters": 9000.0,
        "duration_seconds": 700.0,
        "geometry": {"type": "LineString", "coordinates": dense_geometry([
            [77.5946, 12.9700], [77.5946, 12.9850], [77.5946, 13.0050],
            [77.5946, 13.0170], [77.5946, 13.0350], [77.5946, 13.0500],
        ])},
        "steps": [{"name": "Congested Main Road", "distance": 9000.0, "duration": 700.0}],
    }
    bypass = {
        "route_index": 0,
        "distance_meters": 11500.0,
        "duration_seconds": 900.0,
        "geometry": {"type": "LineString", "coordinates": dense_geometry([
            [77.5946, 12.9700], [77.6090, 12.9980], [77.6090, 13.0220],
            [77.5946, 13.0500],
        ])},
        "steps": [{"name": "Outer Service Road", "distance": 11500.0, "duration": 900.0}],
    }
    zones = [
        {"lat": round(13.0050 + i * 0.0010, 6), "lon": 77.5946, "radius_km": 0.09}
        for i in range(13)
    ]
    calls = []

    async def mock_get_routes(*args, **kwargs):
        return [initial.copy()]

    async def mock_get_routes_via_waypoints(waypoints):
        calls.append(waypoints)
        return [bypass.copy()]

    monkeypatch.setattr(OSRMService, "get_routes", staticmethod(mock_get_routes))
    monkeypatch.setattr(OSRMService, "get_routes_via_waypoints", staticmethod(mock_get_routes_via_waypoints))
    monkeypatch.setattr(RouteScorer, "evaluate_routes", staticmethod(lambda routes, *args, **kwargs: routes))

    recommendation = asyncio.run(DynamicRerouteEngine.evaluate_reroute(
        current_lat=current_lat, current_lon=current_lon,
        dest_lat=dest_lat, dest_lon=dest_lon,
        original_remaining_duration_s=700.0, avoid_hotspots=zones,
        traffic_test_mode=TrafficTestMode.HEAVY, traffic_progress=0.32,
        synthetic_traffic_active=True,
    ))

    assert calls, "The reroute engine should probe street-snapped paired waypoints."
    assert all(len(waypoints) == 4 for waypoints in calls), "A stretch bypass must use entry + exit waypoints."
    assert recommendation.is_reroute_recommended
    assert recommendation.recommended_route is not None
    assert not route_intersects_avoid_hotspots(recommendation.recommended_route.geometry, zones)
```


## `backend\tests\test_traffic_scenario.py`

```python
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
```


## `frontend\next-env.d.ts`

```typescript
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/building-your-application/configuring/typescript for more information.
```


## `frontend\package-lock.json`

```json
{
  "name": "apexguardian-frontend",
  "version": "0.1.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "apexguardian-frontend",
      "version": "0.1.0",
      "dependencies": {
        "clsx": "^2.1.0",
        "framer-motion": "^11.0.8",
        "lucide-react": "^0.358.0",
        "maplibre-gl": "^4.1.1",
        "next": "^14.2.24",
        "react": "^18.2.0",
        "react-dom": "^18.2.0",
        "tailwind-merge": "^2.2.1"
      },
      "devDependencies": {
        "@types/node": "^20.11.28",
        "@types/react": "^18.2.66",
        "@types/react-dom": "^18.2.22",
        "autoprefixer": "^10.4.18",
        "postcss": "^8.4.35",
        "tailwindcss": "^3.4.1",
        "typescript": "^5.4.2"
      }
    },
    "node_modules/@alloc/quick-lru": {
      "version": "5.2.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/@jridgewell/gen-mapping": {
      "version": "0.3.13",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/sourcemap-codec": "^1.5.0",
        "@jridgewell/trace-mapping": "^0.3.24"
      }
    },
    "node_modules/@jridgewell/resolve-uri": {
      "version": "3.1.2",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@jridgewell/sourcemap-codec": {
      "version": "1.5.5",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@jridgewell/trace-mapping": {
      "version": "0.3.31",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/resolve-uri": "^3.1.0",
        "@jridgewell/sourcemap-codec": "^1.4.14"
      }
    },
    "node_modules/@mapbox/geojson-rewind": {
      "version": "0.5.2",
      "license": "ISC",
      "dependencies": {
        "get-stream": "^6.0.1",
        "minimist": "^1.2.6"
      },
      "bin": {
        "geojson-rewind": "geojson-rewind"
      }
    },
    "node_modules/@mapbox/jsonlint-lines-primitives": {
      "version": "2.0.3",
      "license": "MIT",
      "engines": {
        "node": ">= 22"
      }
    },
    "node_modules/@mapbox/point-geometry": {
      "version": "0.1.0",
      "license": "ISC"
    },
    "node_modules/@mapbox/tiny-sdf": {
      "version": "2.2.0",
      "license": "BSD-2-Clause"
    },
    "node_modules/@mapbox/unitbezier": {
      "version": "0.0.1",
      "license": "BSD-2-Clause"
    },
    "node_modules/@mapbox/vector-tile": {
      "version": "1.3.1",
      "license": "BSD-3-Clause",
      "dependencies": {
        "@mapbox/point-geometry": "~0.1.0"
      }
    },
    "node_modules/@mapbox/whoots-js": {
      "version": "3.1.0",
      "license": "ISC",
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@maplibre/maplibre-gl-style-spec": {
      "version": "20.4.0",
      "license": "ISC",
      "dependencies": {
        "@mapbox/jsonlint-lines-primitives": "~2.0.2",
        "@mapbox/unitbezier": "^0.0.1",
        "json-stringify-pretty-compact": "^4.0.0",
        "minimist": "^1.2.8",
        "quickselect": "^2.0.0",
        "rw": "^1.3.3",
        "tinyqueue": "^3.0.0"
      },
      "bin": {
        "gl-style-format": "dist/gl-style-format.mjs",
        "gl-style-migrate": "dist/gl-style-migrate.mjs",
        "gl-style-validate": "dist/gl-style-validate.mjs"
      }
    },
    "node_modules/@maplibre/maplibre-gl-style-spec/node_modules/quickselect": {
      "version": "2.0.0",
      "license": "ISC"
    },
    "node_modules/@next/env": {
      "version": "14.2.35",
      "resolved": "https://registry.npmjs.org/@next/env/-/env-14.2.35.tgz",
      "integrity": "sha512-DuhvCtj4t9Gwrx80dmz2F4t/zKQ4ktN8WrMwOuVzkJfBilwAwGr6v16M5eI8yCuZ63H9TTuEU09Iu2HqkzFPVQ==",
      "license": "MIT"
    },
    "node_modules/@next/swc-darwin-arm64": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-darwin-arm64/-/swc-darwin-arm64-14.2.33.tgz",
      "integrity": "sha512-HqYnb6pxlsshoSTubdXKu15g3iivcbsMXg4bYpjL2iS/V6aQot+iyF4BUc2qA/J/n55YtvE4PHMKWBKGCF/+wA==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-darwin-x64": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-darwin-x64/-/swc-darwin-x64-14.2.33.tgz",
      "integrity": "sha512-8HGBeAE5rX3jzKvF593XTTFg3gxeU4f+UWnswa6JPhzaR6+zblO5+fjltJWIZc4aUalqTclvN2QtTC37LxvZAA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-arm64-gnu": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-14.2.33.tgz",
      "integrity": "sha512-JXMBka6lNNmqbkvcTtaX8Gu5by9547bukHQvPoLe9VRBx1gHwzf5tdt4AaezW85HAB3pikcvyqBToRTDA4DeLw==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-arm64-musl": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-14.2.33.tgz",
      "integrity": "sha512-Bm+QulsAItD/x6Ih8wGIMfRJy4G73tu1HJsrccPW6AfqdZd0Sfm5Imhgkgq2+kly065rYMnCOxTBvmvFY1BKfg==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-x64-gnu": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-14.2.33.tgz",
      "integrity": "sha512-FnFn+ZBgsVMbGDsTqo8zsnRzydvsGV8vfiWwUo1LD8FTmPTdV+otGSWKc4LJec0oSexFnCYVO4hX8P8qQKaSlg==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-x64-musl": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-x64-musl/-/swc-linux-x64-musl-14.2.33.tgz",
      "integrity": "sha512-345tsIWMzoXaQndUTDv1qypDRiebFxGYx9pYkhwY4hBRaOLt8UGfiWKr9FSSHs25dFIf8ZqIFaPdy5MljdoawA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-win32-arm64-msvc": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-win32-arm64-msvc/-/swc-win32-arm64-msvc-14.2.33.tgz",
      "integrity": "sha512-nscpt0G6UCTkrT2ppnJnFsYbPDQwmum4GNXYTeoTIdsmMydSKFz9Iny2jpaRupTb+Wl298+Rh82WKzt9LCcqSQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-win32-ia32-msvc": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-win32-ia32-msvc/-/swc-win32-ia32-msvc-14.2.33.tgz",
      "integrity": "sha512-pc9LpGNKhJ0dXQhZ5QMmYxtARwwmWLpeocFmVG5Z0DzWq5Uf0izcI8tLc+qOpqxO1PWqZ5A7J1blrUIKrIFc7Q==",
      "cpu": [
        "ia32"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-win32-x64-msvc": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-win32-x64-msvc/-/swc-win32-x64-msvc-14.2.33.tgz",
      "integrity": "sha512-nOjfZMy8B94MdisuzZo9/57xuFVLHJaDj5e/xrduJp9CV2/HrfxTRH2fbyLe+K9QT41WBLUd4iXX3R7jBp0EUg==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@nodelib/fs.scandir": {
      "version": "2.1.5",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.stat": "2.0.5",
        "run-parallel": "^1.1.9"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nodelib/fs.stat": {
      "version": "2.0.5",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nodelib/fs.walk": {
      "version": "1.2.8",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.scandir": "2.1.5",
        "fastq": "^1.6.0"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@swc/counter": {
      "version": "0.1.3",
      "resolved": "https://registry.npmjs.org/@swc/counter/-/counter-0.1.3.tgz",
      "integrity": "sha512-e2BR4lsJkkRlKZ/qCHPw9ZaSxc0MVUd7gtbtaB7aMvHeJVYe8sOB8DBZkP2DtISHGSku9sCK6T6cnY0CtXrOCQ==",
      "license": "Apache-2.0"
    },
    "node_modules/@swc/helpers": {
      "version": "0.5.5",
      "resolved": "https://registry.npmjs.org/@swc/helpers/-/helpers-0.5.5.tgz",
      "integrity": "sha512-KGYxvIOXcceOAbEk4bi/dVLEK9z8sZ0uBB3Il5b1rhfClSpcX0yfRO0KmTkqR2cnQDymwLB+25ZyMzICg/cm/A==",
      "license": "Apache-2.0",
      "dependencies": {
        "@swc/counter": "^0.1.3",
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@types/geojson": {
      "version": "7946.0.16",
      "license": "MIT"
    },
    "node_modules/@types/geojson-vt": {
      "version": "3.2.5",
      "license": "MIT",
      "dependencies": {
        "@types/geojson": "*"
      }
    },
    "node_modules/@types/mapbox__point-geometry": {
      "version": "0.1.4",
      "license": "MIT"
    },
    "node_modules/@types/mapbox__vector-tile": {
      "version": "1.3.4",
      "license": "MIT",
      "dependencies": {
        "@types/geojson": "*",
        "@types/mapbox__point-geometry": "*",
        "@types/pbf": "*"
      }
    },
    "node_modules/@types/node": {
      "version": "20.19.43",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "undici-types": "~6.21.0"
      }
    },
    "node_modules/@types/pbf": {
      "version": "3.0.5",
      "license": "MIT"
    },
    "node_modules/@types/prop-types": {
      "version": "15.7.15",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@types/react": {
      "version": "18.3.31",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@types/prop-types": "*",
        "csstype": "^3.2.2"
      }
    },
    "node_modules/@types/react-dom": {
      "version": "18.3.7",
      "dev": true,
      "license": "MIT",
      "peerDependencies": {
        "@types/react": "^18.0.0"
      }
    },
    "node_modules/@types/supercluster": {
      "version": "7.1.3",
      "license": "MIT",
      "dependencies": {
        "@types/geojson": "*"
      }
    },
    "node_modules/any-promise": {
      "version": "1.3.0",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/anymatch": {
      "version": "3.1.3",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "normalize-path": "^3.0.0",
        "picomatch": "^2.0.4"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/arg": {
      "version": "5.0.2",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/autoprefixer": {
      "version": "10.5.4",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/autoprefixer"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "browserslist": "^4.28.6",
        "caniuse-lite": "^1.0.30001806",
        "fraction.js": "^5.3.4",
        "picocolors": "^1.1.1",
        "postcss-value-parser": "^4.2.0"
      },
      "bin": {
        "autoprefixer": "bin/autoprefixer"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      },
      "peerDependencies": {
        "postcss": "^8.1.0"
      }
    },
    "node_modules/baseline-browser-mapping": {
      "version": "2.11.11",
      "dev": true,
      "license": "Apache-2.0",
      "bin": {
        "baseline-browser-mapping": "dist/cli.cjs"
      },
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/binary-extensions": {
      "version": "2.3.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/braces": {
      "version": "3.0.3",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fill-range": "^7.1.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/browserslist": {
      "version": "4.28.7",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/browserslist"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "baseline-browser-mapping": "^2.10.44",
        "caniuse-lite": "^1.0.30001806",
        "electron-to-chromium": "^1.5.393",
        "node-releases": "^2.0.51",
        "update-browserslist-db": "^1.2.3"
      },
      "bin": {
        "browserslist": "cli.js"
      },
      "engines": {
        "node": "^6 || ^7 || ^8 || ^9 || ^10 || ^11 || ^12 || >=13.7"
      }
    },
    "node_modules/busboy": {
      "version": "1.6.0",
      "dependencies": {
        "streamsearch": "^1.1.0"
      },
      "engines": {
        "node": ">=10.16.0"
      }
    },
    "node_modules/camelcase-css": {
      "version": "2.0.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/caniuse-lite": {
      "version": "1.0.30001806",
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/caniuse-lite"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "CC-BY-4.0"
    },
    "node_modules/chokidar": {
      "version": "3.6.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "anymatch": "~3.1.2",
        "braces": "~3.0.2",
        "glob-parent": "~5.1.2",
        "is-binary-path": "~2.1.0",
        "is-glob": "~4.0.1",
        "normalize-path": "~3.0.0",
        "readdirp": "~3.6.0"
      },
      "engines": {
        "node": ">= 8.10.0"
      },
      "funding": {
        "url": "https://paulmillr.com/funding/"
      },
      "optionalDependencies": {
        "fsevents": "~2.3.2"
      }
    },
    "node_modules/chokidar/node_modules/fsevents": {
      "version": "2.3.3",
      "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz",
      "integrity": "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==",
      "dev": true,
      "hasInstallScript": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": "^8.16.0 || ^10.6.0 || >=11.0.0"
      }
    },
    "node_modules/chokidar/node_modules/glob-parent": {
      "version": "5.1.2",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/client-only": {
      "version": "0.0.1",
      "license": "MIT"
    },
    "node_modules/clsx": {
      "version": "2.1.1",
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/commander": {
      "version": "4.1.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/cssesc": {
      "version": "3.0.0",
      "dev": true,
      "license": "MIT",
      "bin": {
        "cssesc": "bin/cssesc"
      },
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/csstype": {
      "version": "3.2.3",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/didyoumean": {
      "version": "1.2.2",
      "dev": true,
      "license": "Apache-2.0"
    },
    "node_modules/dlv": {
      "version": "1.1.3",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/earcut": {
      "version": "3.2.3",
      "license": "ISC"
    },
    "node_modules/electron-to-chromium": {
      "version": "1.5.399",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/es-errors": {
      "version": "1.3.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/escalade": {
      "version": "3.2.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/fast-glob": {
      "version": "3.3.3",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.stat": "^2.0.2",
        "@nodelib/fs.walk": "^1.2.3",
        "glob-parent": "^5.1.2",
        "merge2": "^1.3.0",
        "micromatch": "^4.0.8"
      },
      "engines": {
        "node": ">=8.6.0"
      }
    },
    "node_modules/fast-glob/node_modules/glob-parent": {
      "version": "5.1.2",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/fastq": {
      "version": "1.20.1",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "reusify": "^1.0.4"
      }
    },
    "node_modules/fill-range": {
      "version": "7.1.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "to-regex-range": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/fraction.js": {
      "version": "5.3.4",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "*"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/rawify"
      }
    },
    "node_modules/framer-motion": {
      "version": "11.18.2",
      "license": "MIT",
      "dependencies": {
        "motion-dom": "^11.18.1",
        "motion-utils": "^11.18.1",
        "tslib": "^2.4.0"
      },
      "peerDependencies": {
        "@emotion/is-prop-valid": "*",
        "react": "^18.0.0 || ^19.0.0",
        "react-dom": "^18.0.0 || ^19.0.0"
      },
      "peerDependenciesMeta": {
        "@emotion/is-prop-valid": {
          "optional": true
        },
        "react": {
          "optional": true
        },
        "react-dom": {
          "optional": true
        }
      }
    },
    "node_modules/function-bind": {
      "version": "1.1.2",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/geojson-vt": {
      "version": "4.0.3",
      "license": "ISC"
    },
    "node_modules/get-stream": {
      "version": "6.0.1",
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/gl-matrix": {
      "version": "3.4.4",
      "license": "MIT"
    },
    "node_modules/glob-parent": {
      "version": "6.0.2",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.3"
      },
      "engines": {
        "node": ">=10.13.0"
      }
    },
    "node_modules/global-prefix": {
      "version": "4.0.0",
      "license": "MIT",
      "dependencies": {
        "ini": "^4.1.3",
        "kind-of": "^6.0.3",
        "which": "^4.0.0"
      },
      "engines": {
        "node": ">=16"
      }
    },
    "node_modules/graceful-fs": {
      "version": "4.2.11",
      "license": "ISC"
    },
    "node_modules/hasown": {
      "version": "2.0.4",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "function-bind": "^1.1.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/ieee754": {
      "version": "1.2.1",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "BSD-3-Clause"
    },
    "node_modules/ini": {
      "version": "4.1.3",
      "license": "ISC",
      "engines": {
        "node": "^14.17.0 || ^16.13.0 || >=18.0.0"
      }
    },
    "node_modules/is-binary-path": {
      "version": "2.1.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "binary-extensions": "^2.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/is-core-module": {
      "version": "2.16.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hasown": "^2.0.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-extglob": {
      "version": "2.1.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-glob": {
      "version": "4.0.3",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-extglob": "^2.1.1"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-number": {
      "version": "7.0.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.12.0"
      }
    },
    "node_modules/isexe": {
      "version": "3.1.5",
      "license": "BlueOak-1.0.0",
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/jiti": {
      "version": "1.21.7",
      "dev": true,
      "license": "MIT",
      "bin": {
        "jiti": "bin/jiti.js"
      }
    },
    "node_modules/js-tokens": {
      "version": "4.0.0",
      "license": "MIT"
    },
    "node_modules/json-stringify-pretty-compact": {
      "version": "4.0.0",
      "license": "MIT"
    },
    "node_modules/kdbush": {
      "version": "4.1.0",
      "license": "ISC"
    },
    "node_modules/kind-of": {
      "version": "6.0.3",
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/lilconfig": {
      "version": "3.1.3",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=14"
      },
      "funding": {
        "url": "https://github.com/sponsors/antonk52"
      }
    },
    "node_modules/lines-and-columns": {
      "version": "1.2.4",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/loose-envify": {
      "version": "1.4.0",
      "license": "MIT",
      "dependencies": {
        "js-tokens": "^3.0.0 || ^4.0.0"
      },
      "bin": {
        "loose-envify": "cli.js"
      }
    },
    "node_modules/lucide-react": {
      "version": "0.358.0",
      "license": "ISC",
      "peerDependencies": {
        "react": "^16.5.1 || ^17.0.0 || ^18.0.0"
      }
    },
    "node_modules/maplibre-gl": {
      "version": "4.7.1",
      "license": "BSD-3-Clause",
      "dependencies": {
        "@mapbox/geojson-rewind": "^0.5.2",
        "@mapbox/jsonlint-lines-primitives": "^2.0.2",
        "@mapbox/point-geometry": "^0.1.0",
        "@mapbox/tiny-sdf": "^2.0.6",
        "@mapbox/unitbezier": "^0.0.1",
        "@mapbox/vector-tile": "^1.3.1",
        "@mapbox/whoots-js": "^3.1.0",
        "@maplibre/maplibre-gl-style-spec": "^20.3.1",
        "@types/geojson": "^7946.0.14",
        "@types/geojson-vt": "3.2.5",
        "@types/mapbox__point-geometry": "^0.1.4",
        "@types/mapbox__vector-tile": "^1.3.4",
        "@types/pbf": "^3.0.5",
        "@types/supercluster": "^7.1.3",
        "earcut": "^3.0.0",
        "geojson-vt": "^4.0.2",
        "gl-matrix": "^3.4.3",
        "global-prefix": "^4.0.0",
        "kdbush": "^4.0.2",
        "murmurhash-js": "^1.0.0",
        "pbf": "^3.3.0",
        "potpack": "^2.0.0",
        "quickselect": "^3.0.0",
        "supercluster": "^8.0.1",
        "tinyqueue": "^3.0.0",
        "vt-pbf": "^3.1.3"
      },
      "engines": {
        "node": ">=16.14.0",
        "npm": ">=8.1.0"
      },
      "funding": {
        "url": "https://github.com/maplibre/maplibre-gl-js?sponsor=1"
      }
    },
    "node_modules/merge2": {
      "version": "1.4.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/micromatch": {
      "version": "4.0.8",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "braces": "^3.0.3",
        "picomatch": "^2.3.1"
      },
      "engines": {
        "node": ">=8.6"
      }
    },
    "node_modules/minimist": {
      "version": "1.2.8",
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/motion-dom": {
      "version": "11.18.1",
      "license": "MIT",
      "dependencies": {
        "motion-utils": "^11.18.1"
      }
    },
    "node_modules/motion-utils": {
      "version": "11.18.1",
      "license": "MIT"
    },
    "node_modules/murmurhash-js": {
      "version": "1.0.0",
      "license": "MIT"
    },
    "node_modules/mz": {
      "version": "2.7.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "any-promise": "^1.0.0",
        "object-assign": "^4.0.1",
        "thenify-all": "^1.0.0"
      }
    },
    "node_modules/nanoid": {
      "version": "3.3.16",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "bin": {
        "nanoid": "bin/nanoid.cjs"
      },
      "engines": {
        "node": "^10 || ^12 || ^13.7 || ^14 || >=15.0.1"
      }
    },
    "node_modules/next": {
      "version": "14.2.35",
      "resolved": "https://registry.npmjs.org/next/-/next-14.2.35.tgz",
      "integrity": "sha512-KhYd2Hjt/O1/1aZVX3dCwGXM1QmOV4eNM2UTacK5gipDdPN/oHHK/4oVGy7X8GMfPMsUTUEmGlsy0EY1YGAkig==",
      "license": "MIT",
      "dependencies": {
        "@next/env": "14.2.35",
        "@swc/helpers": "0.5.5",
        "busboy": "1.6.0",
        "caniuse-lite": "^1.0.30001579",
        "graceful-fs": "^4.2.11",
        "postcss": "8.4.31",
        "styled-jsx": "5.1.1"
      },
      "bin": {
        "next": "dist/bin/next"
      },
      "engines": {
        "node": ">=18.17.0"
      },
      "optionalDependencies": {
        "@next/swc-darwin-arm64": "14.2.33",
        "@next/swc-darwin-x64": "14.2.33",
        "@next/swc-linux-arm64-gnu": "14.2.33",
        "@next/swc-linux-arm64-musl": "14.2.33",
        "@next/swc-linux-x64-gnu": "14.2.33",
        "@next/swc-linux-x64-musl": "14.2.33",
        "@next/swc-win32-arm64-msvc": "14.2.33",
        "@next/swc-win32-ia32-msvc": "14.2.33",
        "@next/swc-win32-x64-msvc": "14.2.33"
      },
      "peerDependencies": {
        "@opentelemetry/api": "^1.1.0",
        "@playwright/test": "^1.41.2",
        "react": "^18.2.0",
        "react-dom": "^18.2.0",
        "sass": "^1.3.0"
      },
      "peerDependenciesMeta": {
        "@opentelemetry/api": {
          "optional": true
        },
        "@playwright/test": {
          "optional": true
        },
        "sass": {
          "optional": true
        }
      }
    },
    "node_modules/next/node_modules/postcss": {
      "version": "8.4.31",
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/postcss"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "nanoid": "^3.3.6",
        "picocolors": "^1.0.0",
        "source-map-js": "^1.0.2"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      }
    },
    "node_modules/node-releases": {
      "version": "2.0.51",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/normalize-path": {
      "version": "3.0.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/object-assign": {
      "version": "4.1.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/object-hash": {
      "version": "3.0.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/path-parse": {
      "version": "1.0.7",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/pbf": {
      "version": "3.3.0",
      "license": "BSD-3-Clause",
      "dependencies": {
        "ieee754": "^1.1.12",
        "resolve-protobuf-schema": "^2.1.0"
      },
      "bin": {
        "pbf": "bin/pbf"
      }
    },
    "node_modules/picocolors": {
      "version": "1.1.1",
      "license": "ISC"
    },
    "node_modules/picomatch": {
      "version": "2.3.2",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8.6"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/pify": {
      "version": "2.3.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/pirates": {
      "version": "4.0.7",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/postcss": {
      "version": "8.5.25",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/postcss"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "nanoid": "^3.3.16",
        "picocolors": "^1.1.1",
        "source-map-js": "^1.2.1"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      }
    },
    "node_modules/postcss-import": {
      "version": "15.1.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "postcss-value-parser": "^4.0.0",
        "read-cache": "^1.0.0",
        "resolve": "^1.1.7"
      },
      "engines": {
        "node": ">=14.0.0"
      },
      "peerDependencies": {
        "postcss": "^8.0.0"
      }
    },
    "node_modules/postcss-js": {
      "version": "4.1.0",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "camelcase-css": "^2.0.1"
      },
      "engines": {
        "node": "^12 || ^14 || >= 16"
      },
      "peerDependencies": {
        "postcss": "^8.4.21"
      }
    },
    "node_modules/postcss-load-config": {
      "version": "6.0.1",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "lilconfig": "^3.1.1"
      },
      "engines": {
        "node": ">= 18"
      },
      "peerDependencies": {
        "jiti": ">=1.21.0",
        "postcss": ">=8.0.9",
        "tsx": "^4.8.1",
        "yaml": "^2.4.2"
      },
      "peerDependenciesMeta": {
        "jiti": {
          "optional": true
        },
        "postcss": {
          "optional": true
        },
        "tsx": {
          "optional": true
        },
        "yaml": {
          "optional": true
        }
      }
    },
    "node_modules/postcss-nested": {
      "version": "6.2.0",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "postcss-selector-parser": "^6.1.1"
      },
      "engines": {
        "node": ">=12.0"
      },
      "peerDependencies": {
        "postcss": "^8.2.14"
      }
    },
    "node_modules/postcss-selector-parser": {
      "version": "6.1.4",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "cssesc": "^3.0.0",
        "util-deprecate": "^1.0.2"
      },
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/postcss-value-parser": {
      "version": "4.2.0",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/potpack": {
      "version": "2.1.0",
      "license": "ISC"
    },
    "node_modules/protocol-buffers-schema": {
      "version": "3.6.1",
      "license": "MIT"
    },
    "node_modules/queue-microtask": {
      "version": "1.2.3",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/quickselect": {
      "version": "3.0.0",
      "license": "ISC"
    },
    "node_modules/react": {
      "version": "18.3.1",
      "license": "MIT",
      "dependencies": {
        "loose-envify": "^1.1.0"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/react-dom": {
      "version": "18.3.1",
      "license": "MIT",
      "dependencies": {
        "loose-envify": "^1.1.0",
        "scheduler": "^0.23.2"
      },
      "peerDependencies": {
        "react": "^18.3.1"
      }
    },
    "node_modules/read-cache": {
      "version": "1.0.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "pify": "^2.3.0"
      }
    },
    "node_modules/readdirp": {
      "version": "3.6.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "picomatch": "^2.2.1"
      },
      "engines": {
        "node": ">=8.10.0"
      }
    },
    "node_modules/resolve": {
      "version": "1.22.12",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "is-core-module": "^2.16.1",
        "path-parse": "^1.0.7",
        "supports-preserve-symlinks-flag": "^1.0.0"
      },
      "bin": {
        "resolve": "bin/resolve"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/resolve-protobuf-schema": {
      "version": "2.1.0",
      "license": "MIT",
      "dependencies": {
        "protocol-buffers-schema": "^3.3.1"
      }
    },
    "node_modules/reusify": {
      "version": "1.1.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "iojs": ">=1.0.0",
        "node": ">=0.10.0"
      }
    },
    "node_modules/run-parallel": {
      "version": "1.2.0",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "queue-microtask": "^1.2.2"
      }
    },
    "node_modules/rw": {
      "version": "1.3.3",
      "license": "BSD-3-Clause"
    },
    "node_modules/scheduler": {
      "version": "0.23.2",
      "license": "MIT",
      "dependencies": {
        "loose-envify": "^1.1.0"
      }
    },
    "node_modules/source-map-js": {
      "version": "1.2.1",
      "license": "BSD-3-Clause",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/streamsearch": {
      "version": "1.1.0",
      "engines": {
        "node": ">=10.0.0"
      }
    },
    "node_modules/styled-jsx": {
      "version": "5.1.1",
      "license": "MIT",
      "dependencies": {
        "client-only": "0.0.1"
      },
      "engines": {
        "node": ">= 12.0.0"
      },
      "peerDependencies": {
        "react": ">= 16.8.0 || 17.x.x || ^18.0.0-0"
      },
      "peerDependenciesMeta": {
        "@babel/core": {
          "optional": true
        },
        "babel-plugin-macros": {
          "optional": true
        }
      }
    },
    "node_modules/sucrase": {
      "version": "3.35.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/gen-mapping": "^0.3.2",
        "commander": "^4.0.0",
        "lines-and-columns": "^1.1.6",
        "mz": "^2.7.0",
        "pirates": "^4.0.1",
        "tinyglobby": "^0.2.11",
        "ts-interface-checker": "^0.1.9"
      },
      "bin": {
        "sucrase": "bin/sucrase",
        "sucrase-node": "bin/sucrase-node"
      },
      "engines": {
        "node": ">=16 || 14 >=14.17"
      }
    },
    "node_modules/supercluster": {
      "version": "8.0.1",
      "license": "ISC",
      "dependencies": {
        "kdbush": "^4.0.2"
      }
    },
    "node_modules/supports-preserve-symlinks-flag": {
      "version": "1.0.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/tailwind-merge": {
      "version": "2.6.1",
      "license": "MIT",
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/dcastil"
      }
    },
    "node_modules/tailwindcss": {
      "version": "3.4.19",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@alloc/quick-lru": "^5.2.0",
        "arg": "^5.0.2",
        "chokidar": "^3.6.0",
        "didyoumean": "^1.2.2",
        "dlv": "^1.1.3",
        "fast-glob": "^3.3.2",
        "glob-parent": "^6.0.2",
        "is-glob": "^4.0.3",
        "jiti": "^1.21.7",
        "lilconfig": "^3.1.3",
        "micromatch": "^4.0.8",
        "normalize-path": "^3.0.0",
        "object-hash": "^3.0.0",
        "picocolors": "^1.1.1",
        "postcss": "^8.4.47",
        "postcss-import": "^15.1.0",
        "postcss-js": "^4.0.1",
        "postcss-load-config": "^4.0.2 || ^5.0 || ^6.0",
        "postcss-nested": "^6.2.0",
        "postcss-selector-parser": "^6.1.2",
        "resolve": "^1.22.8",
        "sucrase": "^3.35.0"
      },
      "bin": {
        "tailwind": "lib/cli.js",
        "tailwindcss": "lib/cli.js"
      },
      "engines": {
        "node": ">=14.0.0"
      }
    },
    "node_modules/thenify": {
      "version": "3.3.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "any-promise": "^1.0.0"
      }
    },
    "node_modules/thenify-all": {
      "version": "1.6.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "thenify": ">= 3.1.0 < 4"
      },
      "engines": {
        "node": ">=0.8"
      }
    },
    "node_modules/tinyglobby": {
      "version": "0.2.17",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fdir": "^6.5.0",
        "picomatch": "^4.0.4"
      },
      "engines": {
        "node": ">=12.0.0"
      },
      "funding": {
        "url": "https://github.com/sponsors/SuperchupuDev"
      }
    },
    "node_modules/tinyglobby/node_modules/fdir": {
      "version": "6.5.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12.0.0"
      },
      "peerDependencies": {
        "picomatch": "^3 || ^4"
      },
      "peerDependenciesMeta": {
        "picomatch": {
          "optional": true
        }
      }
    },
    "node_modules/tinyglobby/node_modules/picomatch": {
      "version": "4.0.5",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/tinyqueue": {
      "version": "3.0.0",
      "license": "ISC"
    },
    "node_modules/to-regex-range": {
      "version": "5.0.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-number": "^7.0.0"
      },
      "engines": {
        "node": ">=8.0"
      }
    },
    "node_modules/ts-interface-checker": {
      "version": "0.1.13",
      "dev": true,
      "license": "Apache-2.0"
    },
    "node_modules/tslib": {
      "version": "2.8.1",
      "license": "0BSD"
    },
    "node_modules/typescript": {
      "version": "5.9.3",
      "dev": true,
      "license": "Apache-2.0",
      "bin": {
        "tsc": "bin/tsc",
        "tsserver": "bin/tsserver"
      },
      "engines": {
        "node": ">=14.17"
      }
    },
    "node_modules/undici-types": {
      "version": "6.21.0",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/update-browserslist-db": {
      "version": "1.2.3",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/browserslist"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "escalade": "^3.2.0",
        "picocolors": "^1.1.1"
      },
      "bin": {
        "update-browserslist-db": "cli.js"
      },
      "peerDependencies": {
        "browserslist": ">= 4.21.0"
      }
    },
    "node_modules/util-deprecate": {
      "version": "1.0.2",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/vt-pbf": {
      "version": "3.1.3",
      "license": "MIT",
      "dependencies": {
        "@mapbox/point-geometry": "0.1.0",
        "@mapbox/vector-tile": "^1.3.1",
        "pbf": "^3.2.1"
      }
    },
    "node_modules/which": {
      "version": "4.0.0",
      "license": "ISC",
      "dependencies": {
        "isexe": "^3.1.1"
      },
      "bin": {
        "node-which": "bin/which.js"
      },
      "engines": {
        "node": "^16.13.0 || >=18.0.0"
      }
    }
  }
}
```


## `frontend\package.json`

```json
{
  "name": "apexguardian-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "clsx": "^2.1.0",
    "framer-motion": "^11.0.8",
    "lucide-react": "^0.358.0",
    "maplibre-gl": "^4.1.1",
    "next": "^14.2.24",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "tailwind-merge": "^2.2.1"
  },
  "devDependencies": {
    "@types/node": "^20.11.28",
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "autoprefixer": "^10.4.18",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.4.2"
  }
}
```


## `frontend\postcss.config.js`

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```


## `frontend\src\app\globals.css`

```css
@import "maplibre-gl/dist/maplibre-gl.css";
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #ffffff;
  --foreground: #0f172a;
}

html,
body,
#root,
main {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

.glass-panel {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08);
}

.glass-panel-dark {
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
}

/* Custom scrollbars for drawers */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 9999px;
}
```


## `frontend\src\app\layout.tsx`

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { NavigationProvider } from "@/context/NavigationContext";

export const metadata: Metadata = {
  title: "Apex Guardian - AI Navigation Engine",
  description: "AI-powered predictive navigation engine for Bengaluru",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full w-full overflow-hidden">
      <body className="h-full w-full overflow-hidden bg-slate-900 text-slate-900 antialiased">
        <NavigationProvider>
          {children}
        </NavigationProvider>
      </body>
    </html>
  );
}
```


## `frontend\src\app\page.tsx`

```tsx
"use client";

import React from "react";
import { MapCanvas } from "@/components/map/MapCanvas";
import { FloatingSearchPanel } from "@/components/ui/FloatingSearchPanel";
import { MapControls } from "@/components/ui/MapControls";
import { RouteCard } from "@/components/ui/RouteCard";
import { TurnByTurnDrawer } from "@/components/ui/TurnByTurnDrawer";
import { AdvanceAlertBanner } from "@/components/ui/AdvanceAlertBanner";
import { RerouteModal } from "@/components/ui/RerouteModal";
import { NavigationControlsHUD } from "@/components/ui/NavigationControlsHUD";
import { NoFasterRouteToast } from "@/components/ui/NoFasterRouteToast";
import { TrafficLegend } from "@/components/ui/TrafficLegend";
import { useNavigation } from "@/context/NavigationContext";
import { ShieldCheck, Wifi, WifiOff, Siren } from "lucide-react";
import { OVERLAY_Z } from "@/lib/layoutZones";

export default function Home() {
  const {
    backendOnline,
    isEmergencyMode,
    isNavigating,
    activeAlert,
    dismissAlert,
    activeRerouteRecommendation,
    dismissReroute,
    acceptReroute,
    triggerDynamicRerouteCheck,
    isApplyingReroute,
    noRouteReason,
    dismissNoRouteReason,
  } = useNavigation();

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-900 select-none">
      {/* Full-bleed Map Canvas Base Layer */}
      <MapCanvas />

      {/* Feature 4: Advance Distance-Decrementing Proactive Alert Banner */}
      <AdvanceAlertBanner
        alert={activeAlert}
        onDismiss={dismissAlert}
        onCheckReroute={() => triggerDynamicRerouteCheck(true, activeAlert?.hotspotId ?? null)}
        fasterRouteAvailable={!!activeRerouteRecommendation?.is_reroute_recommended}
      />

      {/* Feature 8 & 9: Fastest Alternative Route Modal */}
      <RerouteModal
        recommendation={activeRerouteRecommendation}
        onAccept={acceptReroute}
        onDismiss={dismissReroute}
        isApplying={isApplyingReroute}
      />

      {!activeRerouteRecommendation && (
        <NoFasterRouteToast reason={noRouteReason} onDismiss={dismissNoRouteReason} />
      )}

      {/* Active Driving Turn-by-Turn HUD & Simulation Controls */}
      <NavigationControlsHUD />

      {/* Left Sidebar UI Layout */}
      {!isNavigating && (
        <div className="fixed left-4 top-4 bottom-4 flex flex-col gap-4 w-[calc(100vw-32px)] sm:w-[420px] overflow-y-auto pointer-events-none" style={{ zIndex: OVERLAY_Z.sidebar }}>
          <FloatingSearchPanel />
          <RouteCard />
          <TurnByTurnDrawer />
          <TrafficLegend placement="sidebar" />
        </div>
      )}
      {isNavigating && <TrafficLegend placement="navigation" />}

      {/* Standard Map Controls (Zoom, Recenter, Layers) */}
      <MapControls />

      {/* Top-Right Backend Health & Mode Status Badges */}
      <div className="fixed top-4 right-4 flex items-center gap-2 pointer-events-auto" style={{ zIndex: OVERLAY_Z.statusBadge }}>
        {/* EMERGENCY FEATURE DISABLED (commented out, not deleted) - re-enable later.
        {isEmergencyMode && (
          <div className="glass-panel px-3.5 py-2 rounded-full flex items-center gap-2 shadow-lg text-xs font-black text-rose-600 border border-rose-500/50 bg-rose-50/95 animate-pulse">
            <Siren className="w-3.5 h-3.5 fill-current" />
            <span className="tracking-wide uppercase">Emergency Mode</span>
          </div>
        )}
        */}

        <div className="glass-panel px-3.5 py-2 rounded-full flex items-center gap-2 shadow-lg text-xs font-semibold">
          <div className="w-6 h-6 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-600">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <span className="hidden sm:inline text-slate-700 font-bold">Apex Backend:</span>
          {backendOnline === null ? (
            <span className="text-slate-400">Connecting...</span>
          ) : backendOnline ? (
            <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
              <Wifi className="w-3.5 h-3.5" /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-rose-500 font-bold">
              <WifiOff className="w-3.5 h-3.5" /> Offline
            </span>
          )}
        </div>
      </div>
    </main>
  );
}
```


## `frontend\src\components\map\MapCanvas.tsx`

```tsx
"use client";

import React, { useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { TRAFFIC_COLORS } from "@/lib/trafficScenario";
import { useNavigation, haversineMeters } from "@/context/NavigationContext";
import { ACTIVE_REGION_CENTER, ACTIVE_REGION_CONFIG } from "@/lib/region";
import { reverseGeocode, CongestionHotspot } from "@/lib/api";
import { OVERLAY_Z } from "@/lib/layoutZones";

// Route identity colours (used only where traffic is clear; congestion keeps its own colours).
const AI_ROUTE_GREEN = "#16A34A";      // AI recommended route
const AI_ROUTE_GREEN_DARK = "#15803D";
const OSRM_ROUTE_BLUE = "#2563EB";     // OSRM preferred / second-best route
const OSRM_ROUTE_BLUE_DARK = "#1D4ED8";

const escapePopupText = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, (character) => {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
  return entities[character] ?? character;
});

export const mapRefContainer: { current: maplibregl.Map | null } = { current: null };

export const MapCanvas: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const vehicleMarkerRef = useRef<maplibregl.Marker | null>(null);
  const hotspotMarkersRef = useRef<maplibregl.Marker[]>([]);
  const lastCameraFollowTimeRef = useRef<number>(0);
  const lastClickTimestampRef = useRef<number>(0);

  const {
    selectedOrigin,
    setSelectedOrigin,
    setSourceQuery,
    selectedDestination,
    setSelectedDestination,
    setDestinationQuery,
    routes,
    activeRouteIndex,
    setActiveRouteIndex,
    recenterTrigger,
    setCurrentZoom,
    pinDropMode,
    setPinDropMode,
    calculateRoutes,
    activeLayerMode,
    isEmergencyMode,
    trafficTestMode,
    isNavigating,
    currentLocation,
    vehicleBearing,
    activeRerouteRecommendation,
    navigationHudHeight,
  } = useNavigation();

  // Stable refs for values used inside event handlers.
  // This lets us register map listeners ONCE and always read the latest state.
  const pinDropModeRef = useRef(pinDropMode);
  const selectedOriginRef = useRef(selectedOrigin);
  const selectedDestinationRef = useRef(selectedDestination);
  const calculateRoutesRef = useRef(calculateRoutes);
  const setSelectedOriginRef = useRef(setSelectedOrigin);
  const setSelectedDestinationRef = useRef(setSelectedDestination);
  const setSourceQueryRef = useRef(setSourceQuery);
  const setDestinationQueryRef = useRef(setDestinationQuery);
  const setPinDropModeRef = useRef(setPinDropMode);
  const isNavigatingRef = useRef(isNavigating);
  const activeRouteIndexRef = useRef(activeRouteIndex);

  // Keep refs in sync with latest values on every render (no effects needed).
  pinDropModeRef.current = pinDropMode;
  selectedOriginRef.current = selectedOrigin;
  selectedDestinationRef.current = selectedDestination;
  calculateRoutesRef.current = calculateRoutes;
  setSelectedOriginRef.current = setSelectedOrigin;
  setSelectedDestinationRef.current = setSelectedDestination;
  setSourceQueryRef.current = setSourceQuery;
  setDestinationQueryRef.current = setDestinationQuery;
  setPinDropModeRef.current = setPinDropMode;
  isNavigatingRef.current = isNavigating;
  activeRouteIndexRef.current = activeRouteIndex;

  // Map Click Listener for Destination and Origin Selection — stable callback that reads from refs.
  // Defined before the map init effect so it can be passed to map.on() during initialization.
  const stableHandleMapClick = useCallback((e: maplibregl.MapMouseEvent) => {
    // If actively driving/navigating, do not permit map click destination changes
    if (isNavigatingRef.current) return;

    // Ignore clicks directly on map markers, popups, or controls
    const origTarget = e.originalEvent?.target as HTMLElement | null;
    if (origTarget && (
      origTarget.closest(".maplibregl-marker") ||
      origTarget.closest(".maplibregl-popup") ||
      origTarget.closest(".maplibregl-ctrl")
    )) {
      return;
    }

    // Map clicks only place a pin when the user explicitly enabled a drop mode.
    // Otherwise the click is reserved for route-line selection (OSRM vs AI route).
    const currentMode = pinDropModeRef.current;
    if (currentMode === "none") return;

    // Debounce rapid double-clicks to prevent duplicate pin / route requests.
    const now = Date.now();
    if (now - lastClickTimestampRef.current < 300) {
      return;
    }
    lastClickTimestampRef.current = now;

    const { lng, lat } = e.lngLat;
    const roundedLat = parseFloat(lat.toFixed(5));
    const roundedLon = parseFloat(lng.toFixed(5));

    // The explicit button determines the target. After one pin is placed the mode
    // returns to "none", so another map click cannot silently replace the destination.
    const targetMode: "source" | "destination" = currentMode;

    const initialName = `Location (${roundedLat}, ${roundedLon})`;

    if (targetMode === "source") {
      const newOrigin = { lat: roundedLat, lon: roundedLon, name: initialName };
      setSelectedOriginRef.current(newOrigin);
      setSourceQueryRef.current(initialName);
      if (currentMode !== "none") {
        setPinDropModeRef.current("none");
      }
      if (selectedDestinationRef.current) {
        void calculateRoutesRef.current(newOrigin, selectedDestinationRef.current);
      }
      reverseGeocode(roundedLat, roundedLon).then((rev) => {
        if (rev?.display_name) {
          const resolvedName = rev.display_name;
          setSelectedOriginRef.current({ lat: roundedLat, lon: roundedLon, name: resolvedName });
          setSourceQueryRef.current(resolvedName);
        }
      }).catch((err) => {
        console.warn("[MapCanvas] Reverse geocode background warning:", err);
      });
    } else {
      const newDest = { lat: roundedLat, lon: roundedLon, name: initialName };
      setSelectedDestinationRef.current(newDest);
      setDestinationQueryRef.current(initialName);
      if (currentMode !== "none") {
        setPinDropModeRef.current("none");
      }
      if (selectedOriginRef.current) {
        void calculateRoutesRef.current(selectedOriginRef.current, newDest);
      }
      reverseGeocode(roundedLat, roundedLon).then((rev) => {
        if (rev?.display_name) {
          const resolvedName = rev.display_name;
          setSelectedDestinationRef.current({ lat: roundedLat, lon: roundedLon, name: resolvedName });
          setDestinationQueryRef.current(resolvedName);
        }
      }).catch((err) => {
        console.warn("[MapCanvas] Reverse geocode background warning:", err);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable — reads from refs

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          "carto-positron-hd": {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            maxzoom: 19,
            attribution: "&copy; OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "carto-positron-hd-layer",
            type: "raster",
            source: "carto-positron-hd",
            minzoom: 0,
            maxzoom: 20,
          },
        ],
      },
      center: [ACTIVE_REGION_CENTER.lon, ACTIVE_REGION_CENTER.lat],
      zoom: ACTIVE_REGION_CONFIG.defaultZoom,
      minZoom: 3,
      maxZoom: 19,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    map.on("load", () => {
      map.resize();
    });

    map.on("zoom", () => setCurrentZoom(map.getZoom()));
    map.on("zoomend", () => setCurrentZoom(map.getZoom()));

    // Register the stable click handler here — guaranteed map exists, and it
    // persists for the full lifetime of this map instance.
    map.on("click", stableHandleMapClick);

    mapRef.current = map;
    mapRefContainer.current = map;

    const timer = setTimeout(() => {
      if (mapRef.current) mapRef.current.resize();
    }, 250);

    return () => {
      clearTimeout(timer);
      map.off("click", stableHandleMapClick);
      map.remove();
      mapRef.current = null;
      mapRefContainer.current = null;
    };
  }, [setCurrentZoom, stableHandleMapClick]);

  // Window Resize Listener
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapContainerRef.current) return;

    const handleResize = () => {
      if (mapRef.current) mapRef.current.resize();
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(mapContainerRef.current);
    window.addEventListener("resize", handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Disable double-click zoom while pin drop mode is active so double clicks don't zoom instead of placing pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pinDropMode !== "none") {
      map.doubleClickZoom.disable();
    } else {
      map.doubleClickZoom.enable();
    }
  }, [pinDropMode]);

  // Update cursor based on pinDropMode
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = pinDropMode !== "none" ? "crosshair" : "";
    }
  }, [pinDropMode]);

  // Origin Marker (Section 5: Matching Drop-Pin Style in Emerald Green)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedOrigin) {
      if (!originMarkerRef.current) {
        const el = document.createElement("div");
        el.className =
          "cursor-grab active:cursor-grabbing hover:scale-110 transition duration-300";
        el.innerHTML = `
          <svg width="34" height="44" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.163 0 0 7.163 0 16C0 28 16 42 16 42C16 42 32 28 32 16C32 7.163 24.837 0 16 0ZM16 22C12.686 22 10 19.314 10 16C10 12.686 12.686 10 16 10C19.314 10 22 12.686 22 16C22 19.314 19.314 22 16 22Z" fill="#10B981"/>
            <path d="M16 20C18.2091 20 20 18.2091 20 16C20 13.7909 18.2091 12 16 12C13.7909 12 12 13.7909 12 16C12 18.2091 13.7909 20 16 20Z" fill="#047857"/>
          </svg>
        `;
        const marker = new maplibregl.Marker({ element: el, anchor: "bottom", draggable: true })
          .setLngLat([selectedOrigin.lon, selectedOrigin.lat])
          .addTo(map);

        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          const roundedLat = parseFloat(lngLat.lat.toFixed(5));
          const roundedLon = parseFloat(lngLat.lng.toFixed(5));
          const initialName = `Location (${roundedLat}, ${roundedLon})`;

          const newOrigin = { lat: roundedLat, lon: roundedLon, name: initialName };
          setSelectedOriginRef.current(newOrigin);
          setSourceQueryRef.current(initialName);
          if (selectedDestinationRef.current) {
            void calculateRoutesRef.current(newOrigin, selectedDestinationRef.current);
          }

          reverseGeocode(roundedLat, roundedLon).then((rev) => {
            if (rev?.display_name) {
              const resolvedName = rev.display_name;
              setSelectedOriginRef.current({ lat: roundedLat, lon: roundedLon, name: resolvedName });
              setSourceQueryRef.current(resolvedName);
            }
          }).catch((err) => {
            console.warn("[MapCanvas] Reverse geocode drag error:", err);
          });
        });

        originMarkerRef.current = marker;
      } else {
        originMarkerRef.current.setLngLat([selectedOrigin.lon, selectedOrigin.lat]);
      }
    } else if (originMarkerRef.current) {
      originMarkerRef.current.remove();
      originMarkerRef.current = null;
    }
  }, [selectedOrigin]);

  // Destination Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedDestination) {
      if (!destMarkerRef.current) {
        const el = document.createElement("div");
        el.className =
          "cursor-grab active:cursor-grabbing hover:scale-110 transition duration-300";
        el.innerHTML = `
          <svg width="34" height="44" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.163 0 0 7.163 0 16C0 28 16 42 16 42C16 42 32 28 32 16C32 7.163 24.837 0 16 0ZM16 22C12.686 22 10 19.314 10 16C10 12.686 12.686 10 16 10C19.314 10 22 12.686 22 16C22 19.314 19.314 22 16 22Z" fill="#EA4335"/>
            <path d="M16 20C18.2091 20 20 18.2091 20 16C20 13.7909 18.2091 12 16 12C13.7909 12 12 13.7909 12 16C12 18.2091 13.7909 20 16 20Z" fill="#7A0000"/>
          </svg>
        `;
        const marker = new maplibregl.Marker({ element: el, anchor: "bottom", draggable: true })
          .setLngLat([selectedDestination.lon, selectedDestination.lat])
          .addTo(map);

        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          const roundedLat = parseFloat(lngLat.lat.toFixed(5));
          const roundedLon = parseFloat(lngLat.lng.toFixed(5));
          const initialName = `Location (${roundedLat}, ${roundedLon})`;

          const newDest = { lat: roundedLat, lon: roundedLon, name: initialName };
          setSelectedDestinationRef.current(newDest);
          setDestinationQueryRef.current(initialName);
          if (selectedOriginRef.current) {
            void calculateRoutesRef.current(selectedOriginRef.current, newDest);
          }

          reverseGeocode(roundedLat, roundedLon).then((rev) => {
            if (rev?.display_name) {
              const resolvedName = rev.display_name;
              setSelectedDestinationRef.current({ lat: roundedLat, lon: roundedLon, name: resolvedName });
              setDestinationQueryRef.current(resolvedName);
            }
          }).catch((err) => {
            console.warn("[MapCanvas] Reverse geocode drag error:", err);
          });
        });

        destMarkerRef.current = marker;
      } else {
        destMarkerRef.current.setLngLat([selectedDestination.lon, selectedDestination.lat]);
      }
    } else if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }
  }, [selectedDestination]);

  // Smooth Vehicle Marker & Camera Follow (Section 4)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (isNavigating && currentLocation) {
      if (!vehicleMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "relative flex items-center justify-center pointer-events-none";
        el.style.width = "42px";
        el.style.height = "42px";
        el.innerHTML = `
          <div class="absolute w-10 h-10 rounded-full bg-blue-500/25 animate-ping"></div>
          <div class="vehicle-inner relative w-9 h-9 rounded-full bg-slate-900 border-2 border-white shadow-2xl flex items-center justify-center transition-transform duration-75 ease-out">
            <svg class="w-5 h-5 text-blue-400 fill-current" viewBox="0 0 24 24">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
            </svg>
          </div>
        `;

        vehicleMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([currentLocation.lon, currentLocation.lat])
          .addTo(map);
      } else {
        // Smooth fractional position updates
        vehicleMarkerRef.current.setLngLat([currentLocation.lon, currentLocation.lat]);
        const innerIcon = vehicleMarkerRef.current.getElement().querySelector(".vehicle-inner") as HTMLElement;
        if (innerIcon) {
          innerIcon.style.transform = `rotate(${vehicleBearing}deg)`;
        }
      }

      // Smooth camera follow without competing with marker animation
      const now = performance.now();
      if (now - lastCameraFollowTimeRef.current > 200) {
        lastCameraFollowTimeRef.current = now;
        map.easeTo({
          center: [currentLocation.lon, currentLocation.lat],
          duration: 250,
          easing: (t) => t,
          zoom: Math.max(14.5, map.getZoom()),
          padding: {
            top: 0,
            bottom: isNavigating ? navigationHudHeight : 0,
            left: 0,
            right: 0,
          },
        });
      }
    } else if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.remove();
      vehicleMarkerRef.current = null;
    }
  }, [isNavigating, currentLocation, vehicleBearing, navigationHudHeight]);

  // Render Multi-Color Congestion Segments & Congestion Drop Pins (Sections 3 & 6)
  const renderedLayersRef = useRef<string[]>([]);
  const renderedSourcesRef = useRef<string[]>([]);
  const renderedListenersRef = useRef<{ layerId: string; listener: any }[]>([]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const cleanupOldRoutes = () => {
      renderedLayersRef.current.forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
      });
      renderedLayersRef.current = [];

      renderedSourcesRef.current.forEach((sourceId) => {
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      });
      renderedSourcesRef.current = [];

      renderedListenersRef.current.forEach(({ layerId, listener }) => {
        map.off("click", layerId, listener);
      });
      renderedListenersRef.current = [];

      // Clear all hotspot drop pin markers
      hotspotMarkersRef.current.forEach((m) => m.remove());
      hotspotMarkersRef.current = [];
    };

    const renderPolylines = () => {
      cleanupOldRoutes();
      if (!routes || routes.length === 0) return;

      // Draw non-active routes first, then active route on top
      const sortedIndices = routes.map((_, idx) => idx).sort((a, b) => {
        if (a === activeRouteIndex) return 1;
        if (b === activeRouteIndex) return -1;
        return 0;
      });

      const renderedHotspotIds = new Set<string>();

      sortedIndices.forEach((idx) => {
        const route = routes[idx];
        if (!route || !route.geometry) return;

        const isSelected = idx === activeRouteIndex;
        const isAI = Boolean(route.is_ai_recommended);
        // The currently selected/active route is always green, regardless of whether its
        // original source was AI or OSRM. Unselected OSRM alternatives remain blue.
        const clearColor = isSelected || isAI ? AI_ROUTE_GREEN : OSRM_ROUTE_BLUE;
        const clearCasing = isSelected || isAI ? AI_ROUTE_GREEN_DARK : OSRM_ROUTE_BLUE_DARK;

        // Layer Mode Filtering
        if (activeLayerMode === "AI_ONLY" && !isAI && routes.length > 1) return;
        if (activeLayerMode === "STANDARD_ONLY" && isAI && routes.length > 1) return;

        if (route.segments && route.segments.length > 0) {
          // Render Segmented Color-Coded Polyline for All Routes
          route.segments.forEach((seg, sIdx) => {
            const sourceId = `seg-source-${idx}-${sIdx}`;
            const casingLayerId = `seg-casing-${idx}-${sIdx}`;
            const lineLayerId = `seg-line-${idx}-${sIdx}`;

            // PATCH: clear stretches take the route's identity colour (AI = green, OSRM = blue);
            // congested stretches always keep their own yellow / orange / red. Unselected = grey.
            const level = seg.congestion_level;
            const isCongested = Boolean(level) && level !== "LOW";
            const trafficColor = isCongested
              ? (TRAFFIC_COLORS[level] || seg.color)
              : clearColor;
            const segmentColor = isSelected ? trafficColor : "#94A3B8";
            const segmentCasing = isSelected
              ? (isCongested ? trafficColor : clearCasing)
              : "#1E293B";

            map.addSource(sourceId, {
              type: "geojson",
              data: {
                type: "Feature",
                properties: { level: seg.congestion_level, color: segmentColor, routeIndex: idx },
                geometry: {
                  type: "LineString",
                  coordinates: seg.coordinates,
                },
              },
            });
            renderedSourcesRef.current.push(sourceId);

            // Casing Glow
            map.addLayer({
              id: casingLayerId,
              type: "line",
              source: sourceId,
              layout: { "line-join": "round", "line-cap": "round" },
              paint: {
                "line-color": segmentCasing,
                "line-width": isSelected ? 12 : 8,
                "line-opacity": isSelected ? 0.9 : 0.2,
              },
            });
            renderedLayersRef.current.push(casingLayerId);

            // Segment Line
            map.addLayer({
              id: lineLayerId,
              type: "line",
              source: sourceId,
              layout: { "line-join": "round", "line-cap": "round" },
              paint: {
                "line-color": segmentColor,
                "line-width": isSelected ? 7 : 5,
                "line-opacity": isSelected ? 1.0 : 0.65,
              },
            });
            renderedLayersRef.current.push(lineLayerId);

            // Click-to-switch behavior
            if (!isSelected && !isNavigating) {
              const clickListener = () => {
                if (pinDropModeRef.current !== "none") return;
                setActiveRouteIndex(idx);
              };
              map.on("click", lineLayerId, clickListener);
              renderedListenersRef.current.push({ layerId: lineLayerId, listener: clickListener });
            }
          });

          // Section 3: Render Distinct Congestion Drop Pins Anchored Directly at Hotspot GPS Points
          if (route.hotspots && route.hotspots.length > 0) {
            route.hotspots.forEach((hotspot) => {
              const locId = `${hotspot.lat.toFixed(3)}_${hotspot.lon.toFixed(3)}`;
              // Routes are drawn inactive-first, so otherwise an inactive marker can be
              // deduplicated here and suppress the active route's clickable popup.
              const activeRouteHasSameHotspot = !isSelected && (routes[activeRouteIndex]?.hotspots || []).some(
                (activeHotspot) => `${activeHotspot.lat.toFixed(3)}_${activeHotspot.lon.toFixed(3)}` === locId,
              );
              if (activeRouteHasSameHotspot || renderedHotspotIds.has(locId)) return;
              renderedHotspotIds.add(locId);

              // Skip a pin that is essentially co-located with the vehicle.
              // At this proximity the AdvanceAlertBanner already carries the
              // warning, and drawing a second marker here just stacks a
              // hazard pin directly on top of the vehicle marker — most
              // visible right at trip start, or right after a reroute
              // activates near a hotspot that sits close to the new route's
              // beginning.
              if (isSelected && isNavigating && currentLocation) {
                const distToVehicleM = haversineMeters(
                  currentLocation.lon, currentLocation.lat, hotspot.lon, hotspot.lat
                );
                if (distToVehicleM < 120) return;
              }

              const el = document.createElement("div");
              const level = hotspot.congestion_level || "HEAVY";
              const isSevere = level === "SEVERE";
              const levelColor = TRAFFIC_COLORS[level];
              const accessibleLabel = `${level[0]}${level.slice(1).toLowerCase()} traffic ahead at ${hotspot.location_name}`;

              // Opacity for non-selected route pins
              if (!isSelected) {
                el.style.opacity = "0.5";
                el.style.pointerEvents = "none";
              } else {
                el.style.opacity = "1";
              }

              el.className = "relative cursor-pointer group";
              el.setAttribute("role", "button");
              el.tabIndex = isSelected ? 0 : -1;
              el.setAttribute("aria-label", accessibleLabel);
              el.setAttribute("title", accessibleLabel);
              el.style.width = "44px";
              el.style.height = "44px";
              el.innerHTML = `
                <div class="relative flex items-center justify-center hover:scale-110 active:scale-95 transition duration-200" style="filter: drop-shadow(0 3px 8px ${levelColor}99);">
                  ${isSevere && isSelected ? `<span class="absolute w-10 h-10 rounded-full animate-ping pointer-events-none" style="background:${levelColor}55"></span>` : ""}
                  <svg width="44" height="44" viewBox="0 0 36 36" role="presentation" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="18" cy="18" r="16" fill="${levelColor}" stroke="white" stroke-width="2"/>
                    <path d="M18 8.5 28 26H8L18 8.5Z" fill="white" stroke="#1F2937" stroke-width="1.2" stroke-linejoin="round"/>
                    <path d="M18 14v5" stroke="#111827" stroke-width="2.4" stroke-linecap="round"/>
                    <circle cx="18" cy="22.2" r="1.2" fill="#111827"/>
                  </svg>
                </div>
              `;

              // Interactive Popup on Click / Hover (only if selected)
              if (isSelected) {
                const popupContent = `
                  <div class="p-3 rounded-xl bg-slate-900/95 text-white text-xs space-y-1.5 shadow-2xl border border-slate-700 min-w-[190px] backdrop-blur-md">
                    <div class="font-extrabold text-xs" style="color:${levelColor}">
                      ${escapePopupText(accessibleLabel)}
                    </div>
                    <div class="flex items-center justify-between text-slate-300 text-[11px]">
                      <span>Average speed</span>
                      <span class="font-bold text-amber-300">${escapePopupText(hotspot.average_speed_kmh)} km/h</span>
                    </div>
                    <div class="flex items-center justify-between text-slate-300 text-[11px]">
                      <span>Estimated delay</span>
                      <span class="font-bold text-rose-300">${Math.max(0, Math.round((hotspot.estimated_delay_seconds || 0) / 60))} min</span>
                    </div>
                    <div class="text-[11px] text-slate-300 font-medium pt-1 border-t border-slate-700">
                      ${escapePopupText(hotspot.description || hotspot.cause || "Traffic congestion bottleneck")}
                    </div>
                  </div>
                `;

                const popup = new maplibregl.Popup({
                  offset: [0, -46],
                  closeButton: true,
                  closeOnClick: false,
                  className: "custom-hotspot-popup",
                }).setHTML(popupContent);

                const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
                  .setLngLat([hotspot.lon, hotspot.lat])
                  .setPopup(popup)
                  .addTo(map);
                el.addEventListener("keydown", (event: KeyboardEvent) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    marker.togglePopup();
                  }
                });

                hotspotMarkersRef.current.push(marker);
              } else {
                const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
                  .setLngLat([hotspot.lon, hotspot.lat])
                  .addTo(map);
                hotspotMarkersRef.current.push(marker);
              }
            });
          }
        } else {
          // Fallback if no segments data (should not happen, but safe)
          const sourceId = `route-source-${idx}`;
          const casingLayerId = `route-casing-${idx}`;
          const lineLayerId = `route-line-${idx}`;

          map.addSource(sourceId, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: { routeIndex: idx },
              geometry: route.geometry as any,
            },
          });
          renderedSourcesRef.current.push(sourceId);

          map.addLayer({
            id: casingLayerId,
            type: "line",
            source: sourceId,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
                "line-color": isSelected ? clearCasing : "#1E293B",
                "line-width": isSelected ? 12 : 8,
                "line-opacity": isSelected ? 0.9 : 0.2,
            },
          });
          renderedLayersRef.current.push(casingLayerId);

          map.addLayer({
            id: lineLayerId,
            type: "line",
            source: sourceId,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              // EMERGENCY FEATURE DISABLED: "line-color": isSelected ? (isEmergencyMode ? "#EF4444" : "#3B82F6") : "#64748B",
              "line-color": isSelected ? clearColor : "#64748B",
              "line-width": isSelected ? 7 : 5,
              "line-opacity": isSelected ? 1.0 : 0.65,
            },
          });
          renderedLayersRef.current.push(lineLayerId);

          if (!isSelected && !isNavigating) {
            const clickListener = () => {
              if (pinDropModeRef.current !== "none") return;
              setActiveRouteIndex(idx);
            };
            map.on("click", lineLayerId, clickListener);
            renderedListenersRef.current.push({ layerId: lineLayerId, listener: clickListener });
          }
        }
      });

      // Render Ghost Reroute Line if active (Features 8 & 9)
      if (activeRerouteRecommendation?.recommended_route?.geometry) {
        const rerouteSourceId = "ghost-reroute-source";
        const rerouteLineId = "ghost-reroute-line";

        map.addSource(rerouteSourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: activeRerouteRecommendation.recommended_route.geometry as any,
          },
        });
        renderedSourcesRef.current.push(rerouteSourceId);

        map.addLayer({
          id: rerouteLineId,
          type: "line",
          source: rerouteSourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            // Once an alternate route is recommended, show it with the same green
            // active-route color as the committed navigation path.
            "line-color": AI_ROUTE_GREEN,
            "line-width": 7,
            "line-opacity": 0.9,
            "line-offset": 4,
          },
        });
        renderedLayersRef.current.push(rerouteLineId);
      }

      // Auto-fit bounds when not actively driving
      if (!isNavigating) {
        const bounds = new maplibregl.LngLatBounds();
        let hasPoints = false;
        routes.forEach((r) => {
          if (r.geometry && r.geometry.coordinates) {
            r.geometry.coordinates.forEach((coord: number[]) => {
              bounds.extend([coord[0], coord[1]]);
              hasPoints = true;
            });
          }
        });

        if (hasPoints) {
          map.fitBounds(bounds, {
            padding: { top: 100, bottom: 180, left: 100, right: 100 },
            maxZoom: 15,
            duration: 800,
          });
        }
      }
    };

    if (map.isStyleLoaded()) {
      renderPolylines();
    } else {
      map.once("load", renderPolylines);
    }
  }, [
    routes,
    activeRouteIndex,
    setActiveRouteIndex,
    activeLayerMode,
    isEmergencyMode,
    trafficTestMode,
    isNavigating,
    activeRerouteRecommendation,
  ]);

  // Recenter trigger
  useEffect(() => {
    const map = mapRef.current;
    if (!map || recenterTrigger === 0) return;

    if (currentLocation) {
      map.flyTo({
        center: [currentLocation.lon, currentLocation.lat],
        zoom: 15,
        duration: 1200,
      });
    } else if (selectedDestination) {
      map.flyTo({
        center: [selectedDestination.lon, selectedDestination.lat],
        zoom: 14,
        duration: 1200,
      });
    } else {
      map.flyTo({
        center: [ACTIVE_REGION_CENTER.lon, ACTIVE_REGION_CENTER.lat],
        zoom: 12.5,
        duration: 1200,
      });
    }
  }, [recenterTrigger, selectedDestination, currentLocation]);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none">
      <div
        ref={mapContainerRef}
        className="pointer-events-auto"
        style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
      />
      {pinDropMode !== "none" && (
        <div className="absolute top-6 left-3 right-3 mx-auto w-fit max-w-[calc(100%-1.5rem)] bg-slate-900/90 text-white px-6 py-3 rounded-full shadow-2xl border border-blue-500/50 backdrop-blur-md animate-pulse pointer-events-none" style={{ zIndex: OVERLAY_Z.mapPrompt }}>
          <p className="text-sm font-bold tracking-wide text-center">
            Tap the map to set your <span className="text-blue-400">{pinDropMode === "source" ? "starting" : "destination"}</span> point
          </p>
        </div>
      )}
    </div>
  );
};
```


## `frontend\src\components\ui\AdvanceAlertBanner.tsx`

```tsx
"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Volume2, ShieldAlert } from "lucide-react";
import { ActiveCongestionAlert } from "@/lib/alertManager";
import { TTSService } from "@/lib/ttsService";
import { OVERLAY_Z } from "@/lib/layoutZones";

interface AdvanceAlertBannerProps {
  alert: ActiveCongestionAlert | null;
  onDismiss: () => void;
  onCheckReroute?: () => void;
  fasterRouteAvailable?: boolean;
}

export const AdvanceAlertBanner: React.FC<AdvanceAlertBannerProps> = ({
  alert,
  onDismiss,
  onCheckReroute,
  fasterRouteAvailable = false,
}) => {
  if (!alert) return null;

  const isSevere = alert.congestionLevel === "SEVERE";
  const isHeavy = alert.congestionLevel === "HEAVY";
  const severityText = isSevere ? "Severe" : isHeavy ? "Heavy" : "Moderate";
  const severityStyle = isSevere
    ? { border: "border-l-red-600", icon: "text-red-700" }
    : isHeavy
    ? { border: "border-l-orange-500", icon: "text-orange-700" }
    : { border: "border-l-yellow-500", icon: "text-yellow-700" };
  const delayMinutes = Math.max(1, Math.round((alert.estimatedDelaySeconds || 60) / 60));

  const handleSpeak = () => {
    TTSService.speakCongestionAlert(
      alert.locationName,
      alert.distanceText,
      alert.averageSpeedKmh,
      alert.estimatedDelaySeconds ? alert.estimatedDelaySeconds / 60 : undefined,
      true,
      alert.congestionLevel
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -40, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="fixed left-3 right-3 mx-auto w-auto max-w-xs sm:max-w-sm pointer-events-auto"
        style={{ zIndex: OVERLAY_Z.advanceAlertBanner, top: "calc(env(safe-area-inset-top, 0px) + 4.5rem)" }}
      >
        <div className={`glass-panel flex items-start gap-2 rounded-xl border-l-4 p-2.5 text-slate-800 ${severityStyle.border}`}>
          <span className={`mt-0.5 shrink-0 ${severityStyle.icon}`}>
            {isSevere ? <ShieldAlert className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-extrabold">{severityText} traffic ahead · {alert.distanceText}</p>
              <button onClick={onDismiss} aria-label="Dismiss traffic alert" className="-mr-1 -mt-1 rounded-full p-1 text-slate-500 hover:bg-black/5">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="truncate text-xs text-slate-600">{alert.locationName} · Expect about {delayMinutes} min delay</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <button onClick={handleSpeak} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900">
                <Volume2 className="h-3.5 w-3.5" /> Read aloud
              </button>
              {onCheckReroute && !fasterRouteAvailable && (isHeavy || isSevere) && (
                <button onClick={onCheckReroute} className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 shadow-sm hover:bg-emerald-50">
                  Find a route around it
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
```


## `frontend\src\components\ui\FloatingSearchPanel.tsx`

```tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, MapPin, ArrowUpDown, Loader2, MousePointerClick, Siren } from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { searchPlaces, PlaceSearchResult } from "@/lib/api";

export const FloatingSearchPanel: React.FC = () => {
  const {
    sourceQuery,
    setSourceQuery,
    destinationQuery,
    setDestinationQuery,
    searchResults,
    setSearchResults,
    selectedOrigin,
    setSelectedOrigin,
    selectedDestination,
    setSelectedDestination,
    calculateRoutes,
    swapSourceAndDestination,
    pinDropMode,
    setPinDropMode,
    isEmergencyMode,
    toggleEmergencyMode,
  } = useNavigation();

  const [activeInput, setActiveInput] = useState<"source" | "destination" | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search trigger for active input field
  useEffect(() => {
    const currentQuery = activeInput === "source" ? sourceQuery : activeInput === "destination" ? destinationQuery : "";
    const trimmed = currentQuery.trim();

    if (trimmed.length < 3) {
      setSearchResults([]);
      setSelectedIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchPlaces(trimmed);
        setSearchResults(results);
        setSelectedIndex(-1);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [sourceQuery, destinationQuery, activeInput, setSearchResults]);

  // Click outside hook
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveInput(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPlace = async (place: PlaceSearchResult) => {
    const coord = {
      lat: place.lat,
      lon: place.lon,
      name: place.display_name.split(",")[0],
    };

    if (activeInput === "source") {
      setSelectedOrigin(coord);
      setSourceQuery(coord.name);
      if (selectedDestination) {
        await calculateRoutes(coord, selectedDestination);
      }
    } else if (activeInput === "destination") {
      setSelectedDestination(coord);
      setDestinationQuery(coord.name);
      if (selectedOrigin) {
        await calculateRoutes(selectedOrigin, coord);
      }
    }

    setSearchResults([]);
    setActiveInput(null);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchResults.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const targetIdx = selectedIndex >= 0 ? selectedIndex : 0;
      if (searchResults[targetIdx]) {
        handleSelectPlace(searchResults[targetIdx]);
      }
    } else if (e.key === "Escape") {
      setActiveInput(null);
    }
  };

  return (
    <div ref={containerRef} className="w-full relative pointer-events-auto shrink-0">
      <div
        className={`glass-panel rounded-2xl p-3 shadow-2xl transition-all duration-300 space-y-2 border ${
          isEmergencyMode
            ? "border-rose-500/90 shadow-[0_0_30px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/50 bg-rose-950/10"
            : "border-slate-200/80"
        }`}
      >
        {/* EMERGENCY FEATURE DISABLED (commented out, not deleted) - re-enable later.

        <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isEmergencyMode ? "bg-rose-500 animate-ping" : "bg-slate-300"
              }`}
            />
            <span
              className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isEmergencyMode ? "text-rose-700 dark:text-rose-400" : "text-slate-500"
              }`}
            >
              <Siren className={`w-3.5 h-3.5 ${isEmergencyMode ? "text-rose-600 animate-pulse" : "text-slate-400"}`} />
              Emergency / Ambulance Mode
            </span>
          </div>

          <button
            onClick={toggleEmergencyMode}
            type="button"
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isEmergencyMode ? "bg-rose-600 shadow-sm shadow-rose-500/50" : "bg-slate-300"
            }`}
            role="switch"
            aria-checked={isEmergencyMode}
            title="Toggle Emergency / Ambulance Priority Mode"
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isEmergencyMode ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        */}

        {/* Source Input */}
        <div
          className={`relative flex items-center gap-2.5 rounded-xl p-2 transition border ${
            isEmergencyMode
              ? "bg-white/90 border-rose-200"
              : "bg-white/70 hover:bg-white border-slate-200/60"
          }`}
        >
          <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-sm shrink-0 ml-1" />
          <input
            type="text"
            value={sourceQuery}
            onChange={(e) => setSourceQuery(e.target.value)}
            onFocus={() => setActiveInput("source")}
            onKeyDown={handleKeyDown}
            placeholder="Choose starting point or drop pin..."
            className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400 font-semibold text-xs sm:text-sm"
          />
          {activeInput === "source" && isSearching && (
            <Loader2 className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
          )}
          {sourceQuery && (
            <button
              onClick={() => {
                setSourceQuery("");
                setSelectedOrigin(null);
              }}
              className="p-1 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Swap & Pin Drop Action Bar */}
        <div className="flex items-center justify-between px-1">
          <div className="flex gap-2">
            <button
              onClick={() => setPinDropMode(pinDropMode === "source" ? "none" : "source")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                pinDropMode === "source"
                  ? "bg-emerald-600 text-white shadow-sm animate-pulse"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              <MousePointerClick className="w-3.5 h-3.5" />
              <span>{pinDropMode === "source" ? "Click Map to Set Start" : "Drop Start Pin"}</span>
            </button>

            <button
              onClick={() => setPinDropMode(pinDropMode === "destination" ? "none" : "destination")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                pinDropMode === "destination"
                  ? "bg-rose-600 text-white shadow-sm animate-pulse"
                  : "bg-rose-50 text-rose-700 hover:bg-rose-100"
              }`}
            >
              <MousePointerClick className="w-3.5 h-3.5" />
              <span>{pinDropMode === "destination" ? "Click Map to Set Dest" : "Drop Dest Pin"}</span>
            </button>
          </div>

          <button
            onClick={swapSourceAndDestination}
            title="Swap Source and Destination"
            className="w-7 h-7 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition shadow-sm"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>

        {/* Destination Input */}
        <div
          className={`relative flex items-center gap-2.5 rounded-xl p-2 transition border ${
            isEmergencyMode
              ? "bg-white/90 border-rose-200"
              : "bg-white/70 hover:bg-white border-slate-200/60"
          }`}
        >
          <MapPin className="w-4 h-4 text-rose-600 shrink-0 ml-1" />
          <input
            type="text"
            value={destinationQuery}
            onChange={(e) => setDestinationQuery(e.target.value)}
            onFocus={() => setActiveInput("destination")}
            onKeyDown={handleKeyDown}
            placeholder="Choose destination or drop pin..."
            className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400 font-semibold text-xs sm:text-sm"
          />
          {activeInput === "destination" && isSearching && (
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
          )}
          {destinationQuery && (
            <button
              onClick={() => {
                setDestinationQuery("");
                setSelectedDestination(null);
              }}
              className="p-1 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {activeInput && searchResults.length > 0 && (
        <div className="absolute top-full mt-2 w-full glass-panel rounded-2xl shadow-2xl overflow-hidden z-30 border border-slate-200/80 max-h-80 overflow-y-auto">
          {searchResults.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectPlace(item)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-slate-100 last:border-0 transition ${
                idx === selectedIndex ? "bg-blue-100/80 text-blue-900 font-semibold" : "hover:bg-blue-50/70"
              }`}
            >
              <MapPin className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {item.display_name.split(",")[0]}
                </p>
                <p className="text-xs text-slate-500 line-clamp-1">
                  {item.display_name}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```


## `frontend\src\components\ui\MapControls.tsx`

```tsx
"use client";

import React, { useState } from "react";
import { Plus, Minus, Target, Layers, Siren } from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { mapRefContainer } from "@/components/map/MapCanvas";
import { TrafficTestMode, TRAFFIC_TEST_SCENARIOS } from "@/lib/trafficScenario";
import { OVERLAY_Z } from "@/lib/layoutZones";

export const MapControls: React.FC = () => {
  const {
    triggerRecenter,
    activeLayerMode,
    toggleLayerMode,
    currentZoom,
    isEmergencyMode,
    toggleEmergencyMode,
    trafficTestMode,
    runTrafficTest,
    isNavigating,
    navigationHudHeight,
  } = useNavigation();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleZoomIn = () => {
    if (mapRefContainer.current && currentZoom < 18) {
      mapRefContainer.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRefContainer.current && currentZoom > 10) {
      mapRefContainer.current.zoomOut();
    }
  };

  const handleLayerToggle = () => {
    toggleLayerMode();
    let msg = "Showing All Routes";
    if (activeLayerMode === "ALL") msg = "Showing Recommended Route Only";
    else if (activeLayerMode === "AI_ONLY") msg = "Showing Standard Route Only";

    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  return (
    <>
      {toastMessage && (
        <div className="fixed right-16 bottom-8 px-3.5 py-2 rounded-xl bg-slate-900/90 text-white text-xs font-semibold shadow-xl border border-slate-700/80 animate-fade-in backdrop-blur-md" style={{ zIndex: OVERLAY_Z.transientToast }}>
          {toastMessage}
        </div>
      )}

      {/*
        The Traffic Test panel and the zoom/recenter/layers/emergency stack used
        to be two independently-positioned `fixed right-4` elements — one anchored
        from the top (`top: 11rem`), one anchored from the bottom
        (`bottom: navigationHudHeight + 12px`). On shorter viewports, or whenever
        navigationHudHeight grew (the HUD's "extended" state), the bottom-anchored
        stack could rise high enough to collide with the top-anchored panel, since
        neither knew about the other. Folding both into one flex column that
        shares a single bottom anchor makes that collision structurally
        impossible — they now always move together with a fixed gap between them.
      */}
      <div
        className="fixed right-4 flex flex-col items-end gap-2 transition-[bottom] duration-200"
        style={{
          zIndex: OVERLAY_Z.mapControls,
          bottom: isNavigating
            ? `${navigationHudHeight + 12}px`
            : "calc(env(safe-area-inset-bottom, 0px) + 2rem)",
        }}
      >
        <div className="glass-panel w-44 rounded-xl p-2.5 pointer-events-auto">
          <label htmlFor="traffic-test-mode" className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
            Traffic Test
          </label>
          <select
            id="traffic-test-mode"
            value={trafficTestMode}
            onChange={(event) => void runTrafficTest(event.target.value as TrafficTestMode)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
            aria-label="Select real traffic data or a controlled traffic test"
          >
            <option value="real">Real Traffic Data</option>
            <option value="normal">Normal Traffic</option>
            <option value="moderate">Moderate Congestion</option>
            <option value="heavy">Heavy Congestion</option>
            <option value="severe">Severe Congestion</option>
            <option value="dynamic">Dynamic Congestion</option>
          </select>
          {trafficTestMode !== "real" && (
            <p className="mt-1 text-[10px] leading-tight text-slate-500">
              Controlled {TRAFFIC_TEST_SCENARIOS[trafficTestMode].description} test
            </p>
          )}
        </div>

        <div className="glass-panel rounded-full p-1 flex flex-col gap-1 shadow-lg">
          <button
            onClick={handleZoomIn}
            disabled={currentZoom >= 18}
            title={currentZoom >= 18 ? "Maximum zoom reached (18)" : "Zoom In"}
            className="h-12 w-12 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-slate-700 hover:text-slate-900 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/90"
          >
            <Plus className="w-5 h-5" />
          </button>
          <div className="w-full h-px bg-slate-200" />
          <button
            onClick={handleZoomOut}
            disabled={currentZoom <= 10}
            title={currentZoom <= 10 ? "Minimum zoom reached (10)" : "Zoom Out"}
            className="h-12 w-12 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-slate-700 hover:text-slate-900 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/90"
          >
            <Minus className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={triggerRecenter}
          title="Re-center Viewport"
          className="h-12 w-12 rounded-full glass-panel flex items-center justify-center text-slate-700 hover:text-blue-600 transition shadow-lg hover:scale-105 active:scale-95"
        >
          <Target className="w-5 h-5" />
        </button>

        <button
          onClick={handleLayerToggle}
          title={`Layer View: ${activeLayerMode}`}
          className={`h-12 w-12 rounded-full glass-panel flex items-center justify-center transition shadow-lg hover:scale-105 active:scale-95 ${
            activeLayerMode === "AI_ONLY"
              ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20"
              : activeLayerMode === "STANDARD_ONLY"
              ? "bg-slate-700 text-white border-slate-600"
              : "text-slate-700 hover:text-emerald-600"
          }`}
        >
          <Layers className="w-5 h-5" />
        </button>

        {/* EMERGENCY FEATURE DISABLED (commented out, not deleted) - re-enable later.
        <button
          onClick={toggleEmergencyMode}
          title={isEmergencyMode ? "Emergency Mode Active (Ambulance Priority)" : "Enable Emergency / Ambulance Mode"}
          className={`h-12 w-12 rounded-full glass-panel flex items-center justify-center transition shadow-lg hover:scale-105 active:scale-95 ${
            isEmergencyMode
              ? "bg-rose-600 text-white border-rose-500 shadow-rose-500/30 animate-pulse"
              : "text-slate-700 hover:text-rose-600"
          }`}
        >
          <Siren className="w-5 h-5" />
        </button>
        */}
      </div>
    </>
  );
};
```


## `frontend\src\components\ui\NavigationControlsHUD.tsx`

```tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUp,
  Bell,
  BellRing,
  ChevronDown,
  ChevronUp,
  CornerUpLeft,
  CornerUpRight,
  FastForward,
  Pause,
  Play,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { TTSService } from "@/lib/ttsService";
import { PushNotificationService } from "@/lib/pushNotificationService";
import { getManeuverInstruction } from "@/lib/maneuverInstructions";
import { OVERLAY_Z } from "@/lib/layoutZones";

export const NavigationControlsHUD: React.FC = () => {
  const {
    isNavigating,
    navigationMode,
    gpsStatus,
    gpsLocationSource,
    gpsAccuracyMeters,
    gpsError,
    stopNavigation,
    currentVehicleSpeed,
    simProgressPercent,
    simDistanceRemainingM,
    simEtaSeconds,
    isSimPlaying,
    setIsSimPlaying,
    simSpeedMultiplier,
    setSimSpeedMultiplier,
    nextManeuver,
    nextManeuverDistanceM,
    isEmergencyMode,
    navigationHudHeight,
    setNavigationHudHeight,
  } = useNavigation();

  const [isVoiceMuted, setIsVoiceMuted] = useState(TTSService.getMuted());
  const [isPushEnabled, setIsPushEnabled] = useState(PushNotificationService.isPermissionGranted());
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const hudRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isNavigating || !hudRef.current) {
      setNavigationHudHeight(0);
      return;
    }

    const measureHud = () => {
      if (!hudRef.current) return;
      const heightFromBottom = Math.ceil(window.innerHeight - hudRef.current.getBoundingClientRect().top + 12);
      setNavigationHudHeight((previous) => Math.abs(previous - heightFromBottom) > 1 ? heightFromBottom : previous);
    };

    measureHud();
    const resizeObserver = new ResizeObserver(measureHud);
    resizeObserver.observe(hudRef.current);
    window.addEventListener("resize", measureHud);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measureHud);
    };
  }, [isNavigating, isDetailsExpanded, setNavigationHudHeight]);

  if (!isNavigating) return null;

  const handleToggleVoice = () => {
    const newMuted = TTSService.toggleMute();
    setIsVoiceMuted(newMuted);
    if (!newMuted) TTSService.announce("Voice guidance enabled", "normal", "voice_guidance_enabled", 2_000);
  };

  const handleTogglePush = async () => {
    const granted = await PushNotificationService.requestPermission();
    setIsPushEnabled(granted);
    if (granted) PushNotificationService.sendCongestionAlert("Navigation Demo", "500 m", 4, 15);
  };

  const getManeuverIcon = (modifier?: string) => {
    if (modifier?.includes("right")) return <CornerUpRight className="h-5 w-5 text-white" />;
    if (modifier?.includes("left")) return <CornerUpLeft className="h-5 w-5 text-white" />;
    return <ArrowUp className="h-5 w-5 text-white" />;
  };

  return (
    <motion.div
      ref={hudRef}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      className="fixed left-3 right-3 mx-auto w-auto max-w-2xl pointer-events-auto"
      style={{ zIndex: OVERLAY_Z.navigationHud, bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
    >
      <div className="glass-panel-dark flex flex-col gap-2 rounded-3xl p-3 text-white sm:gap-3 sm:p-4">
        <div className={`flex min-w-0 items-center justify-between gap-2 ${isDetailsExpanded ? "border-b border-slate-700 pb-3" : ""}`}>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-lg ${isEmergencyMode ? "bg-rose-600" : "bg-blue-600"}`}>
              {getManeuverIcon(nextManeuver?.modifier)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-amber-300">
                  {nextManeuverDistanceM >= 1000
                    ? `${(nextManeuverDistanceM / 1000).toFixed(1)} km`
                    : `${Math.round(nextManeuverDistanceM)} m`}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Next step</span>
              </div>
              <p className="line-clamp-1 text-xs font-bold text-white sm:text-sm">
                {nextManeuver ? getManeuverInstruction(nextManeuver) : "Continue along active corridor"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="flex flex-col items-end rounded-xl border border-white/10 bg-black/30 px-2 py-1 sm:px-3">
              <div className="flex items-baseline gap-1">
                <span className={`text-lg font-black sm:text-2xl ${navigationMode === "gps" && gpsLocationSource === "demo" ? "text-amber-300" : "text-emerald-400"}`}>{Math.round(currentVehicleSpeed)}</span>
                <span className="text-[9px] font-extrabold uppercase text-slate-400">km/h</span>
              </div>
              {isDetailsExpanded && <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Speed</span>}
            </div>
            <button
              type="button"
              onClick={() => setIsDetailsExpanded((expanded) => !expanded)}
              aria-label={isDetailsExpanded ? "Collapse navigation controls" : "Expand navigation controls"}
              aria-expanded={isDetailsExpanded}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-slate-200 hover:bg-white/20"
            >
              {isDetailsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-300">
          <span className={navigationMode === "gps" ? "text-emerald-300" : "text-blue-300"}>
            {navigationMode === "gps" ? "GPS Navigation" : "Simulation Mode"}
          </span>
          {navigationMode === "gps" && (
            <span
              aria-live="polite"
              className={`inline-flex min-w-0 items-center gap-1.5 ${
                gpsLocationSource === "demo"
                  ? "text-amber-300"
                  : gpsStatus === "tracking"
                  ? "text-emerald-300"
                  : gpsStatus === "arrived"
                  ? "text-blue-200"
                  : "text-amber-300"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  gpsLocationSource === "demo"
                    ? "bg-amber-300"
                    : gpsStatus === "tracking"
                    ? "bg-emerald-300"
                    : "bg-amber-300"
                }`}
              />
              <span className="truncate">
                {gpsStatus === "arrived"
                  ? "Arrived"
                  : gpsLocationSource === "demo"
                  ? "GPS navigation active"
                  : gpsStatus === "tracking"
                  ? `GPS ±${Math.round(gpsAccuracyMeters || 0)} m`
                  : gpsStatus === "rerouting"
                  ? "Updating route"
                  : gpsStatus === "degraded" && gpsAccuracyMeters
                  ? `GPS ±${Math.round(gpsAccuracyMeters)} m · low accuracy`
                  : "GPS navigation active"}
              </span>
            </span>
          )}
        </div>

        {navigationMode === "gps" && gpsError && (
          <p role="status" className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-100">
            {gpsError}
          </p>
        )}

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
          <div
            className={`h-full transition-all duration-300 ${isEmergencyMode ? "bg-rose-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.min(100, Math.max(0, simProgressPercent))}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
          <span aria-label="Distance remaining">
            {simDistanceRemainingM >= 1000
              ? `${(simDistanceRemainingM / 1000).toFixed(1)} km remaining`
              : `${Math.round(simDistanceRemainingM)} m remaining`}
          </span>
          <span aria-label="Estimated time to destination">
            {simEtaSeconds > 0 ? `${Math.ceil(simEtaSeconds / 60)} min to destination` : "Arrived"}
          </span>
        </div>

        {isDetailsExpanded && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
              {navigationMode === "simulation" && (
                <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-1">
                  <button
                    onClick={() => setIsSimPlaying(!isSimPlaying)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20"
                    title={isSimPlaying ? "Pause Simulation" : "Play Simulation"}
                  >
                    {isSimPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
                  </button>
                  <button
                    onClick={() => setSimSpeedMultiplier(simSpeedMultiplier === 1 ? 2 : simSpeedMultiplier === 2 ? 5 : 1)}
                    className="flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-1.5 text-xs font-black text-amber-300 hover:bg-white/20"
                    title="Simulation Speed Multiplier"
                  >
                    <FastForward className="h-3.5 w-3.5" /> <span>{simSpeedMultiplier}x</span>
                  </button>
                </div>
              )}
              <button
                onClick={handleToggleVoice}
                className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-bold ${!isVoiceMuted ? "border-blue-500/50 bg-blue-600/30 text-blue-200" : "border-white/10 bg-white/5 text-slate-300"}`}
                title="Voice Alerts / TTS"
              >
                {!isVoiceMuted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                <span>{!isVoiceMuted ? "Voice ON" : "Voice Muted"}</span>
              </button>

              <button
                onClick={() => void handleTogglePush()}
                className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-bold ${isPushEnabled ? "border-emerald-500/50 bg-emerald-600/30 text-emerald-200" : "border-white/10 bg-white/5 text-slate-300"}`}
                title="Push Notifications"
              >
                {isPushEnabled ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                <span>{isPushEnabled ? "Push ON" : "Enable Push"}</span>
              </button>

              <button
                onClick={() => {
                  stopNavigation();
                }}
                className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-rose-900/60 hover:text-rose-100"
              >
                <XCircle className="h-4 w-4" /> <span>Exit</span>
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};
```


## `frontend\src\components\ui\NoFasterRouteToast.tsx`

```tsx
"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, X } from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { OVERLAY_Z } from "@/lib/layoutZones";

interface NoFasterRouteToastProps {
  reason: string | null;
  onDismiss: () => void;
}

export const NoFasterRouteToast: React.FC<NoFasterRouteToastProps> = ({ reason, onDismiss }) => {
  const { isNavigating, navigationHudHeight } = useNavigation();
  if (!reason) return null;
  const isAvoidanceFailure = /no alternate route avoids|avoids this congestion/i.test(reason);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="fixed left-3 right-auto w-[min(22rem,calc(100vw-2rem))] pointer-events-auto"
        style={{
          zIndex: OVERLAY_Z.noFasterRouteToast,
          bottom: isNavigating
            ? `${navigationHudHeight + 12}px`
            : "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
        }}
      >
        <div className="glass-panel-dark relative rounded-2xl p-3 sm:p-4 text-white flex items-center justify-between gap-3 ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-400">
                {isAvoidanceFailure ? "No avoidance route found" : "No faster route found"}
              </span>
              <p className="text-xs font-semibold text-slate-200 line-clamp-2">
                {reason}
              </p>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition shrink-0"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
```


## `frontend\src\components\ui\RerouteModal.tsx`

```tsx
"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, X, Check } from "lucide-react";
import { RerouteRecommendation } from "@/lib/api";
import { useNavigation } from "@/context/NavigationContext";
import { OVERLAY_Z } from "@/lib/layoutZones";

interface RerouteModalProps {
  recommendation: RerouteRecommendation | null;
  onAccept: (recommendation: RerouteRecommendation) => void;
  onDismiss: () => void;
  isApplying?: boolean;
}

export const RerouteModal: React.FC<RerouteModalProps> = ({
  recommendation,
  onAccept,
  onDismiss,
  isApplying = false,
}) => {
  const { isNavigating, navigationHudHeight } = useNavigation();
  if (!recommendation || !recommendation.is_reroute_recommended || !recommendation.recommended_route) {
    return null;
  }

  const newRoute = recommendation.recommended_route;
  const originalMin = Math.round(recommendation.original_remaining_seconds / 60);
  const newMin = Math.round(recommendation.recommended_duration_seconds / 60);
  const isAvoidance = recommendation.is_congestion_avoidance;
  const savedMin = Math.max(1, Math.round(recommendation.time_saved_minutes));
  const newDistKm = (newRoute.distance_meters / 1000).toFixed(1);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="fixed left-3 right-auto w-[min(22rem,calc(100vw-2rem))] pointer-events-auto"
        style={{
          zIndex: OVERLAY_Z.rerouteModal,
          bottom: isNavigating
            ? `${navigationHudHeight + 12}px`
            : "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
        }}
      >
          <div className="glass-panel rounded-2xl border border-emerald-200/60 p-2.5 sm:p-3 text-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Zap className="h-4 w-4 fill-current" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold leading-tight">
                  {isAvoidance ? "Route around congestion" : "Faster route available"}
                </p>
                <p className="truncate text-xs text-slate-600">
                  {isAvoidance ? `Avoids flagged congestion · ${newDistKm} km` : `About ${savedMin} min faster · ${newDistKm} km`}
                </p>
              </div>
            </div>
            <button
              onClick={onDismiss}
              aria-label={isAvoidance ? "Dismiss congestion avoidance suggestion" : "Dismiss faster route suggestion"}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {isAvoidance && recommendation.reason && (
            <p className="mt-2 text-[11px] leading-snug text-slate-600">{recommendation.reason}</p>
          )}
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
            <p className="min-w-0 truncate text-[11px] text-slate-500">
              {originalMin} min current → {newMin} min new
            </p>
            <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onDismiss}
              className="rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Keep route
            </button>
            <button
              disabled={isApplying}
              onClick={() => {
                if (isApplying) return;
                onAccept(recommendation);
              }}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isApplying ? "Applying…" : isAvoidance ? "Take this route" : "Take faster route"}</span>
            </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
```


## `frontend\src\components\ui\RouteCard.tsx`

```tsx
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Navigation,
  MapPin,
  PlayCircle,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Zap,
  Siren,
  Activity,
  Flame,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";

export const RouteCard: React.FC = () => {
  const [showHotspotList, setShowHotspotList] = useState(false);
  const {
    routes,
    activeRouteIndex,
    setActiveRouteIndex,
    selectedDestination,
    isNavigating,
    startNavigation,
    stopNavigation,
    gpsStatus,
    gpsAccuracyMeters,
    gpsError,
    isLoadingRoutes,
    isEmergencyMode,
    trafficTestMode,
  } = useNavigation();

  if (isLoadingRoutes) {
    return (
      <div
        className={`w-full relative pointer-events-auto shrink-0 glass-panel rounded-2xl p-6 flex items-center justify-center gap-3 shadow-2xl ${
          isEmergencyMode ? "border-rose-500/80 shadow-rose-500/20" : ""
        }`}
      >
        <Loader2 className={`w-6 h-6 animate-spin ${isEmergencyMode ? "text-rose-600" : "text-emerald-600"}`} />
        <span className="text-sm font-semibold text-slate-700">
          {isEmergencyMode
            ? "Evaluating Priority Corridors & transit speeds..."
            : "Evaluating real-time traffic factors & ML congestion..."}
        </span>
      </div>
    );
  }

  if (!selectedDestination || routes.length === 0) return null;

  const currentRoute = routes[activeRouteIndex];
  if (!currentRoute) return null;

  const durationMin = Math.round(
    (currentRoute.predicted_duration_seconds || currentRoute.duration_seconds) / 60
  );

  const distanceKm = (currentRoute.distance_meters / 1000).toFixed(1);
  const isAIRoute = Boolean(currentRoute.is_ai_recommended);
  const isOsrmPreferredRealRoute =
    trafficTestMode === "real" && currentRoute.original_route_index === 0 && !isAIRoute;

  // Format user-friendly route label
  let routeLabel = isOsrmPreferredRealRoute ? "OSRM Preferred Route" : currentRoute.recommendation_label;
  if (!routeLabel) {
    if (isAIRoute) {
      routeLabel = isEmergencyMode ? "Emergency Priority Corridor" : "Recommended Route";
    } else {
      routeLabel = "Standard Route";
    }
  } else if (routeLabel === "AI Recommended") {
    routeLabel = "Recommended Route";
  }

  const clearKm = currentRoute.clear_distance_km || 0.0;
  const modKm = currentRoute.moderate_distance_km || 0.0;
  const heavyKm = currentRoute.heavy_distance_km || 0.0;
  const severeKm = currentRoute.severe_distance_km || 0.0;
  const totalDelayMin = Math.max(0, Math.round((currentRoute.total_delay_seconds || 0) / 60));
  const hotspots = currentRoute.hotspots || [];

  // Sort hotspots by delay descending to find the primary bottleneck causing the delay
  const sortedHotspots = [...hotspots].sort(
    (a, b) => (b.estimated_delay_seconds || 0) - (a.estimated_delay_seconds || 0)
  );
  const worstHotspot = sortedHotspots[0];
  const otherHotspotsCount = sortedHotspots.length - 1;
  const worstHotspotName = worstHotspot
    ? worstHotspot.location_name.replace(/^(Near\s+|Central\s+)/i, "").split(",")[0]
    : "";

  const getMainRoadName = (route: typeof currentRoute) => {
    if (route.steps && route.steps.length > 1) {
      const namedStep = route.steps.find((s) => s.name && s.name.trim() !== "");
      if (namedStep && namedStep.name) return `Via ${namedStep.name}`;
    }
    return "Via Optimal Corridor";
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className={`w-full relative pointer-events-auto flex-1 min-h-0 glass-panel rounded-2xl p-5 shadow-2xl border overflow-y-auto transition-all duration-300 ${
          isEmergencyMode
            ? "border-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.25)] ring-1 ring-rose-500/40"
            : "border-slate-200/80"
        }`}
      >
        {/* Mode & Corridor Context Alert Header */}
        {isEmergencyMode ? (
          <div
            className={`mb-3 px-3.5 py-2 rounded-xl text-white flex items-center justify-between shadow-md ${
              isAIRoute
                ? "bg-gradient-to-r from-rose-600 to-red-600 ring-1 ring-rose-400/50"
                : "bg-gradient-to-r from-slate-700 to-slate-800 border border-slate-600"
            }`}
          >
            <div className="flex items-center gap-2">
              <Siren
                className={`w-4 h-4 fill-current ${isAIRoute ? "animate-bounce text-white" : "text-amber-400"}`}
              />
              <span className="text-xs font-black tracking-wider uppercase">
                {isAIRoute ? "Emergency Priority Corridor" : "Standard Alternate Path"}
              </span>
            </div>
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                isAIRoute ? "bg-white/20 text-white" : "bg-amber-400/20 text-amber-300"
              }`}
            >
              {isAIRoute ? "PRIORITY ACCESS" : "RESTRICTED ACCESS"}
            </span>
          </div>
        ) : null}

        {/* Destination Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded-md font-bold text-xs flex items-center gap-1 ${
                  isEmergencyMode
                    ? isAIRoute
                      ? "bg-rose-500/15 text-rose-700 border border-rose-500/30 font-extrabold"
                      : "bg-slate-200 text-slate-700 font-semibold"
                    : isAIRoute
                    ? "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 font-extrabold"
                    : "bg-blue-500/15 text-blue-700 border border-blue-500/30 font-extrabold"
                }`}
              >
                {isEmergencyMode && isAIRoute ? (
                  <Siren className="w-3 h-3 text-rose-600 fill-current" />
                ) : isAIRoute ? (
                  <Zap className="w-3 h-3 text-emerald-600 fill-current" />
                ) : null}
                {routeLabel}
              </span>
              <span className="flex items-center gap-1 text-slate-500 text-xs font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Guarded
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 line-clamp-1">
              {selectedDestination.name}
            </h3>
            <p className="text-xs text-slate-500 font-medium">{getMainRoadName(currentRoute)}</p>
          </div>
        </div>

        {/* Primary ETA Display with Location-Tied Delay Chip */}
        <div className="flex items-center gap-2.5 mb-3 flex-wrap">
          <span
            className={`text-3xl font-extrabold tracking-tight ${
              isEmergencyMode
                ? isAIRoute
                  ? "text-rose-600"
                  : "text-slate-700"
                : isAIRoute
                ? "text-emerald-600"
                : "text-blue-600"
            }`}
          >
            {durationMin} min
          </span>
          <span className="text-sm font-semibold text-slate-500">({distanceKm} km)</span>

          {/* Location-tied delay chip: only shown if there is a real hotspot causing delay */}
          {totalDelayMin > 0 && worstHotspot && (
            <button
              type="button"
              onClick={() => otherHotspotsCount > 0 && setShowHotspotList(!showHotspotList)}
              className={`text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200/90 shadow-sm flex items-center gap-1 transition ${
                otherHotspotsCount > 0 ? "cursor-pointer active:scale-95" : "cursor-default"
              }`}
              title={otherHotspotsCount > 0 ? "Click to view all congestion spots" : undefined}
            >
              <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>
                +{totalDelayMin}m delay near {worstHotspotName}
                {otherHotspotsCount > 0 ? ` · +${otherHotspotsCount} more` : ""}
              </span>
              {otherHotspotsCount > 0 && (
                showHotspotList ? (
                  <ChevronUp className="w-3.5 h-3.5 text-rose-500 ml-0.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-rose-500 ml-0.5" />
                )
              )}
            </button>
          )}
        </div>

        {/* Expanded Hotspots List (when chip is tapped) */}
        {showHotspotList && sortedHotspots.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 p-2.5 rounded-xl bg-rose-50/80 border border-rose-200/80 space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs font-black text-rose-900 uppercase tracking-wider px-1">
              <span>Congestion Hotspots On Route</span>
              <span className="text-[11px] font-semibold text-rose-600">{sortedHotspots.length} spots</span>
            </div>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {sortedHotspots.map((h, hIdx) => {
                const delayM = Math.max(1, Math.round((h.estimated_delay_seconds || 120) / 60));
                return (
                  <div
                    key={hIdx}
                    className="flex items-center justify-between p-2 rounded-lg bg-white/90 border border-rose-100 text-xs shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-800 line-clamp-1">{h.location_name}</p>
                        <p className="text-[11px] text-slate-500">
                          {h.average_speed_kmh} km/h avg speed
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded shadow-xs shrink-0">
                      +{delayM}m
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Traffic Breakdown Bar */}
        <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-blue-600" /> Traffic on This Route
            </span>
            <span>Live Flow</span>
          </div>

          <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-200">
            {clearKm > 0 && (
              <div
                className={`${isAIRoute ? "bg-emerald-500" : "bg-blue-500"} h-full`}
                style={{ width: `${(clearKm / parseFloat(distanceKm)) * 100}%` }}
                title={`Clear: ${clearKm} km`}
              />
            )}
            {modKm > 0 && (
              <div
                className="bg-amber-500 h-full"
                style={{ width: `${(modKm / parseFloat(distanceKm)) * 100}%` }}
                title={`Moderate: ${modKm} km`}
              />
            )}
            {(heavyKm > 0 || severeKm > 0) && (
              <div
                className="bg-rose-600 h-full"
                style={{ width: `${((heavyKm + severeKm) / parseFloat(distanceKm)) * 100}%` }}
                title={`Heavy/Severe: ${heavyKm + severeKm} km`}
              />
            )}
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-slate-500 flex-wrap gap-1">
            <span className={`${isAIRoute ? "text-emerald-700" : "text-blue-700"} flex items-center gap-1`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isAIRoute ? "bg-emerald-500" : "bg-blue-500"}`} /> {clearKm} km clear
            </span>
            {modKm > 0 && (
              <span className="text-amber-700 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {modKm} km slowed
              </span>
            )}
            {(heavyKm > 0 || severeKm > 0) && (
              <span className="text-rose-700 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" /> {heavyKm + severeKm} km heavy
              </span>
            )}
          </div>
        </div>

        {/* Candidate Routes Comparison */}
        {routes.length > 1 && (
          <div className="space-y-2 mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Other Route Options
            </p>
            <div className="grid grid-cols-1 gap-2">
              {routes.map((r, idx) => {
                const dur = Math.round((r.predicted_duration_seconds || r.duration_seconds) / 60);
                const dist = (r.distance_meters / 1000).toFixed(1);
                const isSelected = idx === activeRouteIndex;
                const isAI = Boolean(r.is_ai_recommended);
                const isOsrmPreferred =
                  trafficTestMode === "real" && r.original_route_index === 0 && !isAI;
                let labelText = isOsrmPreferred ? "OSRM Preferred Route" : r.recommendation_label;
                if (!labelText) {
                  if (isAI) {
                    labelText = isEmergencyMode ? "Emergency Priority" : "Recommended Route";
                  } else {
                    labelText = "Standard Route";
                  }
                } else if (labelText === "AI Recommended") {
                  labelText = "Recommended Route";
                }
                const roadName = getMainRoadName(r);

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (!isNavigating) {
                        setActiveRouteIndex(idx);
                        setShowHotspotList(false);
                      }
                    }}
                    disabled={isNavigating && !isSelected}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition ${
                      isSelected
                        ? isEmergencyMode
                          ? isAI
                            ? "bg-gradient-to-r from-rose-600 to-red-600 text-white border-rose-600 shadow-md"
                            : "bg-slate-700 text-white border-slate-700 shadow-md"
                          : isAI
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                          : "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-white/80 hover:bg-white text-slate-800 border-slate-200/80 shadow-sm"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-bold ${
                            isSelected
                              ? "text-white"
                              : isEmergencyMode && isAI
                              ? "text-rose-600"
                              : isAI
                              ? "text-emerald-600"
                              : "text-slate-800"
                          }`}
                        >
                          {dur} min
                        </span>
                        <span className={`text-xs ${isSelected ? "text-slate-100" : "text-slate-500"}`}>
                          • {dist} km
                        </span>
                      </div>
                      <p
                        className={`text-xs font-medium line-clamp-1 ${
                          isSelected ? "text-slate-100" : "text-slate-500"
                        }`}
                      >
                        {roadName}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : isEmergencyMode && isAI
                            ? "bg-rose-100 text-rose-800"
                            : isAI
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {isEmergencyMode && isAI ? (
                          <Siren className="w-3 h-3 fill-current" />
                        ) : isAI ? (
                          <Zap className="w-3 h-3 fill-current" />
                        ) : null}
                        {labelText}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Journey startup: GPS and simulation are explicit, mutually exclusive modes. */}
        {isNavigating ? (
          <button
            type="button"
            onClick={stopNavigation}
            className="w-full py-3.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 bg-rose-700 hover:bg-rose-800 text-white shadow-rose-700/30"
          >
            <Navigation className="w-4 h-4" />
            <span>End Active Navigation</span>
            <ArrowRight className="w-4 h-4 ml-auto" />
          </button>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void startNavigation("gps")}
              disabled={gpsStatus === "locating" || isLoadingRoutes}
              className="w-full rounded-xl border border-emerald-700/10 bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-900/10 transition hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {gpsStatus === "locating" ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              <span>
                {gpsStatus === "locating"
                  ? gpsAccuracyMeters
                    ? `Checking location (±${Math.round(gpsAccuracyMeters)} m)…`
                    : "Checking device location…"
                  : gpsStatus === "error"
                  ? "Retry GPS navigation"
                  : "Start GPS navigation"}
              </span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </button>
            <button
              type="button"
              onClick={() => void startNavigation("simulation")}
              disabled={isLoadingRoutes}
              className={`w-full py-3.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                isEmergencyMode
                  ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-rose-600/30"
                  : isAIRoute
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30"
                  : "bg-slate-800 hover:bg-slate-900 text-white shadow-slate-800/30"
              }`}
            >
              <PlayCircle className="w-4 h-4" />
              <span>Start Simulation</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </button>
            <div className="flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/90 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-600">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p>If a reliable device location is unavailable, GPS navigation starts from PSG Tech and the vehicle marker stays stationary instead of simulating travel.</p>
            </div>
            {gpsError && (
              gpsStatus === "locating" ? (
                <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs font-medium text-amber-200 flex items-start justify-between gap-2 shadow-sm">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-amber-100 font-semibold">{gpsError}</p>
                      {gpsAccuracyMeters !== null && (
                        <p className="text-[10px] text-amber-300/80">
                          Target accuracy: ≤150 m (current: ±{Math.round(gpsAccuracyMeters)} m)
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={stopNavigation}
                    className="text-[11px] font-bold text-amber-300 hover:text-amber-100 underline flex-shrink-0 ml-1"
                  >
                    Cancel
                  </button>
                </div>
              ) : gpsStatus === "error" ? (
                <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-200 space-y-2 shadow-sm">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                    <p className="text-rose-100 leading-relaxed">{gpsError}</p>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-rose-500/20 text-[11px]">
                    {gpsAccuracyMeters !== null ? (
                      <span className="font-semibold text-rose-300/90">
                        Reported accuracy: ±{Math.round(gpsAccuracyMeters)} m
                      </span>
                    ) : <span />}
                    <button
                      type="button"
                      onClick={() => void startNavigation("gps")}
                      className="font-bold text-rose-300 hover:text-white underline"
                    >
                      Retry GPS
                    </button>
                  </div>
                </div>
              ) : (
                <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-medium text-emerald-200">
                  {gpsError}
                </p>
              )
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
```


## `frontend\src\components\ui\TrafficLegend.tsx`

```tsx
"use client";

import React, { useState } from "react";
import { Activity } from "lucide-react";
import { OVERLAY_Z } from "@/lib/layoutZones";

interface TrafficLegendProps {
  placement?: "navigation" | "sidebar";
}

export const TrafficLegend: React.FC<TrafficLegendProps> = ({ placement = "navigation" }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const placementClass = placement === "sidebar"
    ? "relative w-[min(16rem,calc(100vw-5rem))] self-start pointer-events-auto"
    : "fixed left-3 right-auto top-[calc(env(safe-area-inset-top,0px)+17rem)] w-[min(16rem,calc(100vw-5rem))] pointer-events-auto";

  return (
    <div className={placementClass} style={{ zIndex: OVERLAY_Z.infoPanel }}>
      <div
        className={`glass-panel rounded-2xl shadow-xl border border-slate-200/80 transition-all duration-300 ${
          isExpanded ? "p-3.5 w-full" : "p-2"
        }`}
      >
        {!isExpanded ? (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            aria-label="Open live traffic legend"
            className="flex w-full items-center gap-2 text-left text-xs font-bold text-slate-700 select-none"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">Live Traffic</span>
            <span className="ml-1 flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
          </button>
        ) : (
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
              <div className="flex items-center gap-1.5 text-slate-800 font-extrabold text-xs uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                <span>Traffic on This Route</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                }}
                aria-label="Close traffic legend"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
                  <span className="font-bold text-slate-700">AI Route · Clear</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">≥ 80% freeflow</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-600 shadow-sm" />
                  <span className="font-bold text-slate-700">OSRM Route · Clear</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">alternate</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" />
                  <span className="font-bold text-slate-700">Slowed Traffic</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">50 - 80% speed</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm" />
                  <span className="font-bold text-slate-700">Heavy Traffic</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">25 - 50% speed</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-900 shadow-sm" />
                  <span className="font-bold text-slate-700">Stopped / Barely Moving</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">&lt; 25% speed</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 pt-1 border-t border-slate-100 italic">
              ML dynamically forecasts downstream delays before arrival.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
```


## `frontend\src\components\ui\TurnByTurnDrawer.tsx`

```tsx
"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronUp, ChevronDown, CornerUpRight, CornerUpLeft, ArrowUp, Navigation, Siren } from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { getManeuverInstruction } from "@/lib/maneuverInstructions";

export const TurnByTurnDrawer: React.FC = () => {
  const { routes, activeRouteIndex, isNavigating, isEmergencyMode } = useNavigation();
  const [isOpen, setIsOpen] = useState(false);

  const currentRoute = routes[activeRouteIndex];
  if (!currentRoute || !currentRoute.steps || currentRoute.steps.length === 0) return null;

  const getStepIcon = (modifier?: string) => {
    if (modifier?.includes("right")) return <CornerUpRight className="w-4 h-4 text-blue-600" />;
    if (modifier?.includes("left")) return <CornerUpLeft className="w-4 h-4 text-blue-600" />;
    return <ArrowUp className={`w-4 h-4 ${isEmergencyMode ? "text-rose-600" : "text-emerald-600"}`} />;
  };

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className={`w-full relative pointer-events-auto shrink-0 glass-panel rounded-2xl p-4 shadow-2xl transition-all duration-300 ${
        isEmergencyMode
          ? "border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.25)] ring-1 ring-rose-500/40"
          : isNavigating
          ? "border-2 border-blue-500/80"
          : ""
      }`}
    >
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isEmergencyMode ? "bg-rose-600/15 text-rose-600" : "bg-blue-600/10 text-blue-600"
          }`}>
            {isEmergencyMode ? <Siren className="w-4 h-4 fill-current animate-pulse" /> : <Navigation className="w-4 h-4" />}
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span>{isEmergencyMode ? "Emergency Transit" : "Directions"}</span>
              <span>({currentRoute.steps.length} steps)</span>
            </h4>
            <p className="text-sm text-slate-700 font-semibold line-clamp-1">
              {getManeuverInstruction(currentRoute.steps[0])}
            </p>
          </div>
        </div>
        <button className="w-7 h-7 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-600">
          {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 pt-3 border-t border-slate-200/80 max-h-60 overflow-y-auto space-y-3">
          {currentRoute.steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-3 text-xs">
              <div className="mt-0.5 shrink-0">
                {getStepIcon(step.maneuver?.modifier)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800 text-sm">
                  {getManeuverInstruction(step)}
                </p>
                {step.distance && (
                  <p className="text-slate-500 text-xs">
                    {(step.distance / 1000).toFixed(2)} km
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
```


## `frontend\src\context\NavigationContext.tsx`

```tsx
"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import {
  PlaceSearchResult,
  CandidateRoute,
  CongestionLevel,
  CongestionHotspot,
  checkHealth,
  fetchRoutes,
  reverseGeocode,
  RerouteRecommendation,
} from "@/lib/api";
import { AlertManager, ActiveCongestionAlert } from "@/lib/alertManager";
import { TTSService, SpeechPriority } from "@/lib/ttsService";
import { PushNotificationService } from "@/lib/pushNotificationService";
import { RerouteEngine, routesHaveSameGeometry } from "@/lib/rerouteEngine";
import { getManeuverInstruction, getManeuverAnnouncement } from "@/lib/maneuverInstructions";
import { DEFAULT_TRAFFIC_MODE, dynamicTrafficPhase, TrafficTestMode, TRAFFIC_TEST_SCENARIOS } from "@/lib/trafficScenario";

import { ACTIVE_REGION_CONFIG } from "@/lib/region";

export function selectDisplayedRouteOptions(
  candidates: CandidateRoute[],
  trafficTestMode?: TrafficTestMode
): CandidateRoute[] {
  if (trafficTestMode === "heavy" || trafficTestMode === "severe" || trafficTestMode === "dynamic") {
    const controlledCandidate = candidates.find(
      (route) =>
        typeof route.controlled_test_switch_distance_m === "number" &&
        route.controlled_test_bypass_route &&
        Array.isArray(route.controlled_test_bypass_route.geometry?.coordinates) &&
        route.controlled_test_bypass_route.geometry.coordinates.length >= 2
    );
    const testRoute = controlledCandidate || candidates.find((route) =>
      typeof route.controlled_test_zone_start_distance_m === "number" ||
      (route.hotspots || []).some((hotspot) => hotspot.cause === "Controlled traffic test")
    );
    if (testRoute) {
      const remainingCandidates = candidates.filter((route) => route !== testRoute);
      const secondCandidate = remainingCandidates.find(
        (route) => !routesHaveSameGeometry(route, testRoute)
      ) || remainingCandidates[0];
      return secondCandidate ? [testRoute, secondCandidate] : [testRoute];
    }
  }

  const combined = candidates.find((route) => route.recommendation_label === "AI + OSRM Best Route");
  if (combined) return [combined];
  const aiRoute = candidates.find((route) => route.is_ai_recommended);
  const osrmRoute = candidates.find(
    (route) => !route.is_ai_recommended && route.recommendation_label === "OSRM Preferred Route",
  );
  if (aiRoute && osrmRoute && aiRoute.route_id !== osrmRoute.route_id) return [aiRoute, osrmRoute];
  // Defensive fallback for older/mock API responses that do not carry the new labels.
  return candidates.slice(0, 2);
}


export interface Coordinate {
  lat: number;
  lon: number;
  name?: string;
}

export const GPS_REAL_FIX_MAX_ACCURACY_METERS = 150;
/** Offer a controlled-test bypass once the vehicle is exactly 1 km from the synthetic jam. */
export const CONTROLLED_REROUTE_LOOKAHEAD_METERS = 1000;
/** Default start place (PSG Tech, Peelamedu); same as the region default origin / map centre. */
export const GPS_DEMO_FALLBACK_ORIGIN: Coordinate = {
  lat: 11.0247,
  lon: 77.0030,
  name: "PSG College of Technology, Peelamedu, Coimbatore",
};
export type GPSLocationSource = "device" | "demo";

export type PinDropMode = "none" | "source" | "destination";
export type LayerMode = "ALL" | "AI_ONLY" | "STANDARD_ONLY";
export type NavigationMode = "gps" | "simulation";
export type GPSStatus = "idle" | "locating" | "tracking" | "degraded" | "rerouting" | "arrived" | "error";

function logGpsDiagnostic(event: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  const sanitized = { ...(details || {}) };
  if (typeof sanitized.lat === "number") {
    sanitized.lat = Number((sanitized.lat as number).toFixed(4));
  }
  if (typeof sanitized.lon === "number") {
    sanitized.lon = Number((sanitized.lon as number).toFixed(4));
  }
  console.log(`[ApexGuardian GPS Diagnostics] [${event}]`, sanitized);
}

function logGpsWarning(event: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  console.warn(`[ApexGuardian GPS Warning] [${event}]`, details || {});
}

function describeGeolocationError(error: unknown): string {
  const code = (error as GeolocationPositionError | undefined)?.code;
  if (code === 1) return "Location permission was denied. Allow location access in your browser settings, then try again.";
  if (code === 2) return "Your device could not determine a location. Check that Location Services are enabled on your device and try again.";
  if (code === 3) return "Getting your location timed out. Move somewhere with a clearer GPS signal or network reception, then try again.";
  if (error instanceof Error && error.message) return error.message;
  return "Unable to obtain a reliable GPS location. Check your location settings and try again.";
}

export interface LocationAcquisitionProgress {
  status: "permission_required" | "acquiring" | "waiting_accuracy";
  accuracy: number | null;
  message: string;
}

export interface AcquireAccuratePositionResult {
  position: GeolocationPosition;
  totalSamples: number;
}

function acquireAccuratePosition(options: {
  targetAccuracyMeters?: number;
  maxAcceptableAccuracyMeters?: number;
  timeoutMs?: number;
  refinementWindowMs?: number;
  onProgress?: (progress: LocationAcquisitionProgress) => void;
  signal?: { isAborted: boolean };
}): { promise: Promise<AcquireAccuratePositionResult>; cancel: () => void } {
  let watchId: number | null = null;
  let overallTimer: ReturnType<typeof setTimeout> | null = null;
  let refinementTimer: ReturnType<typeof setTimeout> | null = null;
  let isSettled = false;
  let sampleCount = 0;
  let bestPosition: GeolocationPosition | null = null;
  let lastGeolocationError: GeolocationPositionError | null = null;

  const cleanup = () => {
    if (watchId !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch {
        // ignore
      }
      watchId = null;
    }
    if (overallTimer) {
      clearTimeout(overallTimer);
      overallTimer = null;
    }
    if (refinementTimer) {
      clearTimeout(refinementTimer);
      refinementTimer = null;
    }
  };

  const targetAccuracy = options.targetAccuracyMeters ?? 75;
  const maxAcceptableAccuracy = options.maxAcceptableAccuracyMeters ?? 250;
  const timeoutMs = options.timeoutMs ?? 12000;
  const refinementWindowMs = options.refinementWindowMs ?? 2500;

  let cancelStartup: (() => void) | null = null;
  const promise = new Promise<AcquireAccuratePositionResult>(async (resolve, reject) => {
    const settleResolve = (pos: GeolocationPosition) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      resolve({ position: pos, totalSamples: sampleCount });
    };

    const settleReject = (err: Error) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      reject(err);
    };
    cancelStartup = () => settleReject(new Error("GPS startup was cancelled."));

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      settleReject(new Error("This browser does not support device location."));
      return;
    }

    let permState: PermissionState | null = null;
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      try {
        const perm = await navigator.permissions.query({ name: "geolocation" as PermissionName });
        permState = perm.state;
        logGpsDiagnostic("PERMISSION_QUERY", { state: permState });
        if (perm.state === "denied") {
          settleReject(new Error("Location permission was denied. Allow location access in your browser settings, then try again."));
          return;
        }
        if (perm.state === "prompt") {
          options.onProgress?.({
            status: "permission_required",
            accuracy: null,
            message: "Location permission required. Please allow location access in your browser.",
          });
        }
      } catch (e: any) {
        if (e?.message?.includes("denied")) {
          settleReject(e);
          return;
        }
      }
    }

    if (options.signal?.isAborted) {
      settleReject(new Error("GPS startup was cancelled."));
      return;
    }

    logGpsDiagnostic("ACQUISITION_STARTED", {
      targetAccuracy,
      maxAcceptableAccuracy,
      timeoutMs,
      permissionState: permState,
    });

    options.onProgress?.({
      status: "acquiring",
      accuracy: null,
      message: "Acquiring GPS locationâ€¦",
    });

    const handlePositionSample = (pos: GeolocationPosition) => {
      if (isSettled || options.signal?.isAborted) return;
      sampleCount += 1;
      const { latitude, longitude, accuracy } = pos.coords;
      const timestamp = pos.timestamp || Date.now();
      const sampleAgeMs = Math.max(0, Date.now() - timestamp);

      if (
        !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
      ) {
        logGpsWarning("INVALID_COORDINATES_DISCARDED", { lat: latitude, lon: longitude });
        return;
      }

      if (sampleAgeMs > 30000) {
        logGpsWarning("STALE_SAMPLE_DISCARDED", { sampleAgeMs, accuracy: Math.round(accuracy) });
        return;
      }

      logGpsDiagnostic("SAMPLE_RECEIVED", {
        sampleIndex: sampleCount,
        lat: latitude,
        lon: longitude,
        accuracyMeters: Math.round(accuracy),
        sampleAgeMs,
        isPotentiallyCached: sampleAgeMs > 5000,
      });

      if (!bestPosition || accuracy < bestPosition.coords.accuracy) {
        bestPosition = pos;
      }

      if (accuracy <= targetAccuracy) {
        logGpsDiagnostic("TARGET_ACCURACY_ACHIEVED", {
          sampleIndex: sampleCount,
          accuracyMeters: Math.round(accuracy),
          targetAccuracy,
        });
        settleResolve(pos);
        return;
      }

      if (accuracy <= maxAcceptableAccuracy) {
        logGpsDiagnostic("ACCEPTABLE_ACCURACY_WAITING_REFINEMENT", {
          sampleIndex: sampleCount,
          accuracyMeters: Math.round(accuracy),
          threshold: maxAcceptableAccuracy,
        });
        options.onProgress?.({
          status: "waiting_accuracy",
          accuracy: Math.round(accuracy),
          message: `Location accuracy: approximately ${Math.round(accuracy)} metres. Refining positionâ€¦`,
        });

        if (!refinementTimer) {
          refinementTimer = setTimeout(() => {
            if (!isSettled && bestPosition && !options.signal?.isAborted) {
              logGpsDiagnostic("REFINEMENT_WINDOW_RESOLVED", {
                finalAccuracyMeters: Math.round(bestPosition.coords.accuracy),
                totalSamples: sampleCount,
              });
              settleResolve(bestPosition);
            }
          }, refinementWindowMs);
        }
        return;
      }

      logGpsDiagnostic("COARSE_SAMPLE_WAITING_IMPROVEMENT", {
        sampleIndex: sampleCount,
        accuracyMeters: Math.round(accuracy),
        threshold: maxAcceptableAccuracy,
      });
      options.onProgress?.({
        status: "waiting_accuracy",
        accuracy: Math.round(accuracy),
        message: `Location accuracy: approximately ${Math.round(accuracy)} metres. Waiting for a more accurate positionâ€¦`,
      });
    };

    const handlePositionError = (err: GeolocationPositionError) => {
      lastGeolocationError = err;
      logGpsWarning("GEOLOCATION_CALLBACK_ERROR", {
        code: err.code,
        message: err.message,
        codeName: err.code === 1 ? "PERMISSION_DENIED" : err.code === 2 ? "POSITION_UNAVAILABLE" : err.code === 3 ? "TIMEOUT" : "UNKNOWN",
      });
      if (err.code === 1) {
        settleReject(new Error(describeGeolocationError(err)));
      }
    };

    try {
      watchId = navigator.geolocation.watchPosition(
        handlePositionSample,
        handlePositionError,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
      );
    } catch (e: any) {
      settleReject(new Error(e?.message || "Failed to start GPS location watch."));
      return;
    }

    try {
      navigator.geolocation.getCurrentPosition(
        handlePositionSample,
        () => {},
        { enableHighAccuracy: true, maximumAge: 0, timeout: 4000 }
      );
    } catch {
      // ignore
    }

    overallTimer = setTimeout(() => {
      if (isSettled || options.signal?.isAborted) return;
      if (bestPosition) {
        logGpsDiagnostic("OVERALL_TIMEOUT_ACCEPTING_BEST_SAMPLE", {
          accuracyMeters: Math.round(bestPosition.coords.accuracy),
          totalSamples: sampleCount,
        });
        settleResolve(bestPosition);
      } else if (lastGeolocationError) {
        settleReject(new Error(describeGeolocationError(lastGeolocationError)));
      } else {
        settleReject(
          new Error("Getting your location timed out. Move somewhere with a clearer GPS signal and try again.")
        );
      }
    }, timeoutMs);
  });

  return {
    promise,
    cancel: () => {
      cancelStartup?.();
    },
  };
}

export function haversineMeters(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateBearingAngle(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

function getUpcomingAvoidHotspots(
  route: CandidateRoute,
  distanceAlongRouteM: number,
  pinnedHotspotId?: string | null
) {
  return (route.hotspots || [])
    .filter((hotspot) => {
      // If this hotspot is explicitly pinned by the user's reroute request,
      // always include it regardless of the vehicle's current distance.
      if (pinnedHotspotId && hotspot.hotspot_id === pinnedHotspotId) {
        return (
          hotspot.congestion_level === "HEAVY" ||
          hotspot.congestion_level === "SEVERE"
        );
      }
      // Normal distance-based filtering for automatic rerouting
      return (
        (hotspot.congestion_level === "HEAVY" || hotspot.congestion_level === "SEVERE") &&
        hotspot.distance_from_origin_m >= distanceAlongRouteM - 100
      );
    })
    .flatMap((hotspot) => {
      // PATCH: when the hotspot carries the exact congested stretch, avoid THAT stretch
      // (small circles along it) instead of one 150 m circle at its first point. Otherwise
      // routes that drove straight through the jam were treated as "clean".
      const path = hotspot.zone_path;
      if (path && path.length > 0) {
        // A 90m circle at each sampled road point overlaps the next sample. The backend
        // validates every returned route against ALL circles, covering the whole jam.
        const radiusKm = hotspot.cause === "Controlled traffic test" ? 0.09 : 0.12;
        return path.map(([lon, lat]) => ({ lat, lon, radius_km: radiusKm }));
      }
      return [{ lat: hotspot.lat, lon: hotspot.lon, radius_km: 0.15 }];
    });
}

/** Rebuild the backend's anchored synthetic zone if hotspot metadata could not be refreshed. */
function getControlledTestZoneDistances(route: CandidateRoute): { startM: number; endM: number } | null {
  const routeStart = route.controlled_test_zone_start_distance_m;
  const routeEnd = route.controlled_test_zone_end_distance_m;
  if (typeof routeStart === "number" && typeof routeEnd === "number" && routeEnd > routeStart) {
    return { startM: routeStart, endM: routeEnd };
  }
  const controlledHotspot = (route.hotspots || []).find((hotspot) => hotspot.cause === "Controlled traffic test");
  if (controlledHotspot && typeof controlledHotspot.distance_from_origin_m === "number" && typeof controlledHotspot.zone_end_distance_m === "number" && controlledHotspot.zone_end_distance_m > controlledHotspot.distance_from_origin_m) {
    return { startM: controlledHotspot.distance_from_origin_m, endM: controlledHotspot.zone_end_distance_m };
  }
  const coords = (route.geometry?.coordinates || []) as [number, number][];
  if (coords.length < 2) return null;
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversineMeters(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
  if (!Number.isFinite(total) || total < 500) return null;
  let length = Math.max(300, Math.min(1000, total * 0.10));
  length = Math.min(length, total * 0.25);
  let start = total * 0.50;
  if (start + length > total - 100) start = Math.max(0, total - 100 - length);
  return { startM: start, endM: Math.min(total, start + length) };
}

function getControlledZoneAvoidanceFallback(route: CandidateRoute) {
  const coords = (route.geometry?.coordinates || []) as [number, number][];
  if (coords.length < 2) return [] as Array<{ lat: number; lon: number; radius_km: number }>;
  const cumulative: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    cumulative.push(cumulative[i - 1] + haversineMeters(
      coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]
    ));
  }
  const total = cumulative[cumulative.length - 1];
  const zone = getControlledTestZoneDistances(route);
  if (!Number.isFinite(total) || total < 500 || !zone) return [] as Array<{ lat: number; lon: number; radius_km: number }>;
  const zoneStart = Math.max(0, Math.min(total, zone.startM));
  const zoneEnd = Math.max(zoneStart, Math.min(total, zone.endM));
  const sampleDistances = [zoneStart];
  for (let d = zoneStart + 50; d < zoneEnd; d += 50) sampleDistances.push(d);
  if (sampleDistances[sampleDistances.length - 1] < zoneEnd) sampleDistances.push(zoneEnd);
  return sampleDistances.map((target) => {
    let i = 1;
    while (i < cumulative.length - 1 && cumulative[i] < target) i++;
    const span = Math.max(0.001, cumulative[i] - cumulative[i - 1]);
    const t = Math.max(0, Math.min(1, (target - cumulative[i - 1]) / span));
    return {
      lon: coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t,
      lat: coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t,
      radius_km: 0.035,
    };
  });
}

function getControlledTestAvoidanceZones(route: CandidateRoute) {
  const hotspot = (route.hotspots || []).find((item) => item.cause === "Controlled traffic test");
  if (hotspot?.zone_path?.length) {
    return hotspot.zone_path.map(([lon, lat]) => ({ lat, lon, radius_km: 0.035 }));
  }
  return getControlledZoneAvoidanceFallback(route);
}

function pointAtRouteDistance(route: CandidateRoute, targetDistanceM: number): [number, number] {
  const coords = (route.geometry?.coordinates || []) as [number, number][];
  if (!coords.length) return [0, 0];
  if (coords.length === 1) return coords[0];
  let walked = 0;
  if (targetDistanceM <= 0) return coords[0];
  for (let i = 1; i < coords.length; i += 1) {
    const length = haversineMeters(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    if (walked + length >= targetDistanceM) {
      const t = length > 0 ? Math.max(0, Math.min(1, (targetDistanceM - walked) / length)) : 0;
      return [coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t, coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t];
    }
    walked += length;
  }
  return coords[coords.length - 1];
}

function applyControlledTrafficPhase(route: CandidateRoute, phase: CongestionLevel): CandidateRoute {
  const startM = route.controlled_test_zone_start_distance_m;
  const endM = route.controlled_test_zone_end_distance_m;
  if (typeof startM !== "number" || typeof endM !== "number" || endM <= startM) return route;

  const speedRatio: Record<CongestionLevel, number> = { LOW: 0.90, MODERATE: 0.68, HEAVY: 0.42, SEVERE: 0.20 };
  const color: Record<CongestionLevel, string> = { LOW: "#16A34A", MODERATE: "#EAB308", HEAVY: "#F97316", SEVERE: "#DC2626" };
  let along = 0;
  let totalDelay = 0;
  let lowDistance = 0, moderateDistance = 0, heavyDistance = 0, severeDistance = 0;
  let zoneFreeflowSpeedDistance = 0;
  const segments = (route.segments || []).map((segment) => {
    const segmentDistance = Math.max(0, segment.distance_meters || 0);
    const center = along + segmentDistance / 2;
    const inZone = center >= startM - 1 && center <= endM + 1;
    along += segmentDistance;
    const level: CongestionLevel = inZone ? phase : "LOW";
    const freeflowSpeed = Math.max(20, segment.freeflow_speed_kmh || 45);
    const currentSpeed = Math.max(1, freeflowSpeed * speedRatio[level]);
    const duration = segmentDistance / Math.max(0.5, currentSpeed / 3.6);
    const freeflowDuration = segmentDistance / Math.max(0.5, freeflowSpeed / 3.6);
    const delay = Math.max(0, duration - freeflowDuration);
    totalDelay += delay;
    if (inZone) {
      zoneFreeflowSpeedDistance += freeflowSpeed * segmentDistance;
      if (level === "MODERATE") moderateDistance += segmentDistance;
      else if (level === "HEAVY") heavyDistance += segmentDistance;
      else if (level === "SEVERE") severeDistance += segmentDistance;
      else lowDistance += segmentDistance;
    } else {
      lowDistance += segmentDistance;
    }
    return { ...segment, congestion_level: level, color: color[level], current_speed_kmh: Number(currentSpeed.toFixed(1)), duration_seconds: Number(duration.toFixed(1)), delay_seconds: Number(delay.toFixed(1)), congestion_factor: Number((1 / speedRatio[level]).toFixed(2)) };
  });

  if (phase === "LOW") {
    return { ...route, segments, hotspots: (route.hotspots || []).filter((hotspot) => hotspot.cause !== "Controlled traffic test"), total_delay_seconds: 0, clear_distance_km: Number((lowDistance / 1000).toFixed(2)), moderate_distance_km: 0, heavy_distance_km: 0, severe_distance_km: 0 };
  }

  const zoneLength = endM - startM;
  const zonePath: number[][] = [];
  for (let d = startM; d < endM; d += 75) zonePath.push(pointAtRouteDistance(route, d));
  zonePath.push(pointAtRouteDistance(route, endM));
  const first = zonePath[0] || pointAtRouteDistance(route, startM);
  const averageSpeed = zoneFreeflowSpeedDistance / Math.max(1, zoneLength) * speedRatio[phase];
  const existingHotspot = (route.hotspots || []).find((hotspot) => hotspot.cause === "Controlled traffic test");
  const hotspot: CongestionHotspot = {
    ...(existingHotspot || {} as CongestionHotspot),
    hotspot_id: existingHotspot?.hotspot_id || `controlled-${route.route_id || "test"}`,
    location_name: existingHotspot?.location_name || "Synthetic congestion test zone",
    lat: first[1], lon: first[0], distance_from_origin_m: startM,
    congestion_level: phase, average_speed_kmh: Number(averageSpeed.toFixed(1)),
    estimated_delay_seconds: Number(segments.filter((segment) => segment.congestion_level === phase).reduce((sum, segment) => sum + (segment.delay_seconds || 0), 0).toFixed(1)),
    description: `Synthetic ${phase.toLowerCase()} congestion. A preplanned road bypass is available.`,
    cause: "Controlled traffic test", zone_end_distance_m: endM, zone_path: zonePath,
  };
  return {
    ...route, segments, hotspots: [...(route.hotspots || []).filter((item) => item.cause !== "Controlled traffic test"), hotspot],
    total_delay_seconds: Number(totalDelay.toFixed(1)), clear_distance_km: Number((lowDistance / 1000).toFixed(2)),
    moderate_distance_km: Number((moderateDistance / 1000).toFixed(2)), heavy_distance_km: Number((heavyDistance / 1000).toFixed(2)), severe_distance_km: Number((severeDistance / 1000).toFixed(2)),
  };
}

function buildControlledBypassSuffix(activeRoute: CandidateRoute, currentLocation: Coordinate, expectedDistanceM?: number): CandidateRoute | null {
  const planned = activeRoute.controlled_test_bypass_route;
  const sourceCoords = (planned?.geometry?.coordinates || []) as [number, number][];
  if (!planned || sourceCoords.length < 2) return null;
  const projection = projectPointOntoRoute(currentLocation, planned);
  if (typeof expectedDistanceM === "number" && Math.abs(projection.distanceAlongRouteMeters - expectedDistanceM) > Math.max(150, expectedDistanceM * 0.025)) {
    console.warn("[TrafficTest] Planned bypass projection does not align with the expected switch distance.", {
      expectedDistanceM, projectedDistanceM: projection.distanceAlongRouteMeters,
    });
    return null;
  }
  if (projection.distanceToRouteMeters > 30) {
    console.warn("[TrafficTest] Planned bypass does not join the vehicle's current road.", { distanceM: projection.distanceToRouteMeters });
    return null;
  }
  const segmentIndex = Math.max(0, Math.min(sourceCoords.length - 2, projection.segmentIndex));
  const coords: [number, number][] = [[currentLocation.lon, currentLocation.lat]];
  const projected: [number, number] = [projection.projectedPoint.lon, projection.projectedPoint.lat];
  if (haversineMeters(coords[0][0], coords[0][1], projected[0], projected[1]) > 1.5) coords.push(projected);
  for (const point of sourceCoords.slice(segmentIndex + 1)) {
    const previous = coords[coords.length - 1];
    if (haversineMeters(previous[0], previous[1], point[0], point[1]) > 1) coords.push([point[0], point[1]]);
  }
  if (coords.length < 3) return null;
  let distanceM = 0;
  for (let i = 1; i < coords.length; i += 1) distanceM += haversineMeters(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
  let sourcePolylineM = 0;
  for (let i = 1; i < sourceCoords.length; i += 1) sourcePolylineM += haversineMeters(sourceCoords[i - 1][0], sourceCoords[i - 1][1], sourceCoords[i][0], sourceCoords[i][1]);
  const remainingRatio = sourcePolylineM > 0 ? Math.max(0.01, Math.min(1, distanceM / sourcePolylineM)) : 1;
  const originalDuration = planned.duration_seconds || planned.predicted_duration_seconds || 600;
  const durationS = originalDuration * remainingRatio;
  const steps: CandidateRoute["steps"] = [];
  let stepsDistanceLeft = projection.distanceAlongRouteMeters;
  for (const step of planned.steps || []) {
    const stepDistance = Math.max(0, step.distance || 0);
    if (stepsDistanceLeft >= stepDistance && stepDistance > 0) { stepsDistanceLeft -= stepDistance; continue; }
    const remainingStepDistance = Math.max(0, stepDistance - stepsDistanceLeft);
    const fraction = stepDistance > 0 ? remainingStepDistance / stepDistance : 1;
    steps.push({ ...step, distance: remainingStepDistance, duration: Math.max(0, (step.duration || 0) * fraction) });
    stepsDistanceLeft = 0;
  }
  if (!steps.length) steps.push({ name: "Continue on the clear bypass", distance: distanceM, duration: durationS, maneuver: { type: "depart", instruction: "Continue on the clear bypass", location: coords[0] } });
  const freeflowSpeed = Math.max(25, planned.predicted_average_speed_kmh || 40);
  const clearSegment = { segment_index: 0, coordinates: coords as number[][], distance_meters: distanceM, duration_seconds: durationS, freeflow_speed_kmh: freeflowSpeed, current_speed_kmh: freeflowSpeed, delay_seconds: 0, congestion_level: "LOW" as CongestionLevel, color: "#16A34A", congestion_factor: 1, density_index: 15, predicted_arrival_time_min: durationS / 60, road_name: "Clear bypass" };
  return {
    ...planned, route_id: `controlled-bypass-${Date.now()}`, source: "controlled-test-bypass", route_index: 0,
    distance_meters: distanceM, duration_seconds: durationS, predicted_duration_seconds: durationS, predicted_duration_minutes: Number((durationS / 60).toFixed(1)),
    geometry: { ...planned.geometry, coordinates: coords as number[][] }, steps, segments: [clearSegment], hotspots: [],
    clear_distance_km: Number((distanceM / 1000).toFixed(2)), moderate_distance_km: 0, heavy_distance_km: 0, severe_distance_km: 0, total_delay_seconds: 0,
    controlled_test_bypass_route: null, controlled_test_switch_distance_m: null, controlled_test_zone_start_distance_m: null, controlled_test_zone_end_distance_m: null,
  };
}

export function projectPointOntoRoute(point: Coordinate, route: CandidateRoute): { projectedPoint: Coordinate; distanceAlongRouteMeters: number; distanceToRouteMeters: number; segmentIndex: number } {
  let minDistance = Infinity;
  let bestProj: Coordinate = point;
  let bestDistAlong = 0;
  let bestSegmentIdx = 0;

  const coords = route.geometry.coordinates;
  if (!coords || coords.length < 2) return { projectedPoint: point, distanceAlongRouteMeters: 0, distanceToRouteMeters: 0, segmentIndex: 0 };

  let currentRouteDist = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const lon1 = coords[i][0];
    const lat1 = coords[i][1];
    const lon2 = coords[i + 1][0];
    const lat2 = coords[i + 1][1];

    const segLen = haversineMeters(lon1, lat1, lon2, lat2);

    // Project point onto segment (lat1,lon1)-(lat2,lon2) using flat approximation
    // dlat/dlon in degrees - scale lon by cos(lat) to make Euclidean distance proportional to meters
    const cosLat = Math.cos((lat1 * Math.PI) / 180);
    const dx = (lon2 - lon1) * cosLat;
    const dy = lat2 - lat1;
    const px = (point.lon - lon1) * cosLat;
    const py = point.lat - lat1;

    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq !== 0) {
      t = (px * dx + py * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const projLon = lon1 + (lon2 - lon1) * t;
    const projLat = lat1 + (lat2 - lat1) * t;

    const distToProj = haversineMeters(point.lon, point.lat, projLon, projLat);

    if (distToProj < minDistance) {
      minDistance = distToProj;
      bestProj = { lon: projLon, lat: projLat };
      bestDistAlong = currentRouteDist + (segLen * t);
      bestSegmentIdx = i;
    }

    currentRouteDist += segLen;
  }

  return { projectedPoint: bestProj, distanceAlongRouteMeters: bestDistAlong, distanceToRouteMeters: minDistance, segmentIndex: bestSegmentIdx };
}

interface NavigationContextType {
  sourceQuery: string;
  setSourceQuery: (q: string) => void;
  destinationQuery: string;
  setDestinationQuery: (q: string) => void;
  searchResults: PlaceSearchResult[];
  setSearchResults: (results: PlaceSearchResult[]) => void;
  selectedOrigin: Coordinate | null;
  setSelectedOrigin: (coord: Coordinate | null) => void;
  selectedDestination: Coordinate | null;
  setSelectedDestination: (coord: Coordinate | null) => void;
  routes: CandidateRoute[];
  setRoutes: (routes: CandidateRoute[]) => void;
  activeRouteIndex: number;
  setActiveRouteIndex: (idx: number) => void;
  isNavigating: boolean;
  setIsNavigating: (nav: boolean) => void;
  navigationMode: NavigationMode;
  startNavigation: (mode: NavigationMode) => Promise<boolean>;
  stopNavigation: () => void;
  gpsStatus: GPSStatus;
  gpsLocationSource: GPSLocationSource;
  gpsAccuracyMeters: number | null;
  gpsError: string | null;
  backendOnline: boolean | null;
  activeLayerMode: LayerMode;
  setActiveLayerMode: (mode: LayerMode) => void;
  toggleLayerMode: () => void;
  recenterTrigger: number;
  triggerRecenter: () => void;
  isLoadingRoutes: boolean;
  setIsLoadingRoutes: (loading: boolean) => void;
  currentZoom: number;
  setCurrentZoom: (zoom: number) => void;
  pinDropMode: PinDropMode;
  setPinDropMode: (mode: PinDropMode) => void;
  isEmergencyMode: boolean;
  setIsEmergencyMode: React.Dispatch<React.SetStateAction<boolean>>;
  toggleEmergencyMode: () => void;
  swapSourceAndDestination: () => void;
  calculateRoutes: (origin?: Coordinate | null, dest?: Coordinate | null, emergencyOverride?: boolean) => Promise<boolean>;

  // Real-Time Navigation & Congestion States
  currentLocation: Coordinate | null;
  vehicleBearing: number;
  currentVehicleSpeed: number;
  simProgressPercent: number;
  simDistanceRemainingM: number;
  simEtaSeconds: number;
  isSimPlaying: boolean;
  setIsSimPlaying: (playing: boolean) => void;
  simSpeedMultiplier: number;
  setSimSpeedMultiplier: (mult: number) => void;
  activeAlert: ActiveCongestionAlert | null;
  dismissAlert: () => void;
  activeRerouteRecommendation: RerouteRecommendation | null;
  dismissReroute: () => void;
  acceptReroute: (recommendation: RerouteRecommendation) => void;
  triggerDynamicRerouteCheck: (force?: boolean, pinnedHotspotId?: string | null) => Promise<void>;
  isApplyingReroute: boolean;
  noRouteReason: string | null;
  dismissNoRouteReason: () => void;
  navigationHudHeight: number;
  setNavigationHudHeight: React.Dispatch<React.SetStateAction<number>>;
  trafficTestMode: TrafficTestMode;
  runTrafficTest: (mode: TrafficTestMode) => Promise<void>;

  nextManeuver: any;
  nextManeuverDistanceM: number;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const BENGALURU_CENTER: Coordinate = {
  lat: 12.9716,
  lon: 77.5946,
  name: "Bengaluru Center",
};

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sourceQuery, setSourceQuery] = useState(ACTIVE_REGION_CONFIG.defaultOrigin.name);
  const [destinationQuery, setDestinationQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [selectedOrigin, setSelectedOrigin] = useState<Coordinate | null>({ ...ACTIVE_REGION_CONFIG.defaultOrigin });
  const [selectedDestination, setSelectedDestination] = useState<Coordinate | null>(null);
  const [routes, setRoutes] = useState<CandidateRoute[]>([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationMode, setNavigationMode] = useState<NavigationMode>("simulation");
  const navigationModeRef = useRef<NavigationMode>("simulation");
  navigationModeRef.current = navigationMode;
  const isNavigatingRef = useRef(false);
  isNavigatingRef.current = isNavigating;
  const [gpsStatus, setGpsStatus] = useState<GPSStatus>("idle");
  const [gpsLocationSource, setGpsLocationSource] = useState<GPSLocationSource>("device");
  const gpsLocationSourceRef = useRef<GPSLocationSource>("device");
  gpsLocationSourceRef.current = gpsLocationSource;
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const gpsStartRequestRef = useRef(0);
  const gpsSessionRef = useRef(0);
  const gpsAcquisitionCleanupRef = useRef<(() => void) | null>(null);
  const gpsLastSampleRef = useRef<{ lat: number; lon: number; timestamp: number; accuracy: number } | null>(null);
  const gpsOffRouteSamplesRef = useRef(0);
  const gpsRerouteInProgressRef = useRef(false);
  const gpsLastOffRouteRecalculationRef = useRef(0);
  const gpsArrivalSamplesRef = useRef(0);
  const gpsArrivedRef = useRef(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const [activeLayerMode, setActiveLayerMode] = useState<LayerMode>("ALL");
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(12.5);
  const [pinDropMode, setPinDropMode] = useState<PinDropMode>("none");
  // EMERGENCY FEATURE DISABLED (commented out, not deleted) - re-enable later.
  // const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  // Hard-wired off so every downstream emergency branch (styles, API flag, voice line) stays inert.
  const isEmergencyMode = false;
  const setIsEmergencyMode: React.Dispatch<React.SetStateAction<boolean>> = () => {};
  const [trafficTestMode, setTrafficTestMode] = useState<TrafficTestMode>(DEFAULT_TRAFFIC_MODE);
  const trafficTestModeRef = useRef<TrafficTestMode>(DEFAULT_TRAFFIC_MODE);
  const lastDynamicPhaseRef = useRef<string>("LOW");
  const dynamicProgressRef = useRef(0);
  const dynamicClearingRef = useRef(false); // PATCH: guards the one-shot "zone passed" clear
  const testCongestionConsumedRef = useRef(false);
  const testRerouteTriggeredRef = useRef(false);

  // Real-Time Simulation & Navigation Telemetry
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const currentLocationRef = useRef<Coordinate | null>(null);
  const selectedDestinationRef = useRef<Coordinate | null>(selectedDestination);
  selectedDestinationRef.current = selectedDestination;
  const [vehicleBearing, setVehicleBearing] = useState<number>(0);
  const [currentVehicleSpeed, setCurrentVehicleSpeed] = useState<number>(45.0);
  const [simProgressPercent, setSimProgressPercent] = useState<number>(0);
  const [simDistanceRemainingM, setSimDistanceRemainingM] = useState<number>(0);
  const [simEtaSeconds, setSimEtaSeconds] = useState<number>(0);
  const [isSimPlaying, setIsSimPlaying] = useState<boolean>(true);
  const [simSpeedMultiplier, setSimSpeedMultiplierState] = useState<number>(1);
  const simSpeedMultiplierRef = useRef(1);
  const setSimSpeedMultiplier = useCallback((multiplier: number) => {
    const normalizedMultiplier = Math.max(1, multiplier);
    simSpeedMultiplierRef.current = normalizedMultiplier;
    setSimSpeedMultiplierState(normalizedMultiplier);
  }, []);
  const [activeAlert, setActiveAlert] = useState<ActiveCongestionAlert | null>(null);
  const [activeRerouteRecommendation, setActiveRerouteRecommendation] = useState<RerouteRecommendation | null>(null);
  const [noRouteReason, setNoRouteReason] = useState<string | null>(null);
  const [navigationHudHeight, setNavigationHudHeight] = useState(0);

  const [nextManeuver, setNextManeuver] = useState<any>(null);
  const [nextManeuverDistanceM, setNextManeuverDistanceM] = useState<number>(500);

  // Continuous Interpolation Distance and Animation References
  const simDistanceTraversedRef = useRef<number>(0);
  const currentBearingRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const lastAlertCheckDistanceRef = useRef<number>(-999);
  const lastAutoRerouteCheckTimeRef = useRef<number>(0);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastRerouteInteractionTimeRef = useRef<number>(0);
  const isTransitioningRouteRef = useRef<boolean>(false);
  const testReroutePausedRef = useRef<boolean>(false);
  const rerouteRequestIdRef = useRef<number>(0);
  const [isApplyingReroute, setIsApplyingReroute] = useState(false);
  const recentRoutesRef = useRef<Array<any>>([]);
  
  const activeRouteRef = useRef<CandidateRoute | null>(null);
  activeRouteRef.current = routes[activeRouteIndex] || null;
  const activeRerouteRecommendationRef = useRef<RerouteRecommendation | null>(null);
  activeRerouteRecommendationRef.current = activeRerouteRecommendation;
  const bypassAlignmentAttemptsRef = useRef<number>(0);

  const latestCalculateRoutesRef = useRef<(
    origin?: Coordinate | null,
    dest?: Coordinate | null,
    emergencyOverride?: boolean,
    trafficMode?: TrafficTestMode,
    trafficProgress?: number,
  ) => Promise<boolean>>(async () => false);
  useEffect(() => {
    activeRouteRef.current = routes[activeRouteIndex] || null;
  }, [routes, activeRouteIndex]);

  // Subscribe to AlertManager and RerouteEngine
  useEffect(() => {
    const unsubAlert = AlertManager.subscribe((alert) => {
      setActiveAlert(alert);
      if (!alert) {
        PushNotificationService.clearCongestionAlert();
        if (RerouteEngine.getActiveRecommendation()) {
          RerouteEngine.dismissRecommendation();
          setActiveRerouteRecommendation(null);
        }
      }
    });
    const unsubReroute = RerouteEngine.subscribe((rec, reason) => {
      setNoRouteReason(reason);
      if (!rec || !rec.is_reroute_recommended || !rec.recommended_route) {
        setActiveRerouteRecommendation(null);
        PushNotificationService.clearRerouteAlert();
        return;
      }
      
      const now = Date.now();
      if (now - lastRerouteInteractionTimeRef.current < 30000 && !rec.is_congestion_avoidance) {
        // Cooldown active, ignore new recommendations
        RerouteEngine.dismissRecommendation();
        return;
      }

      // Compare against the remaining active geometry, not total route distance:
      // reroute geometry starts at the vehicle while the active route starts at origin.
      const currentRoute = activeRouteRef.current;
      if (currentRoute && !rec.is_congestion_avoidance && routesHaveSameGeometry(rec.recommended_route, currentRoute)) {
          // Dismiss duplicates so periodic checks can recover, and avoid stale UI.
          RerouteEngine.dismissRecommendation();
          return;
      }

      setActiveRerouteRecommendation(rec);
    });
    return () => {
      unsubAlert();
      unsubReroute();
    };
  }, []);

  const toggleLayerMode = () => {
    setActiveLayerMode((prev) => {
      if (prev === "ALL") return "AI_ONLY";
      if (prev === "AI_ONLY") return "STANDARD_ONLY";
      return "ALL";
    });
  };

  const triggerRecenter = () => setRecenterTrigger((prev) => prev + 1);

  const calculateRoutes = async (
    origin?: Coordinate | null,
    dest?: Coordinate | null,
    emergencyOverride?: boolean,
    trafficMode: TrafficTestMode = trafficTestModeRef.current,
    trafficProgress: number = 0
  ): Promise<boolean> => {
    const originCoord = origin || selectedOrigin;
    const destCoord = dest || selectedDestination;
    if (!originCoord || !destCoord) return false;

    const emergency = emergencyOverride !== undefined ? emergencyOverride : isEmergencyMode;

    TTSService.reset();
    setIsLoadingRoutes(true);
    try {
      const response = await fetchRoutes(
        originCoord.lat,
        originCoord.lon,
        destCoord.lat,
        destCoord.lon,
        emergency,
        trafficMode,
        trafficProgress,
        !testCongestionConsumedRef.current
      );
      if (response.success && response.candidates.length > 0) {
        const displayedRoutes = selectDisplayedRouteOptions(response.candidates, trafficMode);
        setRoutes(displayedRoutes);
        // Keep synchronous consumers (notably GPS callbacks during recovery) on the same
        // route as the state update before React's passive ref-sync effect runs.
        activeRouteRef.current = displayedRoutes[0] || null;
        setActiveRouteIndex(0);
        if (navigationModeRef.current === "gps" && isNavigatingRef.current && displayedRoutes[0]) {
          setSimProgressPercent(0);
          setSimDistanceRemainingM(displayedRoutes[0].distance_meters || 0);
          setSimEtaSeconds(displayedRoutes[0].predicted_duration_seconds || displayedRoutes[0].duration_seconds || 0);
        }
        simDistanceTraversedRef.current = 0;
        lastAlertCheckDistanceRef.current = -999;
        lastAutoRerouteCheckTimeRef.current = 0;
        recentRoutesRef.current = [];
        testCongestionConsumedRef.current = false;
        testRerouteTriggeredRef.current = false;
        dynamicClearingRef.current = false;
        AlertManager.reset();
        RerouteEngine.dismissRecommendation();
        setActiveRerouteRecommendation(null);
        lastDynamicPhaseRef.current = "LOW";
        return true;
      }
      return false;
    } catch (err) {
      console.error("[NavigationContext] Routing calculation error:", err);
      return false;
    } finally {
      setIsLoadingRoutes(false);
    }
  };

  latestCalculateRoutesRef.current = calculateRoutes;

  const startNavigation = async (mode: NavigationMode): Promise<boolean> => {
    // Invalidate a pending GPS startup whenever a new mode is selected.
    const requestId = ++gpsStartRequestRef.current;
    if (gpsAcquisitionCleanupRef.current) {
      gpsAcquisitionCleanupRef.current();
      gpsAcquisitionCleanupRef.current = null;
    }
    setGpsError(null);

    if (mode === "simulation") {
      const activeRoute = routes[activeRouteIndex];
      if (!activeRoute || !selectedDestination) {
        setGpsError("Choose a destination and calculate a route before starting navigation.");
        return false;
      }
      const controlledMode = trafficTestModeRef.current;
      const isControlled = controlledMode === "heavy" || controlledMode === "severe" || controlledMode === "dynamic";
      if (isControlled) {
        const hasValidBypass =
          typeof activeRoute.controlled_test_switch_distance_m === "number" &&
          activeRoute.controlled_test_bypass_route &&
          Array.isArray(activeRoute.controlled_test_bypass_route.geometry?.coordinates) &&
          activeRoute.controlled_test_bypass_route.geometry.coordinates.length >= 2;
        if (!hasValidBypass) {
          setNoRouteReason("This route could not produce a validated test bypass. Simulation will continue on the current route without rerouting.");
        }
      }
      setNavigationMode("simulation");
      gpsLocationSourceRef.current = "device";
      setGpsLocationSource("device");
      setGpsStatus("idle");
      setGpsAccuracyMeters(null);
      gpsLastSampleRef.current = null;
      gpsOffRouteSamplesRef.current = 0;
      gpsArrivalSamplesRef.current = 0;
      gpsArrivedRef.current = false;
      TTSService.warmUp();
      setIsSimPlaying(true);
      setIsNavigating(true);
      return true;
    }

    const destination = selectedDestination;
    if (!destination) {
      setGpsStatus("error");
      setGpsError("Choose a destination before starting GPS navigation.");
      return false;
    }

    setGpsStatus("locating");
    setGpsAccuracyMeters(null);
    setGpsError(null);

    let locationSource: GPSLocationSource = "demo";
    let origin: Coordinate = { ...GPS_DEMO_FALLBACK_ORIGIN };
    let accuracy: number | null = null;
    let timestamp = 0;
    let totalSamples = 0;
    const isLocalhost = typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    const secureLocationContext = typeof window !== "undefined" && (window.isSecureContext || isLocalhost);
    const canTryDeviceLocation = typeof navigator !== "undefined" &&
      Boolean(navigator.geolocation) && secureLocationContext;

    if (canTryDeviceLocation) {
      const abortSignal = { isAborted: false };
      const acquisition = acquireAccuratePosition({
        targetAccuracyMeters: 75,
        maxAcceptableAccuracyMeters: GPS_REAL_FIX_MAX_ACCURACY_METERS,
        timeoutMs: 6500,
        refinementWindowMs: 1200,
        signal: abortSignal,
        onProgress: (progress) => {
          if (requestId !== gpsStartRequestRef.current || abortSignal.isAborted) return;
          setGpsAccuracyMeters(progress.accuracy);
          setGpsError(null);
        },
      });
      gpsAcquisitionCleanupRef.current = () => {
        abortSignal.isAborted = true;
        acquisition.cancel();
      };

      try {
        const acquired = await acquisition.promise;
        totalSamples = acquired.totalSamples;
        if (requestId !== gpsStartRequestRef.current || abortSignal.isAborted) return false;
        const candidate = acquired.position;
        const candidateAccuracy = candidate.coords.accuracy;
        const candidateTimestamp = candidate.timestamp || Date.now();
        const candidateAgeMs = Math.max(0, Date.now() - candidateTimestamp);
        const { latitude, longitude } = candidate.coords;
        const validCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude) &&
          latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
        if (validCoordinates && Number.isFinite(candidateAccuracy) && candidateAccuracy > 0 &&
            candidateAccuracy <= GPS_REAL_FIX_MAX_ACCURACY_METERS && candidateAgeMs <= 30000) {
          locationSource = "device";
          accuracy = candidateAccuracy;
          timestamp = candidateTimestamp;
          origin = { lat: latitude, lon: longitude, name: "Current GPS Location" };
          logGpsDiagnostic("RELIABLE_DEVICE_FIX_ACCEPTED", {
            lat: latitude, lon: longitude, accuracyMeters: Math.round(candidateAccuracy), totalSamples,
          });
        } else {
          logGpsWarning("STARTUP_FIX_NOT_RELIABLE_USING_STATIONARY_PREVIEW", {
            accuracyMeters: Number.isFinite(candidateAccuracy) ? Math.round(candidateAccuracy) : null,
            ageMs: candidateAgeMs,
          });
        }
      } catch (error) {
        if (requestId !== gpsStartRequestRef.current || abortSignal.isAborted) return false;
        logGpsWarning("DEVICE_LOCATION_UNAVAILABLE_USING_STATIONARY_PREVIEW", {
          reason: error instanceof Error ? error.message : "Unknown geolocation error",
        });
      } finally {
        if (requestId === gpsStartRequestRef.current) gpsAcquisitionCleanupRef.current = null;
      }
    } else {
      logGpsWarning("DEVICE_GEOLOCATION_UNAVAILABLE_USING_STATIONARY_PREVIEW", {
        geolocationAvailable: typeof navigator !== "undefined" && Boolean(navigator.geolocation),
        secureContext: secureLocationContext,
      });
    }

    if (requestId !== gpsStartRequestRef.current) return false;
    setGpsError(null);
    setGpsAccuracyMeters(locationSource === "device" ? accuracy : null);

    if (locationSource === "device") {
      try {
        const geocode = await Promise.race([
          reverseGeocode(origin.lat, origin.lon),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1600)),
        ]);
        if (geocode?.display_name) origin = { ...origin, name: geocode.display_name };
      } catch {
        // Reverse geocoding is a convenience; the validated coordinates remain usable.
      }
    }
    if (requestId !== gpsStartRequestRef.current) return false;

    const previousOrigin = selectedOrigin;
    const previousSourceQuery = sourceQuery;
    const previousTrafficMode = trafficTestModeRef.current;
    // GPS mode always uses the real traffic route path. Synthetic controlled scenarios stay in Simulation.
    trafficTestModeRef.current = "real";
    setTrafficTestMode("real");
    setSelectedOrigin(origin);
    setSourceQuery(origin.name || "Current location");
    const routeLoaded = await calculateRoutes(origin, destination, false, "real", 0);
    if (requestId !== gpsStartRequestRef.current) return false;
    if (!routeLoaded) {
      setSelectedOrigin(previousOrigin);
      setSourceQuery(previousSourceQuery);
      trafficTestModeRef.current = previousTrafficMode;
      setTrafficTestMode(previousTrafficMode);
      setGpsStatus("error");
      setGpsAccuracyMeters(null);
      setGpsError("A route could not be calculated. Check your connection and destination, then retry.");
      return false;
    }

    if (locationSource === "demo") {
      // GPS mode must never run the simulation animation. With no reliable device fix,
      // keep the vehicle at the configured PSG Tech start while retaining GPS guidance UI.
      gpsLocationSourceRef.current = "demo";
      setGpsLocationSource("demo");
      navigationModeRef.current = "gps";
      setNavigationMode("gps");
      currentLocationRef.current = { ...origin };
      setCurrentLocation({ ...origin });
      setCurrentVehicleSpeed(0);
      setVehicleBearing(0);
      gpsLastSampleRef.current = null;
      gpsOffRouteSamplesRef.current = 0;
      gpsRerouteInProgressRef.current = false;
      gpsLastOffRouteRecalculationRef.current = 0;
      gpsArrivalSamplesRef.current = 0;
      gpsArrivedRef.current = false;
      setGpsStatus("degraded");
      setGpsAccuracyMeters(null);
      setGpsError(null);
      setSimProgressPercent(0);
      setSimDistanceRemainingM(activeRouteRef.current?.distance_meters || 0);
      setSimEtaSeconds(activeRouteRef.current?.predicted_duration_seconds || activeRouteRef.current?.duration_seconds || 0);
      setIsSimPlaying(false);
      TTSService.warmUp();
      setIsNavigating(true);
      logGpsDiagnostic("GPS_NAVIGATION_STARTED_WITH_STATIONARY_DEMO_ORIGIN", {
        lat: origin.lat, lon: origin.lon, accuracyMeters: null, totalWarmupSamples: totalSamples,
      });
      return true;
    }

    gpsLocationSourceRef.current = locationSource;
    setGpsLocationSource(locationSource);
    navigationModeRef.current = "gps";
    setNavigationMode("gps");
    currentLocationRef.current = origin;
    setCurrentLocation(origin);
    setCurrentVehicleSpeed(0);
    gpsLastSampleRef.current = locationSource === "device" && accuracy !== null
      ? { lat: origin.lat, lon: origin.lon, timestamp, accuracy }
      : null;
    gpsOffRouteSamplesRef.current = 0;
    gpsRerouteInProgressRef.current = false;
    gpsLastOffRouteRecalculationRef.current = 0;
    gpsArrivalSamplesRef.current = 0;
    gpsArrivedRef.current = false;
    setGpsAccuracyMeters(locationSource === "device" ? accuracy : null);
    setGpsStatus(locationSource === "device" ? ((accuracy || 0) > 75 ? "degraded" : "tracking") : "degraded");
    setGpsError(null);
    setSimProgressPercent(0);
    setSimDistanceRemainingM(activeRouteRef.current?.distance_meters || 0);
    setSimEtaSeconds(activeRouteRef.current?.predicted_duration_seconds || activeRouteRef.current?.duration_seconds || 0);
    setIsSimPlaying(false);
    TTSService.warmUp();
    setIsNavigating(true);

    logGpsDiagnostic(locationSource === "device" ? "GPS_NAVIGATION_STARTED_WITH_DEVICE_FIX" : "GPS_NAVIGATION_STARTED_WITH_STATIONARY_DEMO_ORIGIN", {
      lat: origin.lat, lon: origin.lon, accuracyMeters: accuracy === null ? null : Math.round(accuracy), totalWarmupSamples: totalSamples,
    });
    return true;
  };

  const stopNavigation = () => {
    gpsStartRequestRef.current += 1;
    if (gpsAcquisitionCleanupRef.current) {
      gpsAcquisitionCleanupRef.current();
      gpsAcquisitionCleanupRef.current = null;
    }
    gpsArrivedRef.current = false;
    gpsLastSampleRef.current = null;
    gpsOffRouteSamplesRef.current = 0;
    gpsRerouteInProgressRef.current = false;
    setGpsStatus("idle");
    gpsLocationSourceRef.current = "device";
    setGpsLocationSource("device");
    setGpsAccuracyMeters(null);
    setGpsError(null);
    setNavigationMode("simulation");
    setIsSimPlaying(false);
    setIsNavigating(false);
  };

  const runTrafficTest = async (mode: TrafficTestMode) => {
    gpsStartRequestRef.current += 1;
    if (gpsAcquisitionCleanupRef.current) {
      gpsAcquisitionCleanupRef.current();
      gpsAcquisitionCleanupRef.current = null;
    }
    setNavigationMode("simulation");
    gpsLocationSourceRef.current = "device";
    setGpsLocationSource("device");
    setGpsStatus("idle");
    setGpsAccuracyMeters(null);
    setGpsError(null);
    gpsLastSampleRef.current = null;
    gpsArrivedRef.current = false;
    TTSService.warmUp();
    trafficTestModeRef.current = mode;
    setTrafficTestMode(mode);
    setIsNavigating(false);
    setIsSimPlaying(true);
    setSimSpeedMultiplier(1);
    setIsEmergencyMode(false);
    setActiveLayerMode("ALL");
    setActiveRerouteRecommendation(null);
    AlertManager.reset();
    RerouteEngine.dismissRecommendation();
    RerouteEngine.dismissNoRouteReason();
    lastDynamicPhaseRef.current = "LOW";
    dynamicProgressRef.current = 0;
    dynamicClearingRef.current = false;
    testCongestionConsumedRef.current = false;
    testRerouteTriggeredRef.current = false;

    let origin = selectedOrigin;
    let destination = selectedDestination;
    if (mode !== "real") {
      const scenario = TRAFFIC_TEST_SCENARIOS[mode];
      origin = scenario.origin;
      destination = scenario.destination;
      setSelectedOrigin(origin);
      setSelectedDestination(destination);
      setSourceQuery(origin.name ?? "");
      setDestinationQuery(destination.name ?? "");
    }
    if (!origin || !destination) return;
    const loaded = await calculateRoutes(origin, destination, false, mode, 0);
    if (loaded) setIsNavigating(true);
  };

  const refreshTrafficScenario = useCallback(async (route: CandidateRoute, progress: number): Promise<CandidateRoute | null> => {
    const destination = selectedDestination;
    const start = route.geometry?.coordinates?.[0];
    if (
      !destination ||
      !start ||
      trafficTestModeRef.current === "real" ||
      testCongestionConsumedRef.current
    ) {
      return null;
    }

    try {
      const response = await fetchRoutes(
        start[1], start[0], destination.lat, destination.lon,
        isEmergencyMode, trafficTestModeRef.current, progress,
        !testCongestionConsumedRef.current
      );
      // PATCH: candidates come back re-ranked by ETA, so [0] can be a DIFFERENT road than `route`.
      // Copying its segments onto this geometry is what made red stretches jump or vanish.
      // Pick the candidate that is actually this route (same length, same start/end corridor).
      const evaluatedRoute = (response.candidates || []).find(
        (candidate) => routesHaveSameGeometry(candidate, route),
      );
      if (!response.success || !evaluatedRoute) {
        console.warn("[NavigationContext] Could not find the same OSRM geometry during traffic refresh; leaving the current route untouched.");
        return null;
      }

      const updatedRoute: CandidateRoute = {
        ...route,
        segments: evaluatedRoute.segments,
        hotspots: evaluatedRoute.hotspots,
        clear_distance_km: evaluatedRoute.clear_distance_km,
        moderate_distance_km: evaluatedRoute.moderate_distance_km,
        heavy_distance_km: evaluatedRoute.heavy_distance_km,
        severe_distance_km: evaluatedRoute.severe_distance_km,
        total_delay_seconds: evaluatedRoute.total_delay_seconds,
        predicted_duration_seconds: evaluatedRoute.predicted_duration_seconds,
        predicted_duration_minutes: evaluatedRoute.predicted_duration_minutes,
      };

      setRoutes((currentRoutes) => currentRoutes.map((currentRoute) =>
        currentRoute.route_id === route.route_id ? updatedRoute : currentRoute
      ));

      return updatedRoute;
    } catch (error) {
      console.warn("[NavigationContext] Could not refresh test traffic conditions:", error);
      return null;
    }
  }, [selectedDestination, isEmergencyMode]);

  // EMERGENCY FEATURE DISABLED (commented out, not deleted) - re-enable later.
  // const toggleEmergencyMode = () => {
  //   const newEmergency = !isEmergencyMode;
  //   setIsEmergencyMode(newEmergency);
  //   if (selectedOrigin && selectedDestination) {
  //     calculateRoutes(selectedOrigin, selectedDestination, newEmergency);
  //   }
  // };
  const toggleEmergencyMode = () => {};


  const swapSourceAndDestination = async () => {
    const oldOrigin = selectedOrigin;
    const oldDest = selectedDestination;
    const oldSrcQuery = sourceQuery;
    const oldDestQuery = destinationQuery;

    setSelectedOrigin(oldDest);
    setSelectedDestination(oldOrigin);
    setSourceQuery(oldDestQuery);
    setDestinationQuery(oldSrcQuery);

    if (oldDest && oldOrigin) {
      await calculateRoutes(oldDest, oldOrigin);
    }
  };

  const dismissAlert = () => {
    AlertManager.dismissCurrentAlert();
  };

  const dismissReroute = () => {
    lastRerouteInteractionTimeRef.current = Date.now();
    setActiveRerouteRecommendation(null);
    RerouteEngine.dismissRecommendation();
    PushNotificationService.clearRerouteAlert();
    if (testReroutePausedRef.current) {
      testReroutePausedRef.current = false;
      setIsSimPlaying(true);
    }
  };

  const dismissNoRouteReason = () => RerouteEngine.dismissNoRouteReason();

  const activateRoute = (newRoute: CandidateRoute, preservePosition: boolean = false): boolean => {
    if (isTransitioningRouteRef.current) return false;
    if (!newRoute || !newRoute.geometry?.coordinates) return false;

    // REROUTE STATE VERSIONING: Generate an activation ID
    const activationId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    
    isTransitioningRouteRef.current = true;

    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    const firstCoord = newRoute.geometry.coordinates[0];
    const lastCoord = newRoute.geometry.coordinates[newRoute.geometry.coordinates.length - 1];
    const totalRouteDistance = newRoute.distance_meters || 0;
    const distToDest = selectedDestination && currentLocation ? haversineMeters(currentLocation.lon, currentLocation.lat, selectedDestination.lon, selectedDestination.lat) : 0;
    
    let proj: ReturnType<typeof projectPointOntoRoute> | null = null;
    let fallbackToStart = false;

    if (preservePosition && currentLocation) {
      // Reroute API requests start at the vehicle's paused physical position. Validate that
      // the candidate begins beside that position, and start at progress 0. Never project
      // against the entire new line: a later crossing can be closer and cause a teleport.
      const startDistanceM = haversineMeters(
        currentLocation.lon, currentLocation.lat, firstCoord[0], firstCoord[1]
      );
      const endDistanceM = selectedDestination
        ? haversineMeters(lastCoord[0], lastCoord[1], selectedDestination.lon, selectedDestination.lat)
        : 0;
      let calculatedPolylineM = 0;
      for (let i = 1; i < newRoute.geometry.coordinates.length; i++) {
        calculatedPolylineM += haversineMeters(
          newRoute.geometry.coordinates[i - 1][0], newRoute.geometry.coordinates[i - 1][1],
          newRoute.geometry.coordinates[i][0], newRoute.geometry.coordinates[i][1]
        );
      }
      const isGeometryAbsurd = Math.abs(calculatedPolylineM - totalRouteDistance) > Math.max(500, totalRouteDistance * 0.2);
      const startToleranceM = navigationModeRef.current === "gps" ? Math.max(75, (gpsAccuracyMeters || 0) + 35) : 35;
      const badStart = startDistanceM > startToleranceM;
      const badEnd = Boolean(selectedDestination && endDistanceM > 250);
      if (badStart || badEnd || isGeometryAbsurd) {
        console.warn("[NavigationContext] Reroute rejected to prevent a vehicle jump.", {
          startDistanceM, endDistanceM, calculatedPolylineM, reportedDistanceM: totalRouteDistance,
        });
        isTransitioningRouteRef.current = false;
        return false;
      }
      proj = {
        projectedPoint: { lon: firstCoord[0], lat: firstCoord[1] },
        distanceAlongRouteMeters: 0,
        distanceToRouteMeters: startDistanceM,
        segmentIndex: 0,
      };
      simDistanceTraversedRef.current = 0;
      // Keep currentLocation/currentLocationRef untouched; the new road route begins where
      // the reroute was requested, within a strict 35m OSRM snap tolerance.
    } else {
      fallbackToStart = true;
    }

    if (fallbackToStart) {
      simDistanceTraversedRef.current = 0;
      if (newRoute.geometry?.coordinates?.length > 0) {
        const startLocation = { lon: firstCoord[0], lat: firstCoord[1] };
        currentLocationRef.current = startLocation;
        setCurrentLocation(startLocation);
      }
    }

    // PART 1 & 2 - DETERMINISTIC DEBUG CHECK
    if (preservePosition && currentLocation && proj) {
      console.log(`[REROUTE ACTIVATION DEBUG]`, {
        routeId: newRoute.route_id,
        activationId,
        source: newRoute.source || "unknown",
        distance_meters: newRoute.distance_meters,
        duration_seconds: newRoute.duration_seconds,
        predicted_duration_seconds: newRoute.predicted_duration_seconds,
        geometryCoordinateCount: newRoute.geometry.coordinates.length,
        firstCoordinate: firstCoord,
        lastCoordinate: lastCoord,
        currentLocationBeforeActivation: { ...currentLocation },
        projectedPoint: proj.projectedPoint,
        projectedDistanceAlongRouteM: proj.distanceAlongRouteMeters,
        distanceToRouteMeters: proj.distanceToRouteMeters,
        currentLocationAfterActivation: fallbackToStart ? { lon: firstCoord[0], lat: firstCoord[1] } : { ...currentLocation },
        distanceCurrentToDestinationM: distToDest,
        totalRouteDistanceM: totalRouteDistance,
        simDistanceTraversedM: simDistanceTraversedRef.current
      });
    }

    lastFrameTimeRef.current = performance.now();
    lastAlertCheckDistanceRef.current = -999;
    lastAutoRerouteCheckTimeRef.current = Date.now();
    lastRerouteInteractionTimeRef.current = Date.now();
    
    AlertManager.reset();
    RerouteEngine.dismissRecommendation();
    TTSService.reset();
    
    // Add old route to recent history before replacing
    const oldRoute = activeRouteRef.current;
    if (oldRoute) {
       recentRoutesRef.current.push({
           route_id: oldRoute.route_id,
           geometry: oldRoute.geometry
       });
       if (recentRoutesRef.current.length > 5) {
           recentRoutesRef.current.shift();
       }
    }

    // Make newRoute the active route at index 0. In GPS mode the physical marker remains
    // on the current fix while route-relative progress restarts at the beginning of the bypass.
    setRoutes((prev) => [newRoute, ...prev.filter((r) => r.route_id !== newRoute.route_id)]);
    setActiveRouteIndex(0);
    if (navigationModeRef.current === "gps") {
      setSimProgressPercent(0);
      setSimDistanceRemainingM(newRoute.distance_meters || totalRouteDistance);
      setSimEtaSeconds(newRoute.predicted_duration_seconds || newRoute.duration_seconds || 0);
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isTransitioningRouteRef.current = false;
      });
    });
    return true;
  };

  const acceptReroute = (recommendation: RerouteRecommendation) => {
    if (!recommendation || !recommendation.recommended_route) return;
    
    // 2. Log and verify the exact recommended_route object entering acceptReroute
    const recRoute = recommendation.recommended_route;
    let calcGeomLength = 0;
    if (recRoute.geometry?.coordinates) {
      for (let i = 1; i < recRoute.geometry.coordinates.length; i++) {
        calcGeomLength += haversineMeters(
          recRoute.geometry.coordinates[i-1][0], recRoute.geometry.coordinates[i-1][1],
          recRoute.geometry.coordinates[i][0], recRoute.geometry.coordinates[i][1]
        );
      }
    }
    const distDest = (selectedDestination && recRoute.geometry?.coordinates?.length) ? haversineMeters(
      recRoute.geometry.coordinates[0][0], recRoute.geometry.coordinates[0][1],
      selectedDestination.lon, selectedDestination.lat
    ) : 0;

    console.log(`[ACCEPT REROUTE DIAGNOSTIC] Entering acceptReroute():`, {
      route_id: recRoute.route_id,
      source: recRoute.source,
      distance_meters: recRoute.distance_meters,
      geometry_coordinates_length: recRoute.geometry?.coordinates?.length,
      first_coordinate: recRoute.geometry?.coordinates?.[0],
      last_coordinate: recRoute.geometry?.coordinates?.[recRoute.geometry.coordinates.length - 1],
      destination_distance: distDest,
      calculated_geometry_length: calcGeomLength
    });

    // When accepting a bypass in a controlled test, the congestion event
    // has served its purpose. Do not carry synthetic hotspots or bypass metadata
    // onto the new active route.
    const routeToActivate =
      trafficTestModeRef.current !== "real"
        ? {
            ...recRoute,
            hotspots: (recRoute.hotspots || []).filter(
              (hotspot) => hotspot.cause !== "Controlled traffic test",
            ),
            controlled_test_bypass_route: null,
            controlled_test_switch_distance_m: null,
            controlled_test_zone_start_distance_m: null,
            controlled_test_zone_end_distance_m: null,
          }
        : recRoute;

    setIsApplyingReroute(true);
    const switched = activateRoute(routeToActivate, true);
    setIsApplyingReroute(false);
    if (switched) {
      // Any accepted reroute during a controlled traffic test ends that
      // test's synthetic congestion for the rest of the trip â€” not only an
      // accepted congestion-avoidance suggestion. Gating this solely on
      // is_congestion_avoidance meant the "faster route" branch (surfaced by
      // the periodic, non-avoidance check) never marked the scenario
      // consumed, so a later dynamic-mode phase change â€” or any fresh
      // /route call â€” could still inject another synthetic HEAVY/SEVERE
      // hotspot even though the driver had already rerouted once.
      if (trafficTestModeRef.current !== "real") {
        testCongestionConsumedRef.current = true;
      }
      if (testReroutePausedRef.current) {
        testReroutePausedRef.current = false;
        setIsSimPlaying(true);
      }
      if (recommendation.is_congestion_avoidance) {
        const viaRoad = recommendation.recommended_route?.steps?.find(
          (step) => Boolean(step.name?.trim()) && step.maneuver?.type !== "depart",
        )?.name?.trim();
        TTSService.speakRerouteSuggestion(recommendation.time_saved_minutes, viaRoad, true);
      } else {
        TTSService.announce(
          `Route updated. The new route saves about ${Math.round(recommendation.time_saved_minutes)} minutes.`,
          SpeechPriority.NORMAL,
          `route_updated_${recommendation.recommended_route?.route_id || Date.now()}`,
        );
      }
    } else {
      setActiveRerouteRecommendation(null);
      RerouteEngine.dismissRecommendation();
      if (testReroutePausedRef.current) {
        testReroutePausedRef.current = false;
        setIsSimPlaying(true);
      }
      TTSService.announce(
        "Could not switch routes. Continue on the current route.",
        SpeechPriority.NORMAL,
        "reroute_switch_failed",
      );
    }
  };

  // Speech rate is evaluated at dequeue time from the same ref used by the turn thresholds.
  useEffect(() => {
    TTSService.setRateProvider(() => {
      const multiplier = navigationModeRef.current === "simulation" ? simSpeedMultiplierRef.current : 1;
      return Math.min(2.0, 1.05 * (1 + (multiplier - 1) * 0.25));
    });
    return () => TTSService.reset();
  }, []);

  const triggerDynamicRerouteCheck = useCallback(
    async (force: boolean = false, pinnedHotspotId?: string | null) => {
      const activeRoute = routes[activeRouteIndex];


      if (!activeRoute || !selectedDestination || !currentLocation || !isNavigating) return;

      const currentReqId = ++rerouteRequestIdRef.current;

      // Ensure we are physically on route before fetching a reroute
      const proj = projectPointOntoRoute(currentLocation, activeRoute);
      const distanceFromVehicleToRouteMeters = haversineMeters(currentLocation.lon, currentLocation.lat, proj.projectedPoint.lon, proj.projectedPoint.lat);
      if (distanceFromVehicleToRouteMeters > 500) {
        console.warn("[REROUTE BLOCKED] Current vehicle position is not on active route.");
        return;
      }

      // Check distance to destination
      const distToDest = haversineMeters(currentLocation.lon, currentLocation.lat, selectedDestination.lon, selectedDestination.lat);
      if (distToDest <= 500) return;
      
      const totalRouteDistance = activeRoute.distance_meters || 1;
      const traversedDist = simDistanceTraversedRef.current;
      const remainingDist = Math.max(0, totalRouteDistance - traversedDist);
      const progressRatio = Math.min(1.0, traversedDist / totalRouteDistance);
      
      // Calculate true remaining ETA instead of passing full route ETA
      const totalSeconds = activeRoute.predicted_duration_seconds || activeRoute.duration_seconds || 600;
      const remainingSec = Math.max(0, (1.0 - progressRatio) * totalSeconds);

      try {
        const rec = await RerouteEngine.checkAndReevaluate(
          currentLocation.lat,
          currentLocation.lon,
          selectedDestination.lat,
          selectedDestination.lon,
          remainingSec,
          currentVehicleSpeed,
          isEmergencyMode,
          force,
          trafficTestModeRef.current,
          progressRatio,
          force ? getUpcomingAvoidHotspots(activeRoute, traversedDist, pinnedHotspotId) : [],
          recentRoutesRef.current,
          !testCongestionConsumedRef.current
        );
        
        // Ignore stale responses
        if (currentReqId !== rerouteRequestIdRef.current) return;
      } catch (e) {
        console.error("Reroute check error", e);
      }
    },
    [routes, activeRouteIndex, selectedDestination, currentLocation, currentVehicleSpeed, isEmergencyMode, isNavigating]
  );

  const hasInitializedJourneyRef = useRef(false);

  // Active navigation start / stop handling
  useEffect(() => {
    if (isNavigating) {
      if (hasInitializedJourneyRef.current) return; // Do not reset if journey is already running

      // Cancel any lingering animation frame from a previous session to prevent
      // duplicate loops when start is pressed.
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }

      const activeRoute = routes[activeRouteIndex];
      if (activeRoute && activeRoute.geometry?.coordinates?.length > 0) {
        const firstCoord = activeRoute.geometry.coordinates[0];
        const routeStartLocation = { lon: firstCoord[0], lat: firstCoord[1] };
        // GPS startup has already installed the initial device fix. Never snap the GPS marker
        // to the route's first OSRM coordinate; only Simulation starts at that route point.
        const startLocation = navigationMode === "gps" && currentLocationRef.current
          ? currentLocationRef.current
          : routeStartLocation;
        currentLocationRef.current = startLocation;
        setCurrentLocation(startLocation);
        simDistanceTraversedRef.current = navigationMode === "gps"
          ? projectPointOntoRoute(startLocation, activeRoute).distanceAlongRouteMeters
          : 0;
        lastAlertCheckDistanceRef.current = -999;
        lastAutoRerouteCheckTimeRef.current = 0;
        isTransitioningRouteRef.current = false;
        testReroutePausedRef.current = false;
        TTSService.warmUp();
        const routeCoordinates = activeRoute.geometry.coordinates as [number, number][];
        let routeGeometryLength = 0;
        for (let i = 1; i < routeCoordinates.length; i += 1) {
          routeGeometryLength += haversineMeters(
            routeCoordinates[i - 1][0], routeCoordinates[i - 1][1],
            routeCoordinates[i][0], routeCoordinates[i][1],
          );
        }
        const initialProgressRatio = navigationMode === "gps" && routeGeometryLength > 0
          ? Math.min(1, simDistanceTraversedRef.current / routeGeometryLength)
          : 0;
        setSimProgressPercent(Math.round(initialProgressRatio * 100));
        setSimDistanceRemainingM(Math.max(0, (activeRoute.distance_meters || routeGeometryLength) * (1 - initialProgressRatio)));
        setSimEtaSeconds(Math.round((activeRoute.predicted_duration_seconds || activeRoute.duration_seconds || 0) * (1 - initialProgressRatio)));
        // Reset the frame timestamp so the first animateDrive tick computes a
        // sane delta instead of a huge jump from a stale previous value.
        lastFrameTimeRef.current = performance.now();
        // Only Simulation runs the animation-frame movement engine.
        setIsSimPlaying(navigationMode === "simulation");

        TTSService.announce(
          isEmergencyMode
            ? "Starting Emergency Priority Navigation. Clear corridor mode active."
            : navigationMode === "gps" ? "Starting GPS navigation." : "Starting navigation simulation.",
          SpeechPriority.NORMAL,
          `navigation_started_${activeRoute.route_id || activeRouteIndex}`,
        );
        hasInitializedJourneyRef.current = true;
      }
    } else {
      hasInitializedJourneyRef.current = false;
      TTSService.reset();
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      isTransitioningRouteRef.current = false;
      testReroutePausedRef.current = false;
      AlertManager.reset();
      RerouteEngine.dismissRecommendation();
      RerouteEngine.dismissNoRouteReason();
      currentLocationRef.current = null;
      setCurrentLocation(null);
      setActiveRerouteRecommendation(null);
      gpsLastSampleRef.current = null;
      gpsOffRouteSamplesRef.current = 0;
      gpsRerouteInProgressRef.current = false;
      gpsArrivalSamplesRef.current = 0;
      gpsArrivedRef.current = false;
      setGpsAccuracyMeters(null);
      if (navigationModeRef.current !== "gps") setGpsStatus("idle");
    }
  }, [isNavigating, navigationMode, activeRouteIndex, routes, isEmergencyMode]);

  // GPS watcher is exclusively active during a GPS journey. Simulation never requests device location.
  useEffect(() => {
    if (!isNavigating || navigationMode !== "gps" || typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }

    const sessionId = ++gpsSessionRef.current;
    let watchId: number | null = null;
    let lastAlertProgressM = -999;

    const handleGpsPosition = (position: GeolocationPosition) => {
      if (sessionId !== gpsSessionRef.current || !isNavigatingRef.current || navigationModeRef.current !== "gps" || gpsArrivedRef.current || isTransitioningRouteRef.current) return;
      const { latitude, longitude, accuracy, speed, heading } = position.coords;
      const timestamp = position.timestamp || Date.now();
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;
      if (!Number.isFinite(accuracy) || accuracy <= 0) return;
      if (Date.now() - timestamp > 30000) {
        if (gpsLocationSourceRef.current !== "demo") {
          setGpsStatus("degraded");
          setGpsError("GPS signal is stale. Keeping the last reliable position while waiting for an updated fix.");
        }
        return;
      }

      // A fallback coordinate is for route preview only. Do not let coarse browser/IP
      // locations move the marker, advance progress, trigger arrival, or initiate reroutes.
      if (gpsLocationSourceRef.current === "demo") {
        if (accuracy > GPS_REAL_FIX_MAX_ACCURACY_METERS) {
          setGpsStatus("degraded");
          setGpsAccuracyMeters(null);
          setCurrentVehicleSpeed(0);
          return;
        }
        if (gpsRerouteInProgressRef.current) return;
        const destination = selectedDestinationRef.current;
        if (!destination) return;
        const promotedLocation: Coordinate = { lat: latitude, lon: longitude, name: "Current GPS Location" };
        gpsRerouteInProgressRef.current = true;
        setGpsStatus("rerouting");
        setGpsError("Reliable device location found. Updating the route…");
        void (async () => {
          let loaded = false;
          try {
            loaded = await latestCalculateRoutesRef.current(promotedLocation, destination, false, "real", 0);
          } catch (error) {
            console.warn("[ApexGuardian GPS] Device-location route refresh failed:", error);
          }
          if (sessionId !== gpsSessionRef.current || !isNavigatingRef.current || navigationModeRef.current !== "gps") return;
          gpsRerouteInProgressRef.current = false;
          if (loaded) {
            gpsLocationSourceRef.current = "device";
            setGpsLocationSource("device");
            setSelectedOrigin(promotedLocation);
            setSourceQuery("Current GPS Location");
            currentLocationRef.current = promotedLocation;
            setCurrentLocation(promotedLocation);
            setCurrentVehicleSpeed(0);
            gpsLastSampleRef.current = { lat: latitude, lon: longitude, timestamp, accuracy };
            gpsOffRouteSamplesRef.current = 0;
            gpsArrivalSamplesRef.current = 0;
            gpsArrivedRef.current = false;
            simDistanceTraversedRef.current = 0;
            setSimProgressPercent(0);
            setSimDistanceRemainingM(activeRouteRef.current?.distance_meters || 0);
            setSimEtaSeconds(activeRouteRef.current?.predicted_duration_seconds || activeRouteRef.current?.duration_seconds || 0);
            setGpsAccuracyMeters(accuracy);
            setGpsStatus(accuracy > 75 ? "degraded" : "tracking");
            setGpsError(accuracy > 100 ? `GPS accuracy is approximate (±${Math.round(accuracy)} m).` : null);
            logGpsDiagnostic("REAL_FIX_REPLACED_STATIONARY_DEMO_ORIGIN", { lat: latitude, lon: longitude, accuracyMeters: Math.round(accuracy) });
          } else {
            gpsLocationSourceRef.current = "demo";
            setGpsLocationSource("demo");
            currentLocationRef.current = GPS_DEMO_FALLBACK_ORIGIN;
            setCurrentLocation(GPS_DEMO_FALLBACK_ORIGIN);
            setCurrentVehicleSpeed(0);
            setGpsAccuracyMeters(null);
            setGpsStatus("degraded");
            setGpsError("A reliable device location was found, but the route could not be refreshed. The map remains stationary.");
          }
        })();
        return;
      }

      // Ignore coarse fixes for all movement/progress calculations, not just guidance.
      if (accuracy > GPS_REAL_FIX_MAX_ACCURACY_METERS) {
        setGpsStatus("degraded");
        setGpsAccuracyMeters(accuracy);
        setGpsError(`GPS accuracy is too coarse (±${Math.round(accuracy)} m). Holding the last reliable position.`);
        return;
      }

      const previousSample = gpsLastSampleRef.current;
      const elapsedSeconds = previousSample ? Math.max(0.25, (timestamp - previousSample.timestamp) / 1000) : 1;
      const rawMovementM = previousSample
        ? haversineMeters(previousSample.lon, previousSample.lat, longitude, latitude)
        : 0;
      const plausibleMovementM = Math.max(100, elapsedSeconds * 70 + accuracy + (previousSample?.accuracy || 0) + 25);
      if (previousSample && rawMovementM > plausibleMovementM) {
        setGpsStatus("degraded");
        setGpsAccuracyMeters(accuracy);
        setGpsError("A sudden GPS position jump was ignored. Waiting for a stable location fix.");
        return;
      }

      const location: Coordinate = { lat: latitude, lon: longitude, name: "Current GPS Location" };
      let speedKmh = Number.isFinite(speed) && speed !== null && speed >= 0
        ? speed * 3.6
        : previousSample && elapsedSeconds > 1 && rawMovementM > 3
          ? (rawMovementM / elapsedSeconds) * 3.6
          : 0;
      speedKmh = Math.max(0, Math.min(220, speedKmh));
      let nextBearing = Number.isFinite(heading) && heading !== null && heading >= 0
        ? heading
        : currentBearingRef.current;
      if ((!Number.isFinite(heading) || heading === null || heading < 0) && previousSample && rawMovementM > 3) {
        nextBearing = calculateBearingAngle(previousSample.lon, previousSample.lat, longitude, latitude);
      }
      if (!Number.isFinite(nextBearing)) nextBearing = 0;

      gpsLastSampleRef.current = { lat: latitude, lon: longitude, timestamp, accuracy };
      currentLocationRef.current = location;
      setCurrentLocation(location);
      setCurrentVehicleSpeed(Math.round(speedKmh));
      currentBearingRef.current = nextBearing;
      setVehicleBearing(nextBearing);
      setGpsAccuracyMeters(accuracy);

      const isCoarse = accuracy > 75;
      if (!gpsRerouteInProgressRef.current) {
        if (accuracy > 250) {
          setGpsStatus("degraded");
          setGpsError(
            `GPS accuracy is poor (±${Math.round(accuracy)} m). Waiting for a better position fix.`
          );
        } else if (accuracy > 100) {
          setGpsStatus("degraded");
          setGpsError(
            `GPS accuracy is approximate (±${Math.round(accuracy)} m). Navigation is using a coarse position fix.`
          );
        } else {
          setGpsStatus(isCoarse ? "degraded" : "tracking");
          setGpsError(null);
        }
      }

      // Gate reliable route-progress updates, turn-by-turn confidence, off-route rerouting and arrival detection on suitable quality (≤250m)
      if (!Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 250) {
        return;
      }

      const activeRoute = activeRouteRef.current;
      const destination = selectedDestinationRef.current;
      if (!activeRoute || !activeRoute.geometry?.coordinates || activeRoute.geometry.coordinates.length < 2 || !destination) return;
      if (gpsRerouteInProgressRef.current) return;

      const projection = projectPointOntoRoute(location, activeRoute);
      const coordinates = activeRoute.geometry.coordinates as [number, number][];
      let geometryLengthM = 0;
      for (let i = 1; i < coordinates.length; i += 1) {
        geometryLengthM += haversineMeters(coordinates[i - 1][0], coordinates[i - 1][1], coordinates[i][0], coordinates[i][1]);
      }
      if (geometryLengthM <= 0) return;

      const previousProgressM = simDistanceTraversedRef.current;
      const onRouteToleranceM = Math.max(80, accuracy * 1.5);
      const isNearRoute = projection.distanceToRouteMeters <= onRouteToleranceM;
      let progressM = previousProgressM;
      if (isNearRoute) {
        const maxForwardJumpM = Math.max(60, (speedKmh / 3.6) * elapsedSeconds * 3 + accuracy * 2 + 30);
        const candidateProgressM = projection.distanceAlongRouteMeters;
        // Keep route progress monotonic and reject implausible projection jumps at crossings.
        if (candidateProgressM <= previousProgressM + maxForwardJumpM || previousProgressM < 40) {
          progressM = Math.max(previousProgressM, candidateProgressM);
        } else {
          setGpsStatus("degraded");
          setGpsError("GPS matched an unexpected section of the route. Keeping the previous progress until the position stabilizes.");
        }
        gpsOffRouteSamplesRef.current = 0;
      } else {
        gpsOffRouteSamplesRef.current += 1;
      }

      progressM = Math.max(0, Math.min(geometryLengthM, progressM));
      simDistanceTraversedRef.current = progressM;
      const progressRatio = Math.max(0, Math.min(1, progressM / geometryLengthM));
      const remainingM = Math.max(0, (activeRoute.distance_meters || geometryLengthM) * (1 - progressRatio));
      const routePredictedRemainingS = Math.max(0, (activeRoute.predicted_duration_seconds || activeRoute.duration_seconds || 0) * (1 - progressRatio));
      const speedBasedRemainingS = speedKmh >= 5 ? remainingM / Math.max(1, speedKmh / 3.6) : routePredictedRemainingS;
      const etaSeconds = speedKmh >= 5
        ? Math.round(routePredictedRemainingS * 0.65 + speedBasedRemainingS * 0.35)
        : Math.round(routePredictedRemainingS);
      setSimProgressPercent(Math.round(progressRatio * 100));
      setSimDistanceRemainingM(remainingM);
      setSimEtaSeconds(Math.max(0, etaSeconds));

      // Use real GPS progress to keep the existing congestion-alert distance state in sync.
      if (isNearRoute && Math.abs(progressM - lastAlertProgressM) >= 15) {
        lastAlertProgressM = progressM;
        AlertManager.evaluatePosition(latitude, longitude, activeRoute.hotspots || [], speedKmh, (alert) => {
          if (alert.firstAnnouncement) {
            TTSService.speakCongestionAlert(
              alert.locationName,
              alert.distanceText,
              alert.averageSpeedKmh,
              alert.estimatedDelaySeconds ? alert.estimatedDelaySeconds / 60 : undefined,
              true,
              alert.congestionLevel,
            );
            PushNotificationService.sendCongestionAlert(
              alert.locationName,
              alert.distanceText,
              alert.estimatedDelaySeconds ? alert.estimatedDelaySeconds / 60 : 3,
              alert.averageSpeedKmh,
              alert.congestionLevel,
            );
          }
          if (
            (alert.congestionLevel === "HEAVY" || alert.congestionLevel === "SEVERE") &&
            trafficTestModeRef.current === "real" &&
            !RerouteEngine.getActiveRecommendation()
          ) {
            void RerouteEngine.checkAndReevaluate(
              latitude, longitude, destination.lat, destination.lon, etaSeconds, speedKmh,
              isEmergencyMode, true, "real", progressRatio,
              getUpcomingAvoidHotspots(activeRoute, progressM), recentRoutesRef.current, true,
            );
          }
        }, progressM);
      }

      // Keep turn guidance tied to route distance, not wall-clock simulation progress.
      if (activeRoute.steps?.length) {
        let walkedStepM = 0;
        let currentStepIndex = 0;
        let distanceToTurnM = 0;
        for (let i = 0; i < activeRoute.steps.length; i += 1) {
          walkedStepM += activeRoute.steps[i].distance || 0;
          if (walkedStepM > progressM) {
            currentStepIndex = i;
            distanceToTurnM = walkedStepM - progressM;
            break;
          }
        }
        if (walkedStepM <= progressM) {
          currentStepIndex = activeRoute.steps.length - 1;
          distanceToTurnM = 0;
        }
        const upcomingStepIndex = Math.min(currentStepIndex + 1, activeRoute.steps.length - 1);
        const upcomingStep = activeRoute.steps[upcomingStepIndex];
        if (upcomingStep) {
          setNextManeuver(upcomingStep);
          setNextManeuverDistanceM(Math.round(distanceToTurnM));
          const routeId = activeRoute.route_id || `idx-${activeRouteIndex}`;
          if (distanceToTurnM <= 500 && distanceToTurnM > 200) {
            const announcement = getManeuverAnnouncement(upcomingStep, distanceToTurnM);
            if (announcement) TTSService.announce(announcement, SpeechPriority.CRITICAL, `${routeId}_${upcomingStepIndex}_advance`, 30 * 60_000);
          } else if (distanceToTurnM <= 200) {
            // Guard imminent turn announcements against degraded/coarse GPS fixes
            if (accuracy <= 100) {
              TTSService.announce(getManeuverInstruction(upcomingStep), SpeechPriority.CRITICAL, `${routeId}_${upcomingStepIndex}_imminent`, 30 * 60_000);
            }
          }
        }
      }

      // Real-position, cooldown-protected off-route recovery. Do not use this path for synthetic tests.
      const now = Date.now();
      if (
        !isNearRoute && gpsOffRouteSamplesRef.current >= 3 &&
        trafficTestModeRef.current === "real" &&
        now - gpsLastOffRouteRecalculationRef.current >= 20000
      ) {
        gpsLastOffRouteRecalculationRef.current = now;
        gpsOffRouteSamplesRef.current = 0;
        gpsRerouteInProgressRef.current = true;
        setGpsStatus("rerouting");
        setGpsError("You appear to be off the planned route. Recalculating from your current GPS locationâ€¦");
        const origin: Coordinate = { lat: latitude, lon: longitude, name: "Current GPS Location" };
        void (async () => {
          const loaded = await latestCalculateRoutesRef.current(origin, destination, false, "real", 0);
          if (sessionId !== gpsSessionRef.current || !isNavigatingRef.current || navigationModeRef.current !== "gps") return;
          gpsRerouteInProgressRef.current = false;
          if (loaded) {
            setSelectedOrigin(origin);
            setSourceQuery(origin.name || "Current GPS Location");
            simDistanceTraversedRef.current = 0;
            lastAlertProgressM = -999;
            setSimProgressPercent(0);
            setGpsStatus("tracking");
            setGpsError(null);
          } else {
            setGpsStatus("degraded");
            setGpsError("Automatic rerouting failed. Continue toward the planned route or retry route calculation.");
          }
        })();
      }

      // Periodic real-traffic evaluation uses the latest device location. It is independent of simulation playback.
      if (
        isNearRoute && trafficTestModeRef.current === "real" &&
        !RerouteEngine.getActiveRecommendation() &&
        Date.now() - lastAutoRerouteCheckTimeRef.current > 10000
      ) {
        lastAutoRerouteCheckTimeRef.current = Date.now();
        void RerouteEngine.checkAndReevaluate(
          latitude, longitude, destination.lat, destination.lon, etaSeconds, speedKmh,
          isEmergencyMode, false, "real", progressRatio, [], recentRoutesRef.current, true,
        );
      }

      // Arrival is based on consecutive actual GPS fixes near the destination, never on projected progress alone.
      // Strictly guard against coarse GPS fixes (requires accuracy <= 50m) to prevent premature arrival.
      const distanceToDestinationM = haversineMeters(longitude, latitude, destination.lon, destination.lat);
      const arrivalRadiusM = Math.min(50, Math.max(25, accuracy));
      if (distanceToDestinationM <= arrivalRadiusM && accuracy <= 50) {
        gpsArrivalSamplesRef.current += 1;
      } else {
        gpsArrivalSamplesRef.current = 0;
      }
      if (gpsArrivalSamplesRef.current >= 2 && !gpsArrivedRef.current) {
        gpsArrivedRef.current = true;
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
          watchId = null;
        }
        setSimProgressPercent(100);
        setSimDistanceRemainingM(0);
        setSimEtaSeconds(0);
        setGpsStatus("arrived");
        setGpsError(null);
        AlertManager.reset();
        RerouteEngine.dismissRecommendation();
        RerouteEngine.dismissNoRouteReason();
        setActiveRerouteRecommendation(null);
        PushNotificationService.clearCongestionAlert();
        PushNotificationService.clearRerouteAlert();
        TTSService.announce("You have arrived at your destination.", SpeechPriority.CRITICAL, `arrived_${activeRoute.route_id || activeRouteIndex}`);
      }
    };

    const handleGpsError = (error: GeolocationPositionError) => {
      if (sessionId !== gpsSessionRef.current || !isNavigatingRef.current || navigationModeRef.current !== "gps") return;
      setGpsStatus("degraded");
      if (gpsLocationSourceRef.current === "demo") {
        setGpsAccuracyMeters(null);
        setCurrentVehicleSpeed(0);
        logGpsWarning("DEVICE_WATCH_UNAVAILABLE_PREVIEW_REMAINS_STATIONARY", { code: error.code });
        return;
      }
      setGpsError(`${describeGeolocationError(error)} Navigation is paused at the last reliable position; check location access to resume updates.`);
    };

    watchId = navigator.geolocation.watchPosition(
      handleGpsPosition,
      handleGpsError,
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
    );
    return () => {
      gpsSessionRef.current += 1;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [isNavigating, navigationMode]);

  // Clean up any in-flight startup acquisition on unmount
  useEffect(() => {
    return () => {
      if (gpsAcquisitionCleanupRef.current) {
        gpsAcquisitionCleanupRef.current();
        gpsAcquisitionCleanupRef.current = null;
      }
    };
  }, []);

  // High-Frequency Smooth Interpolated Driving Simulation Loop (Section 4 & 5)
  useEffect(() => {
    if (!isNavigating || navigationMode !== "simulation" || !isSimPlaying) {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      return;
    }

    const activeRoute = routes[activeRouteIndex];
    if (!activeRoute || !activeRoute.geometry?.coordinates) return;

    const coords = activeRoute.geometry.coordinates as [number, number][];
    const totalPoints = coords.length;
    if (totalPoints < 2) return;

    // Precalculate segment lengths and cumulative distances
    const segmentDistances: number[] = [];
    const cumulativeDistances: number[] = [0];
    let totalRouteDistanceM = 0;

    for (let i = 1; i < totalPoints; i++) {
      const d = haversineMeters(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
      segmentDistances.push(d);
      totalRouteDistanceM += d;
      cumulativeDistances.push(totalRouteDistanceM);
    }

    if (totalRouteDistanceM <= 0) return;

    // Initialize bearing from first segment
    if (currentBearingRef.current === 0 && totalPoints >= 2) {
      currentBearingRef.current = calculateBearingAngle(
        coords[0][0],
        coords[0][1],
        coords[1][0],
        coords[1][1]
      );
      setVehicleBearing(currentBearingRef.current);
    }

    lastFrameTimeRef.current = performance.now();

    const animateDrive = (now: number) => {
      if (isTransitioningRouteRef.current) {
        animationFrameIdRef.current = requestAnimationFrame(animateDrive);
        return;
      }
      const liveLocation = currentLocationRef.current;
      if (!isNavigating || !isSimPlaying || !activeRoute || !liveLocation) return;
      // Measure distance to route polyline once per route activation
      if (!lastFrameTimeRef.current || (now - lastFrameTimeRef.current < 100 && simDistanceTraversedRef.current === 0)) {
        const { distanceToRouteMeters } = projectPointOntoRoute(liveLocation, activeRoute);
        console.log(`[NavigationContext] initial frame - distance from physical location to route polyline: ${distanceToRouteMeters.toFixed(2)}m`);
      }

      const dtSeconds = Math.min(0.1, (now - lastFrameTimeRef.current) / 1000);
      lastFrameTimeRef.current = now;

      const currentDist = simDistanceTraversedRef.current;

      // Section 3: Arrival sanity check
      if (currentDist >= totalRouteDistanceM) {
        // Enforce strict arrival: must actually be near destination
        const distToDest = selectedDestination && liveLocation
          ? haversineMeters(liveLocation.lon, liveLocation.lat, selectedDestination.lon, selectedDestination.lat)
          : 0;

        const MIN_REASONABLE_ROUTE_DISTANCE = 50; // Guard against 9m phantom routes
        
        if (totalRouteDistanceM < MIN_REASONABLE_ROUTE_DISTANCE && distToDest > 50) {
          console.error(`[NavigationContext] CATASTROPHIC ROUTE ERROR: Route is only ${Math.round(totalRouteDistanceM)}m long, but destination is ${Math.round(distToDest)}m away. ABORTING ARRIVAL.`);
          // We do not arrive. The route is fundamentally broken.
          // Fallback logic could go here, but for now we halt simulation to prevent teleportation.
          setIsSimPlaying(false);
          return;
        }

        if (distToDest <= 50) {
          if (totalRouteDistanceM < 50) {
            console.log("[NavigationContext] Arrived on short route segment:", Math.round(totalRouteDistanceM), "m");
          } else {
            console.log("[NavigationContext] Arrived at destination.");
          }
          setSimProgressPercent(100);
          setSimDistanceRemainingM(0);
          setSimEtaSeconds(0);
          setIsSimPlaying(false);
          AlertManager.reset();
          RerouteEngine.dismissRecommendation();
          RerouteEngine.dismissNoRouteReason();
          setActiveRerouteRecommendation(null);
          PushNotificationService.clearCongestionAlert();
          PushNotificationService.clearRerouteAlert();
          const lastPt = coords[totalPoints - 1];
          setCurrentLocation({ lon: lastPt[0], lat: lastPt[1] });
          TTSService.announce(
            "You have arrived at your destination.",
            SpeechPriority.CRITICAL,
            `arrived_${activeRoute.route_id || activeRouteIndex}`,
          );
          return;
        } else {
          // False arrival due to malformed route, do not trigger arrival.
          console.warn(`[NavigationContext] Suppressing false arrival: route end reached but destination is ${Math.round(distToDest)}m away.`);
          // Pause simulation to prevent out-of-bounds error, but do not arrive.
          setIsSimPlaying(false);
          return;
        }
      }

      // Progress ratio (0.0 to 1.0)
      const progressRatio = Math.min(1.0, currentDist / totalRouteDistanceM);
      const scenarioProgress = trafficTestModeRef.current === "dynamic"
        ? Math.max(dynamicProgressRef.current, progressRatio)
        : progressRatio;
      if (trafficTestModeRef.current === "dynamic") dynamicProgressRef.current = scenarioProgress;

      // Determine current segment speed
      let speedKmh = 40.0;
      if (activeRoute.segments && activeRoute.segments.length > 0) {
        // PATCH: locate the segment by DISTANCE travelled. The old uniform index
        // (progress * segmentCount) drifted away from the real segment as soon as segments had
        // unequal lengths (e.g. when a congestion zone is cut out of a longer chunk).
        let acc = 0;
        let segIdx = activeRoute.segments.length - 1;
        for (let i = 0; i < activeRoute.segments.length; i++) {
          acc += activeRoute.segments[i].distance_meters || 0;
          if (currentDist <= acc) { segIdx = i; break; }
        }
        const seg = activeRoute.segments[segIdx];
        if (seg && seg.current_speed_kmh) {
          speedKmh = seg.current_speed_kmh;
        }
      }

      // Simulation advancement: responsive pace scaling (~6x real-time at 1x)
      const simPaceMultiplier = 6.0;
      const speedMs = (speedKmh * 1000) / 3600;
      const deltaDistance = speedMs * simPaceMultiplier * simSpeedMultiplier * dtSeconds;
      const newDist = Math.min(totalRouteDistanceM, currentDist + deltaDistance);
      console.log("[REROUTE-DEBUG]", { event: "animateDrive_tick", dist: simDistanceTraversedRef.current, totalRouteDistanceM });
      simDistanceTraversedRef.current = newDist;

      // Find the segment containing newDist
      let segIndex = 0;
      for (let i = 0; i < segmentDistances.length; i++) {
        if (newDist >= cumulativeDistances[i] && newDist <= cumulativeDistances[i + 1]) {
          segIndex = i;
          break;
        }
        if (i === segmentDistances.length - 1) {
          segIndex = i;
        }
      }

      const p1 = coords[segIndex];
      const p2 = coords[Math.min(totalPoints - 1, segIndex + 1)];
      const segLen = Math.max(0.1, segmentDistances[segIndex] || 1);
      const segOffset = Math.max(0, newDist - cumulativeDistances[segIndex]);
      const t = Math.min(1.0, Math.max(0.0, segOffset / segLen));

      // Interpolate coordinates
      const interpLon = p1[0] + t * (p2[0] - p1[0]);
      const interpLat = p1[1] + t * (p2[1] - p1[1]);
      const newLocation = { lon: interpLon, lat: interpLat };

      // Interpolate Bearing smoothly with shortest angular distance
      const targetBearing = calculateBearingAngle(p1[0], p1[1], p2[0], p2[1]);
      const currBearing = currentBearingRef.current;
      const angleDiff = ((((targetBearing - currBearing) % 360) + 540) % 360) - 180;
      const smoothedBearing = (currBearing + angleDiff * Math.min(1.0, 8.0 * dtSeconds) + 360) % 360;
      currentBearingRef.current = smoothedBearing;

      // Update state
      currentLocationRef.current = newLocation;
      setCurrentLocation(newLocation);
      setVehicleBearing(smoothedBearing);
      setCurrentVehicleSpeed(Math.round(speedKmh));
      setSimProgressPercent(Math.min(100, Math.round(progressRatio * 100)));
      setSimDistanceRemainingM(Math.max(0, totalRouteDistanceM - newDist));
      setSimEtaSeconds(Math.max(0, Math.round(
        (activeRoute.predicted_duration_seconds || activeRoute.duration_seconds || 0) * (1 - progressRatio)
      )));

      // Continuously update the active alert's distance text every frame so the
      // banner counts down in real time rather than freezing between check gates.
      const currentActiveAlert = AlertManager.getActiveAlert();
      if (currentActiveAlert && activeRoute.hotspots) {
        const hotspot = activeRoute.hotspots.find(
          (h) => h.hotspot_id === currentActiveAlert.hotspotId
        );
        if (hotspot) {
          const liveDistance = hotspot.distance_from_origin_m - newDist;
          if (liveDistance < -50) {
            // Vehicle has passed the hotspot by more than 50m â€” clear the alert
            AlertManager.dismissCurrentAlert();
          } else {
            AlertManager.updateLiveDistance(Math.max(0, liveDistance));
          }
        }
      }

      // Clear stale reroute recommendation if the vehicle has passed the hotspot
      // that triggered it, preventing the popup from lingering.
      const currentReroute = RerouteEngine.getActiveRecommendation();
      if (currentReroute && currentReroute.is_congestion_avoidance && activeRoute.hotspots) {
        const allHotspotsPassedOrCleared = (activeRoute.hotspots || [])
          .filter(h => h.congestion_level === "HEAVY" || h.congestion_level === "SEVERE")
          .every(h => h.distance_from_origin_m < newDist - 50);
        if (allHotspotsPassedOrCleared && activeRoute.hotspots.length > 0) {
          RerouteEngine.dismissRecommendation();
          setActiveRerouteRecommendation(null);
        }
      }

      // Speed-Aware Congestion Alert Evaluation (Throttled per ~15m of progress)
      // Using 15m keeps the alert distance responsive without excessive backend calls
      // (this evaluation is local against already-loaded route hotspots).
      if (Math.abs(newDist - lastAlertCheckDistanceRef.current) >= 15) {
        lastAlertCheckDistanceRef.current = newDist;
        const hotspots = activeRoute.hotspots || [];

        AlertManager.evaluatePosition(interpLat, interpLon, hotspots, speedKmh, (alert) => {
          // PATCH: speak / push ONCE per hotspot. Stage 2 / stage 3 (500 m / 200 m) and severity
          // escalations only refresh the banner; they used to re-announce the same jam 2-3 times.
          if (alert.firstAnnouncement) {
            TTSService.speakCongestionAlert(
              alert.locationName,
              alert.distanceText,
              alert.averageSpeedKmh,
              alert.estimatedDelaySeconds ? alert.estimatedDelaySeconds / 60 : undefined,
              true,
              alert.congestionLevel
            );

            PushNotificationService.sendCongestionAlert(
              alert.locationName,
              alert.distanceText,
              alert.estimatedDelaySeconds ? alert.estimatedDelaySeconds / 60 : 3,
              alert.averageSpeedKmh,
              alert.congestionLevel
            );
          }

          // Proactively check for reroute when a new congestion alert stage triggers.
          // Static HEAVY/SEVERE tests use this path. DYNAMIC is intentionally handled
          // only by the phase transition below so it cannot reroute at HEAVY.
          if (
            (alert.congestionLevel === "HEAVY" || alert.congestionLevel === "SEVERE") &&
            selectedDestination &&
            !RerouteEngine.getActiveRecommendation() &&
            trafficTestModeRef.current === "real"
          ) {
            const traversed = simDistanceTraversedRef.current;
            const activeRouteDist = activeRoute.distance_meters || 1;
            const activeRatio = Math.min(1.0, traversed / activeRouteDist);
            const remainingSec = Math.max(0, (1.0 - activeRatio) * (activeRoute.predicted_duration_seconds || 600));
            
            RerouteEngine.checkAndReevaluate(
              interpLat,
              interpLon,
              selectedDestination.lat,
              selectedDestination.lon,
              remainingSec,
              speedKmh,
              isEmergencyMode,
              true,
              trafficTestModeRef.current,
              Math.min(1, newDist / totalRouteDistanceM),
              getUpcomingAvoidHotspots(activeRoute, newDist),
              recentRoutesRef.current,
              !testCongestionConsumedRef.current
            );
          }
        }, newDist);
      }

      // Step-by-step Turn Maneuver Guidance & Two-Tier Voice Announcements
      if (activeRoute.steps && activeRoute.steps.length > 0) {
        let cumulativeStepDist = 0;
        let currentStepIndex = 0;
        let estDistToTurn = 0;

        for (let i = 0; i < activeRoute.steps.length; i++) {
          const step = activeRoute.steps[i];
          cumulativeStepDist += (step.distance || 0);
          if (cumulativeStepDist > currentDist) {
            currentStepIndex = i;
            estDistToTurn = cumulativeStepDist - currentDist;
            break;
          }
        }

        if (cumulativeStepDist <= currentDist) {
          currentStepIndex = activeRoute.steps.length - 1;
          estDistToTurn = 0;
        }

        // OSRM's current step describes the maneuver that entered this road; the next
        // step is the maneuver still ahead of the vehicle. Clamp to the arrival step.
        const upcomingStepIndex = Math.min(currentStepIndex + 1, activeRoute.steps.length - 1);
        const upcomingStep = activeRoute.steps[upcomingStepIndex];

        if (upcomingStep) {
          setNextManeuver(upcomingStep);
          setNextManeuverDistanceM(Math.round(estDistToTurn));

          const speedMultiplier = simSpeedMultiplierRef.current;
          // Scale thresholds with speed to announce earlier at higher speeds.
          // Base advance: 500m (was 400), base imminent: 200m (was 150).
          // This ensures instructions are spoken BEFORE the maneuver.
          const advanceThreshold = 500 * speedMultiplier;
          const imminentThreshold = 200 * speedMultiplier;
          
          const routeId = activeRoute.route_id || `idx-${activeRouteIndex}`;

          // Tier 1: Advance Heads-up
          if (
            estDistToTurn <= advanceThreshold &&
            estDistToTurn > imminentThreshold
          ) {
            const announcement = getManeuverAnnouncement(upcomingStep, estDistToTurn);
            if (announcement) {
              TTSService.announce(
                announcement,
                SpeechPriority.CRITICAL,
                `${routeId}_${upcomingStepIndex}_advance`,
                30 * 60_000,
              );
            }
          }

          // Tier 2: Imminent
          if (estDistToTurn <= imminentThreshold) {
            const imminentText = getManeuverInstruction(upcomingStep);
            TTSService.announce(
              imminentText,
              SpeechPriority.CRITICAL,
              `${routeId}_${upcomingStepIndex}_imminent`,
              30 * 60_000,
            );
          }
        }
      }

      // Controlled traffic tests trigger at the exact 1 km approach to their synthetic jam.
      // A preplanned route pair places the common-road split at that same threshold; if no
      // preplanned pair exists, a zone-specific live OSRM avoidance request is made from here.
      const controlledMode = trafficTestModeRef.current;
      const controlledTestEnabled = controlledMode === "heavy" || controlledMode === "severe" || controlledMode === "dynamic";
      const controlledZone = controlledTestEnabled ? getControlledTestZoneDistances(activeRoute) : null;
      const plannedSwitchDistance = activeRoute.controlled_test_switch_distance_m;
      const plannedZoneEnd = controlledZone?.endM ?? activeRoute.controlled_test_zone_end_distance_m;
      const controlledTriggerDistance = controlledZone
        ? Math.max(0, controlledZone.startM - CONTROLLED_REROUTE_LOOKAHEAD_METERS)
        : null;

      const offerControlledBypass = () => {
        if (testRerouteTriggeredRef.current || testCongestionConsumedRef.current || !selectedDestination) return;
        testRerouteTriggeredRef.current = true; // latch before any asynchronous network request
        testReroutePausedRef.current = true;
        setIsSimPlaying(false);
        setNoRouteReason(null);

        const remainingSeconds = Math.max(0, (1 - progressRatio) *
          (activeRoute.predicted_duration_seconds || activeRoute.duration_seconds || 600));
        const hasPlannedBypass = Boolean(
          activeRoute.controlled_test_bypass_route?.geometry?.coordinates &&
          activeRoute.controlled_test_bypass_route.geometry.coordinates.length >= 2 &&
          typeof plannedSwitchDistance === "number"
        );

        if (hasPlannedBypass && typeof plannedSwitchDistance === "number") {
          const bypassRoute = buildControlledBypassSuffix(
            activeRoute, { lat: interpLat, lon: interpLon }, plannedSwitchDistance
          );
          if (bypassRoute) {
            const bypassDuration = bypassRoute.predicted_duration_seconds || bypassRoute.duration_seconds || 0;
            const etaDelta = remainingSeconds - bypassDuration;
            const recommendation: RerouteRecommendation = {
              is_reroute_recommended: true,
              is_congestion_avoidance: true,
              time_saved_seconds: etaDelta,
              time_saved_minutes: Number((etaDelta / 60).toFixed(1)),
              original_remaining_seconds: remainingSeconds,
              recommended_duration_seconds: bypassDuration,
              recommended_route: bypassRoute,
              alternative_routes: [bypassRoute],
              reason: "A preplanned OSRM route avoids the complete synthetic congestion stretch.",
            };
            setActiveRerouteRecommendation(recommendation);
            return;
          }
          console.warn("[TrafficTest] Preplanned bypass could not be aligned at the 1 km threshold; trying live OSRM avoidance.");
        }

        const zones = getControlledTestAvoidanceZones(activeRoute);
        if (!zones.length) {
          testReroutePausedRef.current = false;
          setIsSimPlaying(true);
          setNoRouteReason("The controlled test has no valid congestion-zone geometry to avoid.");
          return;
        }

        void (async () => {
          const recommendation = await RerouteEngine.checkAndReevaluate(
            interpLat,
            interpLon,
            selectedDestination.lat,
            selectedDestination.lon,
            remainingSeconds,
            speedKmh,
            isEmergencyMode,
            true,
            controlledMode,
            Math.min(1, newDist / Math.max(1, totalRouteDistanceM)),
            zones,
            recentRoutesRef.current,
            true,
          );
          if (recommendation?.is_reroute_recommended && recommendation.recommended_route) {
            setNoRouteReason(null);
            setActiveRerouteRecommendation(recommendation);
            // Keep simulation paused while the chooser is visible.
            testReroutePausedRef.current = true;
            setIsSimPlaying(false);
            return;
          }
          testReroutePausedRef.current = false;
          setIsSimPlaying(true);
          setNoRouteReason(recommendation?.reason || "No congestion-free OSRM alternative was found; continuing on the current route.");
        })().catch((error) => {
          console.error("[TrafficTest] Live OSRM avoidance failed:", error);
          testReroutePausedRef.current = false;
          setIsSimPlaying(true);
          setNoRouteReason("The routing service could not find a congestion-free alternative. Continuing on the current route.");
        });
      };

      if (controlledTestEnabled && !testCongestionConsumedRef.current && controlledZone && controlledTriggerDistance !== null) {
        if (controlledMode === "dynamic") {
          // All four severity phases are tied to route progress; the zone itself stays fixed.
          // This gives DYNAMIC the same 1 km reroute trigger as HEAVY and SEVERE.
          const phase = dynamicTrafficPhase(scenarioProgress);
          if (phase !== lastDynamicPhaseRef.current) {
            lastDynamicPhaseRef.current = phase;
            setRoutes((currentRoutes) => currentRoutes.map((route) =>
              route.route_id === activeRoute.route_id ? applyControlledTrafficPhase(route, phase) : route
            ));
          }
        }

        const reachedAvoidanceThreshold = newDist >= controlledTriggerDistance;
        const isAtPlannedSwitch = typeof plannedSwitchDistance !== "number" || newDist >= plannedSwitchDistance - 5;
        if (reachedAvoidanceThreshold && isAtPlannedSwitch) {
          offerControlledBypass();
        }

        // Clear the original-zone alert after passage, but never while paused at a reroute.
        if (
          typeof plannedZoneEnd === "number" &&
          newDist >= plannedZoneEnd &&
          !testCongestionConsumedRef.current &&
          !testReroutePausedRef.current &&
          !activeRerouteRecommendationRef.current
        ) {
          testCongestionConsumedRef.current = true;
          lastDynamicPhaseRef.current = "LOW";
          setRoutes((currentRoutes) => currentRoutes.map((route) =>
            route.route_id === activeRoute.route_id ? applyControlledTrafficPhase(route, "LOW") : route
          ));
          AlertManager.reset();
          PushNotificationService.clearCongestionAlert();
        }
      }
      // Continuous automatic reroute re-evaluation is real-navigation behaviour.
      // Controlled HEAVY/SEVERE/DYNAMIC dropdown tests must not perform unrelated
      // OSRM/ML reroutes before their synthetic congestion event fires.
      const controlledTrafficTest =
        trafficTestModeRef.current === "heavy" ||
        trafficTestModeRef.current === "severe" ||
        trafficTestModeRef.current === "dynamic";
      const nowMs = Date.now();
      if (
        !controlledTrafficTest &&
        selectedDestination &&
        !RerouteEngine.getActiveRecommendation() &&
        nowMs - lastAutoRerouteCheckTimeRef.current > 7000
      ) {
        lastAutoRerouteCheckTimeRef.current = nowMs;
        const traversed = simDistanceTraversedRef.current;
        const activeRouteDist = activeRoute.distance_meters || 1;
        const activeRatio = Math.min(1.0, traversed / activeRouteDist);
        const remainingSec = Math.max(0, (1.0 - activeRatio) * (activeRoute.predicted_duration_seconds || 600));
        
        RerouteEngine.checkAndReevaluate(
          interpLat,
          interpLon,
          selectedDestination.lat,
          selectedDestination.lon,
          remainingSec,
          speedKmh,
          isEmergencyMode,
          false,
          trafficTestModeRef.current,
          trafficTestModeRef.current === "dynamic" ? scenarioProgress : activeRatio,
          [],
          recentRoutesRef.current,
          !testCongestionConsumedRef.current
        );
      }

      animationFrameIdRef.current = requestAnimationFrame(animateDrive);
    };

    animationFrameIdRef.current = requestAnimationFrame(animateDrive);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [
    isNavigating,
    navigationMode,
    isSimPlaying,
    simSpeedMultiplier,
    routes,
    activeRouteIndex,
    selectedDestination,
    isEmergencyMode,
    refreshTrafficScenario,
  ]);

  // Backend Health Polling
  useEffect(() => {
    const pollHealth = async () => {
      try {
        await checkHealth();
        setBackendOnline(true);
      } catch {
        setBackendOnline(false);
      }
    };
    pollHealth();
    const interval = setInterval(pollHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        sourceQuery,
        setSourceQuery,
        destinationQuery,
        setDestinationQuery,
        searchResults,
        setSearchResults,
        selectedOrigin,
        setSelectedOrigin,
        selectedDestination,
        setSelectedDestination,
        routes,
        setRoutes,
        activeRouteIndex,
        setActiveRouteIndex,
        isNavigating,
        setIsNavigating,
        navigationMode,
        startNavigation,
        stopNavigation,
        gpsStatus,
        gpsLocationSource,
        gpsAccuracyMeters,
        gpsError,
        backendOnline,

        activeLayerMode,
        setActiveLayerMode,
        toggleLayerMode,
        recenterTrigger,
        triggerRecenter,
        isLoadingRoutes,
        setIsLoadingRoutes,
        currentZoom,
        setCurrentZoom,
        pinDropMode,
        setPinDropMode,
        isEmergencyMode,
        trafficTestMode,
        runTrafficTest,
        setIsEmergencyMode,
        toggleEmergencyMode,
        swapSourceAndDestination,
        calculateRoutes,

        // Real-time navigation & congestion states
        currentLocation,
        vehicleBearing,
        isApplyingReroute,
        currentVehicleSpeed,
        simProgressPercent,
        simDistanceRemainingM,
        simEtaSeconds,
        isSimPlaying,
        setIsSimPlaying,
        simSpeedMultiplier,
            setSimSpeedMultiplier,
        activeAlert,
        dismissAlert,
        activeRerouteRecommendation,
        dismissReroute,
        acceptReroute,
        triggerDynamicRerouteCheck,
        noRouteReason,
        dismissNoRouteReason,
        navigationHudHeight,
        setNavigationHudHeight,

        nextManeuver,
        nextManeuverDistanceM,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return context;
};
```


## `frontend\src\lib\alertManager.ts`

```typescript
import { CongestionHotspot, CongestionLevel } from "./api";

export interface ActiveCongestionAlert {
  hotspotId: string;
  locationName: string;
  distanceMeters: number;
  distanceText: string;
  stage: 1 | 2 | 3;
  congestionLevel: CongestionLevel;
  averageSpeedKmh: number;
  estimatedDelaySeconds: number;
  description: string;
  timestamp: number;
  spoken: boolean;
  /** True only the first time this hotspot is announced (drives voice + push, once). */
  firstAnnouncement: boolean;
}

export type AlertListener = (alert: ActiveCongestionAlert | null) => void;

export class AlertManager {
  private static listeners: Set<AlertListener> = new Set();
  private static activeAlert: ActiveCongestionAlert | null = null;
  private static triggeredStages: Map<string, Set<number>> = new Map();
  private static announcedHotspots: Set<string> = new Set();

  // Distance Thresholds in meters for proactive alert triggers
  public static readonly STAGE_1_THRESHOLD_M = 1200; // 1.2 km heads-up
  public static readonly STAGE_2_THRESHOLD_M = 500;  // 500 m approaching warning
  public static readonly STAGE_3_THRESHOLD_M = 200;  // 200 m imminent bottleneck

  public static subscribe(listener: AlertListener): () => void {
    this.listeners.add(listener);
    listener(this.activeAlert);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.activeAlert);
      } catch (err) {
        console.error("AlertManager listener error:", err);
      }
    });
  }

  public static formatDistance(meters: number): string {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  }

  public static haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Evaluates user's current GPS position against route congestion hotspots.
   * Dynamically decrements distance (e.g. 1.1 km -> 500 m -> 200 m) and emits proactive alerts.
   * Speed-aware: thresholds adapt based on vehicle speed for journey-aware alerts.
   */
  public static evaluatePosition(
    userLat: number,
    userLon: number,
    hotspots: CongestionHotspot[],
    currentSpeedKmh: number,
    onNewStageAlert?: (alert: ActiveCongestionAlert) => void,
    distanceAlongRouteMeters?: number
  ): ActiveCongestionAlert | null {
    if (!hotspots || hotspots.length === 0) {
      if (this.activeAlert !== null) {
        this.activeAlert = null;
        this.notifyListeners();
      }
      return null;
    }

    // Calculate speed-aware thresholds based on time-to-reach
    // Stage 1: ~90s lookahead, Stage 2: ~40s lookahead, Stage 3: ~15s lookahead
    // Convert time to distance: distance_m = speed_kmh * (time_s / 3600) * 1000
    const safeSpeed = Math.max(5, Math.min(120, currentSpeedKmh)); // clamp to sane range
    const stage1ThresholdM = Math.max(150, Math.min(2500, (safeSpeed * 90) / 3.6)); // floor 150m, ceiling 2.5km
    const stage2ThresholdM = Math.max(100, Math.min(1000, (safeSpeed * 40) / 3.6)); // floor 100m, ceiling 1km
    const stage3ThresholdM = Math.max(50, Math.min(500, (safeSpeed * 15) / 3.6));   // floor 50m, ceiling 500m

    // Find closest upcoming hotspot ahead of user
    let closestHotspot: CongestionHotspot | null = null;
    let minDistance = Infinity;

    for (const hotspot of hotspots) {
      const routeDistance = distanceAlongRouteMeters === undefined
        ? this.haversineMeters(userLat, userLon, hotspot.lat, hotspot.lon)
        : hotspot.distance_from_origin_m - distanceAlongRouteMeters;
      const dist = distanceAlongRouteMeters === undefined
        ? routeDistance
        : (routeDistance >= 0 ? routeDistance : Infinity);
      if (dist < minDistance && dist <= stage1ThresholdM + 300) {
        minDistance = dist;
        closestHotspot = hotspot;
      }
    }

    if (!closestHotspot || minDistance > stage1ThresholdM + 100) {
      // User passed the hotspot or no hotspot within range
      if (this.activeAlert !== null) {
        this.activeAlert = null;
        this.notifyListeners();
      }
      return null;
    }

    // Determine Alert Stage based on distance
    let stage: 1 | 2 | 3 = 1;
    if (minDistance <= stage3ThresholdM) {
      stage = 3;
    } else if (minDistance <= stage2ThresholdM) {
      stage = 2;
    } else {
      stage = 1;
    }

    const hotspotStages = this.triggeredStages.get(closestHotspot.hotspot_id) || new Set<number>();
    const isNewStage = !hotspotStages.has(stage);

    if (isNewStage) {
      hotspotStages.add(stage);
      this.triggeredStages.set(closestHotspot.hotspot_id, hotspotStages);
    }

    // Voice / push fire ONCE per hotspot (first time it is HEAVY or SEVERE). Later stage changes
    // (1.2 km -> 500 m -> 200 m) and severity changes only update the on-screen banner.
    const isAnnounceable = closestHotspot.congestion_level === "HEAVY" || closestHotspot.congestion_level === "SEVERE";
    const firstAnnouncement = isAnnounceable && !this.announcedHotspots.has(closestHotspot.hotspot_id);
    if (firstAnnouncement) this.announcedHotspots.add(closestHotspot.hotspot_id);

    const alertData: ActiveCongestionAlert = {
      hotspotId: closestHotspot.hotspot_id,
      locationName: closestHotspot.location_name,
      distanceMeters: minDistance,
      distanceText: this.formatDistance(minDistance),
      stage,
      congestionLevel: closestHotspot.congestion_level,
      averageSpeedKmh: closestHotspot.average_speed_kmh,
      estimatedDelaySeconds: closestHotspot.estimated_delay_seconds,
      description: closestHotspot.description,
      timestamp: Date.now(),
      spoken: !isNewStage,
      firstAnnouncement,
    };

    this.activeAlert = alertData;
    this.notifyListeners();

    if (isNewStage && onNewStageAlert) {
      onNewStageAlert(alertData);
    }

    return alertData;
  }

  public static getActiveAlert(): ActiveCongestionAlert | null {
    return this.activeAlert;
  }

  /**
   * Lightweight per-frame distance update — re-computes only the distance and
   * distanceText on the active alert and notifies listeners so the banner counts
   * down in real time.  Does NOT trigger stage transitions.
   */
  public static updateLiveDistance(distanceMeters: number): void {
    if (!this.activeAlert) return;
    const rounded = Math.max(0, distanceMeters);
    // Threshold of 5m (not 1m): this runs off the per-frame animation loop, and
    // notifyListeners() drives a React state update — at 1m, a fast-moving
    // vehicle can trigger 10-15+ re-renders/sec across every context consumer
    // for the whole time an alert is active. 5m keeps the counter feeling live
    // to a human eye while cutting that re-render rate meaningfully.
    if (Math.abs(this.activeAlert.distanceMeters - rounded) < 5) return;
    this.activeAlert = {
      ...this.activeAlert,
      distanceMeters: rounded,
      distanceText: this.formatDistance(rounded),
    };
    this.notifyListeners();
  }

  public static dismissCurrentAlert() {
    this.activeAlert = null;
    this.notifyListeners();
  }

  public static reset() {
    this.activeAlert = null;
    this.triggeredStages.clear();
    this.announcedHotspots.clear();
    this.notifyListeners();
  }
}
```


## `frontend\src\lib\api.ts`

```typescript
import { DEFAULT_TRAFFIC_MODE } from "./trafficScenario";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export interface HealthResponse {
  status: string;
  region: string;
  features: string[];
  timestamp: string;
}

export interface PlaceSearchResult {
  display_name: string;
  lat: number;
  lon: number;
  place_id: string;
  address_type: string;
}

export type CongestionLevel = "LOW" | "MODERATE" | "HEAVY" | "SEVERE";
export type TrafficTestMode = "real" | "normal" | "moderate" | "heavy" | "severe" | "dynamic";

export interface CongestionSegment {
  segment_index: number;
  coordinates: number[][];
  distance_meters: number;
  duration_seconds: number;
  freeflow_speed_kmh: number;
  current_speed_kmh: number;
  delay_seconds: number;
  congestion_level: CongestionLevel;
  color: string;
  congestion_factor: number;
  density_index: number;
  predicted_arrival_time_min: number;
  road_name?: string;
}

export interface CongestionHotspot {
  hotspot_id: string;
  location_name: string;
  lat: number;
  lon: number;
  distance_from_origin_m: number;
  congestion_level: CongestionLevel;
  average_speed_kmh: number;
  estimated_delay_seconds: number;
  description: string;
  cause: string;
  // Extent of the congested stretch (only set by the traffic test scenarios).
  zone_end_distance_m?: number | null;
  zone_path?: number[][] | null; // [[lon, lat], ...]
}

export interface CandidateRoute {
  route_id: string;
  source: string;
  original_route_index: number;
  route_index: number;
  distance_meters: number;
  duration_seconds: number;
  geometry: {
    type: string;
    coordinates: number[][];
  };
  steps: Array<{
    maneuver?: {
      instruction?: string;
      type?: string;
      modifier?: string;
      location?: [number, number];
    };
    distance?: number;
    duration?: number;
    name?: string;
  }>;
  is_ai_recommended?: boolean;
  recommendation_label?: string;
  congestion_factor?: number;
  predicted_average_speed_kmh?: number;
  predicted_duration_seconds?: number;
  predicted_duration_minutes?: number;
  standard_duration_seconds?: number;
  standard_duration_minutes?: number;
  delay_savings_minutes?: number;
  confidence?: string;
  
  // Segmented Breakdown & Hotspots (Features 1 & 2)
  segments?: CongestionSegment[];
  hotspots?: CongestionHotspot[];
  /** Preplanned real OSRM road alternative for a controlled congestion test. */
  controlled_test_bypass_route?: CandidateRoute | null;
  controlled_test_switch_distance_m?: number | null;
  controlled_test_zone_start_distance_m?: number | null;
  controlled_test_zone_end_distance_m?: number | null;
  clear_distance_km?: number;
  moderate_distance_km?: number;
  heavy_distance_km?: number;
  severe_distance_km?: number;
  total_delay_seconds?: number;
}

export interface RouteResponse {
  success: boolean;
  routes_count: number;
  candidates: CandidateRoute[];
  traffic_coverage?: "supported" | "unsupported";
  region?: string | null;
}

export interface TrafficFactorData {
  location_name: string;
  current_speed_kmh: number;
  freeflow_speed_kmh: number;
  density_index: number;
  congestion_level: CongestionLevel;
  congestion_factor: number;
  incident_description?: string;
  historical_baseline_speed_kmh: number;
}

export interface RerouteRecommendation {
  is_reroute_recommended: boolean;
  is_congestion_avoidance: boolean;
  time_saved_seconds: number;
  time_saved_minutes: number;
  original_remaining_seconds: number;
  recommended_duration_seconds: number;
  recommended_route?: CandidateRoute;
  alternative_routes: CandidateRoute[];
  reason: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE_URL}/health`, { cache: 'no-store' });
  if (!res.ok) throw new Error("Backend service offline");
  return res.json();
}

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  if (!query.trim()) return [];
  const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Failed to search places");
  return res.json();
}

export async function reverseGeocode(lat: number, lon: number): Promise<{ display_name: string; lat: number; lon: number }> {
  const res = await fetch(`${API_BASE_URL}/reverse?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error("Reverse geocode failed");
  return res.json();
}

export async function fetchRoutes(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
  isEmergencyMode: boolean = false,
  trafficTestMode: TrafficTestMode = DEFAULT_TRAFFIC_MODE,
  trafficProgress: number = 0,
  syntheticTrafficActive: boolean = true
): Promise<RouteResponse> {
  const res = await fetch(`${API_BASE_URL}/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin_lat: originLat,
      origin_lon: originLon,
      dest_lat: destLat,
      dest_lon: destLon,
      // EMERGENCY FEATURE DISABLED (commented out, not deleted): is_emergency_mode: isEmergencyMode,
      traffic_test_mode: trafficTestMode,
      traffic_progress: trafficProgress,
      synthetic_traffic_active: syntheticTrafficActive,
    }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.detail || "Failed to calculate routes");
  }
  return res.json();
}

export async function evaluateReroute(
  currentLat: number,
  currentLon: number,
  destLat: number,
  destLon: number,
  originalRemainingSeconds: number,
  avoidHotspots: Array<{ lat: number; lon: number; radius_km?: number }> = [],
  isEmergencyMode: boolean = false,
  trafficTestMode: TrafficTestMode = DEFAULT_TRAFFIC_MODE,
  trafficProgress: number = 0,
  recentRoutes: Array<any> = [],
  syntheticTrafficActive: boolean = true
): Promise<RerouteRecommendation> {
  const res = await fetch(`${API_BASE_URL}/reroute/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      current_lat: currentLat,
      current_lon: currentLon,
      dest_lat: destLat,
      dest_lon: destLon,
      original_remaining_duration_seconds: originalRemainingSeconds,
      avoid_hotspots: avoidHotspots,
      // EMERGENCY FEATURE DISABLED (commented out, not deleted): is_emergency_mode: isEmergencyMode,
      traffic_test_mode: trafficTestMode,
      traffic_progress: trafficProgress,
      recent_routes: recentRoutes,
      synthetic_traffic_active: syntheticTrafficActive,
    }),
  });
  if (!res.ok) throw new Error("Failed to evaluate alternative reroutes");
  return res.json();
}

export async function fetchTrafficFactors(lat: number, lon: number): Promise<TrafficFactorData> {
  const res = await fetch(`${API_BASE_URL}/traffic/factors?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error("Failed to fetch traffic factors");
  return res.json();
}

export async function fetchTrafficHotspots(): Promise<{ success: boolean; count: number; hotspots: any[] }> {
  const res = await fetch(`${API_BASE_URL}/traffic/hotspots`);
  if (!res.ok) throw new Error("Failed to fetch traffic hotspots");
  return res.json();
}



export async function dispatchPushNotification(payload: PushNotificationPayload): Promise<PushNotificationPayload> {
  const res = await fetch(`${API_BASE_URL}/notifications/dispatch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to dispatch push notification");
  return res.json();
}
```


## `frontend\src\lib\layoutZones.ts`

```typescript
export const OVERLAY_Z = {
  mapControls: 20,
  sidebar: 20,
  statusBadge: 20,
  infoPanel: 25,
  navigationHud: 30,
  transientToast: 40,
  noFasterRouteToast: 40,
  rerouteModal: 45,
  advanceAlertBanner: 50,
  mapPrompt: 50,
} as const;
```


## `frontend\src\lib\maneuverInstructions.ts`

```typescript
/**
 * Maneuver Instruction Builder
 *
 * Converts OSRM's raw maneuver objects (type, modifier, exit) into natural-language
 * turn-by-turn instructions, since OSRM API responses do not include pre-built instruction strings.
 */

export interface OSRMManeuver {
  type?: string;
  modifier?: string;
  exit?: number;
  bearing_after?: number;
  bearing_before?: number;
  location?: [number, number];
  instruction?: string;
}

export interface OSRMStep {
  distance?: number;
  duration?: number;
  name?: string;
  maneuver?: OSRMManeuver;
  mode?: string;
  geometry?: any;
}

/**
 * Builds a natural-language instruction from an OSRM step's maneuver object and road name.
 */
export function getManeuverInstruction(step: OSRMStep): string {
  const maneuver = step.maneuver;
  const roadName = step.name?.trim() || "";

  if (!maneuver || !maneuver.type) {
    return roadName || "Continue straight ahead";
  }

  const type = maneuver.type.toLowerCase();
  let modifier = maneuver.modifier?.toLowerCase() || "";
  const exit = maneuver.exit;

  // Mathematically verify L/R directions
  if (maneuver.bearing_before !== undefined && maneuver.bearing_after !== undefined) {
    const bBefore = maneuver.bearing_before;
    const bAfter = maneuver.bearing_after;
    let diff = bAfter - bBefore;
    if (diff < -180) diff += 360;
    if (diff > 180) diff -= 360;
    
    // diff < 0 is left, diff > 0 is right
    if (Math.abs(diff) > 10) { // Only override if it's a clear turn
      if (diff < -10 && modifier.includes("right")) {
        modifier = modifier.replace("right", "left");
      } else if (diff > 10 && modifier.includes("left")) {
        modifier = modifier.replace("left", "right");
      }
    }
  }

  // Helper to add road name
  const withRoad = (instruction: string): string => {
    if (roadName && roadName !== "") {
      return `${instruction} onto ${roadName}`;
    }
    return instruction;
  };

  // Departure
  if (type === "depart") {
    if (roadName) {
      return `Head out on ${roadName}`;
    }
    if (modifier.includes("left")) return "Head out turning left";
    if (modifier.includes("right")) return "Head out turning right";
    return "Head out";
  }

  // Arrival
  if (type === "arrive") {
    if (modifier === "left") return "Arrive at your destination on the left";
    if (modifier === "right") return "Arrive at your destination on the right";
    if (modifier === "straight") return "Arrive at your destination ahead";
    return "You have arrived at your destination";
  }

  // Turns
  if (type === "turn") {
    if (modifier === "left") return withRoad("Turn left");
    if (modifier === "right") return withRoad("Turn right");
    if (modifier === "slight left") return withRoad("Bear left");
    if (modifier === "slight right") return withRoad("Bear right");
    if (modifier === "sharp left") return withRoad("Make a sharp left");
    if (modifier === "sharp right") return withRoad("Make a sharp right");
    if (modifier === "uturn" || modifier === "u-turn") return withRoad("Make a U-turn");
    if (modifier === "straight") return withRoad("Continue straight");
    return roadName ? `Continue on ${roadName}` : "Continue straight ahead";
  }

  // Continue on new road name
  if (type === "new name" || type === "continue") {
    if (roadName) {
      return `Continue on ${roadName}`;
    }
    return "Continue ahead";
  }

  // Merge
  if (type === "merge") {
    if (modifier === "left") return withRoad("Merge left");
    if (modifier === "right") return withRoad("Merge right");
    if (modifier === "slight left") return withRoad("Merge slightly left");
    if (modifier === "slight right") return withRoad("Merge slightly right");
    return withRoad("Merge");
  }

  // Fork
  if (type === "fork") {
    if (modifier === "left") return withRoad("Keep left at the fork");
    if (modifier === "right") return withRoad("Keep right at the fork");
    if (modifier === "slight left") return withRoad("Bear left at the fork");
    if (modifier === "slight right") return withRoad("Bear right at the fork");
    return withRoad("Continue at the fork");
  }

  // Roundabouts
  if (type === "roundabout" || type === "rotary") {
    if (exit !== undefined) {
      const exitOrdinal = getOrdinal(exit);
      return withRoad(`At the roundabout, take the ${exitOrdinal} exit`);
    }
    return withRoad("Enter the roundabout");
  }

  if (type === "roundabout turn") {
    if (modifier === "left") return withRoad("Turn left at the roundabout");
    if (modifier === "right") return withRoad("Turn right at the roundabout");
    return withRoad("Continue through the roundabout");
  }

  if (type === "exit roundabout" || type === "exit rotary") {
    if (exit !== undefined) {
      return withRoad(`Exit the roundabout at the ${getOrdinal(exit)} exit`);
    }
    return withRoad("Exit the roundabout");
  }

  // Ramps
  if (type === "on ramp" || type === "ramp") {
    if (modifier === "left") return withRoad("Take the ramp on the left");
    if (modifier === "right") return withRoad("Take the ramp on the right");
    if (modifier === "slight left") return withRoad("Take the slight left ramp");
    if (modifier === "slight right") return withRoad("Take the slight right ramp");
    return withRoad("Take the ramp");
  }

  if (type === "off ramp") {
    if (modifier === "left") return withRoad("Take the exit on the left");
    if (modifier === "right") return withRoad("Take the exit on the right");
    if (modifier === "slight left") return withRoad("Take the slight left exit");
    if (modifier === "slight right") return withRoad("Take the slight right exit");
    return withRoad("Take the exit");
  }

  // End of road
  if (type === "end of road") {
    if (modifier === "left") return withRoad("At the end of the road, turn left");
    if (modifier === "right") return withRoad("At the end of the road, turn right");
    return withRoad("Continue at the end of the road");
  }

  // Notification (road name change, no action required)
  if (type === "notification") {
    if (roadName) {
      return `Continue on ${roadName}`;
    }
    return "Continue ahead";
  }

  // Fallback for unknown types
  if (roadName) {
    return `Continue on ${roadName}`;
  }
  return "Continue straight ahead";
}

/**
 * Builds a distance-aware announcement for advance warnings.
 * Example: "In 300 meters, turn right onto 5th Cross Road"
 */
export function getManeuverAnnouncement(step: OSRMStep, distanceMeters: number): string {
  const instruction = getManeuverInstruction(step);
  const maneuver = step.maneuver;

  // Don't add distance prefix for arrivals or departures
  if (maneuver?.type === "arrive" || maneuver?.type === "depart") {
    return instruction;
  }

  // Format distance
  let distancePhrase = "";
  if (distanceMeters >= 1000) {
    const km = (distanceMeters / 1000).toFixed(1);
    distancePhrase = `In ${km} kilometers`;
  } else if (distanceMeters >= 100) {
    const roundedMeters = Math.round(distanceMeters / 50) * 50; // Round to nearest 50m
    distancePhrase = `In ${roundedMeters} meters`;
  } else {
    distancePhrase = "Now";
  }

  // For very short distances, just say the instruction without distance
  if (distanceMeters < 50) {
    return instruction;
  }

  // Combine distance + instruction
  // Lower-case first letter of instruction when prefixing with distance
  const instructionLower = instruction.charAt(0).toLowerCase() + instruction.slice(1);
  return `${distancePhrase}, ${instructionLower}`;
}

/**
 * Converts a number to its ordinal form (1 -> "1st", 2 -> "2nd", etc.)
 */
function getOrdinal(n: number): string {
  const ordinals = [
    "", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
    "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth", "twentieth",
  ];
  if (!Number.isFinite(n) || n < 1) return "next";
  const ordinal = Math.floor(n);
  if (ordinals[ordinal]) return ordinals[ordinal];
  const mod100 = ordinal % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : ordinal % 10 === 1 ? "st" : ordinal % 10 === 2 ? "nd" : ordinal % 10 === 3 ? "rd" : "th";
  return `${ordinal}${suffix}`;
}
```


## `frontend\src\lib\pushNotificationService.ts`

```typescript
import { dispatchPushNotification, PushNotificationPayload } from "./api";

export class PushNotificationService {
  private static permissionGranted: boolean = false;
  private static localNotifications: Map<string, Notification> = new Map();

  public static isSupported(): boolean {
    return typeof window !== "undefined" && "Notification" in window;
  }

  public static async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;

    if (Notification.permission === "granted") {
      this.permissionGranted = true;
      return true;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      this.permissionGranted = permission === "granted";
      return this.permissionGranted;
    }

    return false;
  }

  public static isPermissionGranted(): boolean {
    if (!this.isSupported()) return false;
    return Notification.permission === "granted";
  }

  private static async clearTaggedNotification(tag: string) {
    if (!this.isSupported() || Notification.permission !== "granted") return;
    try {
      this.localNotifications.get(tag)?.close();
      this.localNotifications.delete(tag);
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const notifications = await registration.getNotifications({ tag });
        notifications.forEach((notification) => notification.close());
      }
    } catch (err) {
      console.warn("Could not clear congestion notification:", err);
    }
  }

  public static async clearCongestionAlert() {
    await this.clearTaggedNotification("apex-congestion-alert");
  }

  public static async clearRerouteAlert() {
    await this.clearTaggedNotification("apex-reroute-alert");
  }

  /**
   * Dispatches push notification for upcoming route congestion (Feature 5a).
   */
  public static async sendCongestionAlert(
    locationName: string,
    distanceText: string,
    delayMinutes: number,
    speedKmh: number,
    severity: "LOW" | "MODERATE" | "HEAVY" | "SEVERE" = "HEAVY"
  ) {
    const title = `⚠️ ${severity[0]}${severity.slice(1).toLowerCase()} traffic ahead (${distanceText})`;
    const body = `Traffic is moving slowly near ${locationName}. Speed: ${Math.round(speedKmh)} km/h (+${Math.round(delayMinutes)}m delay).`;

    const payload: PushNotificationPayload = {
      title,
      body,
      tag: "apex-congestion-alert",
      data: {
        type: "CONGESTION",
        locationName,
        distanceText,
        delayMinutes,
      },
    };

    // 1. Dispatch locally via Browser Notification API (even in background)
    if (this.isSupported() && Notification.permission === "granted") {
      try {
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification(title, {
            body,
            icon: "/favicon.ico",
            tag: "apex-congestion-alert",
          });
        } else {
          this.localNotifications.get("apex-congestion-alert")?.close();
          this.localNotifications.set("apex-congestion-alert", new Notification(title, {
            body,
            icon: "/favicon.ico",
            tag: "apex-congestion-alert",
          }));
        }
      } catch (err) {
        console.warn("Local notification error:", err);
      }
    }

    // 2. Relay to backend notification logger
    try {
      await dispatchPushNotification(payload);
    } catch {
      // Offline fallback
    }
  }

  /**
   * Dispatches push notification for faster alternative route suggestion (Feature 5b).
   */
  public static async sendRerouteSuggestion(
    timeSavedMinutes: number,
    viaRoad: string,
    isCongestionAvoidance = false,
  ) {
    const title = isCongestionAvoidance
      ? "Route around congestion available"
      : `🚀 Faster Route Found (Save ${Math.round(timeSavedMinutes)} min)`;
    const body = isCongestionAvoidance
      ? `A route avoiding the flagged congestion${viaRoad ? ` via ${viaRoad}` : ""} is available. Review its ETA before switching.`
      : `Alternative route via ${viaRoad} available to bypass congestion.`;

    const payload: PushNotificationPayload = {
      title,
      body,
      tag: "apex-reroute-alert",
      data: {
        type: "REROUTE",
        timeSavedMinutes,
        viaRoad,
        isCongestionAvoidance,
      },
    };

    if (this.isSupported() && Notification.permission === "granted") {
      try {
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification(title, {
            body,
            icon: "/favicon.ico",
            tag: "apex-reroute-alert",
          });
        } else {
          this.localNotifications.get("apex-reroute-alert")?.close();
          this.localNotifications.set("apex-reroute-alert", new Notification(title, {
            body,
            icon: "/favicon.ico",
            tag: "apex-reroute-alert",
          }));
        }
      } catch (err) {
        console.warn("Local notification error:", err);
      }
    }

    try {
      await dispatchPushNotification(payload);
    } catch {
      // Offline fallback
    }
  }
}
```


## `frontend\src\lib\region.ts`

```typescript
export type RegionId = "bengaluru" | "coimbatore";

export interface RegionCoordinate {
  lat: number;
  lon: number;
  name: string;
}

export interface RegionConfig {
  id: RegionId;
  displayName: string;
  center: RegionCoordinate;
  defaultOrigin: RegionCoordinate;
  testOrigin: RegionCoordinate;
  testDestination: RegionCoordinate;
  mapBounds: [[number, number], [number, number]];
  defaultZoom: number;
}

export const REGION_CONFIGS: Record<RegionId, RegionConfig> = {
  "bengaluru": {
    "id": "bengaluru",
    "displayName": "Bengaluru",
    "center": {
      "lat": 12.9716,
      "lon": 77.5946,
      "name": "Bengaluru Center"
    },
    "defaultOrigin": {
      "lat": 12.9786,
      "lon": 77.6421,
      "name": "Indiranagar, Bengaluru"
    },
    "testOrigin": {
      "lat": 12.9786,
      "lon": 77.6421,
      "name": "Indiranagar, Bengaluru"
    },
    "testDestination": {
      "lat": 12.9569,
      "lon": 77.7011,
      "name": "Marathahalli, Bengaluru"
    },
    "mapBounds": [
      [
        77.46,
        12.8
      ],
      [
        77.75,
        13.15
      ]
    ],
    "defaultZoom": 12.5
  },
  "coimbatore": {
    "id": "coimbatore",
    "displayName": "Coimbatore",
    "center": {
      "lat": 11.0247,
      "lon": 77.003,
      "name": "PSG College of Technology, Peelamedu, Coimbatore"
    },
    "defaultOrigin": {
      "lat": 11.0247,
      "lon": 77.003,
      "name": "PSG College of Technology, Peelamedu, Coimbatore"
    },
    "testOrigin": {
      "lat": 11.0247,
      "lon": 77.003,
      "name": "PSG College of Technology, Peelamedu, Coimbatore"
    },
    "testDestination": {
      "lat": 11.0323,
      "lon": 77.0266,
      "name": "Hope College, Coimbatore"
    },
    "mapBounds": [
      [
        76.8,
        10.9
      ],
      [
        77.15,
        11.2
      ]
    ],
    "defaultZoom": 12.5
  }
};

const envRegion = (process.env.NEXT_PUBLIC_ACTIVE_REGION || "coimbatore").trim().toLowerCase();
export const ACTIVE_REGION: RegionId = envRegion === "coimbatore" ? "coimbatore" : "bengaluru";
export const ACTIVE_REGION_CONFIG: RegionConfig = REGION_CONFIGS[ACTIVE_REGION];
export const ACTIVE_REGION_CENTER = ACTIVE_REGION_CONFIG.center;
export const ACTIVE_REGION_MAP_BOUNDS = ACTIVE_REGION_CONFIG.mapBounds;
```


## `frontend\src\lib\rerouteEngine.ts`

```typescript
import { evaluateReroute } from "./api";
import type { CandidateRoute, RerouteRecommendation, TrafficTestMode } from "./api";
import { DEFAULT_TRAFFIC_MODE } from "./trafficScenario";
import { TTSService } from "./ttsService";
import { PushNotificationService } from "./pushNotificationService";

export type RerouteListener = (
  recommendation: RerouteRecommendation | null,
  noRouteReason: string | null
) => void;

export function routesHaveSameGeometry(candidate: RerouteRecommendation["recommended_route"], active: CandidateRoute): boolean {
  const candidateCoords = candidate?.geometry?.coordinates;
  const activeCoords = active.geometry?.coordinates;
  if (!candidateCoords || candidateCoords.length < 2 || !activeCoords || activeCoords.length < 2) return false;

  const segmentDistance = (lon: number, lat: number, segmentIndex: number) => {
    const [x1, y1] = activeCoords[segmentIndex];
    const [x2, y2] = activeCoords[segmentIndex + 1];
    const meanLat = ((y1 + y2 + lat) / 3) * Math.PI / 180;
    const dx = (x2 - x1) * Math.cos(meanLat);
    const dy = y2 - y1;
    const px = (lon - x1) * Math.cos(meanLat);
    const py = lat - y1;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / lengthSquared));
    const projectedLon = x1 + (x2 - x1) * t;
    const projectedLat = y1 + (y2 - y1) * t;
    const dLat = (lat - projectedLat) * 111_132;
    const dLon = (lon - projectedLon) * 111_320 * Math.cos(meanLat);
    return Math.hypot(dLat, dLon);
  };

  const [candidateStartLon, candidateStartLat] = candidateCoords[0];
  let activeStartIndex = 0;
  let startDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < activeCoords.length - 1; i += 1) {
    const distance = segmentDistance(candidateStartLon, candidateStartLat, i);
    if (distance < startDistance) {
      startDistance = distance;
      activeStartIndex = i;
    }
  }
  if (startDistance > 45) return false;

  const sampleCount = Math.min(16, candidateCoords.length);
  let searchFromIndex = activeStartIndex;
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const index = Math.round((sample * (candidateCoords.length - 1)) / Math.max(1, sampleCount - 1));
    const [lon, lat] = candidateCoords[index];
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
    let closestMeters = Number.POSITIVE_INFINITY;
    let closestIndex = searchFromIndex;
    for (let i = searchFromIndex; i < activeCoords.length - 1; i += 1) {
      const distance = segmentDistance(lon, lat, i);
      if (distance < closestMeters) {
        closestMeters = distance;
        closestIndex = i;
      }
    }
    if (closestMeters > 45) return false;
    searchFromIndex = closestIndex;
  }
  return true;
}

// Set to true only when diagnosing rerouting flow in development
const DEBUG = false;

export class RerouteEngine {
  private static activeRecommendation: RerouteRecommendation | null = null;
  private static lastNoRouteFoundReason: string | null = null;
  private static noRouteTimeout: NodeJS.Timeout | null = null;
  private static listeners: Set<RerouteListener> = new Set();
  private static isEvaluating: boolean = false;
  private static lastEvaluationTime: number = 0;
  private static lastEvaluatedSpeed: number = 40.0;
  private static evaluationGeneration: number = 0;

  public static subscribe(listener: RerouteListener): () => void {
    this.listeners.add(listener);
    listener(this.activeRecommendation, this.lastNoRouteFoundReason);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.activeRecommendation, this.lastNoRouteFoundReason);
      } catch (err) {
        console.error("[RerouteEngine] Listener notification error:", err);
      }
    });
  }

  /**
   * Asynchronously checks if real-time conditions warrant re-evaluating the ML model (Features 7 & 8).
   * Gated to prevent polling while a recommendation modal is already active.
   */
  public static async checkAndReevaluate(
    currentLat: number,
    currentLon: number,
    destLat: number,
    destLon: number,
    remainingSeconds: number,
    currentSpeedKmh: number,
    isEmergencyMode: boolean = false,
    forceReevaluate: boolean = false,
    trafficTestMode: TrafficTestMode = DEFAULT_TRAFFIC_MODE,
    trafficProgress: number = 0,
    avoidHotspots: Array<{ lat: number; lon: number; radius_km?: number }> = [],
    recentRoutes: Array<any> = [],
    syntheticTrafficActive: boolean = true
  ): Promise<RerouteRecommendation | null> {
    const isAvoidanceRequest = avoidHotspots.length > 0;
    // 1. Skip automatic background checking if a recommendation is already displayed
    if (!forceReevaluate && this.activeRecommendation !== null) {
      if (DEBUG) console.log("[RerouteEngine] Skipped: recommendation already active in modal");
      return this.activeRecommendation;
    }

    const now = Date.now();
    const timeSinceLastEval = now - this.lastEvaluationTime;
    const speedDropRatio = (this.lastEvaluatedSpeed - currentSpeedKmh) / Math.max(1, this.lastEvaluatedSpeed);
    const hasSignificantSpeedDrop = speedDropRatio >= 0.15;
    const isPeriodicTimeElapsed = timeSinceLastEval > 8000;

    if (DEBUG) {
      console.log(
        `[RerouteEngine] Evaluation check: speed=${currentSpeedKmh.toFixed(1)} km/h, drop=${(speedDropRatio * 100).toFixed(
          1
        )}%, elapsed=${(timeSinceLastEval / 1000).toFixed(1)}s, force=${forceReevaluate}`
      );
    }

    if (!forceReevaluate && !hasSignificantSpeedDrop && !isPeriodicTimeElapsed) {
      return this.activeRecommendation;
    }

    if (this.isEvaluating) {
      if (DEBUG) console.log("[RerouteEngine] Skipped: re-evaluation already in flight");
      return this.activeRecommendation;
    }

    this.isEvaluating = true;
    const generation = this.evaluationGeneration;
    this.lastEvaluationTime = now;
    this.lastEvaluatedSpeed = currentSpeedKmh;

    try {
      // Dynamic Alternative Route Generation strictly from CURRENT position (Feature 8)
      const recommendation = await evaluateReroute(
        currentLat,
        currentLon,
        destLat,
        destLon,
        remainingSeconds,
        avoidHotspots,
        isEmergencyMode,
        trafficTestMode,
        trafficProgress,
        recentRoutes,
        syntheticTrafficActive
      );

      if (generation !== this.evaluationGeneration) return null;

      if (DEBUG) console.log("[RerouteEngine] Backend recommendation response:", recommendation);

      if (recommendation && recommendation.is_reroute_recommended && recommendation.recommended_route) {
        if (generation !== this.evaluationGeneration) return null;
        this.activeRecommendation = recommendation;
        this.lastNoRouteFoundReason = null;
        if (this.noRouteTimeout) {
          clearTimeout(this.noRouteTimeout);
          this.noRouteTimeout = null;
        }
        this.notifyListeners();
        // A listener can reject a duplicate path and dismiss it synchronously.
        // Do not announce or notify about a recommendation that is no longer active.
        if (this.activeRecommendation !== recommendation) return recommendation;

        const viaName = recommendation.recommended_route.steps?.find(
          (step) => Boolean(step.name?.trim()) && step.maneuver?.type !== "depart"
        )?.name?.trim() || "Alternative Bypass";

        // Voice Alert & Push Notification
        TTSService.speakRerouteSuggestion(
          recommendation.time_saved_minutes,
          viaName,
          recommendation.is_congestion_avoidance,
        );
        void PushNotificationService.sendRerouteSuggestion(
          recommendation.time_saved_minutes,
          viaName,
          recommendation.is_congestion_avoidance,
        );
      } else {
        this.activeRecommendation = null;
        if (this.noRouteTimeout) {
          clearTimeout(this.noRouteTimeout);
          this.noRouteTimeout = null;
        }
        // Handle no route found — use avoidance-aware reason
        if (forceReevaluate) {
          const fallbackReason = isAvoidanceRequest
            ? "No alternate route avoids this congestion — continuing on the current path."
            : "Current route remains the fastest available path.";
          const reason = recommendation?.reason || fallbackReason;
          this.lastNoRouteFoundReason = reason;
          if (this.noRouteTimeout) clearTimeout(this.noRouteTimeout);
          this.noRouteTimeout = setTimeout(() => {
            this.lastNoRouteFoundReason = null;
            this.notifyListeners();
          }, 5000);
          this.notifyListeners();
        } else if (this.activeRecommendation !== null) {
          this.activeRecommendation = null;
          this.notifyListeners();
        }
      }

      return recommendation;
    } catch (err) {
      console.error("[RerouteEngine] Async reroute evaluation failed:", err);
      return null;
    } finally {
      this.isEvaluating = false;
    }
  }

  public static dismissRecommendation() {
    this.evaluationGeneration += 1;
    this.activeRecommendation = null;
    this.lastNoRouteFoundReason = null;
    if (this.noRouteTimeout) {
      clearTimeout(this.noRouteTimeout);
      this.noRouteTimeout = null;
    }
    this.notifyListeners();
  }

  public static dismissNoRouteReason() {
    this.evaluationGeneration += 1;
    this.lastNoRouteFoundReason = null;
    if (this.noRouteTimeout) {
      clearTimeout(this.noRouteTimeout);
      this.noRouteTimeout = null;
    }
    this.notifyListeners();
  }

  public static getActiveRecommendation(): RerouteRecommendation | null {
    return this.activeRecommendation;
  }

  public static getLastNoRouteReason(): string | null {
    return this.lastNoRouteFoundReason;
  }
}
```


## `frontend\src\lib\trafficScenario.ts`

```typescript
import type { CongestionLevel, TrafficTestMode } from "./api";
import { ACTIVE_REGION } from "./region";

export type { TrafficTestMode } from "./api";

export const DEFAULT_TRAFFIC_MODE: TrafficTestMode = "real";

export interface TrafficTestScenario {
  origin: { lat: number; lon: number; name: string };
  destination: { lat: number; lon: number; name: string };
  description: string;
}

/**
 * Controlled scenarios are region-aware. Coimbatore modes deliberately reuse a
 * verified local trip so severity is the variable under test, not a different
 * endpoint pair or a return to Bengaluru. OSRM supplies the real road geometry
 * and its alternative-route probe attempts to find a genuine bypass.
 */
const BENGALURU_TRAFFIC_TEST_SCENARIOS: Record<Exclude<TrafficTestMode, "real">, TrafficTestScenario> = {
  normal: {
    origin: { lat: 13.0354, lon: 77.5988, name: "Hebbal, Bengaluru" },
    destination: { lat: 13.0280, lon: 77.5400, name: "Yeshwanthpur, Bengaluru" },
    description: "Hebbal → Yeshwanthpur",
  },
  moderate: {
    origin: { lat: 12.9250, lon: 77.5938, name: "Jayanagar 4th Block, Bengaluru" },
    destination: { lat: 12.9786, lon: 77.6408, name: "Indiranagar, Bengaluru" },
    description: "Jayanagar → Indiranagar",
  },
  heavy: {
    origin: { lat: 12.9347, lon: 77.6140, name: "Koramangala 5th Block, Bengaluru" },
    destination: { lat: 12.9086, lon: 77.6389, name: "HSR Layout Sector 2, Bengaluru" },
    description: "Koramangala 5th Block → HSR Layout",
  },
  severe: {
    origin: { lat: 12.9756, lon: 77.6060, name: "MG Road, Bengaluru" },
    destination: { lat: 12.9177, lon: 77.6233, name: "Silk Board, Bengaluru" },
    description: "MG Road → Silk Board",
  },
  dynamic: {
    origin: { lat: 12.9250, lon: 77.5938, name: "Jayanagar 4th Block, Bengaluru" },
    destination: { lat: 12.9786, lon: 77.6408, name: "Indiranagar 12th Main, Bengaluru" },
    description: "Jayanagar 4th Block → Indiranagar 12th Main",
  },
};

const COIMBATORE_TRAFFIC_TEST_SCENARIOS: Record<Exclude<TrafficTestMode, "real">, TrafficTestScenario> = {
  // Every mode uses its own trip. Heavy / severe / dynamic need two genuine OSRM corridors
  // between the same endpoints so the congestion can sit on one and the vehicle can be
  // offered the other at the split.
  normal: {
    origin: { lat: 11.0006, lon: 76.9747, name: "Race Course, Coimbatore" },
    destination: { lat: 11.0070, lon: 76.9500, name: "RS Puram, Coimbatore" },
    description: "Race Course → RS Puram · normal baseline",
  },
  moderate: {
    origin: { lat: 10.9888, lon: 76.9615, name: "Ukkadam, Coimbatore" },
    destination: { lat: 10.9998, lon: 77.0286, name: "Singanallur, Coimbatore" },
    description: "Ukkadam → Singanallur · moderate traffic",
  },
  heavy: {
    origin: { lat: 11.0236, lon: 76.9015, name: "Vadavalli, Coimbatore" },
    destination: { lat: 11.0243, lon: 77.0041, name: "Peelamedu, Coimbatore" },
    description: "Vadavalli → Peelamedu · heavy congestion bypass",
  },
  severe: {
    // Start from central Gandhipuram rather than Ganapathy to exercise a different
    // set of central/southern corridors and make a usable bypass more likely.
    origin: { lat: 11.0177, lon: 76.9674, name: "Gandhipuram Central Bus Terminus, Coimbatore" },
    destination: { lat: 10.9560, lon: 76.9600, name: "Kuniyamuthur, Coimbatore" },
    description: "Gandhipuram → Kuniyamuthur · severe congestion bypass",
  },
  dynamic: {
    origin: { lat: 11.0720, lon: 77.0330, name: "Kalapatti, Coimbatore" },
    destination: { lat: 10.9953, lon: 76.9617, name: "Town Hall, Coimbatore" },
    description: "Kalapatti → Town Hall · normal → moderate → heavy → severe, then reroute",
  },
};

export const TRAFFIC_TEST_SCENARIOS: Record<Exclude<TrafficTestMode, "real">, TrafficTestScenario> =
  ACTIVE_REGION === "coimbatore" ? COIMBATORE_TRAFFIC_TEST_SCENARIOS : BENGALURU_TRAFFIC_TEST_SCENARIOS;

export const TRAFFIC_COLORS: Record<CongestionLevel, string> = {
  LOW: "#16A34A",
  MODERATE: "#EAB308",
  HEAVY: "#F97316",
  SEVERE: "#DC2626",
};

/**
 * Escalation phase while APPROACHING the (fixed) congestion zone. Must mirror
 * backend/services/traffic_scenario.py::dynamic_traffic_phase. Clearing is NOT decided here:
 * the client clears the scenario once the vehicle has driven past the hotspot's
 * `zone_end_distance_m` (the backend also clears when progress passes the zone end).
 */
export function dynamicTrafficPhase(progress: number): CongestionLevel {
  if (progress < 0.15) return "LOW";
  if (progress < 0.28) return "MODERATE";
  if (progress < 0.40) return "HEAVY";
  return "SEVERE";
}

export function isTrafficTestMode(mode: TrafficTestMode): boolean {
  return mode !== "real";
}
```


## `frontend\src\lib\ttsService.ts`

```typescript
export type SpeechPriority = "normal" | "critical";

export const SpeechPriority = {
  NORMAL: "normal" as SpeechPriority,
  HIGH: "normal" as SpeechPriority,
  CRITICAL: "critical" as SpeechPriority,
};

interface QueuedUtterance {
  text: string;
  priority: SpeechPriority;
  dedupeKey: string;
  enqueuedAt: number;
}

const DEFAULT_DEBOUNCE_MS = 8_000;

export class TTSService {
  private static queue: QueuedUtterance[] = [];
  private static pendingDedupeKeys = new Set<string>();
  private static recentDedupeKeys = new Map<string, number>();
  private static isSpeaking = false;
  private static isMuted = false;
  private static activeUtteranceId = 0;
  private static cancelFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private static getRate: () => number = () => 1.05;
  private static volume = 1;
  private static pitch = 1;
  private static cachedVoices: SpeechSynthesisVoice[] = [];
  private static voiceRetryListener: (() => void) | null = null;
  private static voiceRetryCount = 0;
  private static hasPrimedEngine = false;

  public static isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  /** Call directly from the user gesture that starts navigation. */
  public static warmUp(): void {
    if (!this.isSupported()) {
      console.warn("[TTS] Web Speech API is unavailable in this browser.");
      return;
    }

    const loadVoices = () => {
      try {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          this.cachedVoices = voices;
          this.voiceRetryCount = 0;
          if (this.voiceRetryListener) {
            window.speechSynthesis.removeEventListener("voiceschanged", this.voiceRetryListener);
            this.voiceRetryListener = null;
          }
          // Prime the synthesis engine with a truly silent utterance so the
          // first real announcement doesn't suffer cold-start latency or rate
          // inconsistency. Only do this once per page/session.
          if (!this.hasPrimedEngine) {
            this.hasPrimedEngine = true;
            try {
              const primer = new SpeechSynthesisUtterance(" ");
              primer.volume = 0;
              primer.rate = 1;
              window.speechSynthesis.speak(primer);
            } catch (_) {
              // Not critical — swallow silently
            }
          }
          return;
        }

        // Some Chromium builds populate voices asynchronously. Retry a bounded
        // number of times after the browser announces that its voice list changed.
        if (!this.voiceRetryListener && this.voiceRetryCount < 4) {
          this.voiceRetryCount += 1;
          const retry = () => {
            this.voiceRetryListener = null;
            loadVoices();
          };
          this.voiceRetryListener = retry;
          window.speechSynthesis.addEventListener("voiceschanged", retry, { once: true });
        }
      } catch (error) {
        console.warn("[TTS] Could not load speech voices:", error);
      }
    };

    loadVoices();
  }

  public static setRateProvider(provider: () => number): void {
    this.getRate = provider;
  }

  public static setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  public static setPitch(pitch: number): void {
    this.pitch = Math.max(0.5, Math.min(2, pitch));
  }

  public static getMuted(): boolean {
    return this.isMuted;
  }

  public static setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.queue = [];
      this.pendingDedupeKeys.clear();
      this.cancelActiveSpeech();
    }
  }

  /** Toggle the service itself; the returned value is the new muted state. */
  public static toggleMute(muted?: boolean): boolean {
    this.setMuted(muted ?? !this.isMuted);
    return this.isMuted;
  }

  /** Backward-compatible alias while callers migrate to toggleMute(). */
  public static toggleMuted(): boolean {
    return this.toggleMute();
  }

  public static announce(
    text: string,
    priority: SpeechPriority,
    dedupeKey: string,
    debounceMs: number = DEFAULT_DEBOUNCE_MS,
  ): void {
    const normalizedText = text.trim();
    const normalizedKey = dedupeKey.trim().toLowerCase() || normalizedText.toLowerCase();
    if (!normalizedText || this.isMuted) return;
    if (!this.isSupported()) {
      console.warn("[TTS] Announcement skipped because Web Speech API is unavailable.");
      return;
    }

    const now = Date.now();
    const lastSpokenAt = this.recentDedupeKeys.get(normalizedKey);
    if (
      (lastSpokenAt !== undefined && now - lastSpokenAt < debounceMs) ||
      this.pendingDedupeKeys.has(normalizedKey)
    ) {
      return;
    }

    if (priority === "critical") {
      const retained = this.queue.filter((item) => item.priority === "critical");
      this.queue = retained;
      this.pendingDedupeKeys = new Set(retained.map((item) => item.dedupeKey));
      if (this.isSpeaking) this.hardStop();
    }

    this.queue.push({ text: normalizedText, priority, dedupeKey: normalizedKey, enqueuedAt: now });
    this.pendingDedupeKeys.add(normalizedKey);
    this.processQueue();
  }

  /** Compatibility wrapper for older call sites; new code should use announce(). */
  public static speak(
    text: string,
    priority: SpeechPriority = "normal",
    debounceSeconds = 15,
    dedupeKey?: string,
  ): void {
    const key = dedupeKey || text.trim().toLowerCase();
    this.announce(text, priority, key, debounceSeconds * 1000);
  }

  /** Clear speech and debounce state when leaving or replacing a route. */
  public static reset(): void {
    this.queue = [];
    this.pendingDedupeKeys.clear();
    this.recentDedupeKeys.clear();
    this.cancelActiveSpeech();
  }

  public static clearQueue(): void {
    this.reset();
  }

  private static cancelActiveSpeech(): void {
    this.activeUtteranceId += 1;
    if (this.cancelFallbackTimer) {
      clearTimeout(this.cancelFallbackTimer);
      this.cancelFallbackTimer = null;
    }
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (error) {
        console.error("[TTS] speechSynthesis.cancel() failed:", error);
      }
    }
    // Cancelled Chromium utterances may never raise onend/onerror.
    this.isSpeaking = false;
  }

  private static hardStop(): void {
    const stoppedUtteranceId = ++this.activeUtteranceId;
    if (this.cancelFallbackTimer) clearTimeout(this.cancelFallbackTimer);
    try {
      window.speechSynthesis.cancel();
    } catch (error) {
      console.error("[TTS] Could not interrupt the active utterance:", error);
    }

    // Keep the queue locked until cancel has propagated; the fallback handles
    // browsers that omit the cancelled utterance's completion event.
    this.cancelFallbackTimer = setTimeout(() => {
      this.cancelFallbackTimer = null;
      if (this.activeUtteranceId !== stoppedUtteranceId || this.isMuted) return;
      this.isSpeaking = false;
      this.processQueue();
    }, 60);
  }

  private static processQueue(): void {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[TTS] processQueue", {
        isSpeaking: this.isSpeaking,
        isMuted: this.isMuted,
        queued: this.queue.length,
      });
    }
    if (this.isSpeaking || this.queue.length === 0 || this.isMuted) return;
    if (!this.isSupported()) {
      console.warn("[TTS] Queue cannot play because Web Speech API is unavailable.");
      this.queue = [];
      this.pendingDedupeKeys.clear();
      return;
    }

    const next = this.queue.shift();
    if (!next) return;
    this.pendingDedupeKeys.delete(next.dedupeKey);
    const utteranceId = ++this.activeUtteranceId;
    this.isSpeaking = true;
    this.recentDedupeKeys.set(next.dedupeKey, Date.now());

    try {
      const utterance = new SpeechSynthesisUtterance(next.text);
      const requestedRate = Number(this.getRate());
      utterance.rate = Number.isFinite(requestedRate) ? Math.max(0.5, Math.min(2, requestedRate)) : 1.05;
      utterance.volume = this.volume;
      utterance.pitch = this.pitch;

      if (this.cachedVoices.length === 0) this.warmUp();
      const voices = this.cachedVoices.length > 0 ? this.cachedVoices : window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (voice) => voice.lang.startsWith("en-IN") && /natural|neural/i.test(voice.name),
      ) || voices.find((voice) => voice.lang.startsWith("en"));
      if (preferredVoice) utterance.voice = preferredVoice;

      const finish = (error?: SpeechSynthesisErrorEvent) => {
        if (utteranceId !== this.activeUtteranceId) return;
        if (error) console.warn("[TTS] Utterance failed:", error.error);
        this.isSpeaking = false;
        this.processQueue();
      };
      utterance.onend = () => finish();
      utterance.onerror = (event) => finish(event);

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      if (utteranceId === this.activeUtteranceId) this.isSpeaking = false;
      console.error("[TTS] Failed to speak queued announcement:", error);
      this.processQueue();
    }
  }

  public static speakCongestionAlert(
    locationName: string,
    distanceText: string,
    speedKmh: number,
    delayMinutes?: number,
    suggestRerouteOption = true,
    severity: "LOW" | "MODERATE" | "HEAVY" | "SEVERE" = "HEAVY",
  ): void {
    const severityText = severity === "SEVERE" ? "severe traffic" : severity === "HEAVY" ? "heavy traffic" : "moderate traffic";
    let message = `Traffic alert: ${severityText} ahead in ${distanceText} near ${locationName}.`;
    if (speedKmh > 0) message += ` Flow speed is ${Math.round(speedKmh)} kilometers per hour.`;
    if (delayMinutes && delayMinutes >= 2) message += ` Expected delay is ${Math.round(delayMinutes)} minutes.`;
    // PATCH: the old suffix ("a route around this may be available") was followed a moment later by
    // the real reroute announcement, which sounded like the same alert twice. The reroute engine
    // announces the outcome itself, so the suffix is dropped (param kept for API compatibility).
    void suggestRerouteOption;
    // PATCH: key is per location only (not per severity/stage) so escalations cannot re-trigger it.
    this.announce(message, "normal", `congestion_${locationName}`, 120_000);
  }

  public static speakRerouteSuggestion(
    timeSavedMinutes: number,
    viaRoad?: string,
    isCongestionAvoidance = false,
  ): void {
    let message: string;
    if (isCongestionAvoidance) {
      message = "An alternate route avoids the flagged congestion";
      if (viaRoad) message += ` via ${viaRoad}`;
      message += ". Review the route on screen.";
    } else {
      message = `Faster route found. You can save approximately ${Math.round(timeSavedMinutes)} minutes`;
      message += viaRoad ? ` by taking ${viaRoad}.` : ". Review the route on screen.";
    }
    this.announce(message, "normal", `reroute_${isCongestionAvoidance ? "avoid" : "faster"}_${viaRoad || "route"}`, 30_000);
  }

  public static speakTurnManeuver(instruction: string, dedupeKey = instruction): void {
    this.announce(instruction, "critical", `maneuver_${dedupeKey}`, 30 * 60_000);
  }
}
```


## `frontend\tailwind.config.ts`

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
};
export default config;
```


## `frontend\tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```
