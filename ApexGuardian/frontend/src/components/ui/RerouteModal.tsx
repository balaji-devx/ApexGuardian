"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, ArrowRight, X, Clock, Check, Navigation, AlertCircle } from "lucide-react";
import { RerouteRecommendation } from "@/lib/api";

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
  if (!recommendation || !recommendation.is_reroute_recommended || !recommendation.recommended_route) {
    return null;
  }

  const newRoute = recommendation.recommended_route;
  const originalMin = Math.round(recommendation.original_remaining_seconds / 60);
  const newMin = Math.round(recommendation.recommended_duration_seconds / 60);
  const savedMin = Math.max(1, Math.round(recommendation.time_saved_minutes));
  const newDistKm = (newRoute.distance_meters / 1000).toFixed(1);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 w-[94vw] max-w-lg pointer-events-auto"
      >
        <div className="relative rounded-3xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl bg-slate-900/95 border-2 border-emerald-500/80 text-white overflow-hidden ring-4 ring-emerald-500/20">
          {/* Top Decorative Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shadow-md animate-pulse">
                <Zap className="w-5 h-5 fill-current" />
              </span>
              <div>
                <span className="text-xs font-black tracking-widest text-emerald-400 uppercase">
                  Faster Option Available
                </span>
                <h3 className="text-lg font-black text-white">Save Time with a New Route</h3>
              </div>
            </div>

            <button
              onClick={onDismiss}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Time Savings Comparison Grid */}
          <div className="grid grid-cols-3 gap-2.5 p-3 rounded-2xl bg-black/40 border border-white/10 mb-3 text-center">
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/5">
              <span className="text-xs font-medium text-slate-400">Current Path</span>
              <span className="text-base font-extrabold text-slate-300 line-through">
                {originalMin > 0 ? `${originalMin} min` : "Delayed"}
              </span>
            </div>

            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
              <span className="text-xs font-bold text-emerald-300">New Path</span>
              <span className="text-xl font-black text-emerald-400">{newMin} min</span>
              <span className="text-xs text-slate-400">({newDistKm} km)</span>
            </div>

            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">You Save</span>
              <span className="text-2xl font-black">-{savedMin}m</span>
            </div>
          </div>

          {/* Reroute Reason */}
          <div className="flex items-start gap-2 text-xs text-slate-300 bg-white/5 p-2.5 rounded-xl mb-4 border border-white/5">
            <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {recommendation.reason || "Bypasses upcoming heavy traffic to get you there faster."}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={onDismiss}
              className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-bold text-xs transition active:scale-95"
            >
              Keep Current Route
            </button>

            <button
              disabled={isApplying}
              onClick={() => {
                if (isApplying) return;
                onAccept(recommendation);
              }}
              className="flex-[2] py-3.5 px-5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isApplying ? "Applying..." : "Switch to Faster Route"}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
