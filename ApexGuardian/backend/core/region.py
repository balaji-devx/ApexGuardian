from typing import List, Tuple

class BengaluruRegionManager:
    """Centralized geographical metadata for Bengaluru region."""
    CENTER: Tuple[float, float] = (12.9716, 77.5946)
    BOUNDING_BOX: List[float] = [77.4600, 12.8000, 77.7500, 13.1500]  # Min Lon, Min Lat, Max Lon, Max Lat
    DEFAULT_ZOOM: int = 12

    @classmethod
    def is_within_bounds(cls, lat: float, lon: float) -> bool:
        """Check if a coordinate pair sits inside the Bengaluru bounding box."""
        min_lon, min_lat, max_lon, max_lat = cls.BOUNDING_BOX
        return min_lat <= lat <= max_lat and min_lon <= lon <= max_lon
