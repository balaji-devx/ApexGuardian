from datetime import datetime, timezone
import logging
from typing import List
from fastapi import APIRouter, HTTPException, Query
from core.region import BengaluruRegionManager
from schemas.navigation import LocationSearchResponse, RouteRequest, RouteResponse, CandidateRoute
from services.nominatim import NominatimService
from services.osrm import OSRMService
from ml.recommender import route_scorer

logger = logging.getLogger("apexguardian.api")
router = APIRouter()

@router.get("/health")
async def health_check():
    return {
        "status": "online",
        "region": "Bengaluru",
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
    # Validate bounding box for Bengaluru region
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

        # 2. Evaluate Candidates with XGBoost ML Model & Enforce Case A / Case B Guardrails
        ml_evaluated_candidates = route_scorer.evaluate_routes(raw_candidates)

        candidates = [CandidateRoute(**c) for c in ml_evaluated_candidates]

        return RouteResponse(
            success=True,
            routes_count=len(candidates),
            candidates=candidates
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching routes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Routing service error: {str(e)}")
