"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { MagnifyingGlass, Plus, UsersThree, ArrowLeft } from "@phosphor-icons/react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS, type FirestoreUser } from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";
import { ChatItemSkeleton } from "@/components/ui/Skeleton";
import { formatDistanceToNow } from "date-fns";
import clsx from "clsx";
import { useChatsQuery, useGroupsQuery } from "@/lib/firebase-hooks";
import { getPresenceDotColor, type PresenceDotColor } from "@/lib/presence";

const spring = { type: "spring", stiffness: 300, damping: 25 } as const;

// ─── Types ────────────────────────────────────────────────────────────────────
export type SelectedConversation =
  | {
      type: "dm";
      chatId: string;
      other: FirestoreUser;
      participants: string[];
      status: "pending" | "active" | "rejected";
      requestedBy: string;
      unreadCount?: Record<string, number>;
      lastRead?: Record<string, any>;
      lastMessage?: string;
      lastMessageAt?: any;
    }
  | {
      type: "group";
      groupId: string;
      name: string;
      photoURL: string | null;
      adminId: string;
      members: Array<{ uid: string; status: "pending" | "accepted" }>;
      requestedBy?: string;
      unreadCount?: Record<string, number>;
      lastRead?: Record<string, any>;
      lastMessage?: string;
      lastMessageAt?: any;
      description?: string;
    };

interface ChatListProps {
  selected: SelectedConversation | null;
  onSelect: (conv: SelectedConversation) => void;
  view: "messages" | "groups";
  onNewChat: () => void;
  onNewGroup: () => void;
  /** Mobile only: whether this panel is visible */
  mobileVisible?: boolean;
}

type SubTab = "all" | "pending";

// ─── Sub-tab pill ─────────────────────────────────────────────────────────────
function SubTabs({ active, onChange }: { active: SubTab; onChange: (t: SubTab) => void }) {
  return (
    <div className="flex gap-1 p-1 bg-zinc-200/50 dark:bg-zinc-900/60 backdrop-blur-3xl rounded-xl mb-3 border border-white/50 dark:border-white/5 shadow-inner">
      {(["all", "pending"] as SubTab[]).map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`relative flex-1 py-1.5 text-xs rounded-lg capitalize transition-colors ${
            active === tab 
              ? "text-zinc-900 dark:text-white font-bold" 
              : "text-zinc-500 dark:text-zinc-400 font-medium hover:text-zinc-700 dark:hover:text-zinc-200"
          }`}
        >
          {active === tab && (
            <motion.div
              layoutId="chatlist-subtab-pill"
              className="absolute inset-0 bg-white dark:bg-zinc-800 shadow-sm dark:shadow-none rounded-lg border border-zinc-200/50 dark:border-transparent"
              transition={spring}
            />
          )}
          <span className="relative z-10">{tab}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Real-time User Presence Hook ──────────────────────────────────────────
function usePresence(uid?: string) {
  const [profile, setProfile] = useState<FirestoreUser | null>(null);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, COLLECTIONS.USERS, uid), (snap) => {
      if (snap.exists()) setProfile(snap.data() as FirestoreUser);
    }, (error) => {
      console.warn(`Could not read profile for ${uid} in usePresence:`, error);
    });
    return unsub;
  }, [uid]);

  return profile;
}

// ─── Avatar utility ───────────────────────────────────────────────────────────
const DOT_CLASSES: Record<PresenceDotColor, string> = {
  green: "bg-[#3dfc82] shadow-[0_0_8px_rgba(61,252,130,0.6)]",
  red: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]",
  yellow: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]",
};

