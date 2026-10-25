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
  normal: {
    origin: { lat: 11.0183, lon: 76.9674, name: "Gandhipuram Central Bus Terminus, Coimbatore" },
    destination: { lat: 10.9953, lon: 76.9617, name: "Town Hall, Coimbatore" },
    description: "Gandhipuram → Town Hall · normal baseline",
  },
  moderate: {
    origin: { lat: 10.9993, lon: 76.9667, name: "Coimbatore Junction Railway Station" },
    destination: { lat: 11.0247, lon: 77.0020, name: "PSG College of Technology, Coimbatore" },
    description: "Coimbatore Junction → PSG Tech · moderate traffic",
  },
  heavy: {
    origin: { lat: 10.9893, lon: 76.9606, name: "Ukkadam Bus Terminus, Coimbatore" },
    destination: { lat: 10.9993, lon: 77.0285, name: "Singanallur Bus Stand, Coimbatore" },
    description: "Ukkadam → Singanallur · heavy congestion bypass",
  },
  severe: {
    origin: { lat: 11.0481, lon: 76.9877, name: "Ganapathy, Coimbatore" },
    destination: { lat: 11.0300, lon: 77.0434, name: "Coimbatore International Airport" },
    description: "Ganapathy → Airport · severe congestion bypass",
  },
  dynamic: {
    origin: { lat: 11.0240, lon: 76.9480, name: "Saibaba Colony, Coimbatore" },
    destination: { lat: 11.0797, lon: 77.0000, name: "Saravanampatti, Coimbatore" },
    description: "Saibaba Colony → Saravanampatti · normal → moderate → heavy → severe, then reroute",
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