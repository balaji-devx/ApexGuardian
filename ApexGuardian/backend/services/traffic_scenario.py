from typing import Any, Dict

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


def dynamic_traffic_phase(progress: float) -> CongestionLevel:
    if progress < 0.20:
        return CongestionLevel.LOW
    if progress < 0.38:
        return CongestionLevel.MODERATE
    if progress < 0.58:
        return CongestionLevel.HEAVY
    if progress < 0.76:
        return CongestionLevel.SEVERE
    return CongestionLevel.LOW


def apply_traffic_test_scenario(
    analysis: Dict[str, Any], mode: TrafficTestMode, progress: float = 0.0, synthetic_traffic_active: bool = True
) -> Dict[str, Any]:
    """Apply controlled debug traffic to analyzed road segments, never to route geometry."""
    if mode == TrafficTestMode.REAL or not synthetic_traffic_active:
        return analysis

    phase = {
        TrafficTestMode.NORMAL: CongestionLevel.LOW,
        TrafficTestMode.MODERATE: CongestionLevel.MODERATE,
        TrafficTestMode.HEAVY: CongestionLevel.HEAVY,
        TrafficTestMode.SEVERE: CongestionLevel.SEVERE,
    }.get(mode, dynamic_traffic_phase(progress))

    segments = analysis["segments"]
    total_distance = sum(segment["distance_meters"] for segment in segments) or 1.0
    along = 0.0
    delay_total = 0.0
    distance_by_level = {level: 0.0 for level in CongestionLevel}
    hotspots = []
    in_focus_segments = []
    focus_start = min(0.88, progress + 0.12) if mode == TrafficTestMode.DYNAMIC else 0.42
    focus_end = min(1.0, focus_start + 0.20) if mode == TrafficTestMode.DYNAMIC else 0.68

    for segment in segments:
        distance = segment["distance_meters"]
        center_ratio = (along + distance / 2.0) / total_distance
        in_focus = phase != CongestionLevel.LOW and focus_start <= center_ratio <= focus_end
        level = phase if in_focus else CongestionLevel.LOW
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

        if in_focus:
            in_focus_segments.append({
                "segment": segment,
                "distance": distance,
                "delay": delay,
                "along": along,
                "speed": speed
            })
            
        along += distance

    if in_focus_segments:
        # Create exactly one synthetic hotspot for the entire affected zone
        total_focus_dist = sum(s["distance"] for s in in_focus_segments)
        mid_focus_along = in_focus_segments[0]["along"] + (total_focus_dist / 2.0)
        
        # Find the segment closest to the center of the focus zone
        center_seg = min(in_focus_segments, key=lambda s: abs(s["along"] + s["distance"]/2.0 - mid_focus_along))
        segment = center_seg["segment"]
        coordinates = segment.get("coordinates", [])
        lon, lat = 0.0, 0.0
        if coordinates:
            lon, lat = coordinates[len(coordinates) // 2]
            
        avg_speed = sum(s["speed"] * s["distance"] for s in in_focus_segments) / max(1.0, total_focus_dist)
        total_focus_delay = sum(s["delay"] for s in in_focus_segments)
        
        hotspots.append({
            "hotspot_id": f"test-{mode.value}-primary",
            "location_name": segment.get("road_name") or "Traffic ahead",
            "lat": lat,
            "lon": lon,
            "distance_from_origin_m": round(mid_focus_along, 1),
            "congestion_level": phase.value,
            "average_speed_kmh": round(avg_speed, 1),
            "estimated_delay_seconds": round(total_focus_delay, 1),
            "description": "Traffic is moving more slowly on this road.",
            "cause": "Controlled traffic test",
        })

    analysis["hotspots"] = hotspots
    analysis["total_delay_seconds"] = round(delay_total, 1)
    analysis["clear_distance_km"] = round(distance_by_level[CongestionLevel.LOW] / 1000.0, 2)
    analysis["moderate_distance_km"] = round(distance_by_level[CongestionLevel.MODERATE] / 1000.0, 2)
    analysis["heavy_distance_km"] = round(distance_by_level[CongestionLevel.HEAVY] / 1000.0, 2)
    analysis["severe_distance_km"] = round(distance_by_level[CongestionLevel.SEVERE] / 1000.0, 2)
    return analysis
