"use client";

import React from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, MapPin, EnvelopeSimple, User } from "@phosphor-icons/react";
import type { FirestoreUser } from "@/lib/firestore";
import TrackedItemsPanel from "./TrackedItemsPanel";

const spring = { type: "spring", stiffness: 300, damping: 25 } as const;

interface UserProfileModalProps {
  profile: FirestoreUser;
  onClose: () => void;
  /** Present when opened from a DM — lets this modal show that conversation's tracked items. */
  chatId?: string;
  myUid?: string;
}

const UserProfileModal = ({ profile, onClose, chatId, myUid }: UserProfileModalProps) => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={spring}
          className="w-full max-w-md bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800/50 rounded-2xl overflow-hidden shadow-2xl"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800/40">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Contact Info</h2>
            <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            {/* Avatar & Basic Info */}
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-3xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/40 mb-4 shadow-sm">
                {profile.photoURL ? (
                  <Image src={profile.photoURL} alt={profile.displayName} width={96} height={96} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-emerald-500/10 text-emerald-500 text-3xl font-semibold">
                    {profile.displayName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{profile.displayName}</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{profile.email}</p>
            </div>

            <div className="h-px bg-zinc-200 dark:bg-zinc-800/40" />

            {chatId && myUid && (
              <TrackedItemsPanel
                parentCollection="chats"
                parentId={chatId}
                myUid={myUid}
                resolveName={(uid) => (uid === myUid ? "You" : profile.displayName)}
              />
            )}

            {/* Additional Details */}
            <div className="space-y-4">
              {profile.bio && (
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <User size={14} /> About
                  </p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900/40 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800/40">
                    {profile.bio}
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-zinc-50 dark:bg-zinc-900/40 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800/40">
                  <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Phone size={12} /> Phone
                  </p>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {profile.phone || "Not provided"}
                  </p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900/40 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800/40">
                  <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <MapPin size={12} /> Location
                  </p>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {profile.location || "Not provided"}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default UserProfileModal;
