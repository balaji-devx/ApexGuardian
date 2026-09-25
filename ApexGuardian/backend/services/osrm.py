from typing import Any, Dict, List, Sequence, Tuple

import httpx
from fastapi import HTTPException

from core.config import settings


class OSRMService:
    """Street-snapped driving route service via public OSRM-compatible APIs."""

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
    async def _fetch_candidates(cls, coordinate_string: str, alternatives: bool) -> List[Dict[str, Any]]:
        endpoints = [
            f"{settings.OSRM_BASE_URL.rstrip('/')}/route/v1/driving/{coordinate_string}",
            f"https://routing.openstreetmap.de/routed-car/route/v1/driving/{coordinate_string}",
        ]
        headers = {"User-Agent": "ApexGuardian/2.0 (navigation@apexguardian.local)"}
        params = {
            "overview": "full",
            "geometries": "geojson",
            "steps": "true",
        }
        if alternatives:
            params["alternatives"] = "true"

        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            for endpoint in endpoints:
                try:
                    response = await client.get(endpoint, params=params, headers=headers)
                    if response.status_code != 200:
                        print(f"[OSRM] Endpoint returned {response.status_code}, trying next...")
                        continue

                    candidates = cls._parse_osrm_response(response.json())
                    if candidates:
                        print(f"[OSRM] Success: {len(candidates)} route(s) returned.")
                        return candidates
                except Exception as err:
                    print(f"[OSRM] Endpoint {endpoint} failed: {err}")

        raise HTTPException(
            status_code=503,
            detail="Routing service temporarily unavailable. All OSRM endpoints failed.",
        )

    @classmethod
    async def get_routes(
        cls, origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float
    ) -> List[Dict[str, Any]]:
        """Fetch street-snapped driving alternatives between an origin and destination."""
        coordinate_string = f"{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
        return await cls._fetch_candidates(coordinate_string, alternatives=True)

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
