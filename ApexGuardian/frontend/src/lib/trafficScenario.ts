import type { CongestionLevel, TrafficTestMode } from "./api";

export type { TrafficTestMode } from "./api";

export const DEFAULT_TRAFFIC_MODE: TrafficTestMode = "real";

export interface TrafficTestScenario {
  origin: { lat: number; lon: number; name: string };
  destination: { lat: number; lon: number; name: string };
  description: string;
}

/**
 * Keep each controlled demo mode on a different real Bengaluru corridor.
 *
 * The paths deliberately span different parts of the city so switching the
 * dropdown does not replay the same source/destination pair for every test.
 * Heavy / severe / dynamic still use the same controlled-hotspot + avoidance
 * workflow as before; only the test corridor changes.
 */
export const TRAFFIC_TEST_SCENARIOS: Record<Exclude<TrafficTestMode, "real">, TrafficTestScenario> = {
  // PATCH: corridors shortened to ~5-10 km (the old heavy/severe demos were ~20 km, which made
  // the test drag on and pushed Whitefield to the edge of the Bengaluru bounding box).
  normal: {
    origin: { lat: 13.0354, lon: 77.5988, name: "Hebbal, Bengaluru" },
    destination: { lat: 13.0280, lon: 77.5400, name: "Yeshwanthpur, Bengaluru" },
    description: "Hebbal → Yeshwanthpur",
  },
  moderate: {
    origin: { lat: 12.9250, lon: 77.5938, name: "Jayanagar 4th Block, Bengaluru" },
    destination: { lat: 12.9786, lon: 77.6408, name: "Indiranagar, Bengaluru" },
    description: "Jayanagar → Indiranagar",
  },
  heavy: {
    origin: { lat: 12.9352, lon: 77.6245, name: "Koramangala, Bengaluru" },
    destination: { lat: 12.9260, lon: 77.6762, name: "Bellandur, Bengaluru" },
    description: "Koramangala → Bellandur",
  },
  severe: {
    origin: { lat: 12.9756, lon: 77.6060, name: "MG Road, Bengaluru" },
    destination: { lat: 12.9177, lon: 77.6233, name: "Silk Board, Bengaluru" },
    description: "MG Road → Silk Board",
  },
  dynamic: {
    origin: { lat: 12.9786, lon: 77.6421, name: "Indiranagar, Bengaluru" },
    destination: { lat: 12.9569, lon: 77.7011, name: "Marathahalli, Bengaluru" },
    description: "Indiranagar → Marathahalli",
  },
};

export const TRAFFIC_COLORS: Record<CongestionLevel, string> = {
  LOW: "#16A34A",
  MODERATE: "#EAB308",
  HEAVY: "#F97316",
  SEVERE: "#DC2626",
};

/**
 * Escalation phase while APPROACHING the (fixed) congestion zone. Must mirror
 * backend/services/traffic_scenario.py::dynamic_traffic_phase. Clearing is NOT decided here:
 * the client clears the scenario once the vehicle has driven past the hotspot's
 * `zone_end_distance_m` (the backend also clears when progress passes the zone end).
 */
export function dynamicTrafficPhase(progress: number): CongestionLevel {
  if (progress < 0.15) return "LOW";
  if (progress < 0.28) return "MODERATE";
  if (progress < 0.40) return "HEAVY";
  return "SEVERE";
}

export function isTrafficTestMode(mode: TrafficTestMode): boolean {
  return mode !== "real";
}