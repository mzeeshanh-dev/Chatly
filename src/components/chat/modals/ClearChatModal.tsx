"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ClearChatModalProps {
  open: boolean;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ClearChatModal({ open, busy, onConfirm, onClose }: ClearChatModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onClose()}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-xs bg-white dark:bg-[#1a1d28] border border-zinc-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-2xl"
          >
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Clear Chat?</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
              This will clear this conversation only for you. Other people will still keep their messages.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onClose()}
                className="flex-1 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={busy}
                className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 dark:text-red-400 text-xs font-bold rounded-xl transition-all border border-red-500/20 disabled:opacity-50"
              >
                {busy ? "Clearing..." : "Clear for me"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
