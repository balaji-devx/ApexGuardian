"""Plan a controlled traffic demo around an existing, real OSRM route alternative.

The chosen bypass is never fabricated: both paths are returned by OSRM. The planner
places the synthetic jam where route B is clearly separate from route A and identifies
a shared point immediately before their divergence so the simulated vehicle can switch
without teleporting.
"""
from __future__ import annotations

import asyncio
import math
from typing import Any, Dict, List, Optional, Sequence, Tuple

EARTH_M = 6_371_000.0


def _hav(a: Sequence[float], b: Sequence[float]) -> float:
    p1, p2 = math.radians(float(a[1])), math.radians(float(b[1]))
    dp = p2 - p1
    dl = math.radians(float(b[0]) - float(a[0]))
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_M * math.atan2(math.sqrt(h), math.sqrt(max(0.0, 1 - h)))


def _cumulative(coords: Sequence[Sequence[float]]) -> List[float]:
    out = [0.0]
    for a, b in zip(coords, coords[1:]):
        out.append(out[-1] + _hav(a, b))
    return out


def _point_at(coords: Sequence[Sequence[float]], cumulative: Sequence[float], distance_m: float) -> List[float]:
    if distance_m <= 0:
        return [float(coords[0][0]), float(coords[0][1])]
    if distance_m >= cumulative[-1]:
        return [float(coords[-1][0]), float(coords[-1][1])]
    lo, hi = 1, len(cumulative) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if cumulative[mid] < distance_m:
            lo = mid + 1
        else:
            hi = mid
    i = lo
    span = cumulative[i] - cumulative[i - 1]
    t = 0.0 if span <= 1e-6 else (distance_m - cumulative[i - 1]) / span
    return [
        float(coords[i - 1][0]) + (float(coords[i][0]) - float(coords[i - 1][0])) * t,
        float(coords[i - 1][1]) + (float(coords[i][1]) - float(coords[i - 1][1])) * t,
    ]


def _point_segment_distance_m(point: Sequence[float], a: Sequence[float], b: Sequence[float]) -> float:
    lat0 = math.radians((float(point[1]) + float(a[1]) + float(b[1])) / 3.0)
    mx, my = 111_320.0 * math.cos(lat0), 111_132.0
    px, py = float(point[0]) * mx, float(point[1]) * my
    ax, ay = float(a[0]) * mx, float(a[1]) * my
    bx, by = float(b[0]) * mx, float(b[1]) * my
    dx, dy = bx - ax, by - ay
    denom = dx * dx + dy * dy
    t = 0.0 if denom <= 1e-9 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / denom))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def _distance_to_route_m(point: Sequence[float], coords: Sequence[Sequence[float]]) -> float:
    return min((_point_segment_distance_m(point, a, b) for a, b in zip(coords, coords[1:])), default=float("inf"))


def _valid_coords(candidate: Dict[str, Any]) -> List[List[float]]:
    geom = candidate.get("geometry") or {}
    coords = geom.get("coordinates", []) if isinstance(geom, dict) else []
    if not isinstance(coords, list) or len(coords) < 10:
        return []
    try:
        result = [[float(p[0]), float(p[1])] for p in coords]
    except (TypeError, ValueError, IndexError):
        return []
    if any(not all(math.isfinite(v) for v in p) for p in result):
        return []
    return result


def _profile(active: Sequence[Sequence[float]], active_cum: Sequence[float], bypass: Sequence[Sequence[float]], bypass_cum: Sequence[float]) -> List[Tuple[float, float]]:
    """Return (distance along active route, lateral distance to bypass) every 25m."""
    total = active_cum[-1]
    # OSRM geometries can contain many thousands of vertices. Downsample only the
    # distance-check copy; the returned route itself always keeps its original geometry.
    if len(bypass) > 1200:
        step = (len(bypass) - 1) / 1199.0
        bypass_check = [bypass[round(i * step)] for i in range(1200)]
    else:
        bypass_check = bypass
    points: List[Tuple[float, float]] = []
    d = 0.0
    while d < total:
        p = _point_at(active, active_cum, d)
        points.append((d, _distance_to_route_m(p, bypass_check)))
        d += 25.0
    p = _point_at(active, active_cum, total)
    points.append((total, _distance_to_route_m(p, bypass_check)))
    return points


