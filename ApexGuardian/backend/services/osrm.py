from typing import List, Dict, Any
import httpx
from fastapi import HTTPException
from core.config import settings


class OSRMService:
    """Street-snapped driving route service via OSRM public API."""

    @staticmethod
    async def get_routes(origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float) -> List[Dict[str, Any]]:
        """Fetch street-snapped driving routes between origin and destination from OSRM.
        
        Returns a list of candidate route dicts. Raises HTTPException if OSRM is unreachable.
        """
        endpoints = [
            f"{settings.OSRM_BASE_URL.rstrip('/')}/route/v1/driving/{origin_lon},{origin_lat};{dest_lon},{dest_lat}",
            f"https://routing.openstreetmap.de/routed-car/route/v1/driving/{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
        ]

        headers = {
            "User-Agent": "ApexGuardian/2.0 (navigation@apexguardian.local)"
        }
        params = {
            "overview": "full",
            "geometries": "geojson",
            "alternatives": "true",
            "steps": "true",
        }

        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            for base_url in endpoints:
                try:
                    response = await client.get(base_url, params=params, headers=headers)
                    if response.status_code != 200:
                        print(f"[OSRM] Endpoint returned {response.status_code}, trying next...")
                        continue

                    data = response.json()
                    raw_routes = data.get("routes", [])

                    if data.get("code") == "Ok" and raw_routes:
                        candidates = []
                        for idx, route in enumerate(raw_routes):
                            all_steps = []
                            for leg in route.get("legs", []):
                                all_steps.extend(leg.get("steps", []))

                            distance = float(route.get("distance", 0.0))
                            duration = float(route.get("duration", 0.0))
                            geometry = route.get("geometry", {})

                            # Validate route data
                            if distance <= 0 or duration <= 0:
                                continue
                            if not geometry or not geometry.get("coordinates"):
                                continue

                            candidates.append({
                                "route_index": idx,
                                "distance_meters": distance,
                                "duration_seconds": duration,
                                "geometry": geometry,
                                "steps": all_steps,
                            })

                        if candidates:
                            print(f"[OSRM] Success: {len(candidates)} route(s) returned.")
                            return candidates

                except Exception as err:
                    print(f"[OSRM] Endpoint {base_url} failed: {err}")
                    continue

        # All endpoints failed — do NOT fabricate routes
        raise HTTPException(
            status_code=503,
            detail="Routing service temporarily unavailable. All OSRM endpoints failed."
        )
