"""Street-snapped driving route service (OSRM-compatible public APIs).

PATCH NOTES (why this file changed)
-----------------------------------
The old ``_fetch_candidates`` returned as soon as ONE endpoint produced ONE
route.  The public OSRM demo server usually returns a single route even with
``alternatives=true``, and the second endpoint (routing.openstreetmap.de) was
only tried when the first one *failed outright*.  Result: most real
origin/destination pairs showed only one route.

New behaviour of ``get_routes``:
  1. Ask every endpoint (in parallel) for native alternatives and merge them,
     dropping routes that share (almost) the same corridor.
  2. If that still yields < ``min_routes`` routes, probe "via" waypoints placed
     perpendicular to the primary route (both sides, several positions along
     it) and keep any *genuinely different*, *reasonably short* result.
  3. Results are cached briefly so repeated demo clicks do not hammer the
     public servers (which rate-limit).
"""
import asyncio
import logging
import math
import time
from typing import Any, Dict, List, Optional, Sequence, Tuple

import httpx
from fastapi import HTTPException

from core.config import settings

logger = logging.getLogger("apexguardian.osrm")

# ---- tunables ---------------------------------------------------------------
MIN_ROUTES_TARGET = 2
MAX_ROUTES = 3
SAME_CORRIDOR_OVERLAP = 0.88     # >= this shared fraction => "same route"
CORRIDOR_TOLERANCE_M = 80.0
MAX_ALT_DISTANCE_RATIO = 1.45    # alt may be at most 45% longer than primary
MAX_ALT_DURATION_RATIO = 1.60
PROBE_BATCH_SIZE = 3
CACHE_TTL_S = 600.0

_route_cache: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}


# ---- geometry helpers -------------------------------------------------------
def _haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _downsample(coords: Sequence[Sequence[float]], max_points: int) -> List[Tuple[float, float]]:
    if len(coords) <= max_points:
        return [(float(c[0]), float(c[1])) for c in coords]
    step = (len(coords) - 1) / float(max_points - 1)
    return [
        (float(coords[round(i * step)][0]), float(coords[round(i * step)][1]))
        for i in range(max_points)
    ]


def _point_to_polyline_m(lon: float, lat: float, poly: Sequence[Tuple[float, float]]) -> float:
    best = float("inf")
    m_lat = 111_132.0
    m_lon = 111_320.0 * math.cos(math.radians(lat))
    for (x1, y1), (x2, y2) in zip(poly, poly[1:]):
        ax, ay = (x1 - lon) * m_lon, (y1 - lat) * m_lat
        bx, by = (x2 - lon) * m_lon, (y2 - lat) * m_lat
        dx, dy = bx - ax, by - ay
        denom = dx * dx + dy * dy
        t = 0.0 if denom == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / denom))
        d = math.hypot(ax + t * dx, ay + t * dy)
        if d < best:
            best = d
    return best


def _overlap_fraction(a: Sequence[Sequence[float]], b: Sequence[Sequence[float]]) -> float:
    """Fraction of route A's sampled points that lie within tolerance of route B."""
    sample_a = _downsample(a, 40)
    poly_b = _downsample(b, 500)
    if len(poly_b) < 2 or not sample_a:
        return 0.0
    near = sum(
        1 for lon, lat in sample_a
        if _point_to_polyline_m(lon, lat, poly_b) <= CORRIDOR_TOLERANCE_M
    )
    return near / float(len(sample_a))


