"use client";

import React, { useState } from "react";
import { Activity } from "lucide-react";
import { OVERLAY_Z } from "@/lib/layoutZones";

interface TrafficLegendProps {
  placement?: "navigation" | "sidebar";
}

export const TrafficLegend: React.FC<TrafficLegendProps> = ({ placement = "navigation" }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const placementClass = placement === "sidebar"
    ? "relative z-0 w-fit max-w-full self-start pointer-events-auto"
    : "fixed left-3 right-auto top-[calc(env(safe-area-inset-top,0px)+17rem)] w-[min(16rem,calc(100vw-5rem))] pointer-events-auto";

  return (
    <div className={placementClass} style={placement === "navigation" ? { zIndex: OVERLAY_Z.infoPanel } : undefined}>
      <div
        className={`glass-panel rounded-2xl shadow-xl border border-slate-200/80 transition-all duration-300 ${
          isExpanded ? "p-3.5 w-full" : "p-2"
        }`}
      >
        {!isExpanded ? (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            aria-label="Open live traffic legend"
            className="flex w-full items-center gap-2 text-left text-xs font-bold text-slate-700 select-none"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">Live Traffic</span>
            <span className="ml-1 flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
          </button>
        ) : (
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
              <div className="flex items-center gap-1.5 text-slate-800 font-extrabold text-xs uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                <span>Traffic on This Route</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                }}
                aria-label="Close traffic legend"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
                  <span className="font-bold text-slate-700">Clear Flow</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">≥ 80% freeflow</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" />
                  <span className="font-bold text-slate-700">Slowed Traffic</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">50 - 80% speed</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm" />
                  <span className="font-bold text-slate-700">Heavy Traffic</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">25 - 50% speed</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-900 shadow-sm" />
                  <span className="font-bold text-slate-700">Stopped / Barely Moving</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">&lt; 25% speed</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 pt-1 border-t border-slate-100 italic">
              ML dynamically forecasts downstream delays before arrival.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
