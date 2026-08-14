"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { MagnifyingGlass, X, Camera, Trash } from "@phosphor-icons/react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS, type FirestoreUser, type GroupDoc } from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";
import TrackedItemsPanel from "./TrackedItemsPanel";

const spring = { type: "spring", stiffness: 300, damping: 25 } as const;

interface GroupSettingsModalProps {
  group: GroupDoc & { id?: string; groupId?: string };
  onClose: () => void;
}

const GroupSettingsModal = ({ group, onClose }: GroupSettingsModalProps) => {
  const { user } = useAuth();
  const [groupName, setGroupName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [photoURL, setPhotoURL] = useState(group.photoURL);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupId = group.id ?? group.groupId;

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const q = query(collection(db, COLLECTIONS.USERS), where("isActivated", "==", true));
      const snap = await getDocs(q);
      setUsers(snap.docs.map((d) => d.data() as FirestoreUser));
      setLoading(false);
    };
    fetch();
  }, [user]);

  const filtered = users.filter(
    (u) =>
      u.uid !== user?.uid && // not self
      !group.members.some(m => m.uid === u.uid) && // only show people not in group
      (u.displayName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()))
  );

  const isAdmin = group.adminId === user?.uid;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !isAdmin || !groupId) return;
    setUploadLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("id", groupId);
      fd.append("type", "group");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url, publicId } = await res.json();
      await updateDoc(doc(db, COLLECTIONS.GROUPS, groupId), { photoURL: url, photoPublicId: publicId });
      setPhotoURL(url);
    } finally {
      setUploadLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAvatarRemove = async () => {
    if (!user || !isAdmin || !groupId || !photoURL) return;

    const confirmed = window.confirm("Remove this group photo? This will delete it from Cloudinary and clear it from the group.");
    if (!confirmed) return;

    setRemoveLoading(true);
    try {
      const publicIds = group.photoPublicId
        ? [group.photoPublicId]
        : [`Chatly/groups/${groupId}`, `chatly/groups/${groupId}`];

      const res = await fetch("/api/upload/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicIds }),
      });

      if (!res.ok) throw new Error("Remove failed");

      await updateDoc(doc(db, COLLECTIONS.GROUPS, groupId), { photoURL: null, photoPublicId: null });
      setPhotoURL(null);
    } finally {
      setRemoveLoading(false);
    }
  };

  const handleSaveInfo = async () => {
    if (!groupId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.GROUPS, groupId), {
        name: groupName.trim(),
        description: description.trim()
      });
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async (uid: string) => {
    if (!groupId) return;
    const newMembers = [...group.members, { uid, status: "pending" }];
    const newMemberIds = [...(group.memberIds || group.members.map(m => m.uid)), uid];
    await updateDoc(doc(db, COLLECTIONS.GROUPS, groupId), { members: newMembers, memberIds: newMemberIds });
  };

  const handleRemoveMember = async (uid: string) => {
    if (!groupId) return;
    const newMembers = group.members.filter(m => m.uid !== uid);
    const newMemberIds = (group.memberIds || group.members.map(m => m.uid)).filter((id: string) => id !== uid);
    await updateDoc(doc(db, COLLECTIONS.GROUPS, groupId), { members: newMembers, memberIds: newMemberIds });
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
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {isAdmin ? "Group Settings" : "Group Info"}
            </h2>
            <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Avatar */}
            <div className="flex items-center gap-5">
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/40">
                  {photoURL ? (
                    <Image src={photoURL} alt={group.name} width={64} height={64} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-emerald-500/10 text-emerald-500 text-xl font-semibold">
                      {group.name[0]?.toUpperCase() ?? "?"}
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <>
                    <motion.button
                      onClick={() => fileInputRef.current?.click()}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.92 }}
                      disabled={uploadLoading || removeLoading}
                      transition={spring}
                      aria-label="Change group photo"
                      className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white shadow-lg disabled:opacity-60 transition-colors"
                    >
                      <Camera size={14} weight="fill" />
                    </motion.button>
                    {photoURL && (
                      <motion.button
                        onClick={handleAvatarRemove}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.92 }}
                        disabled={uploadLoading || removeLoading}
                        transition={spring}
                        aria-label="Remove group photo"
                        className="absolute -bottom-1.5 -left-1.5 p-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-white shadow-lg disabled:opacity-60 transition-colors"
                      >
                        <Trash size={14} weight="fill" />
                      </motion.button>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  disabled={!isAdmin || !isEditing}
                  placeholder="Group Name"
                  className="w-full bg-transparent border-b border-zinc-300 dark:border-zinc-700 focus:border-emerald-500 outline-none text-sm font-semibold text-zinc-900 dark:text-zinc-200 py-1 disabled:border-transparent"
                />
                {uploadLoading && <p className="text-xs text-emerald-400 mt-1">Uploading...</p>}
                {removeLoading && <p className="text-xs text-red-400 mt-1">Removing...</p>}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Description</p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!isAdmin || !isEditing}
                placeholder={isAdmin ? "Add group description..." : "No description."}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/60 focus:border-zinc-300 dark:focus:border-zinc-700/80 rounded-xl text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none transition-all resize-none h-16 disabled:opacity-80"
              />
            </div>
            
            {isAdmin && (
              <div className="flex justify-end gap-2">
                {!isEditing ? (
                  <button onClick={() => setIsEditing(true)} className="px-4 py-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-semibold shadow-sm transition-colors">
                    Edit Info
                  </button>
                ) : (
                  <>
                    <button onClick={() => {
                      setIsEditing(false);
                      setGroupName(group.name);
                      setDescription(group.description);
                    }} className="px-4 py-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-semibold shadow-sm transition-colors">
                      Cancel
                    </button>
                    <button onClick={handleSaveInfo} disabled={saving} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-lg transition-colors">
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="h-px bg-zinc-200 dark:bg-zinc-800/40 my-2" />

            {groupId && user && (
              <TrackedItemsPanel
                parentCollection="groups"
                parentId={groupId}
                myUid={user.uid}
                resolveName={(uid) => (uid === user.uid ? "You" : (users.find((x) => x.uid === uid)?.displayName ?? "Unknown"))}
              />
            )}

            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                {isAdmin ? "Manage Members" : "Members"}
              </p>
              {/* Existing Members */}
              <div className="space-y-1 mb-4 max-h-32 overflow-y-auto">
                {group.members.map((m) => {
                  const u = users.find((x) => x.uid === m.uid);
                  const isUserAdmin = m.uid === group.adminId;
                  if (isAdmin && isUserAdmin) return null; // Admin doesn't need to see remove button for themselves
                  return (
                    <div key={m.uid} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/40">
                      <p className="text-sm text-zinc-800 dark:text-zinc-300">
                        {u?.displayName || (isUserAdmin && !isAdmin ? "Admin" : "Loading...")} 
                        {isUserAdmin && <span className="ml-1 text-[10px] text-emerald-500 font-bold uppercase">(Admin)</span>}
                        <span className="text-[10px] text-zinc-500 ml-1">({m.status})</span>
                      </p>
                      {isAdmin && !isUserAdmin && (
                        <button onClick={() => handleRemoveMember(m.uid)} className="text-xs font-medium text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors px-2 py-1 bg-red-500/10 rounded-lg">Remove</button>
                      )}
                    </div>
                  );
                })}
                {group.members.length <= 1 && <p className="text-xs text-zinc-500 italic">No other members.</p>}
              </div>

              {/* Add New Members - Admins Only */}
              {isAdmin && (
                <>
                  <div className="relative mb-2 mt-4">
                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={15} />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search to add members..."
                      className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/60 focus:border-zinc-300 dark:focus:border-zinc-700/80 rounded-xl text-sm text-zinc-800 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none transition-all"
                    />
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {loading ? (
                      <p className="text-xs text-zinc-500 p-2">Loading users...</p>
                    ) : filtered.length === 0 ? (
                      <p className="text-xs text-zinc-500 p-2">No users to add.</p>
                    ) : (
                      filtered.map((u) => (
                        <div key={u.uid} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/40 transition-colors">
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700/40 flex-shrink-0">
                            {u.photoURL ? (
                              <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                                {u.displayName[0]?.toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-zinc-800 dark:text-zinc-300">{u.displayName}</p>
                            <p className="truncate text-xs text-zinc-500">{u.email}</p>
                          </div>
                          <button onClick={() => handleAddMember(u.uid)} className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-lg flex-shrink-0 transition-colors">Add</button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default GroupSettingsModal;
