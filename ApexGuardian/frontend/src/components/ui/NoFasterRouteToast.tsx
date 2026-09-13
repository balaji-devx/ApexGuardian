"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, X } from "lucide-react";

interface NoFasterRouteToastProps {
  reason: string | null;
  onDismiss: () => void;
}

export const NoFasterRouteToast: React.FC<NoFasterRouteToastProps> = ({ reason, onDismiss }) => {
  if (!reason) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 w-[92vw] max-w-md pointer-events-auto"
      >
        <div className="relative rounded-2xl p-4 shadow-2xl backdrop-blur-xl bg-slate-900/95 border border-slate-700/80 text-white flex items-center justify-between gap-3 ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-400">
                Optimal Path Active
              </span>
              <p className="text-xs font-semibold text-slate-200 line-clamp-2">
                {reason}
              </p>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition shrink-0"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
