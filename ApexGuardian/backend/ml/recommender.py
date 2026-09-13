import math
from typing import List, Dict, Any
from datetime import datetime, timezone, timedelta

from ml.route_model import predictor as congestion_predictor

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
    
    KNOWN_CORNERS = [
        (12.9514, 77.6590), # Example Indiranagar/Old Airport Road area
        (12.9345, 77.6200), # Koramangala
        (13.1989, 77.7069), # Airport
        (12.9716, 77.5946), # MG Road
        (12.9279, 77.6271), # Silk Board
        (12.9698, 77.7499), # Whitefield
        (13.0354, 77.5988), # Hebbal
    ]
    
    @classmethod
    def determine_coverage(cls, origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float) -> str:
        o_dists = [haversine(origin_lat, origin_lon, lat, lon) for lat, lon in cls.KNOWN_CORNERS]
        d_dists = [haversine(dest_lat, dest_lon, lat, lon) for lat, lon in cls.KNOWN_CORNERS]
        
        o_min = min(o_dists) if o_dists else float('inf')
        d_min = min(d_dists) if d_dists else float('inf')
        
        if o_min <= 3.0 and d_min <= 3.0:
            return "High (Historical)"
        elif o_min <= 8.0 and d_min <= 8.0:
            return "Medium (Similar)"
        else:
            return "Low (Extrapolated)"

    @classmethod
    def evaluate_routes(cls, routes: List[Dict[str, Any]], origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float, is_emergency_mode: bool = False) -> List[Dict[str, Any]]:
        ist_tz = timezone(timedelta(hours=5, minutes=30))
        now = datetime.now(ist_tz)
        hour = now.hour
        day_of_week = now.weekday()
        is_weekend = int(day_of_week in [5, 6])
        month = now.month
        
        confidence = cls.determine_coverage(origin_lat, origin_lon, dest_lat, dest_lon)
        
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
            
            # Congestion Factor prediction
            if is_emergency_mode:
                cf = 1.0
            else:
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
                    month=month
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
