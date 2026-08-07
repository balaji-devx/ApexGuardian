from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class LocationSearchResponse(BaseModel):
    display_name: str
    lat: float
    lon: float
    place_id: str
    address_type: str

class RouteRequest(BaseModel):
    origin_lat: float
    origin_lon: float
    dest_lat: float
    dest_lon: float

class CandidateRoute(BaseModel):
    route_index: int
    distance_meters: float
    duration_seconds: float
    geometry: Dict[str, Any]
    steps: List[Dict[str, Any]]
    is_ai_recommended: bool = False
    route_label: str = ""
    predicted_duration_seconds: float = 0.0
    predicted_duration_minutes: float = 0.0
    standard_duration_seconds: float = 0.0
    standard_duration_minutes: float = 0.0
    delay_savings_minutes: float = 0.0
    congestion_risk_score: float = 0.0
    delay_reason: str = ""

class RouteResponse(BaseModel):
    success: bool
    routes_count: int
    candidates: List[CandidateRoute]
