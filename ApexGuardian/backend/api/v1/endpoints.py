from datetime import datetime, timezone
import logging
import uuid
import math
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query, Body
from core.region import BengaluruRegionManager
from schemas.navigation import (
    LocationSearchResponse, 
    RouteRequest, 
    RouteResponse, 
    CandidateRoute,
    TrafficFactorsRequest,
    TrafficFactorData,
    RerouteRequest,
    RerouteRecommendation,
    PushNotificationPayload
)
from services.nominatim import NominatimService
from services.osrm import OSRMService
from services.traffic_service import LiveTrafficService
from services.congestion_detector import CongestionDetector
from services.reroute_engine import DynamicRerouteEngine
from services.notification_service import PushNotificationService
from ml.recommender import RouteScorer

logger = logging.getLogger("apexguardian.api")
router = APIRouter()

@router.get("/health")
async def health_check():
    return {
        "status": "online",
        "region": "Bengaluru",
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
    origin_in_bounds = BengaluruRegionManager.is_within_bounds(request.origin_lat, request.origin_lon)
    dest_in_bounds = BengaluruRegionManager.is_within_bounds(request.dest_lat, request.dest_lon)

    if not origin_in_bounds:
        logger.warning(f"Origin coordinates ({request.origin_lat}, {request.origin_lon}) are outside Bengaluru bounding box.")
    if not dest_in_bounds:
        logger.warning(f"Destination coordinates ({request.dest_lat}, {request.dest_lon}) are outside Bengaluru bounding box.")

    try:
        # 1. Fetch High-Resolution OSRM Street Driving Polylines
        raw_candidates = await OSRMService.get_routes(
            origin_lat=request.origin_lat,
            origin_lon=request.origin_lon,
            dest_lat=request.dest_lat,
            dest_lon=request.dest_lon
        )

        # 2. Evaluate Candidates with Route-Level ML Model
        ml_evaluated_candidates = RouteScorer.evaluate_routes(
            raw_candidates,
            request.origin_lat,
            request.origin_lon,
            request.dest_lat,
            request.dest_lon,
            is_emergency_mode=request.is_emergency_mode
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
            candidate["original_route_index"] = candidate.get("route_index", 0)

            analysis = CongestionDetector.analyze_route(
                geometry=geometry,
                steps=steps,
                total_distance_m=route_dist_m,
                base_duration_s=base_dur_s,
                is_emergency_mode=request.is_emergency_mode
            )

            candidate["segments"] = analysis["segments"]
            candidate["hotspots"] = analysis["hotspots"]
            candidate["clear_distance_km"] = analysis["clear_distance_km"]
            candidate["moderate_distance_km"] = analysis["moderate_distance_km"]
            candidate["heavy_distance_km"] = analysis["heavy_distance_km"]
            candidate["severe_distance_km"] = analysis["severe_distance_km"]
            candidate["total_delay_seconds"] = analysis["total_delay_seconds"]

            # Incorporate segment-level live delays with ML duration
            live_delay = analysis["total_delay_seconds"]
            ml_predicted_dur = candidate.get("predicted_duration_seconds", base_dur_s)
            final_predicted_dur = max(ml_predicted_dur, base_dur_s + live_delay)
            
            candidate["predicted_duration_seconds"] = final_predicted_dur
            candidate["predicted_duration_minutes"] = round(final_predicted_dur / 60.0, 1)

            processed_candidates.append(CandidateRoute(**candidate))

        return RouteResponse(
            success=True,
            routes_count=len(processed_candidates),
            candidates=processed_candidates
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching routes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Routing service error: {str(e)}")

@router.post("/reroute/evaluate", response_model=RerouteRecommendation)
async def evaluate_reroute(request: RerouteRequest):
    """Dynamically generates alternative routes from CURRENT user location and recommends the fastest (Features 8 & 9)."""
    recommendation = await DynamicRerouteEngine.evaluate_reroute(
        current_lat=request.current_lat,
        current_lon=request.current_lon,
        dest_lat=request.dest_lat,
        dest_lon=request.dest_lon,
        original_remaining_duration_s=request.original_remaining_duration_seconds,
        avoid_hotspots=request.avoid_hotspots,
        is_emergency_mode=request.is_emergency_mode
    )
    return recommendation

@router.get("/traffic/factors", response_model=TrafficFactorData)
async def get_traffic_factors(lat: float = Query(...), lon: float = Query(...)):
    """Returns real-time traffic factor metrics for a location (Feature 2)."""
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
    """Returns all active bottleneck hotspots across Bengaluru."""
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
