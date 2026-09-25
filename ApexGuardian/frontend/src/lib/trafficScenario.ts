import type { CongestionLevel, TrafficTestMode } from "./api";

export type { TrafficTestMode } from "./api";

export const DEFAULT_TRAFFIC_MODE: TrafficTestMode = "real";

export const TRAFFIC_COLORS: Record<CongestionLevel, string> = {
  LOW: "#16A34A",
  MODERATE: "#EAB308",
  HEAVY: "#F97316",
  SEVERE: "#DC2626",
};

export function dynamicTrafficPhase(progress: number): CongestionLevel {
  if (progress < 0.22) return "LOW";
  if (progress < 0.43) return "MODERATE";
  if (progress < 0.76) return "HEAVY";
  return "LOW";
}

export function isTrafficTestMode(mode: TrafficTestMode): boolean {
  return mode !== "real";
}
