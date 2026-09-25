from typing import List, Dict, Any, Optional
from enum import Enum
from pydantic import BaseModel, Field

class CongestionLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HEAVY = "HEAVY"
    SEVERE = "SEVERE"

class TrafficTestMode(str, Enum):
    REAL = "real"
    NORMAL = "normal"
    MODERATE = "moderate"
    HEAVY = "heavy"
    SEVERE = "severe"
    DYNAMIC = "dynamic"

class LocationSearchResponse(BaseModel):
    """Geocoded location search result."""
    display_name: str
    lat: float
    lon: float
    place_id: str
    address_type: str

class RouteRequest(BaseModel):
    """Driving route query between origin and destination coordinates."""
    origin_lat: float
    origin_lon: float
    dest_lat: float
    dest_lon: float
    is_emergency_mode: bool = False
    # Real traffic data is the production default; test modes are opt-in via the frontend dropdown only.
    traffic_test_mode: TrafficTestMode = TrafficTestMode.REAL
    traffic_progress: float = Field(default=0.0, ge=0.0, le=1.0)

class CongestionSegment(BaseModel):
    """Sub-segment of a route with localized real-time and predicted congestion metrics."""
    segment_index: int
    coordinates: List[List[float]] = Field(default_factory=list, description="[[lon, lat], ...]")
    distance_meters: float = 0.0
    duration_seconds: float = 0.0
    freeflow_speed_kmh: float = 45.0
    current_speed_kmh: float = 45.0
    delay_seconds: float = 0.0
    congestion_level: CongestionLevel = CongestionLevel.LOW
    color: str = "#10B981"  # Hex color for MapLibre rendering
    congestion_factor: float = 1.0
    density_index: float = 20.0  # 0 to 100
    predicted_arrival_time_min: float = 0.0
    road_name: Optional[str] = "Main Road"

class CongestionHotspot(BaseModel):
    """Identified critical congestion bottleneck along a route."""
    hotspot_id: str
    location_name: str
    lat: float
    lon: float
    distance_from_origin_m: float
    congestion_level: CongestionLevel = CongestionLevel.HEAVY
    average_speed_kmh: float = 15.0
    estimated_delay_seconds: float = 0.0
    description: str = ""
    cause: str = "High Vehicle Volume / Choke Point"

class CandidateRoute(BaseModel):
    """Complete candidate route with ML scoring and segmented traffic breakdown."""
    route_id: str = ""
    source: str = "initial-osrm"
    original_route_index: int = 0
    route_index: int
    distance_meters: float
    duration_seconds: float
    geometry: Dict[str, Any]
    steps: List[Dict[str, Any]]
    is_ai_recommended: bool = False
    recommendation_label: str = ""
    congestion_factor: float = 1.0
    predicted_average_speed_kmh: float = 0.0
    predicted_duration_seconds: float = 0.0
    predicted_duration_minutes: float = 0.0
    standard_duration_seconds: float = 0.0
    standard_duration_minutes: float = 0.0
    delay_savings_minutes: float = 0.0
    confidence: str = ""
    
    # Feature 1 & 2: Segmented congestion breakdown & Hotspots
    segments: List[CongestionSegment] = Field(default_factory=list)
    hotspots: List[CongestionHotspot] = Field(default_factory=list)
    clear_distance_km: float = 0.0
    moderate_distance_km: float = 0.0
    heavy_distance_km: float = 0.0
    severe_distance_km: float = 0.0
    total_delay_seconds: float = 0.0

class RouteResponse(BaseModel):
    """Response returned by route calculation endpoint."""
    success: bool
    routes_count: int
    candidates: List[CandidateRoute]

class TrafficFactorsRequest(BaseModel):
    """Query live traffic metrics for a location or corridor."""
    lat: float
    lon: float
    radius_km: float = 2.0

class TrafficFactorData(BaseModel):
    """Real-time traffic factor telemetry."""
    location_name: str
    current_speed_kmh: float
    freeflow_speed_kmh: float
    density_index: float
    congestion_level: str
    congestion_factor: float
    incident_description: Optional[str] = None
    historical_baseline_speed_kmh: float = 35.0

class RerouteRequest(BaseModel):
    """Dynamic alternative rerouting query from user's current GPS position."""
    current_lat: float
    current_lon: float
    dest_lat: float
    dest_lon: float
    original_route_index: int = 0
    original_remaining_duration_seconds: float = 0.0
    avoid_hotspots: List[Dict[str, float]] = Field(default_factory=list)
    is_emergency_mode: bool = False
    # Real traffic data is the production default; test modes are opt-in via the frontend dropdown only.
    traffic_test_mode: TrafficTestMode = TrafficTestMode.REAL
    traffic_progress: float = Field(default=0.0, ge=0.0, le=1.0)

class RerouteRecommendation(BaseModel):
    """Alternative route recommendation evaluated from the current location."""
    is_reroute_recommended: bool = False
    is_congestion_avoidance: bool = False
    time_saved_seconds: float = 0.0
    time_saved_minutes: float = 0.0
    original_remaining_seconds: float = 0.0
    recommended_duration_seconds: float = 0.0
    recommended_route: Optional[CandidateRoute] = None
    alternative_routes: List[CandidateRoute] = Field(default_factory=list)
    reason: str = ""

class PushNotificationPayload(BaseModel):
    """Mobile / Web Push Notification Dispatch Payload."""
    title: str
    body: str
    icon: Optional[str] = "/icons/alert-icon.png"
    badge: Optional[str] = "/icons/badge.png"
    tag: Optional[str] = "apex-traffic-alert"
    data: Optional[Dict[str, Any]] = None
