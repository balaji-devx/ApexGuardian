import logging
import math
import uuid
from typing import Any, Dict, List, Optional, Sequence, Tuple

from ml.recommender import RouteScorer
from schemas.navigation import CandidateRoute, RerouteRecommendation, TrafficTestMode
from services.congestion_detector import CongestionDetector
from services.osrm import OSRMService
from services.traffic_scenario import apply_traffic_test_scenario

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
            radius_m = float(zone.get("radius_km", 0.6)) * 1000.0
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
            is_emergency_mode=is_emergency_mode,
        )
        if not is_emergency_mode:
            analysis = apply_traffic_test_scenario(analysis, traffic_test_mode, traffic_progress)

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
    ) -> List[CandidateRoute]:
        evaluated = RouteScorer.evaluate_routes(
            raw_candidates,
            origin_lat=current_lat,
            origin_lon=current_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon,
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
    ) -> RerouteRecommendation:
        """Evaluate alternatives, attempting a waypoint bypass around supplied avoid zones."""
        try:
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
                    approach_bearing = _bearing_degrees(current_lat, current_lon, dest_lat, dest_lon)
                    left_waypoint = compute_bypass_waypoint(hotspot_lat, hotspot_lon, approach_bearing)
                    right_waypoint = compute_bypass_waypoint(hotspot_lat, hotspot_lon, approach_bearing + 180.0)
                    via_waypoint = min(
                        (left_waypoint, right_waypoint),
                        key=lambda point: haversine_distance_m(current_lon, current_lat, point[1], point[0])
                        + haversine_distance_m(point[1], point[0], dest_lon, dest_lat),
                    )

                    try:
                        bypass_candidates = await OSRMService.get_routes_via_waypoints(
                            [(current_lat, current_lon), via_waypoint, (dest_lat, dest_lon)]
                        )
                        bypass_routes = cls._score_and_process(
                            bypass_candidates,
                            current_lat,
                            current_lon,
                            dest_lat,
                            dest_lon,
                            direct_distance_m,
                            is_emergency_mode,
                            traffic_test_mode,
                            traffic_progress,
                        )
                    except Exception as error:
                        logger.warning("Waypoint bypass routing failed: %s", error)

                    clean_bypass_routes = [
                        route for route in bypass_routes
                        if not route_intersects_avoid_hotspots(route.geometry, zones)
                    ]
                    clean_routes.extend(clean_bypass_routes)

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
                    reason="No alternate route avoids this stretch — continuing on the only available path.",
                )

            candidates = clean_routes if zones else processed
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
