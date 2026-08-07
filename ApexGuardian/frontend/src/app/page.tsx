"use client";

import React from "react";
import { MapCanvas } from "@/components/map/MapCanvas";
import { FloatingSearchPanel } from "@/components/ui/FloatingSearchPanel";
import { MapControls } from "@/components/ui/MapControls";
import { RouteCard } from "@/components/ui/RouteCard";
import { TurnByTurnDrawer } from "@/components/ui/TurnByTurnDrawer";
import { useNavigation } from "@/context/NavigationContext";
import { ShieldCheck, Wifi, WifiOff } from "lucide-react";

export default function Home() {
  const { backendOnline } = useNavigation();

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-900">
      {/* Full-bleed Map Canvas Base Layer */}
      <MapCanvas />

      {/* Floating UI Overlays */}
      <FloatingSearchPanel />
      <RouteCard />
      <TurnByTurnDrawer />
      <MapControls />

      {/* Top-Right Backend Health Connection Badge */}
      <div className="fixed top-4 right-4 z-20">
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
