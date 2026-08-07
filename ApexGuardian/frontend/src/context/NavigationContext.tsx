"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { PlaceSearchResult, CandidateRoute, checkHealth, fetchRoutes } from "@/lib/api";

export interface Coordinate {
  lat: number;
  lon: number;
  name?: string;
}

export type PinDropMode = "none" | "source" | "destination";
export type LayerMode = "ALL" | "AI_ONLY" | "STANDARD_ONLY";

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
  trafficLayerActive: boolean;
  setTrafficLayerActive: React.Dispatch<React.SetStateAction<boolean>>;
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
  swapSourceAndDestination: () => void;
  calculateRoutes: (origin: Coordinate, dest: Coordinate) => Promise<void>;
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
  const [trafficLayerActive, setTrafficLayerActive] = useState(false);
  const [activeLayerMode, setActiveLayerMode] = useState<LayerMode>("ALL");
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(12.5);
  const [pinDropMode, setPinDropMode] = useState<PinDropMode>("none");

  const toggleLayerMode = () => {
    setActiveLayerMode((prev) => {
      if (prev === "ALL") return "AI_ONLY";
      if (prev === "AI_ONLY") return "STANDARD_ONLY";
      return "ALL";
    });
  };

  const triggerRecenter = () => setRecenterTrigger((prev) => prev + 1);

  const calculateRoutes = async (origin: Coordinate, dest: Coordinate) => {
    setIsLoadingRoutes(true);
    try {
      const response = await fetchRoutes(origin.lat, origin.lon, dest.lat, dest.lon);
      if (response.success && response.candidates.length > 0) {
        setRoutes(response.candidates);
        setActiveRouteIndex(0);
      }
    } catch (err) {
      console.error("Routing error:", err);
    } finally {
      setIsLoadingRoutes(false);
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
        trafficLayerActive,
        setTrafficLayerActive,
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
        swapSourceAndDestination,
        calculateRoutes,
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
