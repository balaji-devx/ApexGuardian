"use client";

import React, { useState } from "react";
import { Plus, Minus, Target, Layers } from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { mapRefContainer } from "@/components/map/MapCanvas";

export const MapControls: React.FC = () => {
  const {
    triggerRecenter,
    activeLayerMode,
    toggleLayerMode,
    currentZoom,
  } = useNavigation();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleZoomIn = () => {
    if (mapRefContainer.current && currentZoom < 18) {
      mapRefContainer.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRefContainer.current && currentZoom > 10) {
      mapRefContainer.current.zoomOut();
    }
  };

  const handleLayerToggle = () => {
    toggleLayerMode();
    let msg = "Layer: Showing All Routes";
    if (activeLayerMode === "ALL") msg = "Layer: Showing AI Recommended Only";
    else if (activeLayerMode === "AI_ONLY") msg = "Layer: Showing Standard Route Only";

    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  return (
    <>
      {toastMessage && (
        <div className="fixed right-16 bottom-8 z-30 px-3.5 py-2 rounded-xl bg-slate-900/90 text-white text-xs font-semibold shadow-xl border border-slate-700/80 animate-fade-in backdrop-blur-md">
          {toastMessage}
        </div>
      )}

      <div className="fixed right-4 bottom-8 z-20 flex flex-col gap-2">
        <div className="glass-panel rounded-full p-1 flex flex-col gap-1 shadow-lg">
          <button
            onClick={handleZoomIn}
            disabled={currentZoom >= 18}
            title={currentZoom >= 18 ? "Maximum zoom reached (18)" : "Zoom In"}
            className="w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-slate-700 hover:text-slate-900 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/90"
          >
            <Plus className="w-5 h-5" />
          </button>
          <div className="w-full h-px bg-slate-200" />
          <button
            onClick={handleZoomOut}
            disabled={currentZoom <= 10}
            title={currentZoom <= 10 ? "Minimum zoom reached (10)" : "Zoom Out"}
            className="w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-slate-700 hover:text-slate-900 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/90"
          >
            <Minus className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={triggerRecenter}
          title="Re-center Viewport"
          className="w-11 h-11 rounded-full glass-panel flex items-center justify-center text-slate-700 hover:text-blue-600 transition shadow-lg hover:scale-105 active:scale-95"
        >
          <Target className="w-5 h-5" />
        </button>

        <button
          onClick={handleLayerToggle}
          title={`Layer View: ${activeLayerMode}`}
          className={`w-11 h-11 rounded-full glass-panel flex items-center justify-center transition shadow-lg hover:scale-105 active:scale-95 ${
            activeLayerMode === "AI_ONLY"
              ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20"
              : activeLayerMode === "STANDARD_ONLY"
              ? "bg-slate-700 text-white border-slate-600"
              : "text-slate-700 hover:text-emerald-600"
          }`}
        >
          <Layers className="w-5 h-5" />
        </button>
      </div>
    </>
  );
};
