"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import {
  PlaceSearchResult,
  CandidateRoute,
  CongestionLevel,
  CongestionHotspot,
  checkHealth,
  fetchRoutes,
  RerouteRecommendation,
} from "@/lib/api";
import { AlertManager, ActiveCongestionAlert } from "@/lib/alertManager";
import { TTSService, SpeechPriority } from "@/lib/ttsService";
import { PushNotificationService } from "@/lib/pushNotificationService";
import { RerouteEngine, routesHaveSameGeometry } from "@/lib/rerouteEngine";
import { getManeuverInstruction, getManeuverAnnouncement } from "@/lib/maneuverInstructions";
import { DEFAULT_TRAFFIC_MODE, dynamicTrafficPhase, TrafficTestMode, TRAFFIC_TEST_SCENARIOS } from "@/lib/trafficScenario";

import { ACTIVE_REGION_CONFIG } from "@/lib/region";

export function selectDisplayedRouteOptions(candidates: CandidateRoute[]): CandidateRoute[] {
  const combined = candidates.find((route) => route.recommendation_label === "AI + OSRM Best Route");
  if (combined) return [combined];
  const aiRoute = candidates.find((route) => route.is_ai_recommended);
  const osrmRoute = candidates.find(
    (route) => !route.is_ai_recommended && route.recommendation_label === "OSRM Preferred Route",
  );
  if (aiRoute && osrmRoute && aiRoute.route_id !== osrmRoute.route_id) return [aiRoute, osrmRoute];
  // Defensive fallback for older/mock API responses that do not carry the new labels.
  return candidates.slice(0, 2);
}

export interface Coordinate {
  lat: number;
  lon: number;
  name?: string;
}

export type PinDropMode = "none" | "source" | "destination";
export type LayerMode = "ALL" | "AI_ONLY" | "STANDARD_ONLY";

export function haversineMeters(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateBearingAngle(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

function getUpcomingAvoidHotspots(
  route: CandidateRoute,
  distanceAlongRouteM: number,
  pinnedHotspotId?: string | null
) {
  return (route.hotspots || [])
    .filter((hotspot) => {
      // If this hotspot is explicitly pinned by the user's reroute request,
      // always include it regardless of the vehicle's current distance.
      if (pinnedHotspotId && hotspot.hotspot_id === pinnedHotspotId) {
        return (
          hotspot.congestion_level === "HEAVY" ||
          hotspot.congestion_level === "SEVERE"
        );
      }
      // Normal distance-based filtering for automatic rerouting
      return (
        (hotspot.congestion_level === "HEAVY" || hotspot.congestion_level === "SEVERE") &&
        hotspot.distance_from_origin_m >= distanceAlongRouteM - 100
      );
    })
    .flatMap((hotspot) => {
      // PATCH: when the hotspot carries the exact congested stretch, avoid THAT stretch
      // (small circles along it) instead of one 150 m circle at its first point. Otherwise
      // routes that drove straight through the jam were treated as "clean".
      const path = hotspot.zone_path;
      if (path && path.length > 0) {
        // A 90m circle at each sampled road point overlaps the next sample. The backend
        // validates every returned route against ALL circles, covering the whole jam.
        const radiusKm = hotspot.cause === "Controlled traffic test" ? 0.09 : 0.12;
        return path.map(([lon, lat]) => ({ lat, lon, radius_km: radiusKm }));
      }
      return [{ lat: hotspot.lat, lon: hotspot.lon, radius_km: 0.15 }];
    });
}

/** Rebuild the backend's anchored synthetic zone if hotspot metadata could not be refreshed. */
function getControlledZoneAvoidanceFallback(route: CandidateRoute) {
  const coords = (route.geometry?.coordinates || []) as [number, number][];
  if (coords.length < 2) return [] as Array<{ lat: number; lon: number; radius_km: number }>;
  const cumulative: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    cumulative.push(cumulative[i - 1] + haversineMeters(
      coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]
    ));
  }
  const total = cumulative[cumulative.length - 1];
  if (!Number.isFinite(total) || total < 500) return [] as Array<{ lat: number; lon: number; radius_km: number }>;
  let zoneLength = Math.max(300, Math.min(1000, total * 0.10));
  zoneLength = Math.min(zoneLength, total * 0.25);
  let zoneStart = total * 0.50;
  if (zoneStart + zoneLength > total - 100) zoneStart = Math.max(0, total - 100 - zoneLength);
  const zoneEnd = Math.min(total, zoneStart + zoneLength);
  const sampleDistances = [zoneStart];
  for (let d = zoneStart + 75; d < zoneEnd; d += 75) sampleDistances.push(d);
  if (sampleDistances[sampleDistances.length - 1] < zoneEnd) sampleDistances.push(zoneEnd);
  return sampleDistances.map((target) => {
    let i = 1;
    while (i < cumulative.length - 1 && cumulative[i] < target) i++;
    const span = Math.max(0.001, cumulative[i] - cumulative[i - 1]);
    const t = Math.max(0, Math.min(1, (target - cumulative[i - 1]) / span));
    return {
      lon: coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t,
      lat: coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t,
      radius_km: 0.09,
    };
  });
}

