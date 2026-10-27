import type { CongestionLevel, TrafficTestMode } from "./api";
import { ACTIVE_REGION } from "./region";

export type { TrafficTestMode } from "./api";

export const DEFAULT_TRAFFIC_MODE: TrafficTestMode = "real";

export interface TrafficTestScenario {
  origin: { lat: number; lon: number; name: string };
  destination: { lat: number; lon: number; name: string };
  description: string;
}

/**
 * Controlled scenarios are region-aware. Coimbatore modes deliberately reuse a
 * verified local trip so severity is the variable under test, not a different
 * endpoint pair or a return to Bengaluru. OSRM supplies the real road geometry
 * and its alternative-route probe attempts to find a genuine bypass.
 */
const BENGALURU_TRAFFIC_TEST_SCENARIOS: Record<Exclude<TrafficTestMode, "real">, TrafficTestScenario> = {
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
    origin: { lat: 12.9347, lon: 77.6140, name: "Koramangala 5th Block, Bengaluru" },
    destination: { lat: 12.9086, lon: 77.6389, name: "HSR Layout Sector 2, Bengaluru" },
    description: "Koramangala 5th Block → HSR Layout",
  },
  severe: {
    origin: { lat: 12.9756, lon: 77.6060, name: "MG Road, Bengaluru" },
    destination: { lat: 12.9177, lon: 77.6233, name: "Silk Board, Bengaluru" },
    description: "MG Road → Silk Board",
  },
  dynamic: {
    origin: { lat: 12.9250, lon: 77.5938, name: "Jayanagar 4th Block, Bengaluru" },
    destination: { lat: 12.9786, lon: 77.6408, name: "Indiranagar 12th Main, Bengaluru" },
    description: "Jayanagar 4th Block → Indiranagar 12th Main",
  },
};

const COIMBATORE_TRAFFIC_TEST_SCENARIOS: Record<Exclude<TrafficTestMode, "real">, TrafficTestScenario> = {
  // Every mode uses its own trip. Heavy / severe / dynamic need two genuine OSRM corridors
  // between the same endpoints so the congestion can sit on one and the vehicle can be
  // offered the other at the split.
  normal: {
    origin: { lat: 11.0006, lon: 76.9747, name: "Race Course, Coimbatore" },
    destination: { lat: 11.0070, lon: 76.9500, name: "RS Puram, Coimbatore" },
    description: "Race Course → RS Puram · normal baseline",
  },
  moderate: {
    origin: { lat: 10.9888, lon: 76.9615, name: "Ukkadam, Coimbatore" },
    destination: { lat: 10.9998, lon: 77.0286, name: "Singanallur, Coimbatore" },
    description: "Ukkadam → Singanallur · moderate traffic",
  },
  heavy: {
    origin: { lat: 11.0236, lon: 76.9015, name: "Vadavalli, Coimbatore" },
    destination: { lat: 11.0243, lon: 77.0041, name: "Peelamedu, Coimbatore" },
    description: "Vadavalli → Peelamedu · heavy congestion bypass",
  },
  severe: {
    // Start from central Gandhipuram rather than Ganapathy to exercise a different
    // set of central/southern corridors and make a usable bypass more likely.
    origin: { lat: 11.0177, lon: 76.9674, name: "Gandhipuram Central Bus Terminus, Coimbatore" },
    destination: { lat: 10.9560, lon: 76.9600, name: "Kuniyamuthur, Coimbatore" },
    description: "Gandhipuram → Kuniyamuthur · severe congestion bypass",
  },
  dynamic: {
    origin: { lat: 11.0720, lon: 77.0330, name: "Kalapatti, Coimbatore" },
    destination: { lat: 10.9953, lon: 76.9617, name: "Town Hall, Coimbatore" },
    description: "Kalapatti → Town Hall · normal → moderate → heavy → severe, then reroute",
  },
};

export const TRAFFIC_TEST_SCENARIOS: Record<Exclude<TrafficTestMode, "real">, TrafficTestScenario> =
  ACTIVE_REGION === "coimbatore" ? COIMBATORE_TRAFFIC_TEST_SCENARIOS : BENGALURU_TRAFFIC_TEST_SCENARIOS;

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