"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import {
  collection,
  onSnapshot,
  query,
  where,
  setDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS, getDMChatId, type FirestoreUser } from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";
import { useUsersQuery } from "@/lib/firebase-hooks";

const spring = { type: "spring", stiffness: 300, damping: 25 } as const;

import { type SelectedConversation } from "./ChatList";

interface NewChatModalProps {
  onClose: () => void;
  onSelect?: (conv: SelectedConversation) => void;
}

type ExistingChat = {
  id: string;
  participants: string[];
  status: "pending" | "active" | "rejected";
  requestedBy: string;
};

const NewChatModal = ({ onClose, onSelect }: NewChatModalProps) => {
  const { user, profile } = useAuth();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState<string | null>(null);
  // Live existing chats via onSnapshot so status is always fresh
  const [existingChats, setExistingChats] = useState<ExistingChat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);

  // ─── TanStack Query powered user list ────────────────────────────────────
  const { data: allUsers = [], isLoading: usersLoading } = useUsersQuery(user?.uid);

  // ─── Real-time existing chats subscription ───────────────────────────────
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, COLLECTIONS.CHATS),
      where("participants", "array-contains", user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setExistingChats(
          snap.docs.map((d) => ({
            id: d.id,
            participants: d.data().participants,
            status: d.data().status,
            requestedBy: d.data().requestedBy,
          }))
        );
        setChatsLoading(false);
      },
      (err) => {
        console.warn("Error listening to existing chats:", err);
        setChatsLoading(false);
      }
    );

    return unsub;
  }, [user]);

  const loading = usersLoading || chatsLoading;

  const filtered = allUsers.filter((u) => {
    // Hide if either blocked each other
    const isTargetBlocked = profile?.blockedUsers?.includes(u.uid);
    const targetBlockedMe = u.blockedUsers?.includes(user?.uid as string);
    if (isTargetBlocked || targetBlockedMe) return false;

    return (
      u.displayName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    );
  });

  const handleStartChat = async (target: FirestoreUser) => {
    if (!user || creating) return;
    setCreating(target.uid);

    try {
      const chatId = getDMChatId(user.uid, target.uid);
      const chatRef = doc(db, COLLECTIONS.CHATS, chatId);
      const isAccepted = profile?.acceptedContacts?.includes(target.uid);
      const existingChat = existingChats.find((c) => c.participants.includes(target.uid));

      if (!existingChat) {
        // First time — create the chat document
        await setDoc(chatRef, {
          participants: [user.uid, target.uid].sort(),
          status: isAccepted ? "active" : "pending",
          requestedBy: user.uid,
          createdAt: serverTimestamp(),
          lastMessageAt: serverTimestamp(),
          lastMessage: "",
        });
      } else if (existingChat.status === "rejected") {
        // Re-send request after rejection
        await setDoc(
          chatRef,
          {
            status: isAccepted ? "active" : "pending",
            requestedBy: user.uid,
          },
          { merge: true }
        );
      }
      // If existingChat with status "pending" or "active" — just open it, no doc write needed

      // ✅ Always open the conversation regardless of whether it's new or existing
      if (onSelect) {
        const chatStatus = existingChat
          ? existingChat.status === "rejected"
            ? (isAccepted ? "active" : "pending")
            : existingChat.status
          : isAccepted
          ? "active"
          : "pending";

        const requestedBy = existingChat
          ? existingChat.status === "rejected"
            ? user.uid
            : existingChat.requestedBy
          : user.uid;

        onSelect({
          type: "dm",
          chatId,
          other: target,
          participants: [user.uid, target.uid].sort(),
          status: chatStatus,
          requestedBy,
        });
      }

      onClose();
    } finally {
      setCreating(null);
    }
  };

  // ─── Button label logic ───────────────────────────────────────────────────
  const getButtonInfo = (u: FirestoreUser): { label: string; disabled: boolean; style: string } => {
    if (creating === u.uid) {
      return { label: "Opening...", disabled: true, style: "opacity-50" };
    }
    const chat = existingChats.find((c) => c.participants.includes(u.uid));
    if (!chat) {
      return {
        label: "Connect",
        disabled: false,
        style: "bg-emerald-600 hover:bg-emerald-500 text-white",
      };
    }
    if (chat.status === "active") {
      return {
        label: "Message",
        disabled: false,
        style: "bg-zinc-700 hover:bg-zinc-600 text-zinc-100",
      };
    }
    if (chat.status === "pending") {
      const isRequester = chat.requestedBy === user?.uid;
      return {
        label: isRequester ? "Pending ↗" : "Respond",
        disabled: false,
        style: isRequester
          ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30"
          : "bg-emerald-600 hover:bg-emerald-500 text-white",
      };
    }
    if (chat.status === "rejected") {
      return {
        label: "Re-connect",
        disabled: false,
        style: "bg-zinc-700 hover:bg-zinc-600 text-zinc-100",
      };
    }
    return { label: "Connect", disabled: false, style: "bg-emerald-600 hover:bg-emerald-500 text-white" };
  };

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
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">New Chat</h2>
            <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email or name..."
                className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/60 focus:border-emerald-500/50 rounded-xl text-sm text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none transition-all shadow-sm dark:shadow-none"
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-3">
              {loading ? (
                <p className="text-center text-sm text-zinc-600 py-8">Loading users...</p>
              ) : filtered.length === 0 ? (
                <p className="text-center text-sm text-zinc-600 py-8">No users found</p>
              ) : (
                filtered.map((u) => {
                  const { label, disabled, style } = getButtonInfo(u);
                  return (
                    <div
                      key={u.uid}
                      className="flex items-center gap-4 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/40"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700/40 flex-shrink-0">
                        {u.photoURL ? (
                          <Image src={u.photoURL} alt={u.displayName} width={40} height={40} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                            {u.displayName[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200 truncate">{u.displayName}</p>
                        <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                      </div>
                      <button
                        onClick={() => handleStartChat(u)}
                        disabled={disabled}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50 transition-colors ${style}`}
                      >
                        {label}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NewChatModal;