function pointAtRouteDistance(route: CandidateRoute, targetDistanceM: number): [number, number] {
  const coords = (route.geometry?.coordinates || []) as [number, number][];
  if (!coords.length) return [0, 0];
  if (coords.length === 1) return coords[0];
  let walked = 0;
  if (targetDistanceM <= 0) return coords[0];
  for (let i = 1; i < coords.length; i += 1) {
    const length = haversineMeters(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    if (walked + length >= targetDistanceM) {
      const t = length > 0 ? Math.max(0, Math.min(1, (targetDistanceM - walked) / length)) : 0;
      return [coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t, coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t];
    }
    walked += length;
  }
  return coords[coords.length - 1];
}

function applyControlledTrafficPhase(route: CandidateRoute, phase: CongestionLevel): CandidateRoute {
  const startM = route.controlled_test_zone_start_distance_m;
  const endM = route.controlled_test_zone_end_distance_m;
  if (typeof startM !== "number" || typeof endM !== "number" || endM <= startM) return route;

  const speedRatio: Record<CongestionLevel, number> = { LOW: 0.90, MODERATE: 0.68, HEAVY: 0.42, SEVERE: 0.20 };
  const color: Record<CongestionLevel, string> = { LOW: "#16A34A", MODERATE: "#EAB308", HEAVY: "#F97316", SEVERE: "#DC2626" };
  let along = 0;
  let totalDelay = 0;
  let lowDistance = 0, moderateDistance = 0, heavyDistance = 0, severeDistance = 0;
  let zoneFreeflowSpeedDistance = 0;
  const segments = (route.segments || []).map((segment) => {
    const segmentDistance = Math.max(0, segment.distance_meters || 0);
    const center = along + segmentDistance / 2;
    const inZone = center >= startM - 1 && center <= endM + 1;
    along += segmentDistance;
    const level: CongestionLevel = inZone ? phase : "LOW";
    const freeflowSpeed = Math.max(20, segment.freeflow_speed_kmh || 45);
    const currentSpeed = Math.max(1, freeflowSpeed * speedRatio[level]);
    const duration = segmentDistance / Math.max(0.5, currentSpeed / 3.6);
    const freeflowDuration = segmentDistance / Math.max(0.5, freeflowSpeed / 3.6);
    const delay = Math.max(0, duration - freeflowDuration);
    totalDelay += delay;
    if (inZone) {
      zoneFreeflowSpeedDistance += freeflowSpeed * segmentDistance;
      if (level === "MODERATE") moderateDistance += segmentDistance;
      else if (level === "HEAVY") heavyDistance += segmentDistance;
      else if (level === "SEVERE") severeDistance += segmentDistance;
      else lowDistance += segmentDistance;
    } else {
      lowDistance += segmentDistance;
    }
    return { ...segment, congestion_level: level, color: color[level], current_speed_kmh: Number(currentSpeed.toFixed(1)), duration_seconds: Number(duration.toFixed(1)), delay_seconds: Number(delay.toFixed(1)), congestion_factor: Number((1 / speedRatio[level]).toFixed(2)) };
  });

  if (phase === "LOW") {
    return { ...route, segments, hotspots: (route.hotspots || []).filter((hotspot) => hotspot.cause !== "Controlled traffic test"), total_delay_seconds: 0, clear_distance_km: Number((lowDistance / 1000).toFixed(2)), moderate_distance_km: 0, heavy_distance_km: 0, severe_distance_km: 0 };
  }

  const zoneLength = endM - startM;
  const zonePath: number[][] = [];
  for (let d = startM; d < endM; d += 75) zonePath.push(pointAtRouteDistance(route, d));
  zonePath.push(pointAtRouteDistance(route, endM));
  const first = zonePath[0] || pointAtRouteDistance(route, startM);
  const averageSpeed = zoneFreeflowSpeedDistance / Math.max(1, zoneLength) * speedRatio[phase];
  const existingHotspot = (route.hotspots || []).find((hotspot) => hotspot.cause === "Controlled traffic test");
  const hotspot: CongestionHotspot = {
    ...(existingHotspot || {} as CongestionHotspot),
    hotspot_id: existingHotspot?.hotspot_id || `controlled-${route.route_id || "test"}`,
    location_name: existingHotspot?.location_name || "Synthetic congestion test zone",
    lat: first[1], lon: first[0], distance_from_origin_m: startM,
    congestion_level: phase, average_speed_kmh: Number(averageSpeed.toFixed(1)),
    estimated_delay_seconds: Number(segments.filter((segment) => segment.congestion_level === phase).reduce((sum, segment) => sum + (segment.delay_seconds || 0), 0).toFixed(1)),
    description: `Synthetic ${phase.toLowerCase()} congestion. A preplanned road bypass is available.`,
    cause: "Controlled traffic test", zone_end_distance_m: endM, zone_path: zonePath,
  };
  return {
    ...route, segments, hotspots: [...(route.hotspots || []).filter((item) => item.cause !== "Controlled traffic test"), hotspot],
    total_delay_seconds: Number(totalDelay.toFixed(1)), clear_distance_km: Number((lowDistance / 1000).toFixed(2)),
    moderate_distance_km: Number((moderateDistance / 1000).toFixed(2)), heavy_distance_km: Number((heavyDistance / 1000).toFixed(2)), severe_distance_km: Number((severeDistance / 1000).toFixed(2)),
  };
}

function buildControlledBypassSuffix(activeRoute: CandidateRoute, currentLocation: Coordinate): CandidateRoute | null {
  const planned = activeRoute.controlled_test_bypass_route;
  const sourceCoords = (planned?.geometry?.coordinates || []) as [number, number][];
  if (!planned || sourceCoords.length < 2) return null;
  const projection = projectPointOntoRoute(currentLocation, planned);
  if (projection.distanceToRouteMeters > 30) {
    console.warn("[TrafficTest] Planned bypass does not join the vehicle's current road.", { distanceM: projection.distanceToRouteMeters });
    return null;
  }
  const segmentIndex = Math.max(0, Math.min(sourceCoords.length - 2, projection.segmentIndex));
  const coords: [number, number][] = [[currentLocation.lon, currentLocation.lat]];
  const projected: [number, number] = [projection.projectedPoint.lon, projection.projectedPoint.lat];
  if (haversineMeters(coords[0][0], coords[0][1], projected[0], projected[1]) > 1.5) coords.push(projected);
  for (const point of sourceCoords.slice(segmentIndex + 1)) {
    const previous = coords[coords.length - 1];
    if (haversineMeters(previous[0], previous[1], point[0], point[1]) > 1) coords.push([point[0], point[1]]);
  }
  if (coords.length < 3) return null;
  let distanceM = 0;
  for (let i = 1; i < coords.length; i += 1) distanceM += haversineMeters(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
  let sourcePolylineM = 0;
  for (let i = 1; i < sourceCoords.length; i += 1) sourcePolylineM += haversineMeters(sourceCoords[i - 1][0], sourceCoords[i - 1][1], sourceCoords[i][0], sourceCoords[i][1]);
  const remainingRatio = sourcePolylineM > 0 ? Math.max(0.01, Math.min(1, distanceM / sourcePolylineM)) : 1;
  const originalDuration = planned.duration_seconds || planned.predicted_duration_seconds || 600;
  const durationS = originalDuration * remainingRatio;
  const steps: CandidateRoute["steps"] = [];
  let stepsDistanceLeft = projection.distanceAlongRouteMeters;
  for (const step of planned.steps || []) {
    const stepDistance = Math.max(0, step.distance || 0);
    if (stepsDistanceLeft >= stepDistance && stepDistance > 0) { stepsDistanceLeft -= stepDistance; continue; }
    const remainingStepDistance = Math.max(0, stepDistance - stepsDistanceLeft);
    const fraction = stepDistance > 0 ? remainingStepDistance / stepDistance : 1;
    steps.push({ ...step, distance: remainingStepDistance, duration: Math.max(0, (step.duration || 0) * fraction) });
    stepsDistanceLeft = 0;
  }
  if (!steps.length) steps.push({ name: "Continue on the clear bypass", distance: distanceM, duration: durationS, maneuver: { type: "depart", instruction: "Continue on the clear bypass", location: coords[0] } });
  const freeflowSpeed = Math.max(25, planned.predicted_average_speed_kmh || 40);
  const clearSegment = { segment_index: 0, coordinates: coords as number[][], distance_meters: distanceM, duration_seconds: durationS, freeflow_speed_kmh: freeflowSpeed, current_speed_kmh: freeflowSpeed, delay_seconds: 0, congestion_level: "LOW" as CongestionLevel, color: "#16A34A", congestion_factor: 1, density_index: 15, predicted_arrival_time_min: durationS / 60, road_name: "Clear bypass" };
  return {
    ...planned, route_id: `controlled-bypass-${Date.now()}`, source: "controlled-test-bypass", route_index: 0,
    distance_meters: distanceM, duration_seconds: durationS, predicted_duration_seconds: durationS, predicted_duration_minutes: Number((durationS / 60).toFixed(1)),
    geometry: { ...planned.geometry, coordinates: coords as number[][] }, steps, segments: [clearSegment], hotspots: (planned.hotspots || []).filter((hotspot) => hotspot.cause !== "Controlled traffic test"),
    clear_distance_km: Number((distanceM / 1000).toFixed(2)), moderate_distance_km: 0, heavy_distance_km: 0, severe_distance_km: 0, total_delay_seconds: 0,
    controlled_test_bypass_route: null, controlled_test_switch_distance_m: null, controlled_test_zone_start_distance_m: null, controlled_test_zone_end_distance_m: null,
  };
}

export function projectPointOntoRoute(point: Coordinate, route: CandidateRoute): { projectedPoint: Coordinate; distanceAlongRouteMeters: number; distanceToRouteMeters: number; segmentIndex: number } {
  let minDistance = Infinity;
  let bestProj: Coordinate = point;
  let bestDistAlong = 0;
  let bestSegmentIdx = 0;

  const coords = route.geometry.coordinates;
  if (!coords || coords.length < 2) return { projectedPoint: point, distanceAlongRouteMeters: 0, distanceToRouteMeters: 0, segmentIndex: 0 };

  let currentRouteDist = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const lon1 = coords[i][0];
    const lat1 = coords[i][1];
    const lon2 = coords[i + 1][0];
    const lat2 = coords[i + 1][1];

    const segLen = haversineMeters(lon1, lat1, lon2, lat2);

    // Project point onto segment (lat1,lon1)-(lat2,lon2) using flat approximation
    // dlat/dlon in degrees - scale lon by cos(lat) to make Euclidean distance proportional to meters
    const cosLat = Math.cos((lat1 * Math.PI) / 180);
    const dx = (lon2 - lon1) * cosLat;
    const dy = lat2 - lat1;
    const px = (point.lon - lon1) * cosLat;
    const py = point.lat - lat1;

    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq !== 0) {
      t = (px * dx + py * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const projLon = lon1 + (lon2 - lon1) * t;
    const projLat = lat1 + (lat2 - lat1) * t;

    const distToProj = haversineMeters(point.lon, point.lat, projLon, projLat);

    if (distToProj < minDistance) {
      minDistance = distToProj;
      bestProj = { lon: projLon, lat: projLat };
      bestDistAlong = currentRouteDist + (segLen * t);
      bestSegmentIdx = i;
    }

    currentRouteDist += segLen;
  }

  return { projectedPoint: bestProj, distanceAlongRouteMeters: bestDistAlong, distanceToRouteMeters: minDistance, segmentIndex: bestSegmentIdx };
}

interface NavigationContextType {
  sourceQuery: string;
  setSourceQuery: (q: string) => void;
  destinationQuery: string;
  setDestinationQuery: (q: string) => void;
  searchResults: PlaceSearchResult[];
  setSearchResults: (results: PlaceSearchResult[]) => void;
  selectedOrigin: Coordinate | null;
  setSelectedOrigin: (coord: Coordinate | null) => void;
  selectedDestination: Coordinate | null;
  setSelectedDestination: (coord: Coordinate | null) => void;
  routes: CandidateRoute[];
  setRoutes: (routes: CandidateRoute[]) => void;
  activeRouteIndex: number;
  setActiveRouteIndex: (idx: number) => void;
  isNavigating: boolean;
  setIsNavigating: (nav: boolean) => void;
  backendOnline: boolean | null;
  activeLayerMode: LayerMode;
  setActiveLayerMode: (mode: LayerMode) => void;
  toggleLayerMode: () => void;
  recenterTrigger: number;
  triggerRecenter: () => void;
  isLoadingRoutes: boolean;
  setIsLoadingRoutes: (loading: boolean) => void;
  currentZoom: number;
  setCurrentZoom: (zoom: number) => void;
  pinDropMode: PinDropMode;
  setPinDropMode: (mode: PinDropMode) => void;
  isEmergencyMode: boolean;
  setIsEmergencyMode: React.Dispatch<React.SetStateAction<boolean>>;
  toggleEmergencyMode: () => void;
  swapSourceAndDestination: () => void;
  calculateRoutes: (origin?: Coordinate | null, dest?: Coordinate | null, emergencyOverride?: boolean) => Promise<boolean>;

  // Real-Time Navigation & Congestion States
  currentLocation: Coordinate | null;
  vehicleBearing: number;
  currentVehicleSpeed: number;
  simProgressPercent: number;
  simDistanceRemainingM: number;
  simEtaSeconds: number;
  isSimPlaying: boolean;
  setIsSimPlaying: (playing: boolean) => void;
  simSpeedMultiplier: number;
  setSimSpeedMultiplier: (mult: number) => void;
  activeAlert: ActiveCongestionAlert | null;
  dismissAlert: () => void;
  activeRerouteRecommendation: RerouteRecommendation | null;
  dismissReroute: () => void;
  acceptReroute: (recommendation: RerouteRecommendation) => void;
  triggerDynamicRerouteCheck: (force?: boolean, pinnedHotspotId?: string | null) => Promise<void>;
  isApplyingReroute: boolean;
  noRouteReason: string | null;
  dismissNoRouteReason: () => void;
  navigationHudHeight: number;
  setNavigationHudHeight: React.Dispatch<React.SetStateAction<number>>;
  trafficTestMode: TrafficTestMode;
  runTrafficTest: (mode: TrafficTestMode) => Promise<void>;

  nextManeuver: any;
  nextManeuverDistanceM: number;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const BENGALURU_CENTER: Coordinate = {
  lat: 12.9716,
  lon: 77.5946,
  name: "Bengaluru Center",
};

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sourceQuery, setSourceQuery] = useState(ACTIVE_REGION_CONFIG.defaultOrigin.name);
  const [destinationQuery, setDestinationQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [selectedOrigin, setSelectedOrigin] = useState<Coordinate | null>({ ...ACTIVE_REGION_CONFIG.defaultOrigin });
  const [selectedDestination, setSelectedDestination] = useState<Coordinate | null>(null);
  const [routes, setRoutes] = useState<CandidateRoute[]>([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const [activeLayerMode, setActiveLayerMode] = useState<LayerMode>("ALL");
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(12.5);
  const [pinDropMode, setPinDropMode] = useState<PinDropMode>("none");
  // EMERGENCY FEATURE DISABLED (commented out, not deleted) - re-enable later.
  // const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  // Hard-wired off so every downstream emergency branch (styles, API flag, voice line) stays inert.
  const isEmergencyMode = false;
  const setIsEmergencyMode: React.Dispatch<React.SetStateAction<boolean>> = () => {};
  const [trafficTestMode, setTrafficTestMode] = useState<TrafficTestMode>(DEFAULT_TRAFFIC_MODE);
  const trafficTestModeRef = useRef<TrafficTestMode>(DEFAULT_TRAFFIC_MODE);
  const lastDynamicPhaseRef = useRef<string>("LOW");
  const dynamicProgressRef = useRef(0);
  const dynamicClearingRef = useRef(false); // PATCH: guards the one-shot "zone passed" clear
  const testCongestionConsumedRef = useRef(false);
  const testRerouteTriggeredRef = useRef(false);

  // Real-Time Simulation & Navigation Telemetry
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const currentLocationRef = useRef<Coordinate | null>(null);
  const [vehicleBearing, setVehicleBearing] = useState<number>(0);
  const [currentVehicleSpeed, setCurrentVehicleSpeed] = useState<number>(45.0);
  const [simProgressPercent, setSimProgressPercent] = useState<number>(0);
  const [simDistanceRemainingM, setSimDistanceRemainingM] = useState<number>(0);
  const [simEtaSeconds, setSimEtaSeconds] = useState<number>(0);
  const [isSimPlaying, setIsSimPlaying] = useState<boolean>(true);
  const [simSpeedMultiplier, setSimSpeedMultiplierState] = useState<number>(1);
  const simSpeedMultiplierRef = useRef(1);
  const setSimSpeedMultiplier = useCallback((multiplier: number) => {
    const normalizedMultiplier = Math.max(1, multiplier);
    simSpeedMultiplierRef.current = normalizedMultiplier;
    setSimSpeedMultiplierState(normalizedMultiplier);
  }, []);
  const [activeAlert, setActiveAlert] = useState<ActiveCongestionAlert | null>(null);
  const [activeRerouteRecommendation, setActiveRerouteRecommendation] = useState<RerouteRecommendation | null>(null);
  const [noRouteReason, setNoRouteReason] = useState<string | null>(null);
  const [navigationHudHeight, setNavigationHudHeight] = useState(0);

  const [nextManeuver, setNextManeuver] = useState<any>(null);
  const [nextManeuverDistanceM, setNextManeuverDistanceM] = useState<number>(500);

  // Continuous Interpolation Distance and Animation References
  const simDistanceTraversedRef = useRef<number>(0);
  const currentBearingRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const lastAlertCheckDistanceRef = useRef<number>(-999);
  const lastAutoRerouteCheckTimeRef = useRef<number>(0);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastRerouteInteractionTimeRef = useRef<number>(0);
  const isTransitioningRouteRef = useRef<boolean>(false);
  const testReroutePausedRef = useRef<boolean>(false);
  const rerouteRequestIdRef = useRef<number>(0);
  const [isApplyingReroute, setIsApplyingReroute] = useState(false);
  const recentRoutesRef = useRef<Array<any>>([]);
  
  const activeRouteRef = useRef<CandidateRoute | null>(null);
  useEffect(() => {
    activeRouteRef.current = routes[activeRouteIndex] || null;
  }, [routes, activeRouteIndex]);

  // Subscribe to AlertManager and RerouteEngine
  useEffect(() => {
    const unsubAlert = AlertManager.subscribe((alert) => {
      setActiveAlert(alert);
      if (!alert) {
        PushNotificationService.clearCongestionAlert();
        if (RerouteEngine.getActiveRecommendation()) {
          RerouteEngine.dismissRecommendation();
          setActiveRerouteRecommendation(null);
        }
      }
    });
    const unsubReroute = RerouteEngine.subscribe((rec, reason) => {
      setNoRouteReason(reason);
      if (!rec || !rec.is_reroute_recommended || !rec.recommended_route) {
        setActiveRerouteRecommendation(null);
        PushNotificationService.clearRerouteAlert();
        return;
      }
      
      const now = Date.now();
      if (now - lastRerouteInteractionTimeRef.current < 30000 && !rec.is_congestion_avoidance) {
        // Cooldown active, ignore new recommendations
        RerouteEngine.dismissRecommendation();
        return;
      }

      // Compare against the remaining active geometry, not total route distance:
      // reroute geometry starts at the vehicle while the active route starts at origin.
      const currentRoute = activeRouteRef.current;
      if (currentRoute && !rec.is_congestion_avoidance && routesHaveSameGeometry(rec.recommended_route, currentRoute)) {
          // Dismiss duplicates so periodic checks can recover, and avoid stale UI.
          RerouteEngine.dismissRecommendation();
          return;
      }

      setActiveRerouteRecommendation(rec);
    });
    return () => {
      unsubAlert();
      unsubReroute();
    };
  }, []);

  const toggleLayerMode = () => {
    setActiveLayerMode((prev) => {
      if (prev === "ALL") return "AI_ONLY";
      if (prev === "AI_ONLY") return "STANDARD_ONLY";
      return "ALL";
    });
  };

  const triggerRecenter = () => setRecenterTrigger((prev) => prev + 1);

  const calculateRoutes = async (
    origin?: Coordinate | null,
    dest?: Coordinate | null,
    emergencyOverride?: boolean,
    trafficMode: TrafficTestMode = trafficTestModeRef.current,
    trafficProgress: number = 0
  ): Promise<boolean> => {
    const originCoord = origin || selectedOrigin;
    const destCoord = dest || selectedDestination;
    if (!originCoord || !destCoord) return false;

    const emergency = emergencyOverride !== undefined ? emergencyOverride : isEmergencyMode;

    TTSService.reset();
    setIsLoadingRoutes(true);
    try {
      const response = await fetchRoutes(
        originCoord.lat,
        originCoord.lon,
        destCoord.lat,
        destCoord.lon,
        emergency,
        trafficMode,
        trafficProgress,
        !testCongestionConsumedRef.current
      );
      if (response.success && response.candidates.length > 0) {
        setRoutes(selectDisplayedRouteOptions(response.candidates));
        setActiveRouteIndex(0);
        simDistanceTraversedRef.current = 0;
        lastAlertCheckDistanceRef.current = -999;
        lastAutoRerouteCheckTimeRef.current = 0;
        recentRoutesRef.current = [];
        testCongestionConsumedRef.current = false;
        testRerouteTriggeredRef.current = false;
        dynamicClearingRef.current = false;
        AlertManager.reset();
        RerouteEngine.dismissRecommendation();
        setActiveRerouteRecommendation(null);
        lastDynamicPhaseRef.current = "LOW";
        return true;
      }
      return false;
    } catch (err) {
      console.error("[NavigationContext] Routing calculation error:", err);
      return false;
    } finally {
      setIsLoadingRoutes(false);
    }
  };

  const runTrafficTest = async (mode: TrafficTestMode) => {
    TTSService.warmUp();
    trafficTestModeRef.current = mode;
    setTrafficTestMode(mode);
    setIsNavigating(false);
    setIsSimPlaying(true);
    setSimSpeedMultiplier(1);
    setIsEmergencyMode(false);
    setActiveLayerMode("ALL");
    setActiveRerouteRecommendation(null);
    AlertManager.reset();
    RerouteEngine.dismissRecommendation();
    RerouteEngine.dismissNoRouteReason();
    lastDynamicPhaseRef.current = "LOW";
    dynamicProgressRef.current = 0;
    dynamicClearingRef.current = false;
    testCongestionConsumedRef.current = false;
    testRerouteTriggeredRef.current = false;

    let origin = selectedOrigin;
    let destination = selectedDestination;
    if (mode !== "real") {
      const scenario = TRAFFIC_TEST_SCENARIOS[mode];
      origin = scenario.origin;
      destination = scenario.destination;
      setSelectedOrigin(origin);
      setSelectedDestination(destination);
      setSourceQuery(origin.name ?? "");
      setDestinationQuery(destination.name ?? "");
    }
    if (!origin || !destination) return;
    const loaded = await calculateRoutes(origin, destination, false, mode, 0);
    if (loaded) setIsNavigating(true);
  };

  const refreshTrafficScenario = useCallback(async (route: CandidateRoute, progress: number): Promise<CandidateRoute | null> => {
    const destination = selectedDestination;
    const start = route.geometry?.coordinates?.[0];
    if (
      !destination ||
      !start ||
      trafficTestModeRef.current === "real" ||
      testCongestionConsumedRef.current
    ) {
      return null;
    }

    try {
      const response = await fetchRoutes(
        start[1], start[0], destination.lat, destination.lon,
        isEmergencyMode, trafficTestModeRef.current, progress,
        !testCongestionConsumedRef.current
      );
      // PATCH: candidates come back re-ranked by ETA, so [0] can be a DIFFERENT road than `route`.
      // Copying its segments onto this geometry is what made red stretches jump or vanish.
      // Pick the candidate that is actually this route (same length, same start/end corridor).
      const evaluatedRoute = (response.candidates || []).find(
        (candidate) => routesHaveSameGeometry(candidate, route),
      );
      if (!response.success || !evaluatedRoute) {
        console.warn("[NavigationContext] Could not find the same OSRM geometry during traffic refresh; leaving the current route untouched.");
        return null;
      }

      const updatedRoute: CandidateRoute = {
        ...route,
        segments: evaluatedRoute.segments,
        hotspots: evaluatedRoute.hotspots,
        clear_distance_km: evaluatedRoute.clear_distance_km,
        moderate_distance_km: evaluatedRoute.moderate_distance_km,
        heavy_distance_km: evaluatedRoute.heavy_distance_km,
        severe_distance_km: evaluatedRoute.severe_distance_km,
        total_delay_seconds: evaluatedRoute.total_delay_seconds,
        predicted_duration_seconds: evaluatedRoute.predicted_duration_seconds,
        predicted_duration_minutes: evaluatedRoute.predicted_duration_minutes,
      };

      setRoutes((currentRoutes) => currentRoutes.map((currentRoute) =>
        currentRoute.route_id === route.route_id ? updatedRoute : currentRoute
      ));

      return updatedRoute;
    } catch (error) {
      console.warn("[NavigationContext] Could not refresh test traffic conditions:", error);
      return null;
    }
  }, [selectedDestination, isEmergencyMode]);

  // EMERGENCY FEATURE DISABLED (commented out, not deleted) - re-enable later.
  // const toggleEmergencyMode = () => {
  //   const newEmergency = !isEmergencyMode;
  //   setIsEmergencyMode(newEmergency);
  //   if (selectedOrigin && selectedDestination) {
  //     calculateRoutes(selectedOrigin, selectedDestination, newEmergency);
  //   }
  // };
  const toggleEmergencyMode = () => {};


  const swapSourceAndDestination = async () => {
    const oldOrigin = selectedOrigin;
    const oldDest = selectedDestination;
    const oldSrcQuery = sourceQuery;
    const oldDestQuery = destinationQuery;

    setSelectedOrigin(oldDest);
    setSelectedDestination(oldOrigin);
    setSourceQuery(oldDestQuery);
    setDestinationQuery(oldSrcQuery);

    if (oldDest && oldOrigin) {
      await calculateRoutes(oldDest, oldOrigin);
    }
  };

  const dismissAlert = () => {
    AlertManager.dismissCurrentAlert();
  };

  const dismissReroute = () => {
    lastRerouteInteractionTimeRef.current = Date.now();
    setActiveRerouteRecommendation(null);
    RerouteEngine.dismissRecommendation();
    PushNotificationService.clearRerouteAlert();
    if (testReroutePausedRef.current) {
      testReroutePausedRef.current = false;
      setIsSimPlaying(true);
    }
  };

  const dismissNoRouteReason = () => RerouteEngine.dismissNoRouteReason();

  const activateRoute = (newRoute: CandidateRoute, preservePosition: boolean = false): boolean => {
    if (isTransitioningRouteRef.current) return false;
    if (!newRoute || !newRoute.geometry?.coordinates) return false;

    // REROUTE STATE VERSIONING: Generate an activation ID
    const activationId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    
    isTransitioningRouteRef.current = true;

    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    const firstCoord = newRoute.geometry.coordinates[0];
    const lastCoord = newRoute.geometry.coordinates[newRoute.geometry.coordinates.length - 1];
    const totalRouteDistance = newRoute.distance_meters || 0;
    const distToDest = selectedDestination && currentLocation ? haversineMeters(currentLocation.lon, currentLocation.lat, selectedDestination.lon, selectedDestination.lat) : 0;
    
    let proj: ReturnType<typeof projectPointOntoRoute> | null = null;
    let fallbackToStart = false;

    if (preservePosition && currentLocation) {
      // Reroute API requests start at the vehicle's paused physical position. Validate that
      // the candidate begins beside that position, and start at progress 0. Never project
      // against the entire new line: a later crossing can be closer and cause a teleport.
      const startDistanceM = haversineMeters(
        currentLocation.lon, currentLocation.lat, firstCoord[0], firstCoord[1]
      );
      const endDistanceM = selectedDestination
        ? haversineMeters(lastCoord[0], lastCoord[1], selectedDestination.lon, selectedDestination.lat)
        : 0;
      let calculatedPolylineM = 0;
      for (let i = 1; i < newRoute.geometry.coordinates.length; i++) {
        calculatedPolylineM += haversineMeters(
          newRoute.geometry.coordinates[i - 1][0], newRoute.geometry.coordinates[i - 1][1],
          newRoute.geometry.coordinates[i][0], newRoute.geometry.coordinates[i][1]
        );
      }
      const isGeometryAbsurd = Math.abs(calculatedPolylineM - totalRouteDistance) > Math.max(500, totalRouteDistance * 0.2);
      const badStart = startDistanceM > 35;
      const badEnd = Boolean(selectedDestination && endDistanceM > 250);
      if (badStart || badEnd || isGeometryAbsurd) {
        console.warn("[NavigationContext] Reroute rejected to prevent a vehicle jump.", {
          startDistanceM, endDistanceM, calculatedPolylineM, reportedDistanceM: totalRouteDistance,
        });
        isTransitioningRouteRef.current = false;
        return false;
      }
      proj = {
        projectedPoint: { lon: firstCoord[0], lat: firstCoord[1] },
        distanceAlongRouteMeters: 0,
        distanceToRouteMeters: startDistanceM,
        segmentIndex: 0,
      };
      simDistanceTraversedRef.current = 0;
      // Keep currentLocation/currentLocationRef untouched; the new road route begins where
      // the reroute was requested, within a strict 35m OSRM snap tolerance.
    } else {
      fallbackToStart = true;
    }

    if (fallbackToStart) {
      simDistanceTraversedRef.current = 0;
      if (newRoute.geometry?.coordinates?.length > 0) {
        const startLocation = { lon: firstCoord[0], lat: firstCoord[1] };
        currentLocationRef.current = startLocation;
        setCurrentLocation(startLocation);
      }
    }

    // PART 1 & 2 - DETERMINISTIC DEBUG CHECK
    if (preservePosition && currentLocation && proj) {
      console.log(`[REROUTE ACTIVATION DEBUG]`, {
        routeId: newRoute.route_id,
        activationId,
        source: newRoute.source || "unknown",
        distance_meters: newRoute.distance_meters,
        duration_seconds: newRoute.duration_seconds,
        predicted_duration_seconds: newRoute.predicted_duration_seconds,
        geometryCoordinateCount: newRoute.geometry.coordinates.length,
        firstCoordinate: firstCoord,
        lastCoordinate: lastCoord,
        currentLocationBeforeActivation: { ...currentLocation },
        projectedPoint: proj.projectedPoint,
        projectedDistanceAlongRouteM: proj.distanceAlongRouteMeters,
        distanceToRouteMeters: proj.distanceToRouteMeters,
        currentLocationAfterActivation: fallbackToStart ? { lon: firstCoord[0], lat: firstCoord[1] } : { ...currentLocation },
        distanceCurrentToDestinationM: distToDest,
        totalRouteDistanceM: totalRouteDistance,
        simDistanceTraversedM: simDistanceTraversedRef.current
      });
    }

    lastFrameTimeRef.current = performance.now();
    lastAlertCheckDistanceRef.current = -999;
    lastAutoRerouteCheckTimeRef.current = Date.now();
    lastRerouteInteractionTimeRef.current = Date.now();
    
    AlertManager.reset();
    RerouteEngine.dismissRecommendation();
    TTSService.reset();
    
    // Add old route to recent history before replacing
    const oldRoute = activeRouteRef.current;
    if (oldRoute) {
       recentRoutesRef.current.push({
           route_id: oldRoute.route_id,
           geometry: oldRoute.geometry
       });
       if (recentRoutesRef.current.length > 5) {
           recentRoutesRef.current.shift();
       }
    }

    // Make newRoute the active route at index 0
    setRoutes((prev) => [newRoute, ...prev.filter((r) => r.route_id !== newRoute.route_id)]);
    setActiveRouteIndex(0);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isTransitioningRouteRef.current = false;
      });
    });
    return true;
  };

  const acceptReroute = (recommendation: RerouteRecommendation) => {
    if (!recommendation || !recommendation.recommended_route) return;
    
    // 2. Log and verify the exact recommended_route object entering acceptReroute
    const recRoute = recommendation.recommended_route;
    let calcGeomLength = 0;
    if (recRoute.geometry?.coordinates) {
      for (let i = 1; i < recRoute.geometry.coordinates.length; i++) {
        calcGeomLength += haversineMeters(
          recRoute.geometry.coordinates[i-1][0], recRoute.geometry.coordinates[i-1][1],
          recRoute.geometry.coordinates[i][0], recRoute.geometry.coordinates[i][1]
        );
      }
    }
    const distDest = (selectedDestination && recRoute.geometry?.coordinates?.length) ? haversineMeters(
      recRoute.geometry.coordinates[0][0], recRoute.geometry.coordinates[0][1],
      selectedDestination.lon, selectedDestination.lat
    ) : 0;

    console.log(`[ACCEPT REROUTE DIAGNOSTIC] Entering acceptReroute():`, {
      route_id: recRoute.route_id,
      source: recRoute.source,
      distance_meters: recRoute.distance_meters,
      geometry_coordinates_length: recRoute.geometry?.coordinates?.length,
      first_coordinate: recRoute.geometry?.coordinates?.[0],
      last_coordinate: recRoute.geometry?.coordinates?.[recRoute.geometry.coordinates.length - 1],
      destination_distance: distDest,
      calculated_geometry_length: calcGeomLength
    });

    // In the SEVERE controlled test only, the congestion event has already
    // served its purpose once the driver accepts the bypass. Do not carry the
    // synthetic hotspot onto the new active route, otherwise the accepted route
    // can show a stray severe marker and later trigger a heavy/moderate alert.
    const routeToActivate =
      trafficTestModeRef.current === "severe"
        ? {
            ...recRoute,
            hotspots: (recRoute.hotspots || []).filter(
              (hotspot) => hotspot.cause !== "Controlled traffic test",
            ),
          }
        : recRoute;

    setIsApplyingReroute(true);
    const switched = activateRoute(routeToActivate, true);
    setIsApplyingReroute(false);
    if (switched) {
      // Any accepted reroute during a controlled traffic test ends that
      // test's synthetic congestion for the rest of the trip — not only an
      // accepted congestion-avoidance suggestion. Gating this solely on
      // is_congestion_avoidance meant the "faster route" branch (surfaced by
      // the periodic, non-avoidance check) never marked the scenario
      // consumed, so a later dynamic-mode phase change — or any fresh
      // /route call — could still inject another synthetic HEAVY/SEVERE
      // hotspot even though the driver had already rerouted once.
      if (trafficTestModeRef.current !== "real") {
        testCongestionConsumedRef.current = true;
      }
      if (testReroutePausedRef.current) {
        testReroutePausedRef.current = false;
        setIsSimPlaying(true);
      }
      if (recommendation.is_congestion_avoidance) {
        const viaRoad = recommendation.recommended_route?.steps?.find(
          (step) => Boolean(step.name?.trim()) && step.maneuver?.type !== "depart",
        )?.name?.trim();
        TTSService.speakRerouteSuggestion(recommendation.time_saved_minutes, viaRoad, true);
      } else {
        TTSService.announce(
          `Route updated. The new route saves about ${Math.round(recommendation.time_saved_minutes)} minutes.`,
          SpeechPriority.NORMAL,
          `route_updated_${recommendation.recommended_route?.route_id || Date.now()}`,
        );
      }
    } else {
      setActiveRerouteRecommendation(null);
      RerouteEngine.dismissRecommendation();
      if (testReroutePausedRef.current) {
        testReroutePausedRef.current = false;
        setIsSimPlaying(true);
      }
      TTSService.announce(
        "Could not switch routes. Continue on the current route.",
        SpeechPriority.NORMAL,
        "reroute_switch_failed",
      );
    }
  };

  // Speech rate is evaluated at dequeue time from the same ref used by the turn thresholds.
  useEffect(() => {
    TTSService.setRateProvider(() =>
      Math.min(2.0, 1.05 * (1 + (simSpeedMultiplierRef.current - 1) * 0.25)),
    );
    return () => TTSService.reset();
  }, []);

  const triggerDynamicRerouteCheck = useCallback(
    async (force: boolean = false, pinnedHotspotId?: string | null) => {
      const activeRoute = routes[activeRouteIndex];


      if (!activeRoute || !selectedDestination || !currentLocation || !isNavigating) return;

      const currentReqId = ++rerouteRequestIdRef.current;

      // Ensure we are physically on route before fetching a reroute
      const proj = projectPointOntoRoute(currentLocation, activeRoute);
      const distanceFromVehicleToRouteMeters = haversineMeters(currentLocation.lon, currentLocation.lat, proj.projectedPoint.lon, proj.projectedPoint.lat);
      if (distanceFromVehicleToRouteMeters > 500) {
        console.warn("[REROUTE BLOCKED] Current vehicle position is not on active route.");
        return;
      }

      // Check distance to destination
      const distToDest = haversineMeters(currentLocation.lon, currentLocation.lat, selectedDestination.lon, selectedDestination.lat);
      if (distToDest <= 500) return;
      
      const totalRouteDistance = activeRoute.distance_meters || 1;
      const traversedDist = simDistanceTraversedRef.current;
      const remainingDist = Math.max(0, totalRouteDistance - traversedDist);
      const progressRatio = Math.min(1.0, traversedDist / totalRouteDistance);
      
      // Calculate true remaining ETA instead of passing full route ETA
      const totalSeconds = activeRoute.predicted_duration_seconds || activeRoute.duration_seconds || 600;
      const remainingSec = Math.max(0, (1.0 - progressRatio) * totalSeconds);

      try {
        const rec = await RerouteEngine.checkAndReevaluate(
          currentLocation.lat,
          currentLocation.lon,
          selectedDestination.lat,
          selectedDestination.lon,
          remainingSec,
          currentVehicleSpeed,
          isEmergencyMode,
          force,
          trafficTestModeRef.current,
          progressRatio,
          force ? getUpcomingAvoidHotspots(activeRoute, traversedDist, pinnedHotspotId) : [],
          recentRoutesRef.current,
          !testCongestionConsumedRef.current
        );
        
        // Ignore stale responses
        if (currentReqId !== rerouteRequestIdRef.current) return;
      } catch (e) {
        console.error("Reroute check error", e);
      }
    },
    [routes, activeRouteIndex, selectedDestination, currentLocation, currentVehicleSpeed, isEmergencyMode, isNavigating]
  );

  const hasInitializedJourneyRef = useRef(false);

  // Active navigation start / stop handling
  useEffect(() => {
    if (isNavigating) {
      if (hasInitializedJourneyRef.current) return; // Do not reset if journey is already running

      // Cancel any lingering animation frame from a previous session to prevent
      // duplicate loops when start is pressed.
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }

      const activeRoute = routes[activeRouteIndex];
      if (activeRoute && activeRoute.geometry?.coordinates?.length > 0) {
        const firstCoord = activeRoute.geometry.coordinates[0];
        const startLocation = { lon: firstCoord[0], lat: firstCoord[1] };
        currentLocationRef.current = startLocation;
        setCurrentLocation(startLocation);
        simDistanceTraversedRef.current = 0;
        lastAlertCheckDistanceRef.current = -999;
        lastAutoRerouteCheckTimeRef.current = 0;
        isTransitioningRouteRef.current = false;
        testReroutePausedRef.current = false;
        TTSService.warmUp();
        setSimProgressPercent(0);
        setSimDistanceRemainingM(activeRoute.distance_meters || 0);
        setSimEtaSeconds(activeRoute.predicted_duration_seconds || activeRoute.duration_seconds || 0);
        // Reset the frame timestamp so the first animateDrive tick computes a
        // sane delta instead of a huge jump from a stale previous value.
        lastFrameTimeRef.current = performance.now();
        // Ensure simulation is playing — set state *after* all refs are
        // initialised so the simulation-loop effect picks up correct values.
        setIsSimPlaying(true);

        TTSService.announce(
          isEmergencyMode
            ? "Starting Emergency Priority Navigation. Clear corridor mode active."
            : "Starting navigation. Drive safely.",
          SpeechPriority.NORMAL,
          `navigation_started_${activeRoute.route_id || activeRouteIndex}`,
        );
        hasInitializedJourneyRef.current = true;
      }
    } else {
      hasInitializedJourneyRef.current = false;
      TTSService.reset();
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      isTransitioningRouteRef.current = false;
      testReroutePausedRef.current = false;
      AlertManager.reset();
      RerouteEngine.dismissRecommendation();
      RerouteEngine.dismissNoRouteReason();
      currentLocationRef.current = null;
      setCurrentLocation(null);
      setActiveRerouteRecommendation(null);
    }
  }, [isNavigating, activeRouteIndex, routes, isEmergencyMode]);

  // High-Frequency Smooth Interpolated Driving Simulation Loop (Section 4 & 5)
  useEffect(() => {
    if (!isNavigating || !isSimPlaying) {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      return;
    }

    const activeRoute = routes[activeRouteIndex];
    if (!activeRoute || !activeRoute.geometry?.coordinates) return;

    const coords = activeRoute.geometry.coordinates as [number, number][];
    const totalPoints = coords.length;
    if (totalPoints < 2) return;

    // Precalculate segment lengths and cumulative distances
    const segmentDistances: number[] = [];
    const cumulativeDistances: number[] = [0];
    let totalRouteDistanceM = 0;

    for (let i = 1; i < totalPoints; i++) {
      const d = haversineMeters(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
      segmentDistances.push(d);
      totalRouteDistanceM += d;
      cumulativeDistances.push(totalRouteDistanceM);
    }

    if (totalRouteDistanceM <= 0) return;

    // Initialize bearing from first segment
    if (currentBearingRef.current === 0 && totalPoints >= 2) {
      currentBearingRef.current = calculateBearingAngle(
        coords[0][0],
        coords[0][1],
        coords[1][0],
        coords[1][1]
      );
      setVehicleBearing(currentBearingRef.current);
    }

    lastFrameTimeRef.current = performance.now();

    const animateDrive = (now: number) => {
      if (isTransitioningRouteRef.current) {
        animationFrameIdRef.current = requestAnimationFrame(animateDrive);
        return;
      }
      const liveLocation = currentLocationRef.current;
      if (!isNavigating || !isSimPlaying || !activeRoute || !liveLocation) return;
      // Measure distance to route polyline once per route activation
      if (!lastFrameTimeRef.current || (now - lastFrameTimeRef.current < 100 && simDistanceTraversedRef.current === 0)) {
        const { distanceToRouteMeters } = projectPointOntoRoute(liveLocation, activeRoute);
        console.log(`[NavigationContext] initial frame - distance from physical location to route polyline: ${distanceToRouteMeters.toFixed(2)}m`);
      }

      const dtSeconds = Math.min(0.1, (now - lastFrameTimeRef.current) / 1000);
      lastFrameTimeRef.current = now;

      const currentDist = simDistanceTraversedRef.current;

      // Section 3: Arrival sanity check
      if (currentDist >= totalRouteDistanceM) {
        // Enforce strict arrival: must actually be near destination
        const distToDest = selectedDestination && liveLocation
          ? haversineMeters(liveLocation.lon, liveLocation.lat, selectedDestination.lon, selectedDestination.lat)
          : 0;

        const MIN_REASONABLE_ROUTE_DISTANCE = 50; // Guard against 9m phantom routes
        
        if (totalRouteDistanceM < MIN_REASONABLE_ROUTE_DISTANCE && distToDest > 50) {
          console.error(`[NavigationContext] CATASTROPHIC ROUTE ERROR: Route is only ${Math.round(totalRouteDistanceM)}m long, but destination is ${Math.round(distToDest)}m away. ABORTING ARRIVAL.`);
          // We do not arrive. The route is fundamentally broken.
          // Fallback logic could go here, but for now we halt simulation to prevent teleportation.
          setIsSimPlaying(false);
          return;
        }

        if (distToDest <= 50) {
          if (totalRouteDistanceM < 50) {
            console.log("[NavigationContext] Arrived on short route segment:", Math.round(totalRouteDistanceM), "m");
          } else {
            console.log("[NavigationContext] Arrived at destination.");
          }
          setSimProgressPercent(100);
          setSimDistanceRemainingM(0);
          setSimEtaSeconds(0);
          setIsSimPlaying(false);
          AlertManager.reset();
          RerouteEngine.dismissRecommendation();
          RerouteEngine.dismissNoRouteReason();
          setActiveRerouteRecommendation(null);
          PushNotificationService.clearCongestionAlert();
          PushNotificationService.clearRerouteAlert();
          const lastPt = coords[totalPoints - 1];
          setCurrentLocation({ lon: lastPt[0], lat: lastPt[1] });
          TTSService.announce(
            "You have arrived at your destination.",
            SpeechPriority.CRITICAL,
            `arrived_${activeRoute.route_id || activeRouteIndex}`,
          );
          return;
        } else {
          // False arrival due to malformed route, do not trigger arrival.
          console.warn(`[NavigationContext] Suppressing false arrival: route end reached but destination is ${Math.round(distToDest)}m away.`);
          // Pause simulation to prevent out-of-bounds error, but do not arrive.
          setIsSimPlaying(false);
          return;
        }
      }

      // Progress ratio (0.0 to 1.0)
      const progressRatio = Math.min(1.0, currentDist / totalRouteDistanceM);
      const scenarioProgress = trafficTestModeRef.current === "dynamic"
        ? Math.max(dynamicProgressRef.current, progressRatio)
        : progressRatio;
      if (trafficTestModeRef.current === "dynamic") dynamicProgressRef.current = scenarioProgress;

      // Determine current segment speed
      let speedKmh = 40.0;
      if (activeRoute.segments && activeRoute.segments.length > 0) {
        // PATCH: locate the segment by DISTANCE travelled. The old uniform index
        // (progress * segmentCount) drifted away from the real segment as soon as segments had
        // unequal lengths (e.g. when a congestion zone is cut out of a longer chunk).
        let acc = 0;
        let segIdx = activeRoute.segments.length - 1;
        for (let i = 0; i < activeRoute.segments.length; i++) {
          acc += activeRoute.segments[i].distance_meters || 0;
          if (currentDist <= acc) { segIdx = i; break; }
        }
        const seg = activeRoute.segments[segIdx];
        if (seg && seg.current_speed_kmh) {
          speedKmh = seg.current_speed_kmh;
        }
      }

      // Simulation advancement: responsive pace scaling (~6x real-time at 1x)
      const simPaceMultiplier = 6.0;
      const speedMs = (speedKmh * 1000) / 3600;
      const deltaDistance = speedMs * simPaceMultiplier * simSpeedMultiplier * dtSeconds;
      const newDist = Math.min(totalRouteDistanceM, currentDist + deltaDistance);
      console.log("[REROUTE-DEBUG]", { event: "animateDrive_tick", dist: simDistanceTraversedRef.current, totalRouteDistanceM });
      simDistanceTraversedRef.current = newDist;

      // Find the segment containing newDist
      let segIndex = 0;
      for (let i = 0; i < segmentDistances.length; i++) {
        if (newDist >= cumulativeDistances[i] && newDist <= cumulativeDistances[i + 1]) {
          segIndex = i;
          break;
        }
        if (i === segmentDistances.length - 1) {
          segIndex = i;
        }
      }

      const p1 = coords[segIndex];
      const p2 = coords[Math.min(totalPoints - 1, segIndex + 1)];
      const segLen = Math.max(0.1, segmentDistances[segIndex] || 1);
      const segOffset = Math.max(0, newDist - cumulativeDistances[segIndex]);
      const t = Math.min(1.0, Math.max(0.0, segOffset / segLen));

      // Interpolate coordinates
      const interpLon = p1[0] + t * (p2[0] - p1[0]);
      const interpLat = p1[1] + t * (p2[1] - p1[1]);
      const newLocation = { lon: interpLon, lat: interpLat };

      // Interpolate Bearing smoothly with shortest angular distance
      const targetBearing = calculateBearingAngle(p1[0], p1[1], p2[0], p2[1]);
      const currBearing = currentBearingRef.current;
      const angleDiff = ((((targetBearing - currBearing) % 360) + 540) % 360) - 180;
      const smoothedBearing = (currBearing + angleDiff * Math.min(1.0, 8.0 * dtSeconds) + 360) % 360;
      currentBearingRef.current = smoothedBearing;

      // Update state
      currentLocationRef.current = newLocation;
      setCurrentLocation(newLocation);
      setVehicleBearing(smoothedBearing);
      setCurrentVehicleSpeed(Math.round(speedKmh));
      setSimProgressPercent(Math.min(100, Math.round(progressRatio * 100)));
      setSimDistanceRemainingM(Math.max(0, totalRouteDistanceM - newDist));
      setSimEtaSeconds(Math.max(0, Math.round(
        (activeRoute.predicted_duration_seconds || activeRoute.duration_seconds || 0) * (1 - progressRatio)
      )));

      // Continuously update the active alert's distance text every frame so the
      // banner counts down in real time rather than freezing between check gates.
      const currentActiveAlert = AlertManager.getActiveAlert();
      if (currentActiveAlert && activeRoute.hotspots) {
        const hotspot = activeRoute.hotspots.find(
          (h) => h.hotspot_id === currentActiveAlert.hotspotId
        );
        if (hotspot) {
          const liveDistance = hotspot.distance_from_origin_m - newDist;
          if (liveDistance < -50) {
            // Vehicle has passed the hotspot by more than 50m — clear the alert
            AlertManager.dismissCurrentAlert();
          } else {
            AlertManager.updateLiveDistance(Math.max(0, liveDistance));
          }
        }
      }

      // Clear stale reroute recommendation if the vehicle has passed the hotspot
      // that triggered it, preventing the popup from lingering.
      const currentReroute = RerouteEngine.getActiveRecommendation();
      if (currentReroute && currentReroute.is_congestion_avoidance && activeRoute.hotspots) {
        const allHotspotsPassedOrCleared = (activeRoute.hotspots || [])
          .filter(h => h.congestion_level === "HEAVY" || h.congestion_level === "SEVERE")
          .every(h => h.distance_from_origin_m < newDist - 50);
        if (allHotspotsPassedOrCleared && activeRoute.hotspots.length > 0) {
          RerouteEngine.dismissRecommendation();
          setActiveRerouteRecommendation(null);
        }
      }

      // Speed-Aware Congestion Alert Evaluation (Throttled per ~15m of progress)
      // Using 15m keeps the alert distance responsive without excessive backend calls
      // (this evaluation is local against already-loaded route hotspots).
      if (Math.abs(newDist - lastAlertCheckDistanceRef.current) >= 15) {
        lastAlertCheckDistanceRef.current = newDist;
        const hotspots = activeRoute.hotspots || [];

        AlertManager.evaluatePosition(interpLat, interpLon, hotspots, speedKmh, (alert) => {
          // PATCH: speak / push ONCE per hotspot. Stage 2 / stage 3 (500 m / 200 m) and severity
          // escalations only refresh the banner; they used to re-announce the same jam 2-3 times.
          if (alert.firstAnnouncement) {
            TTSService.speakCongestionAlert(
              alert.locationName,
              alert.distanceText,
              alert.averageSpeedKmh,
              alert.estimatedDelaySeconds ? alert.estimatedDelaySeconds / 60 : undefined,
              true,
              alert.congestionLevel
            );

            PushNotificationService.sendCongestionAlert(
              alert.locationName,
              alert.distanceText,
              alert.estimatedDelaySeconds ? alert.estimatedDelaySeconds / 60 : 3,
              alert.averageSpeedKmh,
              alert.congestionLevel
            );
          }

          // Proactively check for reroute when a new congestion alert stage triggers.
          // Static HEAVY/SEVERE tests use this path. DYNAMIC is intentionally handled
          // only by the phase transition below so it cannot reroute at HEAVY.
          if (
            (alert.congestionLevel === "HEAVY" || alert.congestionLevel === "SEVERE") &&
            selectedDestination &&
            !RerouteEngine.getActiveRecommendation() &&
            trafficTestModeRef.current === "real"
          ) {
            const traversed = simDistanceTraversedRef.current;
            const activeRouteDist = activeRoute.distance_meters || 1;
            const activeRatio = Math.min(1.0, traversed / activeRouteDist);
            const remainingSec = Math.max(0, (1.0 - activeRatio) * (activeRoute.predicted_duration_seconds || 600));
            
            RerouteEngine.checkAndReevaluate(
              interpLat,
              interpLon,
              selectedDestination.lat,
              selectedDestination.lon,
              remainingSec,
              speedKmh,
              isEmergencyMode,
              true,
              trafficTestModeRef.current,
              Math.min(1, newDist / totalRouteDistanceM),
              getUpcomingAvoidHotspots(activeRoute, newDist),
              recentRoutesRef.current,
              !testCongestionConsumedRef.current
            );
          }
        }, newDist);
      }

      // Step-by-step Turn Maneuver Guidance & Two-Tier Voice Announcements
      if (activeRoute.steps && activeRoute.steps.length > 0) {
        let cumulativeStepDist = 0;
        let currentStepIndex = 0;
        let estDistToTurn = 0;

        for (let i = 0; i < activeRoute.steps.length; i++) {
          const step = activeRoute.steps[i];
          cumulativeStepDist += (step.distance || 0);
          if (cumulativeStepDist > currentDist) {
            currentStepIndex = i;
            estDistToTurn = cumulativeStepDist - currentDist;
            break;
          }
        }

        if (cumulativeStepDist <= currentDist) {
          currentStepIndex = activeRoute.steps.length - 1;
          estDistToTurn = 0;
        }

        // OSRM's current step describes the maneuver that entered this road; the next
        // step is the maneuver still ahead of the vehicle. Clamp to the arrival step.
        const upcomingStepIndex = Math.min(currentStepIndex + 1, activeRoute.steps.length - 1);
        const upcomingStep = activeRoute.steps[upcomingStepIndex];

        if (upcomingStep) {
          setNextManeuver(upcomingStep);
          setNextManeuverDistanceM(Math.round(estDistToTurn));

          const speedMultiplier = simSpeedMultiplierRef.current;
          // Scale thresholds with speed to announce earlier at higher speeds.
          // Base advance: 500m (was 400), base imminent: 200m (was 150).
          // This ensures instructions are spoken BEFORE the maneuver.
          const advanceThreshold = 500 * speedMultiplier;
          const imminentThreshold = 200 * speedMultiplier;
          
          const routeId = activeRoute.route_id || `idx-${activeRouteIndex}`;

          // Tier 1: Advance Heads-up
          if (
            estDistToTurn <= advanceThreshold &&
            estDistToTurn > imminentThreshold
          ) {
            const announcement = getManeuverAnnouncement(upcomingStep, estDistToTurn);
            if (announcement) {
              TTSService.announce(
                announcement,
                SpeechPriority.CRITICAL,
                `${routeId}_${upcomingStepIndex}_advance`,
                30 * 60_000,
              );
            }
          }

          // Tier 2: Imminent
          if (estDistToTurn <= imminentThreshold) {
            const imminentText = getManeuverInstruction(upcomingStep);
            TTSService.announce(
              imminentText,
              SpeechPriority.CRITICAL,
              `${routeId}_${upcomingStepIndex}_imminent`,
              30 * 60_000,
            );
          }
        }
      }

      // Controlled traffic scenarios have their bypass preplanned before the simulation
      // starts. The vehicle opens the chooser at the common road approach; no live OSRM
      // request is awaited and a missing plan never freezes the animation.
      const controlledMode = trafficTestModeRef.current;
      const controlledTestEnabled = controlledMode === "heavy" || controlledMode === "severe" || controlledMode === "dynamic";
      const plannedSwitchDistance = activeRoute.controlled_test_switch_distance_m;
      const plannedZoneEnd = activeRoute.controlled_test_zone_end_distance_m;

      const offerPlannedControlledBypass = () => {
        if (testRerouteTriggeredRef.current || testCongestionConsumedRef.current || !selectedDestination) return;
        const bypassRoute = buildControlledBypassSuffix(activeRoute, { lat: interpLat, lon: interpLon });
        if (!bypassRoute) {
          testRerouteTriggeredRef.current = true;
          console.warn("[TrafficTest] Preplanned bypass was not aligned with the vehicle; continuing on the current route.");
          setNoRouteReason(null);
          return;
        }
        testRerouteTriggeredRef.current = true;
        const remainingSeconds = Math.max(0, (1 - progressRatio) *
          (activeRoute.predicted_duration_seconds || activeRoute.duration_seconds || 600));
        const bypassDuration = bypassRoute.predicted_duration_seconds || bypassRoute.duration_seconds || 0;
        const etaDelta = remainingSeconds - bypassDuration;
        const recommendation: RerouteRecommendation = {
          is_reroute_recommended: true,
          is_congestion_avoidance: true,
          time_saved_seconds: etaDelta,
          time_saved_minutes: Number((etaDelta / 60).toFixed(1)),
          original_remaining_seconds: remainingSeconds,
          recommended_duration_seconds: bypassDuration,
          recommended_route: bypassRoute,
          alternative_routes: [bypassRoute],
          reason: "A preplanned OSRM street route avoids the complete synthetic congestion stretch and rejoins the destination without moving the vehicle.",
        };
        testReroutePausedRef.current = true;
        setIsSimPlaying(false);
        setNoRouteReason(null);
        setActiveRerouteRecommendation(recommendation);
      };

      if (controlledTestEnabled && !testCongestionConsumedRef.current && typeof plannedSwitchDistance === "number") {
        if (controlledMode === "dynamic") {
          // Ramp LOW -> MODERATE -> HEAVY -> SEVERE as the vehicle approaches the
          // planned split. SEVERE occurs at the switching point, before the synthetic jam.
          const switchRatio = Math.max(0.12, Math.min(0.48, plannedSwitchDistance / Math.max(1, totalRouteDistanceM)));
          const phaseProgress = Math.min(1, (scenarioProgress / switchRatio) * 0.40);
          const phase = dynamicTrafficPhase(phaseProgress);
          if (phase !== lastDynamicPhaseRef.current) {
            lastDynamicPhaseRef.current = phase;
            setRoutes((currentRoutes) => currentRoutes.map((route) =>
              route.route_id === activeRoute.route_id ? applyControlledTrafficPhase(route, phase) : route
            ));
          }
          if (phase === "SEVERE" && newDist >= plannedSwitchDistance - 5) offerPlannedControlledBypass();
          if (typeof plannedZoneEnd === "number" && newDist > plannedZoneEnd + 30 && !testRerouteTriggeredRef.current) {
            testCongestionConsumedRef.current = true;
            lastDynamicPhaseRef.current = "LOW";
            setRoutes((currentRoutes) => currentRoutes.map((route) =>
              route.route_id === activeRoute.route_id ? applyControlledTrafficPhase(route, "LOW") : route
            ));
            AlertManager.reset();
          }
        } else if (newDist >= plannedSwitchDistance - 5) {
          offerPlannedControlledBypass();
        }
      }
      // Continuous automatic reroute re-evaluation is real-navigation behaviour.
      // Controlled HEAVY/SEVERE/DYNAMIC dropdown tests must not perform unrelated
      // OSRM/ML reroutes before their synthetic congestion event fires.
      const controlledTrafficTest =
        trafficTestModeRef.current === "heavy" ||
        trafficTestModeRef.current === "severe" ||
        trafficTestModeRef.current === "dynamic";
      const nowMs = Date.now();
      if (
        !controlledTrafficTest &&
        selectedDestination &&
        !RerouteEngine.getActiveRecommendation() &&
        nowMs - lastAutoRerouteCheckTimeRef.current > 7000
      ) {
        lastAutoRerouteCheckTimeRef.current = nowMs;
        const traversed = simDistanceTraversedRef.current;
        const activeRouteDist = activeRoute.distance_meters || 1;
        const activeRatio = Math.min(1.0, traversed / activeRouteDist);
        const remainingSec = Math.max(0, (1.0 - activeRatio) * (activeRoute.predicted_duration_seconds || 600));
        
        RerouteEngine.checkAndReevaluate(
          interpLat,
          interpLon,
          selectedDestination.lat,
          selectedDestination.lon,
          remainingSec,
          speedKmh,
          isEmergencyMode,
          false,
          trafficTestModeRef.current,
          trafficTestModeRef.current === "dynamic" ? scenarioProgress : activeRatio,
          [],
          recentRoutesRef.current,
          !testCongestionConsumedRef.current
        );
      }

      animationFrameIdRef.current = requestAnimationFrame(animateDrive);
    };

    animationFrameIdRef.current = requestAnimationFrame(animateDrive);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [
    isNavigating,
    isSimPlaying,
    simSpeedMultiplier,
    routes,
    activeRouteIndex,
    selectedDestination,
    isEmergencyMode,
    refreshTrafficScenario,
  ]);

  // Backend Health Polling
  useEffect(() => {
    const pollHealth = async () => {
      try {
        await checkHealth();
        setBackendOnline(true);
      } catch {
        setBackendOnline(false);
      }
    };
    pollHealth();
    const interval = setInterval(pollHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        sourceQuery,
        setSourceQuery,
        destinationQuery,
        setDestinationQuery,
        searchResults,
        setSearchResults,
        selectedOrigin,
        setSelectedOrigin,
        selectedDestination,
        setSelectedDestination,
        routes,
        setRoutes,
        activeRouteIndex,
        setActiveRouteIndex,
        isNavigating,
        setIsNavigating,
        backendOnline,

        activeLayerMode,
        setActiveLayerMode,
        toggleLayerMode,
        recenterTrigger,
        triggerRecenter,
        isLoadingRoutes,
        setIsLoadingRoutes,
        currentZoom,
        setCurrentZoom,
        pinDropMode,
        setPinDropMode,
        isEmergencyMode,
        trafficTestMode,
        runTrafficTest,
        setIsEmergencyMode,
        toggleEmergencyMode,
        swapSourceAndDestination,
        calculateRoutes,

        // Real-time navigation & congestion states
        currentLocation,
        vehicleBearing,
        isApplyingReroute,
        currentVehicleSpeed,
        simProgressPercent,
        simDistanceRemainingM,
        simEtaSeconds,
        isSimPlaying,
        setIsSimPlaying,
        simSpeedMultiplier,
        setSimSpeedMultiplier,
        activeAlert,
        dismissAlert,
        activeRerouteRecommendation,
        dismissReroute,
        acceptReroute,
        triggerDynamicRerouteCheck,
        noRouteReason,
        dismissNoRouteReason,
        navigationHudHeight,
        setNavigationHudHeight,

        nextManeuver,
        nextManeuverDistanceM,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return context;
};