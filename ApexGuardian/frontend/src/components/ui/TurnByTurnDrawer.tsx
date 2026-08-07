"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronUp, ChevronDown, CornerUpRight, CornerUpLeft, ArrowUp, Navigation } from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";

export const TurnByTurnDrawer: React.FC = () => {
  const { routes, activeRouteIndex, isNavigating } = useNavigation();
  const [isOpen, setIsOpen] = useState(false);

  const currentRoute = routes[activeRouteIndex];
  if (!currentRoute || !currentRoute.steps || currentRoute.steps.length === 0) return null;

  const getStepIcon = (modifier?: string) => {
    if (modifier?.includes("right")) return <CornerUpRight className="w-5 h-5 text-blue-600" />;
    if (modifier?.includes("left")) return <CornerUpLeft className="w-5 h-5 text-blue-600" />;
    return <ArrowUp className="w-5 h-5 text-emerald-600" />;
  };

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className={`fixed bottom-4 left-4 z-20 w-[calc(100vw-32px)] sm:w-[420px] glass-panel rounded-2xl p-4 shadow-2xl transition-all duration-300 ${
        isNavigating ? "border-2 border-blue-500/80" : ""
      }`}
    >
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center text-blue-600">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Directions ({currentRoute.steps.length} steps)
            </h4>
            <p className="text-xs text-slate-700 font-semibold line-clamp-1">
              {currentRoute.steps[0]?.name || "Head towards destination"}
            </p>
          </div>
        </div>
        <button className="w-7 h-7 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-600">
          {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 pt-3 border-t border-slate-200/80 max-h-60 overflow-y-auto space-y-3">
          {currentRoute.steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-3 text-xs">
              <div className="mt-0.5 shrink-0">
                {getStepIcon(step.maneuver?.modifier)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800">
                  {step.maneuver?.instruction || step.name || `Step ${idx + 1}`}
                </p>
                {step.distance && (
                  <p className="text-slate-500 text-[11px]">
                    {(step.distance / 1000).toFixed(2)} km
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