function Avatar({
  name,
  photoURL,
  online,
  dotColor,
  size = 10,
}: {
  name: string;
  photoURL?: string | null;
  online?: boolean;
  /** Overrides the default green/gray online dot — see getPresenceDotColor(). */
  dotColor?: PresenceDotColor | null;
  size?: number;
}) {
  return (
    <div className={`relative w-${size} h-${size} flex-shrink-0`}>
      <div className={`w-${size} h-${size} rounded-full overflow-hidden bg-zinc-800 border border-zinc-700/30 shadow-inner`}>
        {photoURL ? (
          <Image src={photoURL} alt={name} width={40} height={40} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-emerald-500/10 text-emerald-400 text-sm font-semibold">
            {name[0]?.toUpperCase()}
          </div>
        )}
      </div>
      {dotColor ? (
        <span className={clsx("absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#12141c] transition-colors duration-500", DOT_CLASSES[dotColor])} />
      ) : online != null ? (
        <span className={clsx(
          "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#12141c] transition-colors duration-500",
          online ? "bg-[#3dfc82] shadow-[0_0_8px_rgba(61,252,130,0.6)]" : "bg-zinc-600"
        )} />
      ) : null}
    </div>
  );
}

function ChatListItem({
  conv,
  isSelected,
  onSelect,
  currentUser,
  myBlockedUsers,
}: {
  conv: SelectedConversation;
  isSelected: boolean;
  onSelect: (c: SelectedConversation) => void;
  currentUser: any;
  myBlockedUsers: string[];
}) {
  const otherUid = conv.type === "dm" ? conv.participants.find(p => p !== currentUser?.uid) : undefined;
  const liveProfile = usePresence(otherUid);

  const label = conv.type === "dm" ? (liveProfile?.displayName || conv.other.displayName) : conv.name;
  const photo = conv.type === "dm" ? (liveProfile?.photoURL || conv.other.photoURL) : conv.photoURL;
  const isOnline = conv.type === "dm" ? liveProfile?.status === "online" : undefined;
  const isPending = conv.type === "dm" && conv.status === "pending";
  const isBlocked =
    conv.type === "dm" && Boolean(otherUid && (myBlockedUsers.includes(otherUid) || liveProfile?.blockedUsers?.includes(currentUser?.uid)));
  const dotColor = conv.type === "dm" ? getPresenceDotColor({ status: conv.status, isBlocked, isOnline: Boolean(isOnline) }) : null;
  const unread = currentUser ? conv.unreadCount?.[currentUser.uid] : 0;

  return (
    <motion.button
      onClick={() => onSelect(conv)}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={spring}
      className="w-full relative p-3 rounded-xl flex items-center gap-3 text-left focus:outline-none"
    >
      {/* Selection bg pill */}
      {isSelected && (
        <motion.div
          layoutId="chatlist-selection-pill"
          className="absolute inset-0 bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/20 shadow-sm dark:shadow-none rounded-xl"
          transition={spring}
        />
      )}

      <div className="relative z-10 flex items-center gap-3 w-full">
        <Avatar
          name={label}
          photoURL={photo}
          size={10}
          online={isOnline}
          dotColor={dotColor}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-zinc-900 dark:text-zinc-200 truncate">{label}</span>
            {isPending ? (
              <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20 ml-2 flex-shrink-0">
                Pending
              </span>
            ) : (
              unread ? (
                <span className="w-5 h-5 flex items-center justify-center bg-[#3dfc82] text-[#0b0c10] text-[10px] font-bold rounded-full ml-2 flex-shrink-0 animate-in zoom-in duration-300">
                  {unread}
                </span>
              ) : null
            )}
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate flex-1 pr-2">
              {conv.type === "dm" 
                ? (isPending 
                    ? "Connection request" 
                    : conv.lastMessage || "No messages yet") 
                : (conv.lastMessage || "Group conversation")}
            </p>
            {conv.type === "dm" && !isPending && !isOnline && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                {liveProfile?.lastSeen 
                  ? formatDistanceToNow((liveProfile.lastSeen as any).toDate(), { addSuffix: true })
                  : ""}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const ChatList = ({ selected, onSelect, view, onNewChat, onNewGroup, mobileVisible }: ChatListProps) => {
  const { user: currentUser, profile: myProfile } = useAuth();
  const myBlockedUsers = myProfile?.blockedUsers ?? [];
  const [subTab, setSubTab] = useState<SubTab>("all");
  const [search, setSearch] = useState("");

  // Reset subTab and search when switching views
  useEffect(() => {
    setSubTab("all");
    setSearch("");
  }, [view]);

  // ─── TanStack Query powered real-time data ─────────────────────────────────
  const { data: dmChats = [], isLoading: loadingDms } = useChatsQuery(currentUser?.uid);
  const { data: groups = [], isLoading: loadingGroups } = useGroupsQuery(currentUser?.uid);

  // ─── Derived list ─────────────────────────────────────────────────────────
  const rawList = view === "messages" ? dmChats : groups;

  const filtered = rawList.filter((conv) => {
    const label = conv.type === "dm" ? conv.other.displayName : conv.name;
    const matchesSearch = label.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    // Only apply pending filter for DM view
    if (view === "messages" && subTab === "pending" && conv.type === "dm" && conv.status !== "pending") return false;
    return true;
  });

  return (
    <div 
      className={clsx(
        // Desktop: always visible, fixed width
        "md:w-80 md:flex-shrink-0 md:flex md:flex-col",
        // Mobile: full width, conditionally shown based on mobileVisible
        "flex flex-col",
        mobileVisible === false ? "hidden md:flex" : "flex",
        "border-r border-zinc-200 dark:border-zinc-800/40 bg-zinc-50 dark:bg-[#12141c] h-full",
        // On mobile when visible, take full width
        mobileVisible !== false ? "w-full md:w-80" : ""
      )}
    >
      {/* ─── Header ── */}
      <header className="h-[60px] border-b border-zinc-200 dark:border-zinc-800/40 px-5 flex items-center justify-between flex-shrink-0 bg-white/50 dark:bg-[#12141c]/50 backdrop-blur-md">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {view === "messages" ? "Messages" : "Groups"}
          </h2>
          <motion.button
            onClick={view === "messages" ? onNewChat : onNewGroup}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            transition={spring}
            className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-colors"
            title={view === "messages" ? "New message" : "New group"}
          >
            {view === "messages" ? <Plus size={16} weight="bold" /> : <UsersThree size={16} weight="bold" />}
          </motion.button>
        </header>

        <div className="px-5 py-3">
        <div className="relative group">
          <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" size={16} />
          <input
            type="text"
            placeholder={view === "messages" ? "Search messages..." : "Search groups..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/60 focus:border-emerald-500/50 rounded-xl text-sm text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-500 outline-none transition-all shadow-sm dark:shadow-none"
          />
        </div>
        {/* Only show pending/all tabs for DMs */}
        {view === "messages" && <SubTabs active={subTab} onChange={setSubTab} />}
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-3 space-y-0.5 pb-4">
        {(view === "messages" ? loadingDms : loadingGroups) ? (
          <div className="space-y-1">
            <ChatItemSkeleton />
            <ChatItemSkeleton />
            <ChatItemSkeleton />
          </div>
        ) : (
          <AnimatePresence>
            {filtered.length > 0 ? (
              filtered.map((conv) => {
                const id = conv.type === "dm" ? conv.chatId : conv.groupId;
                const isSelected =
                  selected?.type === conv.type &&
                  (selected.type === "dm" ? selected.chatId === (conv as { chatId: string }).chatId : (selected as { groupId: string }).groupId === (conv as { groupId: string }).groupId);

                return (
                  <ChatListItem
                    key={id}
                    conv={conv}
                    isSelected={isSelected}
                    onSelect={onSelect}
                    currentUser={currentUser}
                    myBlockedUsers={myBlockedUsers}
                  />
                );
              })
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-48 text-center px-4"
              >
                <p className="text-sm text-zinc-600 font-medium">
                  {search ? "No results found" : view === "messages" ? "No conversations yet" : "No groups yet"}
                </p>
                <p className="text-xs text-zinc-700 mt-1">
                  {!search && (view === "messages" ? "Start a new chat" : "Create or join a group")}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default ChatList;
