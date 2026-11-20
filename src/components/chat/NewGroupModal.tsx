"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { MagnifyingGlass, X, Check } from "@phosphor-icons/react";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS, type FirestoreUser, type GroupDoc } from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";

const spring = { type: "spring", stiffness: 300, damping: 25 } as const;

interface NewGroupModalProps {
  onClose: () => void;
}

const NewGroupModal = ({ onClose }: NewGroupModalProps) => {
  const { user } = useAuth();
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const q = query(collection(db, COLLECTIONS.USERS), where("isActivated", "==", true));
      const snap = await getDocs(q);
      setUsers(snap.docs.map((d) => d.data() as FirestoreUser).filter((u) => u.uid !== user.uid));
      setLoading(false);
    };
    fetch();
  }, [user]);

  const filtered = users.filter(
    (u) =>
      u.displayName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = (uid: string) =>
    setSelected((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );

  const handleCreate = async () => {
    if (!user) return;
    if (!groupName.trim()) return setError("Please enter a group name.");
    if (selected.length === 0) return setError("Select at least one member.");
    setError("");
    setCreating(true);
    try {
      const members = [
        { uid: user.uid, status: "accepted" }, // Admin is auto-accepted
        ...selected.map((uid) => ({ uid, status: "pending" })),
      ] as GroupDoc["members"];

      const memberIds = [user.uid, ...selected];

      await addDoc(collection(db, COLLECTIONS.GROUPS), {
        name: groupName.trim(),
        description: description.trim(),
        photoURL: null,
        adminId: user.uid,
        members,
        memberIds,
        createdAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
        lastMessage: "",
      } satisfies Omit<GroupDoc, "id">);
      onClose();
    } catch (err) {
      console.error("Group creation error:", err);
      setError(`Failed to create group: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setCreating(false);
    }
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
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Create Group</h2>
            <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="p-4 space-y-3 max-h-[80vh] overflow-y-auto">
            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">{error}</p>
            )}

            <input
              type="text"
              placeholder="Group Name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/60 focus:border-emerald-500/50 rounded-xl text-sm text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none transition-all shadow-sm dark:shadow-none"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/60 focus:border-emerald-500/50 rounded-xl text-sm text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none transition-all shadow-sm dark:shadow-none"
            />
            
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input
                type="text"
                placeholder="Search to add members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/40 focus:border-emerald-500/50 rounded-xl text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none transition-all shadow-sm dark:shadow-none"
              />
            </div>

            {/* Selected chips */}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selected.map((uid) => {
                  const u = users.find((u) => u.uid === uid);
                  if (!u) return null;
                  return (
                    <motion.button
                      key={uid}
                      onClick={() => handleToggle(uid)}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-medium"
                    >
                      {u.displayName} <X size={10} />
                    </motion.button>
                  );
                })}
              </div>
            )}

            {/* User list */}
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {loading ? (
                <p className="text-center text-sm text-zinc-600 py-6">Loading users...</p>
              ) : filtered.length === 0 ? (
                <p className="text-center text-sm text-zinc-600 py-6">No users found</p>
              ) : (
                filtered.map((u) => {
                  const isSelected = selected.includes(u.uid);
                  return (
                    <div
                      key={u.uid}
                      className={`flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-emerald-500/10 border-emerald-500/40"
                          : "bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800/40 hover:border-zinc-300 dark:hover:border-zinc-700/60"
                      }`}
                      onClick={() => handleToggle(u.uid)}
                    >
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700/40 flex-shrink-0">
                        {u.photoURL ? (
                          <Image src={u.photoURL} alt={u.displayName} width={32} height={32} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                            {u.displayName[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200 truncate">{u.displayName}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? "border-emerald-500 bg-emerald-500" : "border-zinc-300 dark:border-zinc-600"}`}>
                        {isSelected && <Check size={10} weight="bold" className="text-white" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <motion.button
              onClick={handleCreate}
              disabled={creating}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
              transition={spring}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-emerald-500/10 disabled:opacity-60 disabled:pointer-events-none transition-colors"
            >
              {creating ? "Creating..." : `Create Group${selected.length > 0 ? ` (${selected.length} member${selected.length > 1 ? "s" : ""})` : ""}`}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NewGroupModal;
