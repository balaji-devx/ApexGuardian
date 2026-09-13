"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import {
  PlaceSearchResult,
  CandidateRoute,
  checkHealth,
  fetchRoutes,
  RerouteRecommendation,
} from "@/lib/api";
import { AlertManager, ActiveCongestionAlert } from "@/lib/alertManager";
import { TTSService, SpeechPriority } from "@/lib/ttsService";
import { PushNotificationService } from "@/lib/pushNotificationService";
import { RerouteEngine } from "@/lib/rerouteEngine";
import { getManeuverInstruction, getManeuverAnnouncement } from "@/lib/maneuverInstructions";

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
  calculateRoutes: (origin?: Coordinate | null, dest?: Coordinate | null, emergencyOverride?: boolean) => Promise<void>;

  // Real-Time Navigation & Congestion States
  currentLocation: Coordinate | null;
  vehicleBearing: number;
  currentVehicleSpeed: number;
  simProgressPercent: number;
  isSimPlaying: boolean;
  setIsSimPlaying: (playing: boolean) => void;
  simSpeedMultiplier: number;
  setSimSpeedMultiplier: (mult: number) => void;
  activeAlert: ActiveCongestionAlert | null;
  dismissAlert: () => void;
  activeRerouteRecommendation: RerouteRecommendation | null;
  dismissReroute: () => void;
  acceptReroute: (recommendation: RerouteRecommendation) => void;
  triggerDynamicRerouteCheck: (force?: boolean) => Promise<void>;
  isApplyingReroute: boolean;

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
  const [sourceQuery, setSourceQuery] = useState("MG Road, Bengaluru");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [selectedOrigin, setSelectedOrigin] = useState<Coordinate | null>({
    lat: 12.9756,
    lon: 77.6066,
    name: "MG Road, Bengaluru",
  });
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
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);

  // Real-Time Simulation & Navigation Telemetry
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [vehicleBearing, setVehicleBearing] = useState<number>(0);
  const [currentVehicleSpeed, setCurrentVehicleSpeed] = useState<number>(45.0);
  const [simProgressPercent, setSimProgressPercent] = useState<number>(0);
  const [isSimPlaying, setIsSimPlaying] = useState<boolean>(true);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState<number>(1);
  const [activeAlert, setActiveAlert] = useState<ActiveCongestionAlert | null>(null);
  const [activeRerouteRecommendation, setActiveRerouteRecommendation] = useState<RerouteRecommendation | null>(null);

  const [nextManeuver, setNextManeuver] = useState<any>(null);
  const [nextManeuverDistanceM, setNextManeuverDistanceM] = useState<number>(500);

  // Continuous Interpolation Distance and Animation References
  const simDistanceTraversedRef = useRef<number>(0);
  const currentBearingRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const lastAlertCheckDistanceRef = useRef<number>(-999);
  const lastAutoRerouteCheckTimeRef = useRef<number>(0);
  const spokenManeuverTiersRef = useRef<Map<number, Set<string>>>(new Map());
  const animationFrameIdRef = useRef<number | null>(null);
  const lastRerouteInteractionTimeRef = useRef<number>(0);
  const isTransitioningRouteRef = useRef<boolean>(false);
  const rerouteRequestIdRef = useRef<number>(0);
  const [isApplyingReroute, setIsApplyingReroute] = useState(false);
  
  const activeRouteRef = useRef<CandidateRoute | null>(null);
  useEffect(() => {
    activeRouteRef.current = routes[activeRouteIndex] || null;
  }, [routes, activeRouteIndex]);

  // Subscribe to AlertManager and RerouteEngine
  useEffect(() => {
    const unsubAlert = AlertManager.subscribe((alert) => {
      setActiveAlert(alert);
    });
    const unsubReroute = RerouteEngine.subscribe((rec) => {
      if (!rec || !rec.is_reroute_recommended || !rec.recommended_route) {
        setActiveRerouteRecommendation(null);
        return;
      }
      
      const now = Date.now();
      if (now - lastRerouteInteractionTimeRef.current < 30000) {
        // Cooldown active, ignore new recommendations
        return;
      }

      // Check if genuinely different
      const currentRoute = activeRouteRef.current;
      if (currentRoute) {
        // simple heuristic: if total distance is within 5% and bearing/steps are similar
        const distDiff = Math.abs(currentRoute.distance_meters - rec.recommended_route.distance_meters);
        if (distDiff < currentRoute.distance_meters * 0.05) {
          // Likely the same route, just advanced slightly
          return;
        }
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
    emergencyOverride?: boolean
  ) => {
    const originCoord = origin || selectedOrigin;
    const destCoord = dest || selectedDestination;
    if (!originCoord || !destCoord) return;

    const emergency = emergencyOverride !== undefined ? emergencyOverride : isEmergencyMode;

    setIsLoadingRoutes(true);
    try {
      const response = await fetchRoutes(
        originCoord.lat,
        originCoord.lon,
        destCoord.lat,
        destCoord.lon,
        emergency
      );
      if (response.success && response.candidates.length > 0) {
        setRoutes(response.candidates);
        setActiveRouteIndex(0);
        simDistanceTraversedRef.current = 0;
        lastAlertCheckDistanceRef.current = -999;
        lastAutoRerouteCheckTimeRef.current = 0;
        spokenManeuverTiersRef.current.clear();
        AlertManager.reset();
        RerouteEngine.dismissRecommendation();
      }
    } catch (err) {
      console.error("[NavigationContext] Routing calculation error:", err);
    } finally {
      setIsLoadingRoutes(false);
    }
  };

  const toggleEmergencyMode = () => {
    const newEmergency = !isEmergencyMode;
    setIsEmergencyMode(newEmergency);
    if (selectedOrigin && selectedDestination) {
      calculateRoutes(selectedOrigin, selectedDestination, newEmergency);
    }
  };

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
  };

  const activateRoute = (newRoute: CandidateRoute, preservePosition: boolean = false) => {
    if (isTransitioningRouteRef.current) return;
    if (!newRoute || !newRoute.geometry?.coordinates) return;

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
      proj = projectPointOntoRoute(currentLocation, newRoute);
      
      // VERIFY activateRoute safety
      const isImplausiblyFar = proj.distanceToRouteMeters > 500; // 500m off-route is implausible
      const isProjectedNearEndWhileNotActuallyNearDest = 
        (totalRouteDistance - proj.distanceAlongRouteMeters < 50) && (distToDest > 100);

      if (isImplausiblyFar || isProjectedNearEndWhileNotActuallyNearDest) {
        console.warn(`[NavigationContext] Reroute projection rejected. distanceToRouteMeters: ${proj.distanceToRouteMeters}m, projectedDist: ${proj.distanceAlongRouteMeters}m, totalRouteDist: ${totalRouteDistance}m, distToDest: ${distToDest}m`);
        fallbackToStart = true;
      } else {
        simDistanceTraversedRef.current = proj.distanceAlongRouteMeters;
        // IMPORTANT: Do not teleport the vehicle to the projected point (proj.projectedPoint).
        // Let the simulation loop smoothly interpolate from the physical currentLocation.
      }
    } else {
      fallbackToStart = true;
    }

    if (fallbackToStart) {
      simDistanceTraversedRef.current = 0;
      if (newRoute.geometry?.coordinates?.length > 0) {
        setCurrentLocation({ lon: firstCoord[0], lat: firstCoord[1] });
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
    spokenManeuverTiersRef.current.clear();
    lastRerouteInteractionTimeRef.current = Date.now();
    
    AlertManager.reset();
    RerouteEngine.dismissRecommendation();
    TTSService.clearQueue();

    // Make newRoute the active route at index 0
    setRoutes((prev) => [newRoute, ...prev.filter((r) => r.route_id !== newRoute.route_id)]);
    setActiveRouteIndex(0);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isTransitioningRouteRef.current = false;
      });
    });
  };

  const acceptReroute = (recommendation: RerouteRecommendation) => {
    if (!recommendation || !recommendation.recommended_route) return;
    
    setIsApplyingReroute(true);
    TTSService.speak(
      `Reroute accepted. Taking alternative route saving ~${Math.round(recommendation.time_saved_minutes)} minutes.`,
      SpeechPriority.HIGH
    );

    activateRoute(recommendation.recommended_route, true);
    setIsApplyingReroute(false);
  };

  // Sync Simulation Speed with TTS Speech Rate (Section 6)
  useEffect(() => {
    TTSService.setRate(1.05 * Math.min(2.0, 1 + (simSpeedMultiplier - 1) * 0.25));
  }, [simSpeedMultiplier]);

  const triggerDynamicRerouteCheck = useCallback(
    async (force: boolean = false) => {
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
          force
        );
        
        // Ignore stale responses
        if (currentReqId !== rerouteRequestIdRef.current) return;
      } catch (e) {
        console.error("Reroute check error", e);
      }
    },
    [routes, activeRouteIndex, selectedDestination, currentLocation, currentVehicleSpeed, isEmergencyMode]
  );

  const hasInitializedJourneyRef = useRef(false);

  // Active navigation start / stop handling
  useEffect(() => {
    if (isNavigating) {
      if (hasInitializedJourneyRef.current) return; // Do not reset if journey is already running

      const activeRoute = routes[activeRouteIndex];
      if (activeRoute && activeRoute.geometry?.coordinates?.length > 0) {
        const firstCoord = activeRoute.geometry.coordinates[0];
        setCurrentLocation({ lon: firstCoord[0], lat: firstCoord[1] });
        simDistanceTraversedRef.current = 0;
        lastAlertCheckDistanceRef.current = -999;
        lastAutoRerouteCheckTimeRef.current = 0;
        spokenManeuverTiersRef.current.clear();
        setSimProgressPercent(0);
        setIsSimPlaying(true);
        lastFrameTimeRef.current = performance.now();

        TTSService.speak(
          isEmergencyMode
            ? "Starting Emergency Priority Navigation. Clear corridor mode active."
            : "Starting navigation. Drive safely.",
          SpeechPriority.HIGH
        );
        hasInitializedJourneyRef.current = true;
      }
    } else {
      hasInitializedJourneyRef.current = false;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      AlertManager.reset();
      RerouteEngine.dismissRecommendation();
      RerouteEngine.dismissNoRouteReason();
      setCurrentLocation(null);
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
      if (!isNavigating || !isSimPlaying || !activeRoute || !currentLocation) return;
      // Measure distance to route polyline once per route activation
      if (!lastFrameTimeRef.current || (now - lastFrameTimeRef.current < 100 && simDistanceTraversedRef.current === 0)) {
        const { distanceToRouteMeters } = projectPointOntoRoute(currentLocation, activeRoute);
        console.log(`[NavigationContext] initial frame - distance from physical location to route polyline: ${distanceToRouteMeters.toFixed(2)}m`);
      }

      const dtSeconds = Math.min(0.1, (now - lastFrameTimeRef.current) / 1000);
      lastFrameTimeRef.current = now;

      const currentDist = simDistanceTraversedRef.current;

      // Section 3: Arrival sanity check
      if (currentDist >= totalRouteDistanceM) {
        // Enforce strict arrival: must actually be near destination
        const distToDest = selectedDestination && currentLocation 
          ? haversineMeters(currentLocation.lon, currentLocation.lat, selectedDestination.lon, selectedDestination.lat)
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
          setIsSimPlaying(false);
          const lastPt = coords[totalPoints - 1];
          setCurrentLocation({ lon: lastPt[0], lat: lastPt[1] });
          TTSService.speak("You have arrived at your destination.", SpeechPriority.CRITICAL);
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

      // Determine current segment speed
      let speedKmh = 40.0;
      if (activeRoute.segments && activeRoute.segments.length > 0) {
        const segIdx = Math.min(
          activeRoute.segments.length - 1,
          Math.floor(progressRatio * activeRoute.segments.length)
        );
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
      setCurrentLocation(newLocation);
      setVehicleBearing(smoothedBearing);
      setCurrentVehicleSpeed(Math.round(speedKmh));
      setSimProgressPercent(Math.min(100, Math.round(progressRatio * 100)));

      // Speed-Aware Congestion Alert Evaluation (Throttled per ~80m of progress)
      if (Math.abs(newDist - lastAlertCheckDistanceRef.current) >= 80) {
        lastAlertCheckDistanceRef.current = newDist;
        const hotspots = activeRoute.hotspots || [];

        AlertManager.evaluatePosition(interpLat, interpLon, hotspots, speedKmh, (alert) => {
          TTSService.speakCongestionAlert(
            alert.locationName,
            alert.distanceText,
            alert.averageSpeedKmh,
            alert.estimatedDelaySeconds ? alert.estimatedDelaySeconds / 60 : undefined
          );

          PushNotificationService.sendCongestionAlert(
            alert.locationName,
            alert.distanceText,
            alert.estimatedDelaySeconds ? alert.estimatedDelaySeconds / 60 : 3,
            alert.averageSpeedKmh
          );

          // Proactively check for reroute when a new congestion alert stage triggers
          // Only check if no recommendation is already pending
          if (selectedDestination && !RerouteEngine.getActiveRecommendation()) {
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
              true // Force check on new hotspot alert
            );
          }
        });
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

        const step = activeRoute.steps[currentStepIndex];

        if (step) {
          setNextManeuver(step);
          setNextManeuverDistanceM(Math.round(estDistToTurn));

          const stepTiers = spokenManeuverTiersRef.current.get(currentStepIndex) || new Set<string>();

          const advanceThreshold = 400 * simSpeedMultiplier;
          const imminentThreshold = 150 * simSpeedMultiplier;
          
          const routeId = activeRoute.route_id || `idx-${activeRouteIndex}`;

          // Tier 1: Advance Heads-up
          if (
            estDistToTurn <= advanceThreshold &&
            estDistToTurn > imminentThreshold &&
            !stepTiers.has("advance")
          ) {
            stepTiers.add("advance");
            spokenManeuverTiersRef.current.set(currentStepIndex, stepTiers);
            const announcement = getManeuverAnnouncement(step, estDistToTurn);
            if (announcement) {
              TTSService.speak(announcement, SpeechPriority.CRITICAL, 15, `${routeId}_${currentStepIndex}_advance`);
            }
          }

          // Tier 2: Imminent
          if (estDistToTurn <= imminentThreshold && !stepTiers.has("imminent")) {
            stepTiers.add("imminent");
            spokenManeuverTiersRef.current.set(currentStepIndex, stepTiers);
            let modifier = step.maneuver?.modifier || "ahead";
            const imminentText = `Turn ${modifier}`;
            TTSService.speak(imminentText, SpeechPriority.CRITICAL, 15, `${routeId}_${currentStepIndex}_imminent`);
          }
        }
      }

      // Continuous Automatic Reroute Re-Evaluation (Gated when recommendation is already displayed)
      const nowMs = Date.now();
      if (
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
          false
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
