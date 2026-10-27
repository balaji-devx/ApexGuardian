from typing import List, Dict, Any
import httpx
from core.config import settings
from core.region import get_region, list_registered_regions

class NominatimService:
    @staticmethod
    async def search_places(query: str) -> List[Dict[str, Any]]:
        """Search places via Nominatim API with active region viewbox bias and multi-region fallback."""
        sanitized_query = query.strip()
        region = get_region()
        
        # Check if the query explicitly specifies any registered region alias
        has_region_alias = any(
            alias in sanitized_query.lower()
            for r in list_registered_regions()
            for alias in r.nominatim_aliases
        )
        if not has_region_alias and region.nominatim_suffix:
            sanitized_query = f"{sanitized_query}, {region.nominatim_suffix}"

        headers = {
            "User-Agent": "ApexGuardian/1.0 (contact@apexguardian.local)"
        }
        params = {
            "q": sanitized_query,
            "format": "json",
            "viewbox": region.nominatim_viewbox,
            "bounded": "0",  # Bias toward viewbox rather than strictly excluding outside matches
            "limit": "5"
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(f"{settings.NOMINATIM_BASE_URL}/search", params=params, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    results = []
                    for item in data:
                        results.append({
                            "display_name": item.get("display_name", ""),
                            "lat": float(item.get("lat", 0.0)),
                            "lon": float(item.get("lon", 0.0)),
                            "place_id": str(item.get("place_id", "")),
                            "address_type": item.get("addresstype", item.get("type", "unknown"))
                        })
                    if results:
                        return results
                    return []
        except Exception as err:
            print(f"[Nominatim WARNING] Search place online lookup failed: {err}")

        return []

    @staticmethod
    async def reverse_geocode(lat: float, lon: float) -> str:
        """Reverse geocode latitude & longitude coordinates to a clean street/place name."""
        headers = {
            "User-Agent": "ApexGuardian/1.0 (contact@apexguardian.local)"
        }
        params = {
            "format": "json",
            "lat": lat,
            "lon": lon,
            "zoom": "18",
            "addressdetails": "1"
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(f"{settings.NOMINATIM_BASE_URL}/reverse", params=params, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    address = data.get("address", {})
                    short_name = (
                        address.get("road") or
                        address.get("suburb") or
                        address.get("neighbourhood") or
                        address.get("amenity") or
                        data.get("display_name", "").split(",")[0]
                    )
                    if short_name:
                        suburb = address.get("suburb", "")
                        if suburb and suburb.lower() not in short_name.lower():
                            return f"{short_name}, {suburb}"
                        return short_name
                    if data.get("display_name"):
                        return data["display_name"].split(",")[0]
        except Exception:
            pass

        return f"Location ({lat:.5f}, {lon:.5f})"
