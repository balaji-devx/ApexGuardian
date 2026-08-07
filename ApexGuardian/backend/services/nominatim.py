from typing import List, Dict, Any
import httpx
from core.config import settings

class NominatimService:
    @staticmethod
    async def search_places(query: str) -> List[Dict[str, Any]]:
        """Search places via Nominatim API bounded to Bengaluru region with static fallback for reliability."""
        sanitized_query = query.strip()
        if "bengaluru" not in sanitized_query.lower() and "bangalore" not in sanitized_query.lower():
            sanitized_query = f"{sanitized_query}, Bengaluru, India"

        headers = {
            "User-Agent": "ApexGuardian/1.0 (contact@apexguardian.local)"
        }
        params = {
            "q": sanitized_query,
            "format": "json",
            "viewbox": "77.46,13.15,77.75,12.80",
            "bounded": "1",
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
        except Exception as err:
            print(f"[Nominatim WARNING] Search place online lookup failed: {err}")

        # Local fallback if external Nominatim API is rate-limited or blocked
        q_lower = query.lower()
        if "indira" in q_lower:
            return [{
                "display_name": "Indiranagar 100 Feet Road, Bengaluru, Karnataka, India",
                "lat": 12.9784,
                "lon": 77.6408,
                "place_id": "fallback_indiranagar",
                "address_type": "suburb"
            }]
        elif "mg" in q_lower:
            return [{
                "display_name": "MG Road, Mahatma Gandhi Road, Bengaluru, Karnataka, India",
                "lat": 12.9756,
                "lon": 77.6066,
                "place_id": "fallback_mgroad",
                "address_type": "road"
            }]
        elif "mysore" in q_lower:
            return [{
                "display_name": "Mysore Road, Bengaluru, Karnataka, India",
                "lat": 12.9582,
                "lon": 77.5678,
                "place_id": "fallback_mysorerd",
                "address_type": "road"
            }]
        else:
            return [{
                "display_name": f"{query.title()}, Bengaluru, Karnataka, India",
                "lat": 12.9716,
                "lon": 77.5946,
                "place_id": "fallback_generic",
                "address_type": "location"
            }]

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
