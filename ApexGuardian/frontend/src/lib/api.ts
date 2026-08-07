const API_BASE_URL = "http://localhost:8000/api/v1";

export interface HealthResponse {
  status: string;
  region: string;
  timestamp: string;
}

export interface PlaceSearchResult {
  display_name: string;
  lat: number;
  lon: number;
  place_id: string;
  address_type: string;
}

export interface CandidateRoute {
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
    };
    distance?: number;
    duration?: number;
    name?: string;
  }>;
  is_ai_recommended?: boolean;
  route_label?: string;
  predicted_duration_seconds?: number;
  predicted_duration_minutes?: number;
  standard_duration_seconds?: number;
  standard_duration_minutes?: number;
  delay_savings_minutes?: number;
  congestion_risk_score?: number;
  delay_reason?: string;
}

export interface RouteResponse {
  success: boolean;
  routes_count: number;
  candidates: CandidateRoute[];
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
  destLon: number
): Promise<RouteResponse> {
  const res = await fetch(`${API_BASE_URL}/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin_lat: originLat,
      origin_lon: originLon,
      dest_lat: destLat,
      dest_lon: destLon,
    }),
  });
  if (!res.ok) throw new Error("Failed to calculate routes");
  return res.json();
}
