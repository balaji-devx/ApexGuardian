import { DEFAULT_TRAFFIC_MODE } from "./trafficScenario";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export interface HealthResponse {
  status: string;
  region: string;
  features: string[];
  timestamp: string;
}

export interface PlaceSearchResult {
  display_name: string;
  lat: number;
  lon: number;
  place_id: string;
  address_type: string;
}

export type CongestionLevel = "LOW" | "MODERATE" | "HEAVY" | "SEVERE";
export type TrafficTestMode = "real" | "normal" | "moderate" | "heavy" | "severe" | "dynamic";

export interface CongestionSegment {
  segment_index: number;
  coordinates: number[][];
  distance_meters: number;
  duration_seconds: number;
  freeflow_speed_kmh: number;
  current_speed_kmh: number;
  delay_seconds: number;
  congestion_level: CongestionLevel;
  color: string;
  congestion_factor: number;
  density_index: number;
  predicted_arrival_time_min: number;
  road_name?: string;
}

export interface CongestionHotspot {
  hotspot_id: string;
  location_name: string;
  lat: number;
  lon: number;
  distance_from_origin_m: number;
  congestion_level: CongestionLevel;
  average_speed_kmh: number;
  estimated_delay_seconds: number;
  description: string;
  cause: string;
}

export interface CandidateRoute {
  route_id: string;
  source: string;
  original_route_index: number;
  route_index: number;
  distance_meters: number;
  duration_seconds: number;
  geometry: {
    type: string;
    coordinates: number[][];
  };
  steps: Array<{
    maneuver?: {
      instruction?: string;
      type?: string;
      modifier?: string;
      location?: [number, number];
    };
    distance?: number;
    duration?: number;
    name?: string;
  }>;
  is_ai_recommended?: boolean;
  recommendation_label?: string;
  congestion_factor?: number;
  predicted_average_speed_kmh?: number;
  predicted_duration_seconds?: number;
  predicted_duration_minutes?: number;
  standard_duration_seconds?: number;
  standard_duration_minutes?: number;
  delay_savings_minutes?: number;
  confidence?: string;
  
  // Segmented Breakdown & Hotspots (Features 1 & 2)
  segments?: CongestionSegment[];
  hotspots?: CongestionHotspot[];
  clear_distance_km?: number;
  moderate_distance_km?: number;
  heavy_distance_km?: number;
  severe_distance_km?: number;
  total_delay_seconds?: number;
}

export interface RouteResponse {
  success: boolean;
  routes_count: number;
  candidates: CandidateRoute[];
}

export interface TrafficFactorData {
  location_name: string;
  current_speed_kmh: number;
  freeflow_speed_kmh: number;
  density_index: number;
  congestion_level: CongestionLevel;
  congestion_factor: number;
  incident_description?: string;
  historical_baseline_speed_kmh: number;
}

export interface RerouteRecommendation {
  is_reroute_recommended: boolean;
  is_congestion_avoidance: boolean;
  time_saved_seconds: number;
  time_saved_minutes: number;
  original_remaining_seconds: number;
  recommended_duration_seconds: number;
  recommended_route?: CandidateRoute;
  alternative_routes: CandidateRoute[];
  reason: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE_URL}/health`, { cache: 'no-store' });
  if (!res.ok) throw new Error("Backend service offline");
  return res.json();
}

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  if (!query.trim()) return [];
  const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Failed to search places");
  return res.json();
}

export async function reverseGeocode(lat: number, lon: number): Promise<{ display_name: string; lat: number; lon: number }> {
  const res = await fetch(`${API_BASE_URL}/reverse?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error("Reverse geocode failed");
  return res.json();
}

export async function fetchRoutes(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
  isEmergencyMode: boolean = false,
  trafficTestMode: TrafficTestMode = DEFAULT_TRAFFIC_MODE,
  trafficProgress: number = 0
): Promise<RouteResponse> {
  const res = await fetch(`${API_BASE_URL}/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin_lat: originLat,
      origin_lon: originLon,
      dest_lat: destLat,
      dest_lon: destLon,
      is_emergency_mode: isEmergencyMode,
      traffic_test_mode: trafficTestMode,
      traffic_progress: trafficProgress,
    }),
  });
  if (!res.ok) throw new Error("Failed to calculate routes");
  return res.json();
}

export async function evaluateReroute(
  currentLat: number,
  currentLon: number,
  destLat: number,
  destLon: number,
  originalRemainingSeconds: number,
  avoidHotspots: Array<{ lat: number; lon: number; radius_km?: number }> = [],
  isEmergencyMode: boolean = false,
  trafficTestMode: TrafficTestMode = DEFAULT_TRAFFIC_MODE,
  trafficProgress: number = 0
): Promise<RerouteRecommendation> {
  const res = await fetch(`${API_BASE_URL}/reroute/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      current_lat: currentLat,
      current_lon: currentLon,
      dest_lat: destLat,
      dest_lon: destLon,
      original_remaining_duration_seconds: originalRemainingSeconds,
      avoid_hotspots: avoidHotspots,
      is_emergency_mode: isEmergencyMode,
      traffic_test_mode: trafficTestMode,
      traffic_progress: trafficProgress,
    }),
  });
  if (!res.ok) throw new Error("Failed to evaluate alternative reroutes");
  return res.json();
}

export async function fetchTrafficFactors(lat: number, lon: number): Promise<TrafficFactorData> {
  const res = await fetch(`${API_BASE_URL}/traffic/factors?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error("Failed to fetch traffic factors");
  return res.json();
}

export async function fetchTrafficHotspots(): Promise<{ success: boolean; count: number; hotspots: any[] }> {
  const res = await fetch(`${API_BASE_URL}/traffic/hotspots`);
  if (!res.ok) throw new Error("Failed to fetch traffic hotspots");
  return res.json();
}



export async function dispatchPushNotification(payload: PushNotificationPayload): Promise<PushNotificationPayload> {
  const res = await fetch(`${API_BASE_URL}/notifications/dispatch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to dispatch push notification");
  return res.json();
}
