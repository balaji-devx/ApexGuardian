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