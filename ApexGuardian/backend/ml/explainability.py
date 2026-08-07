from typing import List, Dict, Any

class TrafficExplainer:
    """Contextual Explanation Engine for XGBoost AI Routing Decisions."""

    @staticmethod
    def generate_explanation(
        green_route_edges: List[Dict[str, Any]],
        gray_route_edges: List[Dict[str, Any]],
        time_saved_min: float,
        context: Dict[str, Any]
    ) -> str:
        """Generates dynamic, human-readable contextual reasons for AI route choices."""
        
        # Inspect features along Gray Route edges that experienced major slowdowns
        school_zone_triggered = False
        market_peak_triggered = False
        weather_triggered = False
        congested_road_name = "primary corridor"

        time_of_day = context.get("time_of_day", 17.5)
        weather_severity = context.get("weather_severity", 0)

        # Check if school hours active (7:30-8:30 or 14:30-16:00)
        is_school_hours = (7.5 <= time_of_day <= 8.5) or (14.5 <= time_of_day <= 16.0)

        for edge in gray_route_edges:
            name = edge.get("name", "")
            if name and name != "Local Corridor" and name != "City Corridor":
                congested_road_name = name

            if edge.get("is_school_zone") and is_school_hours:
                school_zone_triggered = True
            if edge.get("is_market_zone"):
                market_peak_triggered = True

        if weather_severity > 0:
            weather_triggered = True

        if time_saved_min >= 1.0:
            if school_zone_triggered:
                return f"Saves {time_saved_min:.1f} mins — Bypasses severe congestion near school zone during dismissal time (2:30 PM - 4:00 PM)."
            elif market_peak_triggered:
                return f"Saves {time_saved_min:.1f} mins — Avoids heavy commercial market rush on {congested_road_name}."
            elif weather_triggered:
                return f"Saves {time_saved_min:.1f} mins — Diverts around waterlogging-prone junctions during rainfall."
            else:
                return f"Saves {time_saved_min:.1f} mins — Bypasses signal gridlock and peak hour slowdown near {congested_road_name}."
        else:
            if school_zone_triggered:
                return f"Direct corridor via {congested_road_name} remains fastest despite active school zone traffic."
            elif market_peak_triggered:
                return f"Direct corridor via {congested_road_name} remains optimal — Detour adds extra local road signals."
            else:
                return f"Direct corridor via {congested_road_name} remains the fastest path."

explainer = TrafficExplainer()
