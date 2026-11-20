"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "@phosphor-icons/react";

interface EditMessageModalProps {
  open: boolean;
  text: string;
  saving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function EditMessageModal({ open, text, saving, onChange, onSave, onClose }: EditMessageModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[195] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.form
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onSubmit={(e) => {
              e.preventDefault();
              onSave();
            }}
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1a1d28]"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-white/[0.06]">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Edit message</h3>
                <p className="text-xs text-zinc-500">Available for 3 minutes after sending</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100"
                aria-label="Close edit modal"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            <div className="p-4">
              <textarea
                value={text}
                onChange={(e) => onChange(e.target.value)}
                autoFocus
                rows={4}
                className="min-h-28 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none transition-colors focus:border-emerald-500/60 dark:border-white/[0.08] dark:bg-zinc-900/60 dark:text-zinc-100"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-zinc-100 px-4 py-2 text-xs font-bold text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!text.trim() || saving}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}
