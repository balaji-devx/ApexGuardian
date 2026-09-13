"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Gauge, Clock, X, Volume2, ShieldAlert } from "lucide-react";
import { ActiveCongestionAlert } from "@/lib/alertManager";
import { TTSService } from "@/lib/ttsService";

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

  const handleSpeak = () => {
    TTSService.speakCongestionAlert(
      alert.locationName,
      alert.distanceText,
      alert.averageSpeedKmh,
      alert.estimatedDelaySeconds ? alert.estimatedDelaySeconds / 60 : undefined
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -40, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="fixed top-5 left-1/2 transform -translate-x-1/2 z-50 w-[92vw] max-w-xl pointer-events-auto"
      >
        <div
          className={`relative rounded-2xl p-4 shadow-2xl backdrop-blur-xl border flex flex-col gap-3 text-white overflow-hidden transition-all ${
            isSevere
              ? "bg-gradient-to-r from-red-950/95 via-rose-900/95 to-slate-900/95 border-rose-500/80 shadow-[0_0_35px_rgba(225,29,72,0.45)] ring-2 ring-rose-500/50"
              : isHeavy
              ? "bg-gradient-to-r from-red-900/95 via-orange-950/95 to-slate-900/95 border-red-500/70 shadow-[0_0_30px_rgba(239,68,68,0.35)]"
              : "bg-gradient-to-r from-amber-950/95 via-orange-900/95 to-slate-900/95 border-amber-500/70 shadow-[0_0_25px_rgba(245,158,11,0.3)]"
          }`}
        >
          {/* Pulsing Accent Glow */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-rose-500 to-red-600 animate-pulse" />

          {/* Top Row: Severity Tag & Countdown */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-md animate-bounce ${
                  isSevere ? "bg-rose-600 text-white" : "bg-amber-500 text-slate-950"
                }`}
              >
                {isSevere ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <span className="text-xs font-extrabold tracking-wider uppercase opacity-90">
                  {alert.stage === 3
                    ? "🚨 Imminent Congestion Ahead"
                    : alert.stage === 2
                    ? "⚠️ Approaching Bottleneck"
                    : "ℹ️ Proactive Advance Warning"}
                </span>
                <h4 className="text-base font-black tracking-tight text-white line-clamp-1">
                  {alert.locationName}
                </h4>
              </div>
            </div>

            {/* Distance Countdown Pill */}
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 rounded-xl bg-white/15 border border-white/20 backdrop-blur-md flex items-center gap-1.5 shadow-inner">
                <span className="text-xs font-bold text-slate-300">In</span>
                <span className="text-sm font-black text-amber-300">{alert.distanceText}</span>
              </div>

              <button
                onClick={onDismiss}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Middle Row: Speed & Delay Telemetry */}
          <div className="grid grid-cols-2 gap-2 bg-black/30 p-2.5 rounded-xl border border-white/10 text-xs">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-rose-400" />
              <span className="text-slate-300 font-medium">Flow Speed:</span>
              <span className="font-bold text-white">
                {Math.round(alert.averageSpeedKmh)} km/h
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300 font-medium">Est. Delay:</span>
              <span className="font-bold text-amber-300">
                +{Math.max(1, Math.round((alert.estimatedDelaySeconds || 120) / 60))} min
              </span>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between pt-1 gap-2">
            <button
              onClick={handleSpeak}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1.5 transition text-slate-200"
            >
              <Volume2 className="w-3.5 h-3.5" /> Read Aloud
            </button>

            {onCheckReroute && fasterRouteAvailable && (
              <button
                onClick={onCheckReroute}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-xs font-extrabold text-white shadow-lg transition flex items-center gap-1.5 active:scale-95"
              >
                Find a faster route
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