# Planning tiers, strictest first. A real road network rarely offers a textbook split, so the
# planner relaxes (never fabricates geometry) until some genuine OSRM pair works:
# (min split ratio, max split ratio, min lateral gap at split m, shared-road tolerance m,
#  min clear gap for the jam m, min jam length m, gap between switch and jam m)
PLAN_TIERS: Tuple[Tuple[float, float, float, float, float, float, float], ...] = (
    # Keep at least 1 km between the common-road switch point and the congestion zone.
    # This makes the 1 km-before-hotspot trigger happen at (not after) the road split.
    (0.15, 0.48, 55.0, 28.0, 125.0, 350.0, 1000.0),
    (0.08, 0.60, 40.0, 32.0, 80.0, 300.0, 1000.0),
    (0.03, 0.75, 30.0, 40.0, 45.0, 250.0, 1000.0),
    # Last resort relaxes road-separation/clearance constraints, never the 1 km lead distance.
    (0.02, 0.85, 22.0, 45.0, 40.0, 200.0, 1000.0),
)


def _plan_pair(active: Dict[str, Any], bypass: Dict[str, Any], tier: int = 0) -> Optional[Dict[str, Any]]:
    r_lo, r_hi, split_gap, shared_tol, clear_gap, zone_min, jam_gap = PLAN_TIERS[tier]
    active_coords, bypass_coords = _valid_coords(active), _valid_coords(bypass)
    if not active_coords or not bypass_coords:
        return None
    active_cum, bypass_cum = _cumulative(active_coords), _cumulative(bypass_coords)
    total = active_cum[-1]
    if total < 2_000 or bypass_cum[-1] < 1_000:
        return None
    profile = _profile(active_coords, active_cum, bypass_coords, bypass_cum)

    # Find a common-road point just before a sustained divergence. We only switch at a
    # point both routes share, then follow the already-existing alternative geometry.
    divergence_i: Optional[int] = None
    for i, (distance, lateral) in enumerate(profile):
        ratio = distance / total
        if ratio < r_lo or ratio > r_hi:
            continue
        end_dist = distance + 100.0
        lookahead = [d for d, offset in profile[i:] if d <= end_dist]
        offsets = [offset for d, offset in profile[i:] if d <= end_dist]
        if lookahead and lookahead[-1] >= distance + 75 and len(offsets) >= 3 and all(offset > split_gap for offset in offsets):
            divergence_i = i
            break
    if divergence_i is None:
        return None

    switch_distance: Optional[float] = None
    for j in range(divergence_i - 1, -1, -1):
        d, offset = profile[j]
        if d / total < max(0.0, r_lo - 0.03):
            break
        if offset <= shared_tol:
            switch_distance = max(0.0, d - 5.0)
            break
    if switch_distance is None or switch_distance / total > r_hi - 0.03:
        return None

    # Put the jam at the first viable point exactly one kilometre after the shared-road
    # switch. Moving the zone farther downstream makes the 1 km trigger occur after the
    # junction and can leave the vehicle unable to join the preplanned bypass.
    zone_length = min(500.0, max(zone_min, total * 0.06))
    first_start = switch_distance + jam_gap
    last_start = min(total - zone_length - 100.0, total * 0.85)
    if first_start > last_start:
        return None
    window = [offset for sample_d, offset in profile if first_start - 25.0 <= sample_d <= first_start + zone_length + 25.0]
    if not window or min(window) < clear_gap:
        return None
    clearance = min(window)
    zone_start = first_start
    active_index = int(active.get("route_index", 0))
    bypass_index = int(bypass.get("route_index", 0))
    switch_point = _point_at(active_coords, active_cum, switch_distance)
    if _distance_to_route_m(switch_point, bypass_coords) > max(30.0, shared_tol + 5.0):
        return None
    return {
        "active_route_index": active_index,
        "bypass_route_index": bypass_index,
        "switch_distance_m": round(switch_distance, 1),
        "zone_start_ratio": round(zone_start / total, 6),
        "zone_start_distance_m": round(zone_start, 1),
        "zone_length_m": round(zone_length, 1),
        "zone_end_distance_m": round(zone_start + zone_length, 1),
        "minimum_bypass_clearance_m": round(clearance, 1),
    }


