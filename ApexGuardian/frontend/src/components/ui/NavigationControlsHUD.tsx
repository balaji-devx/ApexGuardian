"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUp,
  Bell,
  BellRing,
  ChevronDown,
  ChevronUp,
  CornerUpLeft,
  CornerUpRight,
  FastForward,
  Pause,
  Play,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { TTSService } from "@/lib/ttsService";
import { PushNotificationService } from "@/lib/pushNotificationService";
import { getManeuverInstruction } from "@/lib/maneuverInstructions";
import { OVERLAY_Z } from "@/lib/layoutZones";

export const NavigationControlsHUD: React.FC = () => {
  const {
    isNavigating,
    setIsNavigating,
    currentVehicleSpeed,
    simProgressPercent,
    simDistanceRemainingM,
    simEtaSeconds,
    isSimPlaying,
    setIsSimPlaying,
    simSpeedMultiplier,
    setSimSpeedMultiplier,
    nextManeuver,
    nextManeuverDistanceM,
    isEmergencyMode,
    navigationHudHeight,
    setNavigationHudHeight,
  } = useNavigation();

  const [isVoiceMuted, setIsVoiceMuted] = useState(TTSService.getMuted());
  const [isPushEnabled, setIsPushEnabled] = useState(PushNotificationService.isPermissionGranted());
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const hudRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isNavigating || !hudRef.current) {
      setNavigationHudHeight(0);
      return;
    }

    const measureHud = () => {
      if (!hudRef.current) return;
      const heightFromBottom = Math.ceil(window.innerHeight - hudRef.current.getBoundingClientRect().top + 12);
      setNavigationHudHeight((previous) => Math.abs(previous - heightFromBottom) > 1 ? heightFromBottom : previous);
    };

    measureHud();
    const resizeObserver = new ResizeObserver(measureHud);
    resizeObserver.observe(hudRef.current);
    window.addEventListener("resize", measureHud);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measureHud);
    };
  }, [isNavigating, isDetailsExpanded, setNavigationHudHeight]);

  if (!isNavigating) return null;

  const handleToggleVoice = () => {
    const newMuted = TTSService.toggleMute();
    setIsVoiceMuted(newMuted);
    if (!newMuted) TTSService.announce("Voice guidance enabled", "normal", "voice_guidance_enabled", 2_000);
  };

  const handleTogglePush = async () => {
    const granted = await PushNotificationService.requestPermission();
    setIsPushEnabled(granted);
    if (granted) PushNotificationService.sendCongestionAlert("Navigation Demo", "500 m", 4, 15);
  };

  const getManeuverIcon = (modifier?: string) => {
    if (modifier?.includes("right")) return <CornerUpRight className="h-5 w-5 text-white" />;
    if (modifier?.includes("left")) return <CornerUpLeft className="h-5 w-5 text-white" />;
    return <ArrowUp className="h-5 w-5 text-white" />;
  };

  return (
    <motion.div
      ref={hudRef}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      className="fixed left-3 right-3 mx-auto w-auto max-w-2xl pointer-events-auto"
      style={{ zIndex: OVERLAY_Z.navigationHud, bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
    >
      <div className="glass-panel-dark flex flex-col gap-2 rounded-3xl p-3 text-white sm:gap-3 sm:p-4">
        <div className={`flex min-w-0 items-center justify-between gap-2 ${isDetailsExpanded ? "border-b border-slate-700 pb-3" : ""}`}>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-lg ${isEmergencyMode ? "bg-rose-600" : "bg-blue-600"}`}>
              {getManeuverIcon(nextManeuver?.modifier)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-amber-300">
                  {nextManeuverDistanceM >= 1000
                    ? `${(nextManeuverDistanceM / 1000).toFixed(1)} km`
                    : `${Math.round(nextManeuverDistanceM)} m`}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Next step</span>
              </div>
              <p className="line-clamp-1 text-xs font-bold text-white sm:text-sm">
                {nextManeuver ? getManeuverInstruction(nextManeuver) : "Continue along active corridor"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="flex flex-col items-end rounded-xl border border-white/10 bg-black/30 px-2 py-1 sm:px-3">
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black text-emerald-400 sm:text-2xl">{Math.round(currentVehicleSpeed)}</span>
                <span className="text-[9px] font-extrabold uppercase text-slate-400">km/h</span>
              </div>
              {isDetailsExpanded && <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Speed</span>}
            </div>
            <button
              type="button"
              onClick={() => setIsDetailsExpanded((expanded) => !expanded)}
              aria-label={isDetailsExpanded ? "Collapse navigation controls" : "Expand navigation controls"}
              aria-expanded={isDetailsExpanded}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-slate-200 hover:bg-white/20"
            >
              {isDetailsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
          <div
            className={`h-full transition-all duration-300 ${isEmergencyMode ? "bg-rose-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.min(100, Math.max(0, simProgressPercent))}%` }}
          />
        </div>

        {isDetailsExpanded && (
          <>
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
              <span aria-label="Distance remaining">
                {simDistanceRemainingM >= 1000
                  ? `${(simDistanceRemainingM / 1000).toFixed(1)} km remaining`
                  : `${Math.round(simDistanceRemainingM)} m remaining`}
              </span>
              <span aria-label="Estimated time to destination">
                {simEtaSeconds > 0 ? `${Math.ceil(simEtaSeconds / 60)} min to destination` : "Arrived"}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
              <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-1">
                <button
                  onClick={() => setIsSimPlaying(!isSimPlaying)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20"
                  title={isSimPlaying ? "Pause Simulation" : "Play Simulation"}
                >
                  {isSimPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
                </button>
                <button
                  onClick={() => setSimSpeedMultiplier(simSpeedMultiplier === 1 ? 2 : simSpeedMultiplier === 2 ? 5 : 1)}
                  className="flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-1.5 text-xs font-black text-amber-300 hover:bg-white/20"
                  title="Simulation Speed Multiplier"
                >
                  <FastForward className="h-3.5 w-3.5" /> <span>{simSpeedMultiplier}x</span>
                </button>
              </div>

              <button
                onClick={handleToggleVoice}
                className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-bold ${!isVoiceMuted ? "border-blue-500/50 bg-blue-600/30 text-blue-200" : "border-white/10 bg-white/5 text-slate-300"}`}
                title="Voice Alerts / TTS"
              >
                {!isVoiceMuted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                <span>{!isVoiceMuted ? "Voice ON" : "Voice Muted"}</span>
              </button>

              <button
                onClick={() => void handleTogglePush()}
                className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-bold ${isPushEnabled ? "border-emerald-500/50 bg-emerald-600/30 text-emerald-200" : "border-white/10 bg-white/5 text-slate-300"}`}
                title="Push Notifications"
              >
                {isPushEnabled ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                <span>{isPushEnabled ? "Push ON" : "Enable Push"}</span>
              </button>

              <button
                onClick={() => {
                  TTSService.reset();
                  setIsNavigating(false);
                }}
                className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-rose-900/60 hover:text-rose-100"
              >
                <XCircle className="h-4 w-4" /> <span>Exit</span>
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};
