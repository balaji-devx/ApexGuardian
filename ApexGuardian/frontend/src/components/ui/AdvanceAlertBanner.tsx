"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Volume2, ShieldAlert } from "lucide-react";
import { ActiveCongestionAlert } from "@/lib/alertManager";
import { TTSService } from "@/lib/ttsService";
import { OVERLAY_Z } from "@/lib/layoutZones";

interface AdvanceAlertBannerProps {
  alert: ActiveCongestionAlert | null;
  onDismiss: () => void;
  onCheckReroute?: () => void;
  fasterRouteAvailable?: boolean;
}

export const AdvanceAlertBanner: React.FC<AdvanceAlertBannerProps> = ({
  alert,
  onDismiss,
  onCheckReroute,
  fasterRouteAvailable = false,
}) => {
  if (!alert) return null;

  const isSevere = alert.congestionLevel === "SEVERE";
  const isHeavy = alert.congestionLevel === "HEAVY";
  const severityText = isSevere ? "Severe" : isHeavy ? "Heavy" : "Moderate";
  const severityStyle = isSevere
    ? { border: "border-l-red-600", icon: "text-red-700" }
    : isHeavy
    ? { border: "border-l-orange-500", icon: "text-orange-700" }
    : { border: "border-l-yellow-500", icon: "text-yellow-700" };
  const delayMinutes = Math.max(1, Math.round((alert.estimatedDelaySeconds || 60) / 60));

  const handleSpeak = () => {
    TTSService.speakCongestionAlert(
      alert.locationName,
      alert.distanceText,
      alert.averageSpeedKmh,
      alert.estimatedDelaySeconds ? alert.estimatedDelaySeconds / 60 : undefined,
      true,
      alert.congestionLevel
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -40, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="fixed left-3 right-3 mx-auto w-auto max-w-sm sm:max-w-md pointer-events-auto"
        style={{ zIndex: OVERLAY_Z.advanceAlertBanner, top: "calc(env(safe-area-inset-top, 0px) + 4.5rem)" }}
      >
        <div className={`glass-panel flex items-start gap-2 rounded-xl border-l-4 p-2.5 text-slate-800 ${severityStyle.border}`}>
          <span className={`mt-0.5 shrink-0 ${severityStyle.icon}`}>
            {isSevere ? <ShieldAlert className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-extrabold">{severityText} traffic ahead · {alert.distanceText}</p>
              <button onClick={onDismiss} aria-label="Dismiss traffic alert" className="-mr-1 -mt-1 rounded-full p-1 text-slate-500 hover:bg-black/5">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="truncate text-xs text-slate-600">{alert.locationName} · Expect about {delayMinutes} min delay</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <button onClick={handleSpeak} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900">
                <Volume2 className="h-3.5 w-3.5" /> Read aloud
              </button>
              {onCheckReroute && !fasterRouteAvailable && (isHeavy || isSevere) && (
                <button onClick={onCheckReroute} className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 shadow-sm hover:bg-emerald-50">
                  Find a route around it
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
