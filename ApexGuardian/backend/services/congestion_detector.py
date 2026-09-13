import math
from typing import List, Dict, Any, Tuple
from services.traffic_service import LiveTrafficService

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
        is_emergency_mode: bool = False
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

            # Real-time traffic factor telemetry at that predicted timestamp
            traffic_factors = LiveTrafficService.get_point_traffic_factors(
                lat=mid_lat, 
                lon=mid_lon, 
                prediction_offset_min=prediction_offset_min
            )

            # In emergency mode, emergency vehicles experience lower baseline congestion
            if is_emergency_mode:
                traffic_factors["current_speed_kmh"] = min(
                    traffic_factors["freeflow_speed_kmh"], 
                    traffic_factors["current_speed_kmh"] * 1.5 + 10.0
                )
                if traffic_factors["congestion_level"] == "SEVERE":
                    traffic_factors["congestion_level"] = "HEAVY"
                elif traffic_factors["congestion_level"] == "HEAVY":
                    traffic_factors["congestion_level"] = "MODERATE"
                elif traffic_factors["congestion_level"] == "MODERATE":
                    traffic_factors["congestion_level"] = "CLEAR"

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
            if level == "CLEAR":
                clear_dist_m += seg_dist_m
            elif level == "MODERATE":
                moderate_dist_m += seg_dist_m
            elif level == "HEAVY":
                heavy_dist_m += seg_dist_m
            elif level == "SEVERE":
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
            if level in ["MODERATE", "HEAVY", "SEVERE"]:
                # Include heavy/severe bottlenecks, or moderate segments with meaningful delay or named bottlenecks
                if level in ["HEAVY", "SEVERE"] or seg_delay_s >= 20.0 or (traffic_factors.get("location_name") and traffic_factors.get("location_name") != "Urban Arterial Corridor"):
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
                            "distance_from_origin_m": round(cumulative_dist_m, 1),
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
