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
    if progress < 0.22:
        return CongestionLevel.LOW
    if progress < 0.43:
        return CongestionLevel.MODERATE
    if progress < 0.76:
        return CongestionLevel.HEAVY
    return CongestionLevel.LOW


def apply_traffic_test_scenario(
    analysis: Dict[str, Any], mode: TrafficTestMode, progress: float = 0.0
) -> Dict[str, Any]:
    """Apply controlled debug traffic to analyzed road segments, never to route geometry."""
    if mode == TrafficTestMode.REAL:
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

        coordinates = segment.get("coordinates", [])
        if in_focus and coordinates:
            lon, lat = coordinates[len(coordinates) // 2]
            hotspots.append({
                "hotspot_id": f"test-{mode.value}-{segment['segment_index']}",
                "location_name": segment.get("road_name") or "Traffic ahead",
                "lat": lat,
                "lon": lon,
                "distance_from_origin_m": round(along + distance / 2.0, 1),
                "congestion_level": level.value,
                "average_speed_kmh": round(speed, 1),
                "estimated_delay_seconds": round(delay, 1),
                "description": "Traffic is moving more slowly on this road.",
                "cause": "Controlled traffic test",
            })
        along += distance

    analysis["hotspots"] = hotspots
    analysis["total_delay_seconds"] = round(delay_total, 1)
    analysis["clear_distance_km"] = round(distance_by_level[CongestionLevel.LOW] / 1000.0, 2)
    analysis["moderate_distance_km"] = round(distance_by_level[CongestionLevel.MODERATE] / 1000.0, 2)
    analysis["heavy_distance_km"] = round(distance_by_level[CongestionLevel.HEAVY] / 1000.0, 2)
    analysis["severe_distance_km"] = round(distance_by_level[CongestionLevel.SEVERE] / 1000.0, 2)
    return analysis
