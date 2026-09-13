"use client";

import React from "react";
import { MapCanvas } from "@/components/map/MapCanvas";
import { FloatingSearchPanel } from "@/components/ui/FloatingSearchPanel";
import { MapControls } from "@/components/ui/MapControls";
import { RouteCard } from "@/components/ui/RouteCard";
import { TurnByTurnDrawer } from "@/components/ui/TurnByTurnDrawer";
import { AdvanceAlertBanner } from "@/components/ui/AdvanceAlertBanner";
import { RerouteModal } from "@/components/ui/RerouteModal";
import { NavigationControlsHUD } from "@/components/ui/NavigationControlsHUD";
import { TrafficLegend } from "@/components/ui/TrafficLegend";
import { useNavigation } from "@/context/NavigationContext";
import { ShieldCheck, Wifi, WifiOff, Siren } from "lucide-react";

export default function Home() {
  const {
    backendOnline,
    isEmergencyMode,
    isNavigating,
    activeAlert,
    dismissAlert,
    activeRerouteRecommendation,
    dismissReroute,
    acceptReroute,
    triggerDynamicRerouteCheck,
    isApplyingReroute,
  } = useNavigation();

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-900 select-none">
      {/* Full-bleed Map Canvas Base Layer */}
      <MapCanvas />

      {/* Feature 4: Advance Distance-Decrementing Proactive Alert Banner */}
      <AdvanceAlertBanner
        alert={activeAlert}
        onDismiss={dismissAlert}
        onCheckReroute={() => triggerDynamicRerouteCheck(true)}
        fasterRouteAvailable={!!activeRerouteRecommendation?.is_reroute_recommended}
      />

      {/* Feature 8 & 9: Fastest Alternative Route Modal */}
      <RerouteModal
        recommendation={activeRerouteRecommendation}
        onAccept={acceptReroute}
        onDismiss={dismissReroute}
        isApplying={isApplyingReroute}
      />

      {/* Active Driving Turn-by-Turn HUD & Simulation Controls */}
      <NavigationControlsHUD />

      {/* Feature 1: Traffic Classification Color Legend */}
      <TrafficLegend />

      {/* Left Sidebar UI Layout */}
      {!isNavigating && (
        <div className="fixed left-4 top-4 bottom-4 z-20 flex flex-col gap-4 w-[calc(100vw-32px)] sm:w-[420px] pointer-events-none">
          <FloatingSearchPanel />
          <RouteCard />
          <TurnByTurnDrawer />
        </div>
      )}

      {/* Standard Map Controls (Zoom, Recenter, Layers) */}
      <MapControls />

      {/* Top-Right Backend Health & Mode Status Badges */}
      <div className="fixed top-4 right-4 z-20 flex items-center gap-2 pointer-events-auto">
        {isEmergencyMode && (
          <div className="glass-panel px-3.5 py-2 rounded-full flex items-center gap-2 shadow-lg text-xs font-black text-rose-600 border border-rose-500/50 bg-rose-50/95 animate-pulse">
            <Siren className="w-3.5 h-3.5 fill-current" />
            <span className="tracking-wide uppercase">Emergency Mode</span>
          </div>
        )}

        <div className="glass-panel px-3.5 py-2 rounded-full flex items-center gap-2 shadow-lg text-xs font-semibold">
          <div className="w-6 h-6 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-600">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <span className="hidden sm:inline text-slate-700 font-bold">Apex Backend:</span>
          {backendOnline === null ? (
            <span className="text-slate-400">Connecting...</span>
          ) : backendOnline ? (
            <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
              <Wifi className="w-3.5 h-3.5" /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-rose-500 font-bold">
              <WifiOff className="w-3.5 h-3.5" /> Offline
            </span>
          )}
        </div>
      </div>
    </main>
  );
}
