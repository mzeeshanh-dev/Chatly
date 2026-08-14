"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkle, X } from "@phosphor-icons/react";

interface DigestBannerProps {
  unreadCount: number;
  openQuestionsCount?: number;
  pendingTasksCount?: number;
  pendingDecisionsCount?: number;
  onDismiss: () => void;
}

/**
 * Non-AI "while you were away" summary — mirrors mobile's DigestBanner.tsx.
 * Every number here is a plain count already tracked on the parent chat/group
 * doc (unreadCount, and the denormalized counters maintained by
 * functions/src/functions/tags.ts). No AI, no extra reads.
 */
export default function DigestBanner({ unreadCount, openQuestionsCount = 0, pendingTasksCount = 0, pendingDecisionsCount = 0, onDismiss }: DigestBannerProps) {
  const parts = [`${unreadCount} new message${unreadCount === 1 ? "" : "s"}`];
  if (openQuestionsCount > 0) parts.push(`${openQuestionsCount} open question${openQuestionsCount === 1 ? "" : "s"}`);
  if (pendingTasksCount > 0) parts.push(`${pendingTasksCount} task${pendingTasksCount === 1 ? "" : "s"}`);
  if (pendingDecisionsCount > 0) parts.push(`${pendingDecisionsCount} decision${pendingDecisionsCount === 1 ? "" : "s"}`);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className="flex items-center gap-2.5 px-4 py-2.5 bg-emerald-500/5 border-b border-emerald-500/10 overflow-hidden"
      >
        <Sparkle size={16} weight="fill" className="text-emerald-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">While you were away</p>
          <p className="text-[11px] text-zinc-500 truncate">{parts.join(" · ")}</p>
        </div>
        <button onClick={onDismiss} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex-shrink-0">
          <X size={13} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