def plan_controlled_bypass(candidates: Sequence[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Find a real route pair and a jam window (just after the road split) the alternative avoids."""
    for tier in range(len(PLAN_TIERS)):
        best: Optional[Dict[str, Any]] = None
        best_score = -float("inf")
        for i, active in enumerate(candidates):
            for j, bypass in enumerate(candidates):
                if i == j:
                    continue
                plan = _plan_pair(active, bypass, tier)
                if not plan:
                    continue
                # Prefer strong separation and an early split so the jam sits right after it.
                switch_ratio = plan["switch_distance_m"] / max(1.0, float(active.get("distance_meters", 1.0)))
                score = plan["minimum_bypass_clearance_m"] - abs(switch_ratio - 0.30) * 180.0
                if score > best_score:
                    best_score, best = score, plan
        if best:
            best["plan_tier"] = tier
            return best
    return None


def _bearing_deg(a: Sequence[float], b: Sequence[float]) -> float:
    p1, p2 = math.radians(float(a[1])), math.radians(float(b[1]))
    dl = math.radians(float(b[0]) - float(a[0]))
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def _offset_point(point: Sequence[float], bearing_deg: float, distance_m: float) -> List[float]:
    angular = distance_m / EARTH_M
    bearing = math.radians(bearing_deg)
    lat1 = math.radians(float(point[1]))
    lon1 = math.radians(float(point[0]))
    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular)
        + math.cos(lat1) * math.sin(angular) * math.cos(bearing)
    )
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(angular) * math.cos(lat1),
        math.cos(angular) - math.sin(lat1) * math.sin(lat2),
    )
    return [math.degrees(lon2), math.degrees(lat2)]


def _project_distance_along_route(point: Sequence[float], coords: Sequence[Sequence[float]], cumulative: Sequence[float]) -> Tuple[float, float]:
    """Project a snapped OSRM waypoint onto a route; return (along distance, cross-track metres)."""
    lat0 = math.radians(float(point[1]))
    mx, my = 111_320.0 * math.cos(lat0), 111_132.0
    px, py = float(point[0]) * mx, float(point[1]) * my
    best_dist, best_along = float("inf"), 0.0
    for i, (a, b) in enumerate(zip(coords, coords[1:])):
        ax, ay = float(a[0]) * mx, float(a[1]) * my
        bx, by = float(b[0]) * mx, float(b[1]) * my
        dx, dy = bx - ax, by - ay
        denom = dx * dx + dy * dy
        t = 0.0 if denom <= 1e-9 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / denom))
        distance = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
        along = cumulative[i] + t * (cumulative[i + 1] - cumulative[i])
        if distance < best_dist:
            best_dist, best_along = distance, along
    return best_along, best_dist


async def build_controlled_bypass_candidates(
    candidates: Sequence[Dict[str, Any]],
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
    fetch_via_routes: Any,
) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """Create an OSRM bypass suffix, then join it to the chosen route at its entry road.

    Routing starts at a waypoint on the chosen route, not back at the origin. The route
    prefix is copied from that same OSRM route, so the candidate has a deterministic shared
    approach and the vehicle can switch at a common junction instead of hoping two full
    origin-to-destination routes happen to share a prefix. All alternative road geometry
    after the junction comes from OSRM; a candidate is rejected unless the full jam window
    is visibly clear of it.
    """
    if not candidates:
        return [], None
    next_index = max((int(c.get("route_index", i)) for i, c in enumerate(candidates)), default=-1) + 1
    additions: List[Dict[str, Any]] = []
    probe_jobs = []
    for base in candidates[:2]:
        base_coords = _valid_coords(base)
        if not base_coords:
            continue
        base_cum = _cumulative(base_coords)
        total = base_cum[-1]
        if total < 2_500:
            continue
        # Keep the planned entry junction inside _plan_pair's accepted divergence
        # window (15–48% of the route). A 55% target put the entry after that limit,
        # so every probe at that position was guaranteed to be rejected on normal routes.
        # Probe early, middle, and later congestion zones with progressively wider
        # offsets. Severe-mode routes often need a farther parallel road to reach a
        # genuinely separate corridor. Entries still land before the planned jam.
        for fraction, lateral_offset_m in ((0.30, 300.0), (0.42, 500.0), (0.54, 700.0)):
            target_zone_start = total * fraction
            zone_length = min(450.0, max(350.0, total * 0.06))
            # The bypass begins on the shared road about 1 km before the intended jam.
            entry_d = max(120.0, target_zone_start - 1000.0)
            exit_d = min(total - 100.0, target_zone_start + zone_length + 160.0)
            if exit_d <= entry_d + 500:
                continue
            entry = _point_at(base_coords, base_cum, entry_d)
            exit_point = _point_at(base_coords, base_cum, exit_d)
            center = _point_at(base_coords, base_cum, target_zone_start + zone_length / 2)
            tangent_before = _point_at(base_coords, base_cum, max(0.0, target_zone_start - 30.0))
            tangent_after = _point_at(base_coords, base_cum, min(total, target_zone_start + zone_length + 30.0))
            bearing = _bearing_deg(tangent_before, tangent_after)
            for side in (90.0, -90.0):
                offset = _offset_point(center, bearing + side, lateral_offset_m)
                # IMPORTANT: begin the OSRM leg at an existing point on the chosen route.
                # This makes the active-route prefix reusable and guarantees a shared approach.
                waypoints = [
                    (entry[1], entry[0]),
                    (offset[1], offset[0]),
                    (exit_point[1], exit_point[0]),
                    (float(dest_lat), float(dest_lon)),
                ]
                probe_jobs.append((base, waypoints, entry_d))
    # Do not hammer the public router if there are many origin alternatives.
    probe_jobs = probe_jobs[:12]
    if not probe_jobs:
        return [], None

    results = await asyncio.gather(
        *(fetch_via_routes(waypoints) for _, waypoints, _ in probe_jobs),
        return_exceptions=True,
    )
    for (base, _, expected_entry_d), result in zip(probe_jobs, results):
        if isinstance(result, Exception) or not isinstance(result, list):
            continue
        base_coords = _valid_coords(base)
        base_cum = _cumulative(base_coords)
        base_total = base_cum[-1]
        for route in result:
            route = dict(route)
            suffix_coords = _valid_coords(route)
            if len(suffix_coords) < 5:
                continue

            # OSRM may snap a via point a few metres to its road. Reject wide snaps that
            # would need an artificial connector, or snaps that moved the junction far away.
            snapped_entry = suffix_coords[0]
            along_d, cross_track = _project_distance_along_route(snapped_entry, base_coords, base_cum)
            if cross_track > 25.0 or abs(along_d - expected_entry_d) > 90.0:
                continue
            prefix_end = _point_at(base_coords, base_cum, along_d)
            prefix_coords: List[List[float]] = []
            for i, point in enumerate(base_coords):
                if base_cum[i] < along_d - 1.0:
                    prefix_coords.append([float(point[0]), float(point[1])])
                else:
                    break
            if not prefix_coords:
                prefix_coords = [[float(base_coords[0][0]), float(base_coords[0][1])]]
            if _hav(prefix_coords[-1], prefix_end) > 1.0:
                prefix_coords.append(prefix_end)
            # The OSRM-snapped first coordinate is on an actual road. The short connector
            # is bounded by the 18m snap test above; after it, every point is OSRM geometry.
            if _hav(prefix_coords[-1], snapped_entry) > 1.0:
                prefix_coords.append([float(snapped_entry[0]), float(snapped_entry[1])])
            combined = prefix_coords + [[float(p[0]), float(p[1])] for p in suffix_coords[1:]]
            if len(combined) < 10:
                continue
            full_cum = _cumulative(combined)
            full_distance = full_cum[-1]
            if full_distance > base_total * 1.55:
                continue

            base_duration = float(base.get("duration_seconds", 0.0))
            prefix_duration = base_duration * (along_d / max(1.0, base_total))
            suffix_duration = float(route.get("duration_seconds", 0.0))
            stitched = dict(base)
            stitched.update(route)
            stitched["route_index"] = next_index
            stitched["controlled_probe"] = True
            stitched["source"] = "controlled-osrm-bypass"
            stitched["geometry"] = {"type": "LineString", "coordinates": combined}
            stitched["distance_meters"] = full_distance
            stitched["duration_seconds"] = prefix_duration + suffix_duration
            stitched["predicted_duration_seconds"] = prefix_duration + suffix_duration
            stitched["predicted_duration_minutes"] = (prefix_duration + suffix_duration) / 60.0
            prefix_step = {
                "name": "Continue on current road to bypass junction",
                "distance": along_d,
                "duration": prefix_duration,
                "maneuver": {"type": "depart", "instruction": "Continue on the current road to the bypass junction", "location": combined[0]},
            }
            stitched["steps"] = [prefix_step] + list(route.get("steps") or [])
            plan = None
            for tier in range(len(PLAN_TIERS)):
                plan = _plan_pair(base, stitched, tier)
                if plan:
                    plan["plan_tier"] = tier
                    break
            if plan:
                additions.append(stitched)
                return additions, plan
            next_index += 1
    return additions, None
