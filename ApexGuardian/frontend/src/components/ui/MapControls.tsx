"use client";

import React, { useState } from "react";
import { Plus, Minus, Target, Layers, Siren } from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { mapRefContainer } from "@/components/map/MapCanvas";
import { TrafficTestMode } from "@/lib/trafficScenario";
import { OVERLAY_Z } from "@/lib/layoutZones";

export const MapControls: React.FC = () => {
  const {
    triggerRecenter,
    activeLayerMode,
    toggleLayerMode,
    currentZoom,
    isEmergencyMode,
    toggleEmergencyMode,
    trafficTestMode,
    runTrafficTest,
    isNavigating,
    navigationHudHeight,
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
    let msg = "Showing All Routes";
    if (activeLayerMode === "ALL") msg = "Showing Recommended Route Only";
    else if (activeLayerMode === "AI_ONLY") msg = "Showing Standard Route Only";

    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  return (
    <>
      <div className="glass-panel fixed right-4 top-[calc(env(safe-area-inset-top,0px)+11rem)] w-44 rounded-xl p-2.5 pointer-events-auto" style={{ zIndex: OVERLAY_Z.mapControls }}>
        <label htmlFor="traffic-test-mode" className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
          Traffic Test
        </label>
        <select
          id="traffic-test-mode"
          value={trafficTestMode}
          onChange={(event) => void runTrafficTest(event.target.value as TrafficTestMode)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
          aria-label="Select real traffic data or a controlled traffic test"
        >
          <option value="real">Real Traffic Data</option>
          <option value="normal">Normal Traffic</option>
          <option value="moderate">Moderate Congestion</option>
          <option value="heavy">Heavy Congestion</option>
          <option value="severe">Severe Congestion</option>
          <option value="dynamic">Dynamic Congestion</option>
        </select>
        {trafficTestMode !== "real" && <p className="mt-1 text-[10px] leading-tight text-slate-500">Controlled MG Road → Koramangala test</p>}
      </div>
      {toastMessage && (
        <div className="fixed right-16 bottom-8 px-3.5 py-2 rounded-xl bg-slate-900/90 text-white text-xs font-semibold shadow-xl border border-slate-700/80 animate-fade-in backdrop-blur-md" style={{ zIndex: OVERLAY_Z.transientToast }}>
          {toastMessage}
        </div>
      )}

      <div
        className="fixed right-4 flex flex-col gap-2 transition-[bottom] duration-200"
        style={{
          zIndex: OVERLAY_Z.mapControls,
          bottom: isNavigating
            ? `${navigationHudHeight + 12}px`
            : "calc(env(safe-area-inset-bottom, 0px) + 2rem)",
        }}
      >
        <div className="glass-panel rounded-full p-1 flex flex-col gap-1 shadow-lg">
          <button
            onClick={handleZoomIn}
            disabled={currentZoom >= 18}
            title={currentZoom >= 18 ? "Maximum zoom reached (18)" : "Zoom In"}
            className="h-12 w-12 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-slate-700 hover:text-slate-900 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/90"
          >
            <Plus className="w-5 h-5" />
          </button>
          <div className="w-full h-px bg-slate-200" />
          <button
            onClick={handleZoomOut}
            disabled={currentZoom <= 10}
            title={currentZoom <= 10 ? "Minimum zoom reached (10)" : "Zoom Out"}
            className="h-12 w-12 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-slate-700 hover:text-slate-900 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/90"
          >
            <Minus className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={triggerRecenter}
          title="Re-center Viewport"
          className="h-12 w-12 rounded-full glass-panel flex items-center justify-center text-slate-700 hover:text-blue-600 transition shadow-lg hover:scale-105 active:scale-95"
        >
          <Target className="w-5 h-5" />
        </button>

        <button
          onClick={handleLayerToggle}
          title={`Layer View: ${activeLayerMode}`}
          className={`h-12 w-12 rounded-full glass-panel flex items-center justify-center transition shadow-lg hover:scale-105 active:scale-95 ${
            activeLayerMode === "AI_ONLY"
              ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20"
              : activeLayerMode === "STANDARD_ONLY"
              ? "bg-slate-700 text-white border-slate-600"
              : "text-slate-700 hover:text-emerald-600"
          }`}
        >
          <Layers className="w-5 h-5" />
        </button>

        <button
          onClick={toggleEmergencyMode}
          title={isEmergencyMode ? "Emergency Mode Active (Ambulance Priority)" : "Enable Emergency / Ambulance Mode"}
          className={`h-12 w-12 rounded-full glass-panel flex items-center justify-center transition shadow-lg hover:scale-105 active:scale-95 ${
            isEmergencyMode
              ? "bg-rose-600 text-white border-rose-500 shadow-rose-500/30 animate-pulse"
              : "text-slate-700 hover:text-rose-600"
          }`}
        >
          <Siren className="w-5 h-5" />
        </button>
      </div>
    </>
  );
};
