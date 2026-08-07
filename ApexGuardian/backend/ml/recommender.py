from datetime import datetime, timezone
from typing import List, Dict, Any
from ml.segment_model import predictor as rf_predictor
from ml.gnn_model import gnn_engine
from ml.xgboost_model import xgb_predictor

BOTTLENECK_KEYWORDS = [
    "100 feet", "100ft", "old airport", "silk board", "tin factory",
    "marathahalli", "goraguntepalya", "hebbal", "outer ring", "indiranagar 100", "cubbon"
]

class RouteScorer:
    """Hybrid Route Scoring & AI Recommendation Engine with Strict Congestion Avoidance Guardrails.
    
    Evaluates candidate routes using Stage 1 Random Forest / XGBoost + Stage 2 GNN Spatial Propagation
    and enforces strict Case A (Faster AI Bypass) vs Case B (Standard Route Only) rendering.
    """

    @staticmethod
    def _extract_segments_from_candidate(candidate: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Deconstructs candidate route steps/geometry into road segments."""
        steps = candidate.get("steps", [])
        segments = []

        now = datetime.now(timezone.utc)
        current_hour = now.hour
        current_day = now.weekday()

        if not steps:
            total_dist_km = candidate.get("distance_meters", 1000.0) / 1000.0
            segments.append({
                "road_type": 2,
                "time_of_day": current_hour,
                "day_of_week": current_day,
                "historical_avg_speed": 35.0,
                "weather_condition": 0,
                "distance_km": max(0.1, total_dist_km),
                "name": "City Corridor",
                "is_bottleneck": False
            })
            return segments

        for step in steps:
            step_dist_km = step.get("distance", 100.0) / 1000.0
            if step_dist_km < 0.05:
                continue

            name = step.get("name", "").lower()
            instruction = step.get("maneuver", {}).get("instruction", "").lower() if step.get("maneuver") else ""
            combined_text = f"{name} {instruction}"

            is_bt = any(b in combined_text for b in BOTTLENECK_KEYWORDS)

            if any(w in name for w in ["highway", "expressway", "nh44", "nh48", "outer ring"]):
                road_type = 1
                h_speed = 55.0
            elif any(w in name for w in ["road", "main", "100 feet", "80 feet", "hosur", "airport", "cubbon"]):
                road_type = 2
                h_speed = 35.0
            else:
                road_type = 3
                h_speed = 22.0

            segments.append({
                "road_type": road_type,
                "time_of_day": current_hour,
                "day_of_week": current_day,
                "historical_avg_speed": h_speed,
                "weather_condition": 0,
                "distance_km": step_dist_km,
                "name": step.get("name", "Local Corridor"),
                "is_bottleneck": is_bt
            })

        if not segments:
            total_dist_km = candidate.get("distance_meters", 1000.0) / 1000.0
            segments.append({
                "road_type": 2,
                "time_of_day": current_hour,
                "day_of_week": current_day,
                "historical_avg_speed": 35.0,
                "weather_condition": 0,
                "distance_km": max(0.1, total_dist_km),
                "name": "City Corridor",
                "is_bottleneck": False
            })

        return segments

    @classmethod
    def evaluate_routes(cls, raw_candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Evaluates candidate routes using ML speed models with strict recommendation thresholding."""
        if not raw_candidates:
            return []

        evaluated_candidates = []
        standard_osrm_duration_sec = float(raw_candidates[0].get("duration_seconds", 1200.0))

        for idx, candidate in enumerate(raw_candidates):
            segments = cls._extract_segments_from_candidate(candidate)
            
            # Stage 1: XGBoost / Random Forest Segment Speed Predictions
            rf_speeds = rf_predictor.predict_speeds(segments)

            # Stage 2: GNN Spatial Graph Traffic Propagation
            final_speeds = gnn_engine.propagate_segment_speeds(rf_speeds, segments)

            total_predicted_duration_sec = 0.0
            total_dist_km = sum(s["distance_km"] for s in segments)
            congested_dist_km = 0.0

            for seg, speed in zip(segments, final_speeds):
                dist = seg["distance_km"]
                total_predicted_duration_sec += (dist / speed) * 3600.0
                if speed < 18.0 or seg.get("is_bottleneck"):
                    congested_dist_km += dist

            risk_percentage = (congested_dist_km / max(0.1, total_dist_km)) * 100.0
            congestion_risk_score = round(min(95.0, max(5.0, risk_percentage)), 1)

            cand_copy = dict(candidate)
            cand_copy["predicted_duration_seconds"] = round(total_predicted_duration_sec, 1)
            cand_copy["predicted_duration_minutes"] = round(total_predicted_duration_sec / 60.0, 1)
            cand_copy["standard_duration_seconds"] = round(standard_osrm_duration_sec, 1)
            cand_copy["standard_duration_minutes"] = round(standard_osrm_duration_sec / 60.0, 1)
            cand_copy["delay_savings_minutes"] = 0.0
            cand_copy["congestion_risk_score"] = congestion_risk_score
            cand_copy["is_ai_recommended"] = False
            cand_copy["route_label"] = "Standard Route"
            cand_copy["delay_reason"] = ""

            evaluated_candidates.append(cand_copy)

        # Extract main road name from Candidate 0 for human-readable reasons
        cand0_steps = raw_candidates[0].get("steps", [])
        standard_road_name = "direct corridor"
        for step in cand0_steps:
            s_name = step.get("name", "")
            if s_name and any(b in s_name.lower() for b in ["100 feet", "cubbon", "old airport", "silk board", "tin factory", "marathahalli", "hosur", "mg road"]):
                standard_road_name = s_name
                break
        if standard_road_name == "direct corridor" and cand0_steps:
            for step in cand0_steps:
                if step.get("name"):
                    standard_road_name = step.get("name")
                    break

        eta_standard = evaluated_candidates[0]["predicted_duration_minutes"]
        
        # Check if an alternative detour exists
        if len(evaluated_candidates) > 1:
            alt_indices = list(range(1, len(evaluated_candidates)))
            best_alt_index = min(alt_indices, key=lambda i: evaluated_candidates[i]["predicted_duration_minutes"])
            eta_alt = evaluated_candidates[best_alt_index]["predicted_duration_minutes"]
            saved_minutes = round(eta_standard - eta_alt, 1)

            # CASE A: A genuine faster bypass exists due to standard route congestion (saves >= 0.5 min / 30s)
            if eta_alt < eta_standard - 0.5:
                cand_standard = evaluated_candidates[0]
                cand_alt = evaluated_candidates[best_alt_index]

                cand_alt["is_ai_recommended"] = True
                cand_alt["display_color"] = "#10B981" # Emerald Green
                cand_alt["route_label"] = "AI Congestion Bypass"
                cand_alt["delay_savings_minutes"] = saved_minutes
                cand_alt["delay_reason"] = f"Saves {saved_minutes} mins by bypassing severe gridlock on {standard_road_name}."

                cand_standard["is_ai_recommended"] = False
                cand_standard["display_color"] = "#64748B" # Slate Grey
                cand_standard["route_label"] = "Standard Route (Congested)"
                cand_standard["delay_reason"] = f"Standard corridor experiencing heavy traffic gridlock near {standard_road_name}."

                return [cand_standard, cand_alt]

            # CASE B: Standard route is already the fastest path (No valid faster detour)
            else:
                cand_standard = evaluated_candidates[0]
                cand_standard["is_ai_recommended"] = True
                cand_standard["display_color"] = "#64748B" # Slate Grey Standard
                cand_standard["route_label"] = "Standard Route"
                cand_standard["delay_savings_minutes"] = 0.0
                cand_standard["delay_reason"] = "Standard route is currently the fastest path — No congestion bypass required."

                # Return ONLY the single standard route; do NOT return a fake green line!
                return [cand_standard]
        else:
            # CASE B: Single route fallback
            cand_standard = evaluated_candidates[0]
            cand_standard["is_ai_recommended"] = True
            cand_standard["display_color"] = "#64748B"
            cand_standard["route_label"] = "Standard Route"
            cand_standard["delay_savings_minutes"] = 0.0
            cand_standard["delay_reason"] = "Standard route is currently the fastest path — No congestion bypass required."

            return [cand_standard]

route_scorer = RouteScorer()
