"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Navigation,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Zap,
  Siren,
  Activity,
  Flame,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { TTSService } from "@/lib/ttsService";

export const RouteCard: React.FC = () => {
  const [showHotspotList, setShowHotspotList] = useState(false);
  const {
    routes,
    activeRouteIndex,
    setActiveRouteIndex,
    selectedDestination,
    isNavigating,
    setIsNavigating,
    isLoadingRoutes,
    isEmergencyMode,
  } = useNavigation();

  if (isLoadingRoutes) {
    return (
      <div
        className={`w-full relative pointer-events-auto shrink-0 glass-panel rounded-2xl p-6 flex items-center justify-center gap-3 shadow-2xl ${
          isEmergencyMode ? "border-rose-500/80 shadow-rose-500/20" : ""
        }`}
      >
        <Loader2 className={`w-6 h-6 animate-spin ${isEmergencyMode ? "text-rose-600" : "text-emerald-600"}`} />
        <span className="text-sm font-semibold text-slate-700">
          {isEmergencyMode
            ? "Evaluating Priority Corridors & transit speeds..."
            : "Evaluating real-time traffic factors & ML congestion..."}
        </span>
      </div>
    );
  }

  if (!selectedDestination || routes.length === 0) return null;

  const currentRoute = routes[activeRouteIndex];
  if (!currentRoute) return null;

  const durationMin = Math.round(
    (currentRoute.predicted_duration_seconds || currentRoute.duration_seconds) / 60
  );

  const distanceKm = (currentRoute.distance_meters / 1000).toFixed(1);
  const isAIRoute = Boolean(currentRoute.is_ai_recommended);

  // Format user-friendly route label
  let routeLabel = currentRoute.recommendation_label;
  if (!routeLabel) {
    if (isAIRoute) {
      routeLabel = isEmergencyMode ? "Emergency Priority Corridor" : "Recommended Route";
    } else {
      routeLabel = "Standard Route";
    }
  } else if (routeLabel === "OSRM Preferred Route") {
    routeLabel = "Standard Route";
  } else if (routeLabel === "AI Recommended") {
    routeLabel = "Recommended Route";
  }

  const clearKm = currentRoute.clear_distance_km || 0.0;
  const modKm = currentRoute.moderate_distance_km || 0.0;
  const heavyKm = currentRoute.heavy_distance_km || 0.0;
  const severeKm = currentRoute.severe_distance_km || 0.0;
  const totalDelayMin = Math.max(0, Math.round((currentRoute.total_delay_seconds || 0) / 60));
  const hotspots = currentRoute.hotspots || [];

  // Sort hotspots by delay descending to find the primary bottleneck causing the delay
  const sortedHotspots = [...hotspots].sort(
    (a, b) => (b.estimated_delay_seconds || 0) - (a.estimated_delay_seconds || 0)
  );
  const worstHotspot = sortedHotspots[0];
  const otherHotspotsCount = sortedHotspots.length - 1;
  const worstHotspotName = worstHotspot
    ? worstHotspot.location_name.replace(/^(Near\s+|Central\s+)/i, "").split(",")[0]
    : "";

  const getMainRoadName = (route: typeof currentRoute) => {
    if (route.steps && route.steps.length > 1) {
      const namedStep = route.steps.find((s) => s.name && s.name.trim() !== "");
      if (namedStep && namedStep.name) return `Via ${namedStep.name}`;
    }
    return "Via Optimal Corridor";
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className={`w-full relative pointer-events-auto flex-1 min-h-0 glass-panel rounded-2xl p-5 shadow-2xl border overflow-y-auto transition-all duration-300 ${
          isEmergencyMode
            ? "border-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.25)] ring-1 ring-rose-500/40"
            : "border-slate-200/80"
        }`}
      >
        {/* Mode & Corridor Context Alert Header */}
        {isEmergencyMode ? (
          <div
            className={`mb-3 px-3.5 py-2 rounded-xl text-white flex items-center justify-between shadow-md ${
              isAIRoute
                ? "bg-gradient-to-r from-rose-600 to-red-600 ring-1 ring-rose-400/50"
                : "bg-gradient-to-r from-slate-700 to-slate-800 border border-slate-600"
            }`}
          >
            <div className="flex items-center gap-2">
              <Siren
                className={`w-4 h-4 fill-current ${isAIRoute ? "animate-bounce text-white" : "text-amber-400"}`}
              />
              <span className="text-xs font-black tracking-wider uppercase">
                {isAIRoute ? "Emergency Priority Corridor" : "Standard Alternate Path"}
              </span>
            </div>
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                isAIRoute ? "bg-white/20 text-white" : "bg-amber-400/20 text-amber-300"
              }`}
            >
              {isAIRoute ? "PRIORITY ACCESS" : "RESTRICTED ACCESS"}
            </span>
          </div>
        ) : null}

        {/* Destination Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded-md font-bold text-xs flex items-center gap-1 ${
                  isEmergencyMode
                    ? isAIRoute
                      ? "bg-rose-500/15 text-rose-700 border border-rose-500/30 font-extrabold"
                      : "bg-slate-200 text-slate-700 font-semibold"
                    : isAIRoute
                    ? "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 font-extrabold"
                    : "bg-blue-500/15 text-blue-700 border border-blue-500/30 font-extrabold"
                }`}
              >
                {isEmergencyMode && isAIRoute ? (
                  <Siren className="w-3 h-3 text-rose-600 fill-current" />
                ) : isAIRoute ? (
                  <Zap className="w-3 h-3 text-emerald-600 fill-current" />
                ) : null}
                {routeLabel}
              </span>
              <span className="flex items-center gap-1 text-slate-500 text-xs font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Guarded
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 line-clamp-1">
              {selectedDestination.name}
            </h3>
            <p className="text-xs text-slate-500 font-medium">{getMainRoadName(currentRoute)}</p>
          </div>
        </div>

        {/* Primary ETA Display with Location-Tied Delay Chip */}
        <div className="flex items-center gap-2.5 mb-3 flex-wrap">
          <span
            className={`text-3xl font-extrabold tracking-tight ${
              isEmergencyMode
                ? isAIRoute
                  ? "text-rose-600"
                  : "text-slate-700"
                : isAIRoute
                ? "text-emerald-600"
                : "text-blue-600"
            }`}
          >
            {durationMin} min
          </span>
          <span className="text-sm font-semibold text-slate-500">({distanceKm} km)</span>

          {/* Location-tied delay chip: only shown if there is a real hotspot causing delay */}
          {totalDelayMin > 0 && worstHotspot && (
            <button
              type="button"
              onClick={() => otherHotspotsCount > 0 && setShowHotspotList(!showHotspotList)}
              className={`text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200/90 shadow-sm flex items-center gap-1 transition ${
                otherHotspotsCount > 0 ? "cursor-pointer active:scale-95" : "cursor-default"
              }`}
              title={otherHotspotsCount > 0 ? "Click to view all congestion spots" : undefined}
            >
              <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>
                +{totalDelayMin}m delay near {worstHotspotName}
                {otherHotspotsCount > 0 ? ` · +${otherHotspotsCount} more` : ""}
              </span>
              {otherHotspotsCount > 0 && (
                showHotspotList ? (
                  <ChevronUp className="w-3.5 h-3.5 text-rose-500 ml-0.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-rose-500 ml-0.5" />
                )
              )}
            </button>
          )}
        </div>

        {/* Expanded Hotspots List (when chip is tapped) */}
        {showHotspotList && sortedHotspots.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 p-2.5 rounded-xl bg-rose-50/80 border border-rose-200/80 space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs font-black text-rose-900 uppercase tracking-wider px-1">
              <span>Congestion Hotspots On Route</span>
              <span className="text-[11px] font-semibold text-rose-600">{sortedHotspots.length} spots</span>
            </div>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {sortedHotspots.map((h, hIdx) => {
                const delayM = Math.max(1, Math.round((h.estimated_delay_seconds || 120) / 60));
                return (
                  <div
                    key={hIdx}
                    className="flex items-center justify-between p-2 rounded-lg bg-white/90 border border-rose-100 text-xs shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-800 line-clamp-1">{h.location_name}</p>
                        <p className="text-[11px] text-slate-500">
                          {h.average_speed_kmh} km/h avg speed
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded shadow-xs shrink-0">
                      +{delayM}m
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Traffic Breakdown Bar */}
        <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-blue-600" /> Traffic on This Route
            </span>
            <span>Live Flow</span>
          </div>

          <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-200">
            {clearKm > 0 && (
              <div
                className={`${isAIRoute ? "bg-emerald-500" : "bg-blue-500"} h-full`}
                style={{ width: `${(clearKm / parseFloat(distanceKm)) * 100}%` }}
                title={`Clear: ${clearKm} km`}
              />
            )}
            {modKm > 0 && (
              <div
                className="bg-amber-500 h-full"
                style={{ width: `${(modKm / parseFloat(distanceKm)) * 100}%` }}
                title={`Moderate: ${modKm} km`}
              />
            )}
            {(heavyKm > 0 || severeKm > 0) && (
              <div
                className="bg-rose-600 h-full"
                style={{ width: `${((heavyKm + severeKm) / parseFloat(distanceKm)) * 100}%` }}
                title={`Heavy/Severe: ${heavyKm + severeKm} km`}
              />
            )}
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-slate-500 flex-wrap gap-1">
            <span className={`${isAIRoute ? "text-emerald-700" : "text-blue-700"} flex items-center gap-1`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isAIRoute ? "bg-emerald-500" : "bg-blue-500"}`} /> {clearKm} km clear
            </span>
            {modKm > 0 && (
              <span className="text-amber-700 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {modKm} km slowed
              </span>
            )}
            {(heavyKm > 0 || severeKm > 0) && (
              <span className="text-rose-700 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" /> {heavyKm + severeKm} km heavy
              </span>
            )}
          </div>
        </div>

        {/* Candidate Routes Comparison */}
        {routes.length > 1 && (
          <div className="space-y-2 mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Other Route Options
            </p>
            <div className="grid grid-cols-1 gap-2">
              {routes.map((r, idx) => {
                const dur = Math.round((r.predicted_duration_seconds || r.duration_seconds) / 60);
                const dist = (r.distance_meters / 1000).toFixed(1);
                const isSelected = idx === activeRouteIndex;
                const isAI = Boolean(r.is_ai_recommended);
                let labelText = r.recommendation_label;
                if (!labelText) {
                  if (isAI) {
                    labelText = isEmergencyMode ? "Emergency Priority" : "Recommended Route";
                  } else {
                    labelText = "Standard Route";
                  }
                } else if (labelText === "OSRM Preferred Route") {
                  labelText = "Standard Route";
                } else if (labelText === "AI Recommended") {
                  labelText = "Recommended Route";
                }
                const roadName = getMainRoadName(r);

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (!isNavigating) {
                        setActiveRouteIndex(idx);
                        setShowHotspotList(false);
                      }
                    }}
                    disabled={isNavigating && !isSelected}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition ${
                      isSelected
                        ? isEmergencyMode
                          ? isAI
                            ? "bg-gradient-to-r from-rose-600 to-red-600 text-white border-rose-600 shadow-md"
                            : "bg-slate-700 text-white border-slate-700 shadow-md"
                          : isAI
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                          : "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-white/80 hover:bg-white text-slate-800 border-slate-200/80 shadow-sm"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-bold ${
                            isSelected
                              ? "text-white"
                              : isEmergencyMode && isAI
                              ? "text-rose-600"
                              : isAI
                              ? "text-emerald-600"
                              : "text-slate-800"
                          }`}
                        >
                          {dur} min
                        </span>
                        <span className={`text-xs ${isSelected ? "text-slate-100" : "text-slate-500"}`}>
                          • {dist} km
                        </span>
                      </div>
                      <p
                        className={`text-xs font-medium line-clamp-1 ${
                          isSelected ? "text-slate-100" : "text-slate-500"
                        }`}
                      >
                        {roadName}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : isEmergencyMode && isAI
                            ? "bg-rose-100 text-rose-800"
                            : isAI
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {isEmergencyMode && isAI ? (
                          <Siren className="w-3 h-3 fill-current" />
                        ) : isAI ? (
                          <Zap className="w-3 h-3 fill-current" />
                        ) : null}
                        {labelText}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA Button */}
        <button
          onClick={() => {
            if (isNavigating) {
              TTSService.reset();
              setIsNavigating(false);
            } else {
              TTSService.warmUp();
              setIsNavigating(true);
            }
          }}
          className={`w-full py-3.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 ${
            isNavigating
              ? "bg-rose-700 hover:bg-rose-800 text-white shadow-rose-700/30"
              : isEmergencyMode
              ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-rose-600/30"
              : isAIRoute
              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30"
              : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30"
          }`}
        >
          {isEmergencyMode ? <Siren className="w-4 h-4" /> : <Navigation className="w-4 h-4 fill-current" />}
          <span>
            {isNavigating
              ? "End Active Navigation"
              : isEmergencyMode
              ? "Start Priority Navigation"
              : "Start Smart Navigation"}
          </span>
          <ArrowRight className="w-4 h-4 ml-auto" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
