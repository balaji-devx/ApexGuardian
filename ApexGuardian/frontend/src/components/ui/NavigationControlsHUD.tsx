"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  FastForward,
  Flame,
  RotateCcw,
  Bell,
  BellRing,
  Navigation,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  XCircle,
  ShieldAlert
} from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { TTSService } from "@/lib/ttsService";
import { PushNotificationService } from "@/lib/pushNotificationService";
import { getManeuverInstruction } from "@/lib/maneuverInstructions";

export const NavigationControlsHUD: React.FC = () => {
  const {
    isNavigating,
    setIsNavigating,
    currentVehicleSpeed,
    simProgressPercent,
    isSimPlaying,
    setIsSimPlaying,
    simSpeedMultiplier,
    setSimSpeedMultiplier,
    nextManeuver,
    nextManeuverDistanceM,
    routes,
    activeRouteIndex,
    triggerDynamicRerouteCheck,
    isEmergencyMode,
    currentLocation,
  } = useNavigation();

  const [isVoiceMuted, setIsVoiceMuted] = useState(TTSService.getMuted());
  const [isPushEnabled, setIsPushEnabled] = useState(PushNotificationService.isPermissionGranted());

  if (!isNavigating) return null;

  const handleToggleVoice = () => {
    const newMuted = TTSService.toggleMuted();
    setIsVoiceMuted(newMuted);
    if (!newMuted) {
      TTSService.speak("Voice guidance enabled", 2);
    }
  };

  const handleTogglePush = async () => {
    const granted = await PushNotificationService.requestPermission();
    setIsPushEnabled(granted);
    if (granted) {
      PushNotificationService.sendCongestionAlert("Navigation Demo", "500 m", 4, 15);
    }
  };

  const getManeuverIcon = (modifier?: string) => {
    if (modifier?.includes("right")) return <CornerUpRight className="w-6 h-6 text-white" />;
    if (modifier?.includes("left")) return <CornerUpLeft className="w-6 h-6 text-white" />;
    return <ArrowUp className="w-6 h-6 text-white" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 w-[94vw] max-w-2xl pointer-events-auto"
    >
      <div className="rounded-3xl p-4 shadow-[0_25px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl bg-slate-900/95 border border-slate-700/80 text-white flex flex-col gap-3">
        {/* Top Progress & Maneuver Row */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
          {/* Next Maneuver Capsule */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
              isEmergencyMode ? "bg-rose-600" : "bg-blue-600"
            }`}>
              {getManeuverIcon(nextManeuver?.modifier)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-amber-300">
                  {nextManeuverDistanceM !== undefined
                    ? nextManeuverDistanceM >= 1000
                      ? `${(nextManeuverDistanceM / 1000).toFixed(1)} km`
                      : `${Math.round(nextManeuverDistanceM)} m`
                    : "500 m"}
                </span>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                  Next Step
                </span>
              </div>
              <p className="text-sm font-bold text-white line-clamp-1">
                {nextManeuver ? getManeuverInstruction(nextManeuver) : "Continue along active corridor"}
              </p>
            </div>
          </div>

          {/* Speedometer Widget */}
          <div className="flex flex-col items-end px-3 py-1.5 rounded-2xl bg-black/40 border border-white/10 shrink-0">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-emerald-400">
                {Math.round(currentVehicleSpeed)}
              </span>
              <span className="text-xs font-extrabold text-slate-400 uppercase">km/h</span>
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Speed
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isEmergencyMode ? "bg-rose-500" : "bg-emerald-500"
            }`}
            style={{ width: `${Math.min(100, Math.max(0, simProgressPercent))}%` }}
          />
        </div>

        {/* Bottom Interactive Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
          {/* Simulation Play / Pause / Multiplier */}
          <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-2xl border border-white/10">
            <button
              onClick={() => setIsSimPlaying(!isSimPlaying)}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition active:scale-95"
              title={isSimPlaying ? "Pause Simulation" : "Play Simulation"}
            >
              {isSimPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <button
              onClick={() => {
                const nextSpeed = simSpeedMultiplier === 1 ? 2 : simSpeedMultiplier === 2 ? 5 : 1;
                setSimSpeedMultiplier(nextSpeed);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-black text-amber-300 flex items-center gap-1 transition active:scale-95"
              title="Simulation Speed Multiplier"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>{simSpeedMultiplier}x</span>
            </button>
          </div>

          {/* Voice Guidance Toggle */}
          <button
            onClick={handleToggleVoice}
            className={`px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 border ${
              !isVoiceMuted
                ? "bg-blue-600/30 text-blue-300 border-blue-500/50 shadow-md"
                : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
            }`}
            title="Voice Alerts / TTS"
          >
            {!isVoiceMuted ? <Volume2 className="w-4 h-4 text-blue-400" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{!isVoiceMuted ? "Voice ON" : "Voice Muted"}</span>
          </button>

          {/* Push Notification Toggle */}
          <button
            onClick={handleTogglePush}
            className={`px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 border ${
              isPushEnabled
                ? "bg-emerald-600/30 text-emerald-300 border-emerald-500/50"
                : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
            }`}
            title="Push Notifications"
          >
            {isPushEnabled ? <BellRing className="w-4 h-4 text-emerald-400" /> : <Bell className="w-4 h-4" />}
            <span className="hidden sm:inline">{isPushEnabled ? "Push ON" : "Enable Push"}</span>
          </button>



          {/* End Navigation Button */}
          <button
            onClick={() => setIsNavigating(false)}
            className="px-3 py-2 rounded-2xl bg-white/10 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 border border-white/10"
          >
            <XCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};
