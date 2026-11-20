"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/chat/Sidebar";
import ChatList, { type SelectedConversation } from "@/components/chat/ChatList";
import ChatWindow from "@/components/chat/ChatWindow";
import SettingsPanel from "@/components/chat/SettingsPanel";
import NewChatModal from "@/components/chat/NewChatModal";
import NewGroupModal from "@/components/chat/NewGroupModal";
import { motion } from "framer-motion";
import { ChatCircle, UsersThree, GearSix, ChatsCircle } from "@phosphor-icons/react";
import { useChatsQuery, useGroupsQuery } from "@/lib/firebase-hooks";
import ChatlyLogo from "@/components/landing/ChatlyLogo";
import { clearServerSession } from "@/lib/session";

type View = "messages" | "groups" | "settings";

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="flex h-[100dvh] bg-white dark:bg-[#0b0c10] items-center justify-center">
      <motion.div
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
        className="flex items-center"
      >
        <ChatlyLogo
          markClassName="h-10 w-10"
          textClassName="text-lg text-zinc-500 dark:text-zinc-500"
        />
      </motion.div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ view }: { view: View }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-zinc-50 dark:bg-[#11131a] text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/40 shadow-sm dark:shadow-none flex items-center justify-center mb-4">
        <ChatsCircle size={28} className="text-emerald-500" aria-hidden />
      </div>
      <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-300 mb-1">
        {view === "groups" ? "Select a group" : "Select a conversation"}
      </h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-600 max-w-xs">
        {view === "groups"
          ? "Choose a group from the list or create a new one."
          : "Choose a conversation from the list or start a new one."}
      </p>
    </div>
  );
}

// ─── Mobile Bottom Tab Bar ────────────────────────────────────────────────────
function MobileTabBar({
  activeView,
  onViewChange,
}: {
  activeView: View;
  onViewChange: (v: View) => void;
}) {
  const tabs = [
    { id: "messages" as const, icon: ChatCircle, label: "Chats" },
    { id: "groups" as const, icon: UsersThree, label: "Groups" },
    { id: "settings" as const, icon: GearSix, label: "Settings" },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-[#090a0f] border-t border-zinc-200 dark:border-zinc-800/60 flex items-stretch h-16 safe-area-bottom">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeView === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onViewChange(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
              isActive
                ? "text-emerald-500"
                : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            }`}
          >
            <Icon size={22} weight={isActive ? "fill" : "regular"} />
            <span className="text-[10px] font-semibold tracking-wide">{tab.label}</span>
            {isActive && (
              <motion.div
                layoutId="mobile-tab-indicator"
                className="absolute bottom-0 w-8 h-0.5 bg-emerald-500 rounded-t-full"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const ChatPage = () => {
  const { user, loading } = useAuth();
  const [activeView, setActiveView] = useState<View>("messages");
  const [selected, setSelected] = useState<SelectedConversation | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);

  // ─── Mobile panel tracking ─────────────────────────────────────────────────
  // "list" = show chat/group list, "chat" = show chat window
  const [mobilePanel, setMobilePanel] = useState<"list" | "chat">("list");

  // When a conversation is selected on mobile → switch to chat panel
  const handleSelect = (conv: SelectedConversation) => {
    setSelected(conv);
    setMobilePanel("chat");
  };

  // When back button pressed in ChatWindow on mobile
  const handleBack = () => {
    setMobilePanel("list");
    setSelected(null);
  };

  // When view changes → go back to list panel
  const handleViewChange = (view: View) => {
    setActiveView(view);
    setMobilePanel("list");
    setSelected(null);
  };

  // ─── Live data from TanStack Query — keep selected in sync ─────────────────
  const { data: dmChats = [] } = useChatsQuery(user?.uid);
  const { data: groupChats = [] } = useGroupsQuery(user?.uid);

  // When the underlying chat/group data changes, update selected so status is fresh
  useEffect(() => {
    if (!selected) return;
    if (selected.type === "dm") {
      const fresh = dmChats.find((c) => c.type === "dm" && c.chatId === selected.chatId);
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(selected)) {
        setSelected(fresh);
      }
    } else {
      const fresh = groupChats.find(
        (g) => g.type === "group" && g.groupId === selected.groupId
      );
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(selected)) {
        setSelected(fresh);
      }
    }
  }, [dmChats, groupChats]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Listen for global chat closure signals ──────────────────────────────
  React.useEffect(() => {
    const handleClose = () => {
      setSelected(null);
      setMobilePanel("list");
    };
    window.addEventListener("close-chat", handleClose);
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
        setMobilePanel("list");
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("close-chat", handleClose);
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);

  // The route guard only checks that a session cookie exists. If Firebase has
  // no user (expired/revoked session), drop the stale cookie and re-authenticate.
  useEffect(() => {
    if (loading || user) return;
    clearServerSession().finally(() => {
      window.location.replace(`/login?from=${encodeURIComponent("/chat")}`);
    });
  }, [loading, user]);

  if (loading || !user) return <LoadingScreen />;

  const showChatWindow = selected !== null;

  return (
    <div className="flex h-[100dvh] bg-white dark:bg-[#0b0c10] overflow-hidden text-zinc-900 dark:text-zinc-100 antialiased font-sans">

      {/* ─── Desktop Sidebar (hidden on mobile) ─────────────────────────── */}
      <div className="hidden md:flex">
        <Sidebar activeView={activeView} onViewChange={handleViewChange} />
      </div>

      {/* ─── Settings panel (full width on all screens) ──────────────────── */}
      {activeView === "settings" ? (
        <SettingsPanel />
      ) : (
        <>
          {/* ─── Chat / Group List ─────────────────────────────────────────
              Desktop: always visible (w-80)
              Mobile: visible only when mobilePanel === "list"
          */}
          <div
            className={`
              ${mobilePanel === "list" ? "flex" : "hidden"}
              md:flex
              w-full md:w-auto md:flex-shrink-0
            `}
          >
            <ChatList
              selected={selected}
              onSelect={handleSelect}
              view={activeView}
              onNewChat={() => setShowNewChat(true)}
              onNewGroup={() => setShowNewGroup(true)}
            />
          </div>

          {/* ─── Main chat area ────────────────────────────────────────────
              Desktop: always visible (flex-1)
              Mobile: visible only when mobilePanel === "chat"
          */}
          <div
            className={`
              ${mobilePanel === "chat" ? "flex" : "hidden"}
              md:flex
              flex-1 min-w-0
            `}
          >
            {showChatWindow ? (
              <ChatWindow
                key={selected.type === "dm" ? selected.chatId : selected.groupId}
                conversation={selected}
                onBack={handleBack}
              />
            ) : (
              // Desktop empty state only
              <EmptyState view={activeView} />
            )}
          </div>
        </>
      )}

      {/* ─── Mobile Bottom Tab Bar ───────────────────────────────────────── */}
      {/* Only show when NOT in chat panel so it doesn't overlap the chat */}
      {mobilePanel === "list" && (
        <MobileTabBar activeView={activeView} onViewChange={handleViewChange} />
      )}

      {/* ─── Modals ─────────────────────────────────────────────────────── */}
      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} onSelect={handleSelect} />}
      {showNewGroup && <NewGroupModal onClose={() => setShowNewGroup(false)} />}
    </div>
  );
};

export default ChatPage;
