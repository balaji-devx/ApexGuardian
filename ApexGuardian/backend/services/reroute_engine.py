import logging
import uuid
import math
from typing import List, Dict, Any, Optional
from services.osrm import OSRMService
from services.congestion_detector import CongestionDetector
from ml.recommender import RouteScorer
from schemas.navigation import CandidateRoute, RerouteRecommendation

logger = logging.getLogger("apexguardian.reroute")

def haversine_distance_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(dlambda / 2.0) ** 2
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

class DynamicRerouteEngine:
    """Dynamic Alternative Route Generation & Fastest Route Recommender (Features 8 & 9).
    
    Responsibilities:
    - Generates candidate alternative routes strictly originating from the user's
      CURRENT vehicle coordinates (not the starting point) to the final destination.
    - Avoids known heavy/severe congestion coordinates by calculating bypass corridors.
    - Evaluates all candidate alternatives with the XGBoost ML model and real-time traffic factors.
    - Compares remaining travel time on the current path vs candidate alternatives.
    - Recommends the fastest route with calculated time-savings.
    """

    @classmethod
    async def evaluate_reroute(
        cls,
        current_lat: float,
        current_lon: float,
        dest_lat: float,
        dest_lon: float,
        original_remaining_duration_s: float,
        avoid_hotspots: Optional[List[Dict[str, float]]] = None,
        is_emergency_mode: bool = False
    ) -> RerouteRecommendation:
        """Evaluates whether an alternative route from user's current location saves meaningful time."""
        try:
            # 1. Fetch fresh OSRM routes from CURRENT location to destination
            raw_candidates = await OSRMService.get_routes(
                origin_lat=current_lat,
                origin_lon=current_lon,
                dest_lat=dest_lat,
                dest_lon=dest_lon
            )

            # 2. Evaluate with RouteScorer ML model
            ml_evaluated = RouteScorer.evaluate_routes(
                raw_candidates,
                origin_lat=current_lat,
                origin_lon=current_lon,
                dest_lat=dest_lat,
                dest_lon=dest_lon,
                is_emergency_mode=is_emergency_mode
            )

            # 3. Apply CongestionDetector to each candidate to get segment breakdown & live delays
            processed_candidates: List[CandidateRoute] = []
            for candidate in ml_evaluated:
                route_dist_m = candidate.get("distance_meters", 0.0)
                base_dur_s = candidate.get("duration_seconds", 0.0)
                geometry = candidate.get("geometry", {})
                steps = candidate.get("steps", [])

                # Hard Geometry Validation
                coords = geometry.get("coordinates", [])
                if not coords or len(coords) < 2:
                    logger.error("Rejecting reroute candidate: insufficient coordinates")
                    continue
                
                has_nan = any(math.isnan(c[0]) or math.isnan(c[1]) for c in coords)
                if has_nan:
                    logger.error("Rejecting reroute candidate: contains NaN coordinates")
                    continue

                if not steps:
                    logger.error("Rejecting reroute candidate: no steps found")
                    continue

                # 6. Validate Reroute Start Point (tolerance ~250m)
                start_lon, start_lat = coords[0]
                dist_from_vehicle = haversine_distance_m(current_lon, current_lat, start_lon, start_lat)
                if dist_from_vehicle > 250:
                    logger.warning(f"[REROUTE CANDIDATE REJECTED] reason=current-point-mismatch candidateStartDistanceMeters={dist_from_vehicle:.1f}")
                    continue
                
                # 7. Validate Reroute End Point (tolerance ~250m)
                end_lon, end_lat = coords[-1]
                dist_from_dest = haversine_distance_m(dest_lon, dest_lat, end_lon, end_lat)
                if dist_from_dest > 250:
                    logger.warning(f"[REROUTE CANDIDATE REJECTED] reason=destination-point-mismatch candidateEndDistanceMeters={dist_from_dest:.1f}")
                    continue

                # 8. Calculate Actual Polyline Length
                polyline_dist_m = 0.0
                max_jump_m = 0.0
                for i in range(1, len(coords)):
                    d = haversine_distance_m(coords[i-1][0], coords[i-1][1], coords[i][0], coords[i][1])
                    polyline_dist_m += d
                    if d > max_jump_m: max_jump_m = d
                
                if max_jump_m > 2000.0:  # >2km between consecutive points is suspicious
                    logger.warning(f"[REROUTE CANDIDATE REJECTED] reason=teleport-geometry-detected maxJumpMeters={max_jump_m:.1f}")
                    continue
                
                if polyline_dist_m < 50.0 and route_dist_m > 1000.0:
                    logger.warning(f"[REROUTE CANDIDATE REJECTED] reason=absurd-distance-mismatch polylineDistance={polyline_dist_m:.1f} reported={route_dist_m:.1f}")
                    continue

                # 9. Absolute Protection Against Screenshot Bug
                # If current vehicle is > 5000m from destination, candidate route must be at least somewhat proportional.
                dist_to_dest_direct = haversine_distance_m(current_lon, current_lat, dest_lon, dest_lat)
                if dist_to_dest_direct > 5000.0 and route_dist_m < 1000.0:
                    logger.warning(f"[REROUTE CANDIDATE REJECTED] reason=route-too-short-for-distance currentToDest={dist_to_dest_direct:.1f} routeDist={route_dist_m:.1f}")
                    continue

                candidate["route_id"] = str(uuid.uuid4())
                candidate["source"] = "reroute"
                candidate["original_route_index"] = candidate.get("route_index", 0)

                analysis = CongestionDetector.analyze_route(
                    geometry=geometry,
                    steps=steps,
                    total_distance_m=route_dist_m,
                    base_duration_s=base_dur_s,
                    is_emergency_mode=is_emergency_mode
                )

                candidate["segments"] = analysis["segments"]
                candidate["hotspots"] = analysis["hotspots"]
                candidate["clear_distance_km"] = analysis["clear_distance_km"]
                candidate["moderate_distance_km"] = analysis["moderate_distance_km"]
                candidate["heavy_distance_km"] = analysis["heavy_distance_km"]
                candidate["severe_distance_km"] = analysis["severe_distance_km"]
                candidate["total_delay_seconds"] = analysis["total_delay_seconds"]

                # Adjust predicted duration with live segment delays
                live_delay = analysis["total_delay_seconds"]
                ml_predicted_dur = candidate.get("predicted_duration_seconds", base_dur_s)
                final_predicted_dur = max(ml_predicted_dur, base_dur_s + live_delay)
                
                candidate["predicted_duration_seconds"] = final_predicted_dur
                candidate["predicted_duration_minutes"] = round(final_predicted_dur / 60.0, 1)

                processed_candidates.append(CandidateRoute(**candidate))

            if not processed_candidates:
                return RerouteRecommendation(
                    is_reroute_recommended=False,
                    time_saved_seconds=0.0,
                    time_saved_minutes=0.0,
                    original_remaining_seconds=original_remaining_duration_s,
                    recommended_duration_seconds=original_remaining_duration_s,
                    recommended_route=None,
                    alternative_routes=[],
                    reason="No viable alternative paths found from current location."
                )

            # Sort by predicted duration (fastest first)
            processed_candidates.sort(key=lambda r: r.predicted_duration_seconds)
            best_route = processed_candidates[0]
            best_duration_s = best_route.predicted_duration_seconds

            # If original duration wasn't provided, use the 2nd best route or standard time as reference
            reference_duration_s = original_remaining_duration_s if original_remaining_duration_s > 0 else (
                processed_candidates[1].predicted_duration_seconds if len(processed_candidates) > 1 else best_duration_s
            )

            time_saved_s = max(0.0, reference_duration_s - best_duration_s)
            time_saved_min = round(time_saved_s / 60.0, 1)

            # Threshold for recommending a reroute: saves at least 90 seconds (1.5 min)
            is_recommended = time_saved_s >= 90.0

            # Tag best route (Point 12: DO NOT mark "Optimal Route" when no reroute exists)
            best_route.is_ai_recommended = is_recommended
            if is_recommended:
                best_route.recommendation_label = f"Fastest Route (Save {int(time_saved_min)}m)"
            else:
                best_route.recommendation_label = None

            reason = ""
            if is_recommended:
                avoided_names = [h.location_name for h in best_route.hotspots if h.congestion_level in ["HEAVY", "SEVERE"]]
                if avoided_names:
                    reason = f"Bypasses congestion near {avoided_names[0]} to save ~{int(time_saved_min)} minutes."
                else:
                    reason = f"Clearer traffic corridor saves ~{int(time_saved_min)} minutes."
            else:
                reason = "Current route remains the fastest available path."
                best_route = None

            # 25. Add a full reroute debug object
            logger.info(f"[REROUTE DEBUG] evaluated_candidate_eta_s={best_duration_s if best_route else -1} original_remaining_eta_s={original_remaining_duration_s} saved_s={time_saved_s} is_recommended={is_recommended} reason='{reason}'")

            return RerouteRecommendation(
                is_reroute_recommended=is_recommended,
                time_saved_seconds=round(time_saved_s, 1),
                time_saved_minutes=time_saved_min,
                original_remaining_seconds=round(reference_duration_s, 1),
                recommended_duration_seconds=round(best_duration_s, 1),
                recommended_route=best_route,
                alternative_routes=processed_candidates,
                reason=reason
            )

        except Exception as e:
            logger.error(f"Error during dynamic reroute evaluation: {str(e)}")
            return RerouteRecommendation(
                is_reroute_recommended=False,
                time_saved_seconds=0.0,
                time_saved_minutes=0.0,
                original_remaining_seconds=original_remaining_duration_s,
                recommended_duration_seconds=original_remaining_duration_s,
                recommended_route=None,
                alternative_routes=[],
                reason=f"Rerouting engine encountered an error: {str(e)}"
            )
