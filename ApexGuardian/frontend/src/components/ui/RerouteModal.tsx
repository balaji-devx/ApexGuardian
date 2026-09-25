"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, X, Check } from "lucide-react";
import { RerouteRecommendation } from "@/lib/api";
import { useNavigation } from "@/context/NavigationContext";
import { OVERLAY_Z } from "@/lib/layoutZones";

interface RerouteModalProps {
  recommendation: RerouteRecommendation | null;
  onAccept: (recommendation: RerouteRecommendation) => void;
  onDismiss: () => void;
  isApplying?: boolean;
}

export const RerouteModal: React.FC<RerouteModalProps> = ({
  recommendation,
  onAccept,
  onDismiss,
  isApplying = false,
}) => {
  const { isNavigating, navigationHudHeight } = useNavigation();
  if (!recommendation || !recommendation.is_reroute_recommended || !recommendation.recommended_route) {
    return null;
  }

  const newRoute = recommendation.recommended_route;
  const originalMin = Math.round(recommendation.original_remaining_seconds / 60);
  const newMin = Math.round(recommendation.recommended_duration_seconds / 60);
  const isAvoidance = recommendation.is_congestion_avoidance;
  const savedMin = Math.max(1, Math.round(recommendation.time_saved_minutes));
  const newDistKm = (newRoute.distance_meters / 1000).toFixed(1);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="fixed left-3 right-auto w-[min(28rem,calc(100vw-5rem))] pointer-events-auto"
        style={{
          zIndex: OVERLAY_Z.rerouteModal,
          bottom: isNavigating
            ? `${navigationHudHeight + 12}px`
            : "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
        }}
      >
          <div className="glass-panel rounded-2xl border border-emerald-200/60 p-3 text-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Zap className="h-4 w-4 fill-current" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold leading-tight">
                  {isAvoidance ? "Route around congestion" : "Faster route available"}
                </p>
                <p className="truncate text-xs text-slate-600">
                  {isAvoidance ? `Avoids flagged congestion · ${newDistKm} km` : `About ${savedMin} min faster · ${newDistKm} km`}
                </p>
              </div>
            </div>
            <button
              onClick={onDismiss}
              aria-label={isAvoidance ? "Dismiss congestion avoidance suggestion" : "Dismiss faster route suggestion"}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {isAvoidance && recommendation.reason && (
            <p className="mt-2 text-[11px] leading-snug text-slate-600">{recommendation.reason}</p>
          )}
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
            <p className="min-w-0 truncate text-[11px] text-slate-500">
              {originalMin} min current → {newMin} min new
            </p>
            <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onDismiss}
              className="rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Keep route
            </button>
            <button
              disabled={isApplying}
              onClick={() => {
                if (isApplying) return;
                onAccept(recommendation);
              }}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isApplying ? "Applying…" : isAvoidance ? "Take this route" : "Take faster route"}</span>
            </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
