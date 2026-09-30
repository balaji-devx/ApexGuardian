"""Controlled traffic test scenarios (heavy / severe / dynamic demos).

PATCH NOTES (why this file changed)
-----------------------------------
Old behaviour and the bugs it caused:
  * The congested window was a fixed 26 % of the *whole route* (42 %-68 %).
    On a 20 km demo trip that is a ~5 km "hotspot" -> "the distance is too long".
  * In DYNAMIC mode the window moved with the vehicle (progress + 12 %).  Every
    phase change (HEAVY -> SEVERE -> LOW) re-stamped the zone somewhere else, so
    the label said "heavy" while the red stretch was further ahead, and the red
    stretch vanished while the car was still inside it.
  * Segments were coloured whole (350-800 m chunks) using their centre point, so
    the coloured stretch never matched the hotspot distance in the alert.

New behaviour:
  * ONE anchored zone per route, 300-1000 m long (never > 25 % of the route),
    starting at ~50 % of the route.  Segments are split exactly at the zone
    boundaries so the colour, the pin and the "ahead in X m" distance agree.
  * The zone never moves.  In DYNAMIC mode only its *severity* changes with
    progress (approach: moderate -> heavy -> severe, then cleared once the
    vehicle has passed the end of the zone).
  * The hotspot carries ``zone_path`` / ``zone_end_distance_m`` so the client can
    ask the reroute engine to avoid exactly the affected stretch.
"""
import math
from typing import Any, Dict, List, Tuple

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

ZONE_START_RATIO = 0.50
ZONE_MIN_LEN_M = 300.0
ZONE_MAX_LEN_M = 1000.0
ZONE_MAX_ROUTE_FRACTION = 0.25
DYNAMIC_CLEAR_MARGIN = 0.03     # cleared once progress passes zone end + 3 %
ZONE_PATH_SAMPLE_M = 120.0


def _hav(a: List[float], b: List[float]) -> float:
    r = 6_371_000.0
    p1, p2 = math.radians(a[1]), math.radians(b[1])
    dphi = p2 - p1
    dl = math.radians(b[0] - a[0])
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(h), math.sqrt(1 - h))


def compute_scenario_zone(total_distance_m: float) -> Tuple[float, float]:
    """Return (zone_start_m, zone_end_m) along the route."""
    total = max(1.0, total_distance_m)
    length = max(ZONE_MIN_LEN_M, min(ZONE_MAX_LEN_M, 0.10 * total))
    length = min(length, ZONE_MAX_ROUTE_FRACTION * total)
    start = ZONE_START_RATIO * total
    if start + length > total - 100.0:
        start = max(0.0, total - 100.0 - length)
    return start, start + length


def dynamic_traffic_phase(progress: float, zone_end_ratio: float = 1.0) -> CongestionLevel:
    """Severity as the vehicle approaches the (fixed) zone; LOW once it has passed it."""
    if progress >= zone_end_ratio + DYNAMIC_CLEAR_MARGIN:
        return CongestionLevel.LOW
    if progress < 0.15:
        return CongestionLevel.LOW
    if progress < 0.28:
        return CongestionLevel.MODERATE
    if progress < 0.40:
        return CongestionLevel.HEAVY
    return CongestionLevel.SEVERE


