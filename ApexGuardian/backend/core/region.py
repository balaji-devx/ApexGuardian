import json
import os
from dataclasses import dataclass, field
from typing import List, Optional, Tuple


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


class CoimbatoreRegionManager:
    """Geographical metadata for Coimbatore (Tamil Nadu).

    CENTER is the commonly published city-centre coordinate. BOUNDING_BOX is a *configurable
    working extent* that comfortably covers the metropolitan road network (Thudiyalur and
    Saravanampatti in the north, Kuniyamuthur in the south, Vadavalli in the west, Singanallur
    and the airport in the east). Refine it once the route catalog has been resolved: the
    dataset generator prints the observed catalog extent.
    """
    CENTER: Tuple[float, float] = (11.0168, 76.9558)
    BOUNDING_BOX: List[float] = [76.8000, 10.9000, 77.1500, 11.2000]  # Min Lon, Min Lat, Max Lon, Max Lat
    DEFAULT_ZOOM: int = 12

    @classmethod
    def is_within_bounds(cls, lat: float, lon: float) -> bool:
        min_lon, min_lat, max_lon, max_lat = cls.BOUNDING_BOX
        return min_lat <= lat <= max_lat and min_lon <= lon <= max_lon


_DATASETS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml", "datasets")


@dataclass(frozen=True)
class RegionProfile:
    """Everything that used to be hard-wired to Bengaluru, gathered in one place."""
    key: str
    display_name: str
    manager: type
    plus_code_reference: Tuple[float, float]   # used to recover shortened Plus Codes
    traffic_csv: str
    osrm_cache: str
    model_filename: str
    nominatim_suffix: str
    nominatim_aliases: Tuple[str, ...]
    data_is_synthetic: bool = False
    coverage_anchors_file: Optional[str] = None
    default_coverage_anchors: Tuple[Tuple[float, float], ...] = field(default_factory=tuple)

    @property
    def center(self) -> Tuple[float, float]:
        return self.manager.CENTER

    @property
    def bounding_box(self) -> List[float]:
        return self.manager.BOUNDING_BOX

    @property
    def nominatim_viewbox(self) -> str:
        min_lon, min_lat, max_lon, max_lat = self.manager.BOUNDING_BOX
        return f"{min_lon},{max_lat},{max_lon},{min_lat}"  # left,top,right,bottom

    def is_within_bounds(self, lat: float, lon: float) -> bool:
        return self.manager.is_within_bounds(lat, lon)

    def coverage_anchors(self) -> List[Tuple[float, float]]:
        """Locations whose neighbourhood counts as 'historically covered' by training data."""
        if self.coverage_anchors_file and os.path.exists(self.coverage_anchors_file):
            with open(self.coverage_anchors_file, "r", encoding="utf-8") as fh:
                return [(float(a), float(b)) for a, b in json.load(fh)]
        return list(self.default_coverage_anchors)


REGIONS = {
    "bengaluru": RegionProfile(
        key="bengaluru",
        display_name="Bengaluru",
        manager=BengaluruRegionManager,
        plus_code_reference=(12.9716, 77.5946),
        traffic_csv=os.path.join(_DATASETS_DIR, "tml", "csv-traffic-bangalore.csv"),
        osrm_cache=os.path.join(_DATASETS_DIR, "tml", "osrm_cache.json"),
        model_filename="congestion_model_v3_fixed.pkl",
        nominatim_suffix="Bengaluru, India",
        nominatim_aliases=("bengaluru", "bangalore"),
        default_coverage_anchors=(
            (12.9514, 77.6590), (12.9345, 77.6200), (13.1989, 77.7069), (12.9716, 77.5946),
            (12.9279, 77.6271), (12.9698, 77.7499), (13.0354, 77.5988),
        ),
    ),
    "coimbatore": RegionProfile(
        key="coimbatore",
        display_name="Coimbatore",
        manager=CoimbatoreRegionManager,
        plus_code_reference=CoimbatoreRegionManager.CENTER,
        traffic_csv=os.path.join(_DATASETS_DIR, "cbe", "csv-traffic-coimbatore.csv"),
        osrm_cache=os.path.join(_DATASETS_DIR, "cbe", "osrm_cache_coimbatore.json"),
        # Distinct file so a Bengaluru-trained model can never be mistaken for a Coimbatore one.
        model_filename="congestion_model_coimbatore_synthetic_v1.pkl",
        nominatim_suffix="Coimbatore, India",
        nominatim_aliases=("coimbatore", "kovai"),
        data_is_synthetic=True,
        # Written by generate_coimbatore_dataset.py from the *resolved* route endpoints.
        coverage_anchors_file=os.path.join(_DATASETS_DIR, "cbe", "coverage_anchors_coimbatore.json"),
    ),
}


def get_region(key: Optional[str] = None) -> RegionProfile:
    """Return the active region profile (``ACTIVE_REGION`` env/.env setting; default Coimbatore)."""
    if key is None:
        from core.config import settings
        key = settings.ACTIVE_REGION
    key = (key or "coimbatore").strip().lower()
    if key not in REGIONS:
        raise ValueError(f"Unknown ACTIVE_REGION '{key}'. Valid options: {sorted(REGIONS)}")
    return REGIONS[key]


def list_registered_regions() -> List[RegionProfile]:
    """Return all registered region profiles."""
    return list(REGIONS.values())



def is_valid_coordinate(lat: float, lon: float) -> bool:
    """Check if lat/lon are finite, valid WGS-84 coordinates (-90 <= lat <= 90, -180 <= lon <= 180)."""
    try:
        import math
        if not (isinstance(lat, (int, float)) and isinstance(lon, (int, float))):
            return False
        if not (math.isfinite(lat) and math.isfinite(lon)):
            return False
        return -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0
    except Exception:
        return False


def find_region_by_coordinates(lat: float, lon: float) -> Optional[RegionProfile]:
    """Find a registered region whose bounding box contains the coordinate."""
    for region in REGIONS.values():
        if region.is_within_bounds(lat, lon):
            return region
    return None


def resolve_route_region(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
    requested_region: Optional[str] = None,
) -> Optional[RegionProfile]:
    """
    Resolve which traffic region applies to a route.
    1. If requested_region is provided and matches a registered region, use it.
    2. Check if origin and destination fall within the same registered region.
    3. If one point falls within a registered region and the other is near or inside, use that region.
    4. Otherwise, return None (unsupported traffic region; standard OSRM routing applies).
    """
    if requested_region and requested_region.strip().lower() in REGIONS:
        return REGIONS[requested_region.strip().lower()]

    origin_region = find_region_by_coordinates(origin_lat, origin_lon)
    dest_region = find_region_by_coordinates(dest_lat, dest_lon)

    if origin_region and dest_region and origin_region.key == dest_region.key:
        return origin_region
    if origin_region and not dest_region:
        return origin_region
    if dest_region and not origin_region:
        return dest_region

    return None