def routes_are_same_corridor(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    ca = a["geometry"]["coordinates"]
    cb = b["geometry"]["coordinates"]
    return max(_overlap_fraction(ca, cb), _overlap_fraction(cb, ca)) >= SAME_CORRIDOR_OVERLAP


def _bearing_deg(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def _offset_point(lat: float, lon: float, bearing_deg: float, dist_km: float) -> Tuple[float, float]:
    ang = dist_km / 6371.0
    b = math.radians(bearing_deg)
    p1, l1 = math.radians(lat), math.radians(lon)
    p2 = math.asin(math.sin(p1) * math.cos(ang) + math.cos(p1) * math.sin(ang) * math.cos(b))
    l2 = l1 + math.atan2(math.sin(b) * math.sin(ang) * math.cos(p1), math.cos(ang) - math.sin(p1) * math.sin(p2))
    return math.degrees(p2), (math.degrees(l2) + 540.0) % 360.0 - 180.0


def _has_uturn(route: Dict[str, Any]) -> bool:
    for step in route.get("steps", []):
        if (step.get("maneuver") or {}).get("modifier") == "uturn":
            return True
    return False


# ---- service ----------------------------------------------------------------
class OSRMService:
    """Street-snapped driving route service via public OSRM-compatible APIs."""

    @staticmethod
    def _endpoints() -> List[str]:
        primary = settings.OSRM_BASE_URL.rstrip("/")
        endpoints = [f"{primary}/route/v1/driving"]
        secondary = "https://routing.openstreetmap.de/routed-car/route/v1/driving"
        if secondary not in endpoints:
            endpoints.append(secondary)
        return endpoints

    @staticmethod
    def _parse_osrm_response(data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parse and validate route candidates returned by an OSRM-compatible server."""
        raw_routes = data.get("routes", [])
        if data.get("code") != "Ok" or not raw_routes:
            return []

        candidates = []
        for idx, route in enumerate(raw_routes):
            all_steps = []
            for leg in route.get("legs", []):
                all_steps.extend(leg.get("steps", []))

            distance = float(route.get("distance", 0.0))
            duration = float(route.get("duration", 0.0))
            geometry = route.get("geometry", {})
            coordinates = geometry.get("coordinates", []) if isinstance(geometry, dict) else []

            if distance <= 0 or duration <= 0 or len(coordinates) < 2 or not all_steps:
                continue

            candidates.append({
                "route_index": idx,
                "distance_meters": distance,
                "duration_seconds": duration,
                "geometry": geometry,
                "steps": all_steps,
            })
        return candidates

    @classmethod
    async def _query_endpoint(
        cls, client: httpx.AsyncClient, endpoint: str, coordinate_string: str, alternatives: bool
    ) -> List[Dict[str, Any]]:
        params = {"overview": "full", "geometries": "geojson", "steps": "true"}
        if alternatives:
            params["alternatives"] = "true"
        try:
            response = await client.get(f"{endpoint}/{coordinate_string}", params=params)
            if response.status_code != 200:
                logger.warning("[OSRM] %s returned HTTP %s", endpoint, response.status_code)
                return []
            return cls._parse_osrm_response(response.json())
        except Exception as err:  # network errors, bad JSON, timeouts
            logger.warning("[OSRM] %s failed: %s", endpoint, err)
            return []

    @classmethod
    async def _fetch_candidates(cls, coordinate_string: str, alternatives: bool) -> List[Dict[str, Any]]:
        """Query ALL endpoints in parallel and merge distinct routes."""
        headers = {"User-Agent": "ApexGuardian/2.0 (navigation@apexguardian.local)"}
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True, headers=headers) as client:
            results = await asyncio.gather(
                *[cls._query_endpoint(client, ep, coordinate_string, alternatives) for ep in cls._endpoints()]
            )
        merged: List[Dict[str, Any]] = []
        for routes in results:
            for route in routes:
                if not any(routes_are_same_corridor(route, kept) for kept in merged):
                    merged.append(route)
        if not merged:
            raise HTTPException(
                status_code=503,
                detail="Routing service temporarily unavailable. All OSRM endpoints failed.",
            )
        return merged

    @classmethod
    async def _probe_via_routes(
        cls, primary: Dict[str, Any], origin: Tuple[float, float], dest: Tuple[float, float], have: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Try perpendicular via-waypoints to manufacture genuinely different alternatives."""
        coords = primary["geometry"]["coordinates"]
        n = len(coords)
        if n < 6:
            return []
        route_km = primary["distance_meters"] / 1000.0
        offset_km = max(0.6, min(2.5, 0.12 * route_km))

        # (fraction along route, side) in priority order
        plan = [(0.5, 90), (0.5, -90), (0.35, 90), (0.65, -90), (0.35, -90), (0.65, 90)]
        waypoints: List[Tuple[float, float]] = []
        for frac, side in plan:
            i = max(1, min(n - 2, int(frac * (n - 1))))
            lon0, lat0 = coords[i - 1][0], coords[i - 1][1]
            lon1, lat1 = coords[i + 1][0], coords[i + 1][1]
            bearing = (_bearing_deg(lon0, lat0, lon1, lat1) + side) % 360.0
            waypoints.append(_offset_point(coords[i][1], coords[i][0], bearing, offset_km))

        found: List[Dict[str, Any]] = []
        for start in range(0, len(waypoints), PROBE_BATCH_SIZE):
            if len(have) + len(found) >= MAX_ROUTES:
                break
            batch = waypoints[start:start + PROBE_BATCH_SIZE]
            tasks = [
                cls._fetch_candidates(
                    f"{origin[1]},{origin[0]};{wp[1]},{wp[0]};{dest[1]},{dest[0]}", alternatives=False
                )
                for wp in batch
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for res in results:
                if isinstance(res, Exception) or not res:
                    continue
                cand = res[0]
                if _has_uturn(cand):
                    continue
                if cand["distance_meters"] > primary["distance_meters"] * MAX_ALT_DISTANCE_RATIO:
                    continue
                if cand["duration_seconds"] > primary["duration_seconds"] * MAX_ALT_DURATION_RATIO:
                    continue
                if any(routes_are_same_corridor(cand, kept) for kept in have + found):
                    continue
                found.append(cand)
                if len(have) + len(found) >= MAX_ROUTES:
                    break
            if len(have) + len(found) >= MIN_ROUTES_TARGET:
                break
        return found

    @classmethod
    async def get_routes(
        cls,
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float,
        ensure_alternatives: bool = True,
    ) -> List[Dict[str, Any]]:
        """Fetch street-snapped driving alternatives between an origin and destination."""
        cache_key = f"{origin_lat:.4f},{origin_lon:.4f};{dest_lat:.4f},{dest_lon:.4f};{int(ensure_alternatives)}"
        cached = _route_cache.get(cache_key)
        if cached and time.time() - cached[0] < CACHE_TTL_S:
            return [dict(r) for r in cached[1]]

        coordinate_string = f"{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
        routes = await cls._fetch_candidates(coordinate_string, alternatives=True)

        # keep the primary (first) route first, cap the list
        routes = routes[:MAX_ROUTES]
        if ensure_alternatives and len(routes) < MIN_ROUTES_TARGET:
            try:
                extra = await asyncio.wait_for(
                    cls._probe_via_routes(routes[0], (origin_lat, origin_lon), (dest_lat, dest_lon), routes),
                    timeout=20.0,
                )
                routes.extend(extra)
            except Exception as err:
                logger.warning("[OSRM] via-waypoint alternative probing failed: %s", err)

        for idx, route in enumerate(routes):
            route["route_index"] = idx
        logger.info("[OSRM] returning %d route(s) for %s", len(routes), cache_key)
        _route_cache[cache_key] = (time.time(), [dict(r) for r in routes])
        if len(_route_cache) > 200:
            oldest = min(_route_cache, key=lambda k: _route_cache[k][0])
            _route_cache.pop(oldest, None)
        return routes

    @classmethod
    async def get_routes_via_waypoints(
        cls, waypoints: Sequence[Tuple[float, float]]
    ) -> List[Dict[str, Any]]:
        """Fetch a route constrained through ordered ``(latitude, longitude)`` waypoints."""
        if len(waypoints) < 3:
            raise ValueError("A bypass route requires an origin, a via waypoint, and a destination.")
        if any(not (-90 <= lat <= 90 and -180 <= lon <= 180) for lat, lon in waypoints):
            raise ValueError("OSRM waypoints must be valid (latitude, longitude) pairs.")

        coordinate_string = ";".join(f"{lon},{lat}" for lat, lon in waypoints)
        return await cls._fetch_candidates(coordinate_string, alternatives=False)