def _split_segment(seg: Dict[str, Any], cut_m: float) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Split a segment at ``cut_m`` metres from its start (0 < cut_m < length)."""
    coords = seg["coordinates"]
    walked = 0.0
    for i in range(1, len(coords)):
        d = _hav(coords[i - 1], coords[i])
        if walked + d >= cut_m or i == len(coords) - 1:
            t = 0.0 if d == 0 else max(0.0, min(1.0, (cut_m - walked) / d))
            mid = [
                coords[i - 1][0] + t * (coords[i][0] - coords[i - 1][0]),
                coords[i - 1][1] + t * (coords[i][1] - coords[i - 1][1]),
            ]
            first = {**seg, "coordinates": coords[:i] + [mid]}
            second = {**seg, "coordinates": [mid] + coords[i:]}
            first["distance_meters"] = round(cut_m, 1)
            second["distance_meters"] = round(max(0.1, seg["distance_meters"] - cut_m), 1)
            return first, second
        walked += d
    return seg, seg  # unreachable for valid input


def _split_at(segments: List[Dict[str, Any]], boundary_m: float) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    along = 0.0
    for seg in segments:
        dist = seg["distance_meters"]
        if along + 1.0 < boundary_m < along + dist - 1.0 and len(seg.get("coordinates", [])) >= 2:
            a, b = _split_segment(seg, boundary_m - along)
            out.extend([a, b])
        else:
            out.append(seg)
        along += dist
    return out


def _sample_zone_path(zone_segments: List[Dict[str, Any]]) -> List[List[float]]:
    """Return [[lon, lat], ...] roughly every ZONE_PATH_SAMPLE_M along the affected stretch (max 14 pts)."""
    pts: List[List[float]] = []
    for seg in zone_segments:
        for c in seg.get("coordinates", []):
            if not pts or _hav(pts[-1], c) >= ZONE_PATH_SAMPLE_M:
                pts.append([round(c[0], 6), round(c[1], 6)])
    last = zone_segments[-1].get("coordinates", [[0, 0]])[-1]
    if not pts or pts[-1] != [round(last[0], 6), round(last[1], 6)]:
        pts.append([round(last[0], 6), round(last[1], 6)])
    if len(pts) > 14:
        step = (len(pts) - 1) / 13.0
        pts = [pts[round(i * step)] for i in range(14)]
    return pts


def apply_traffic_test_scenario(
    analysis: Dict[str, Any], mode: TrafficTestMode, progress: float = 0.0, synthetic_traffic_active: bool = True
) -> Dict[str, Any]:
    """Apply controlled debug traffic to analyzed road segments, never to route geometry."""
    if mode == TrafficTestMode.REAL or not synthetic_traffic_active:
        return analysis

    segments = analysis["segments"]
    if not segments:
        return analysis
    total_distance = sum(s["distance_meters"] for s in segments) or 1.0
    zone_start, zone_end = compute_scenario_zone(total_distance)

    if mode == TrafficTestMode.DYNAMIC:
        phase = dynamic_traffic_phase(progress, zone_end / total_distance)
    else:
        phase = {
            TrafficTestMode.NORMAL: CongestionLevel.LOW,
            TrafficTestMode.MODERATE: CongestionLevel.MODERATE,
            TrafficTestMode.HEAVY: CongestionLevel.HEAVY,
            TrafficTestMode.SEVERE: CongestionLevel.SEVERE,
        }.get(mode, CongestionLevel.LOW)

    # Cut segments exactly at the zone boundaries so colour == hotspot extent.
    segments = _split_at(_split_at(segments, zone_start), zone_end)
    for i, seg in enumerate(segments):
        seg["segment_index"] = i

    along = 0.0
    delay_total = 0.0
    distance_by_level = {level: 0.0 for level in CongestionLevel}
    zone_segments: List[Dict[str, Any]] = []
    zone_delay = 0.0
    zone_speed_x_dist = 0.0
    zone_first_along = None

    for segment in segments:
        distance = segment["distance_meters"]
        center = along + distance / 2.0
        in_zone = phase != CongestionLevel.LOW and zone_start - 0.5 <= center <= zone_end + 0.5
        level = phase if in_zone else CongestionLevel.LOW
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
        if in_zone:
            if zone_first_along is None:
                zone_first_along = along
            zone_segments.append(segment)
            zone_delay += delay
            zone_speed_x_dist += speed * distance
        along += distance

    hotspots: List[Dict[str, Any]] = []
    if zone_segments:
        first = zone_segments[0]
        lon, lat = first["coordinates"][0]
        zone_len = sum(s["distance_meters"] for s in zone_segments)
        path = _sample_zone_path(zone_segments)
        hotspots.append({
            "hotspot_id": f"test-{mode.value}-primary",
            "location_name": first.get("road_name") or "Traffic ahead",
            "lat": lat,
            "lon": lon,
            # Distance to the START of the affected stretch (what "ahead in X m" means).
            "distance_from_origin_m": round(zone_first_along or zone_start, 1),
            "congestion_level": phase.value,
            "average_speed_kmh": round(zone_speed_x_dist / max(1.0, zone_len), 1),
            "estimated_delay_seconds": round(zone_delay, 1),
            "description": "Traffic is moving more slowly on this road.",
            "cause": "Controlled traffic test",
            "zone_end_distance_m": round((zone_first_along or zone_start) + zone_len, 1),
            "zone_path": path,
        })

    analysis["segments"] = segments
    analysis["hotspots"] = hotspots
    analysis["total_delay_seconds"] = round(delay_total, 1)
    analysis["clear_distance_km"] = round(distance_by_level[CongestionLevel.LOW] / 1000.0, 2)
    analysis["moderate_distance_km"] = round(distance_by_level[CongestionLevel.MODERATE] / 1000.0, 2)
    analysis["heavy_distance_km"] = round(distance_by_level[CongestionLevel.HEAVY] / 1000.0, 2)
    analysis["severe_distance_km"] = round(distance_by_level[CongestionLevel.SEVERE] / 1000.0, 2)
    return analysis
