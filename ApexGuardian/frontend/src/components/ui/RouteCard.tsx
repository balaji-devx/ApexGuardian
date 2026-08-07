"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation, ShieldCheck, ArrowRight, Loader2, ChevronDown, ChevronUp, CornerUpRight, CornerUpLeft, MoveRight, Zap, AlertTriangle } from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";

export const RouteCard: React.FC = () => {
  const {
    routes,
    activeRouteIndex,
    setActiveRouteIndex,
    selectedDestination,
    isNavigating,
    setIsNavigating,
    isLoadingRoutes,
  } = useNavigation();

  const [showDetails, setShowDetails] = useState(false);

  if (isLoadingRoutes) {
    return (
      <div className="fixed left-4 top-48 sm:top-52 z-10 w-[calc(100vw-32px)] sm:w-[420px] glass-panel rounded-2xl p-6 flex items-center justify-center gap-3 shadow-2xl">
        <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
        <span className="text-sm font-semibold text-slate-700">Evaluating junction bottleneck delays & ML route scoring...</span>
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
  const routeLabel = currentRoute.route_label || (isAIRoute ? "AI Recommended" : "Standard Route");
  const congestionScore = currentRoute.congestion_risk_score ?? 15;
  const delayReason = currentRoute.delay_reason;

  const getRiskBadgeInfo = (score: number) => {
    if (score < 30) {
      return {
        label: `Low Risk (${score}%)`,
        className: "bg-emerald-100/90 text-emerald-800 border-emerald-300",
        iconColor: "text-emerald-600"
      };
    }
    if (score <= 60) {
      return {
        label: `Moderate Risk (${score}%)`,
        className: "bg-amber-100/90 text-amber-800 border-amber-300",
        iconColor: "text-amber-600"
      };
    }
    return {
      label: `Gridlock Risk (${score}%)`,
      className: "bg-rose-100/90 text-rose-800 border-rose-300",
      iconColor: "text-rose-600"
    };
  };

  const riskBadge = getRiskBadgeInfo(congestionScore);

  const getMainRoadName = (route: typeof currentRoute) => {
    if (route.steps && route.steps.length > 1) {
      const namedStep = route.steps.find((s) => s.name && s.name.trim() !== "");
      if (namedStep && namedStep.name) return `Via ${namedStep.name}`;
    }
    return "Via Optimal Corridor";
  };

  const getStepIcon = (modifier?: string) => {
    if (modifier?.includes("right")) return <CornerUpRight className="w-4 h-4 text-blue-600" />;
    if (modifier?.includes("left")) return <CornerUpLeft className="w-4 h-4 text-blue-600" />;
    return <MoveRight className="w-4 h-4 text-emerald-600" />;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="fixed left-4 top-48 sm:top-52 z-10 w-[calc(100vw-32px)] sm:w-[420px] glass-panel rounded-2xl p-5 shadow-2xl border border-slate-200/80 max-h-[calc(100vh-230px)] overflow-y-auto"
      >
        {/* Destination Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-md font-bold text-xs flex items-center gap-1 ${
                isAIRoute ? "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30" : "bg-slate-200 text-slate-700"
              }`}>
                {isAIRoute ? <Zap className="w-3 h-3 text-emerald-600 fill-current" /> : null}
                {routeLabel}
              </span>
              <span className="flex items-center gap-1 text-slate-500 text-xs font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Guarded
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 line-clamp-1">
              {selectedDestination.name}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {getMainRoadName(currentRoute)}
            </p>
          </div>
        </div>

        {/* Primary ETA Display & Normalized Risk Badge */}
        <div className="flex items-baseline gap-3 mb-2">
          <span className={`text-3xl font-extrabold tracking-tight ${isAIRoute ? "text-emerald-600" : "text-slate-700"}`}>
            {durationMin} min
          </span>
          <span className="text-sm font-semibold text-slate-500">
            ({distanceKm} km)
          </span>
          <span className={`ml-auto px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 shadow-sm ${riskBadge.className}`}>
            <AlertTriangle className={`w-3.5 h-3.5 ${riskBadge.iconColor}`} />
            {riskBadge.label}
          </span>
        </div>

        {/* Dynamic Delay Reason Explanation */}
        {delayReason && (
          <div className="mb-4 p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/60 text-emerald-800 text-xs font-medium leading-relaxed">
            {delayReason}
          </div>
        )}

        {/* Route Option Comparison Cards */}
        {routes.length > 1 && (
          <div className="space-y-2 mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Candidate Routes
            </p>
            <div className="grid grid-cols-1 gap-2">
              {routes.map((r, idx) => {
                const dur = Math.round((r.predicted_duration_seconds || r.duration_seconds) / 60);
                const dist = (r.distance_meters / 1000).toFixed(1);
                const isSelected = idx === activeRouteIndex;
                const isAI = Boolean(r.is_ai_recommended);
                const labelText = r.route_label || (isAI ? "AI Recommended" : "Standard Route");
                const roadName = getMainRoadName(r);

                return (
                  <button
                    key={idx}
                    onClick={() => setActiveRouteIndex(idx)}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition ${
                      isSelected
                        ? isAI
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                          : "bg-slate-700 text-white border-slate-700 shadow-md"
                        : "bg-white/70 hover:bg-white text-slate-800 border-slate-200"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${
                          isSelected ? "text-white" : isAI ? "text-emerald-600" : "text-slate-700"
                        }`}>
                          {dur} min
                        </span>
                        <span className={`text-xs ${isSelected ? "text-slate-100" : "text-slate-500"}`}>
                          • {dist} km
                        </span>
                      </div>
                      <p className={`text-xs font-medium line-clamp-1 ${isSelected ? "text-slate-100" : "text-slate-500"}`}>
                        {roadName}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : isAI
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {isAI && <Zap className="w-2.5 h-2.5 fill-current" />}
                      {labelText}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Turn-by-Turn Preview Accordion Toggle */}
        {currentRoute.steps && currentRoute.steps.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full py-2 px-3 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold flex items-center justify-between transition"
            >
              <span>{showDetails ? "Hide Directions" : "View Turn-by-Turn Details"} ({currentRoute.steps.length} steps)</span>
              {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showDetails && (
              <div className="mt-2 p-3 bg-white/80 rounded-xl border border-slate-200/80 max-h-48 overflow-y-auto space-y-2">
                {currentRoute.steps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs">
                    <div className="mt-0.5 shrink-0">
                      {getStepIcon(step.maneuver?.modifier)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">
                        {step.maneuver?.instruction || step.name || `Step ${idx + 1}`}
                      </p>
                      {step.distance && (
                        <p className="text-[11px] text-slate-500">
                          {(step.distance / 1000).toFixed(2)} km
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CTA Button */}
        <button
          onClick={() => setIsNavigating(!isNavigating)}
          className={`w-full py-3.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 ${
            isNavigating
              ? "bg-rose-600 hover:bg-rose-700 text-white"
              : isAIRoute
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "bg-slate-800 hover:bg-slate-900 text-white"
          }`}
        >
          <Navigation className="w-4 h-4 fill-current" />
          <span>{isNavigating ? "End Navigation" : "Start Navigation"}</span>
          <ArrowRight className="w-4 h-4 ml-auto" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
