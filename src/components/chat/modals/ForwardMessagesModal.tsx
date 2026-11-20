"use client";

import React from "react";
import type { SelectedConversation } from "../ChatList";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "@phosphor-icons/react";

interface ForwardMessagesModalProps {
  open: boolean;
  selectedCount: number;
  targets: SelectedConversation[];
  forwarding: boolean;
  getTargetLabel: (target: SelectedConversation) => string;
  onForward: (target: SelectedConversation) => void;
  onClose: () => void;
}

export default function ForwardMessagesModal({
  open,
  selectedCount,
  targets,
  forwarding,
  getTargetLabel,
  onForward,
  onClose,
}: ForwardMessagesModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[190] flex items-center justify-center p-4">
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
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1a1d28]"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-white/[0.06]">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Forward messages</h3>
                <p className="text-xs text-zinc-500">{selectedCount} selected</p>
              </div>
              <button
                onClick={() => onClose()}
                className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100"
                aria-label="Close forward modal"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            <div className="max-h-[360px] overflow-y-auto p-3">
              {targets.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-zinc-500">No chats available to forward to.</p>
              ) : (
                <div className="space-y-1">
                  {targets.map((target) => (
                    <button
                      key={target.type === "dm" ? `dm-${target.chatId}` : `group-${target.groupId}`}
                      type="button"
                      onClick={() => onForward(target)}
                      disabled={forwarding}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-zinc-100 disabled:opacity-60 dark:hover:bg-white/[0.06]"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-500/10 text-sm font-bold text-emerald-500">
                        {target.type === "dm"
                          ? target.other.displayName[0]?.toUpperCase()
                          : target.name[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {getTargetLabel(target)}
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                          {target.type === "dm" ? target.other.email : "Group chat"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
