"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ChatCircle,
  UsersThree,
  GearSix,
  SignOut,
  ArrowRight,
} from "@phosphor-icons/react";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

const spring = { type: "spring", stiffness: 300, damping: 25 } as const;

interface SidebarProps {
  activeView: "messages" | "groups" | "settings";
  onViewChange: (view: "messages" | "groups" | "settings") => void;
}

const navItems = [
  { id: "messages", icon: ChatCircle, label: "Messages" },
  { id: "groups", icon: UsersThree, label: "Groups" },
] as const;

const Sidebar = ({ activeView, onViewChange }: SidebarProps) => {
  const { profile, logout } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.aside
      initial={false}
      animate={{ width: isExpanded ? 240 : 80 }}
      transition={spring}
      className="h-full bg-[#090a0f] border-r border-zinc-800/40 flex flex-col items-center py-6 relative z-20 select-none overflow-hidden"
    >
      {/* User Profile (Top) */}
      <div 
        className={`w-full px-3 mb-8 flex items-center gap-3 cursor-pointer transition-all ${isExpanded ? "bg-zinc-800/20 rounded-2xl mx-3 w-[calc(100%-24px)] py-3" : "justify-center py-2"}`} 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="w-10 h-10 rounded-xl overflow-hidden border border-zinc-700/40 bg-zinc-800 flex-shrink-0 shadow-lg shadow-black/20">
          {profile?.photoURL ? (
            <Image src={profile.photoURL} alt={profile.displayName} width={40} height={40} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-emerald-500/10 text-emerald-400 font-semibold text-xs">
              {profile?.displayName?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </div>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex flex-col min-w-0"
            >
              <span className="text-xs font-bold text-zinc-100 truncate">{profile?.displayName}</span>
              <span className="text-[10px] text-emerald-500 font-medium">Online</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Nav */}
      <nav className="flex flex-col gap-2 w-full px-3 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <motion.button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full relative px-3 py-3 rounded-xl flex items-center gap-4 group transition-colors ${
                isActive ? "text-emerald-400 bg-zinc-800/40" : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/20"
              }`}
              title={!isExpanded ? item.label : ""}
            >
              <div className="w-6 flex items-center justify-center flex-shrink-0">
                <Icon size={22} weight={isActive ? "fill" : "regular"} />
              </div>
              <AnimatePresence>
                {isExpanded && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="text-sm font-semibold whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {isActive && !isExpanded && (
                <motion.div
                  layoutId="sidebar-active-pill"
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-l-full"
                  transition={spring}
                />
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Bottom Controls */}
      <div className="mt-auto flex flex-col gap-2 w-full px-3">
        {/* Settings */}
        <motion.button
          onClick={() => onViewChange("settings")}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`w-full relative px-3 py-3 rounded-xl flex items-center gap-4 transition-colors ${
            activeView === "settings" ? "text-emerald-400 bg-zinc-800/40" : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/20"
          }`}
          title={!isExpanded ? "Settings" : ""}
        >
          <div className="w-6 flex items-center justify-center flex-shrink-0">
            <GearSix size={22} weight={activeView === "settings" ? "fill" : "regular"} />
          </div>
          <AnimatePresence>
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-sm font-semibold whitespace-nowrap"
              >
                Settings
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        <div className="h-px bg-zinc-800/40 my-2 mx-3" />

        {/* Logout */}
        <motion.button
          onClick={logout}
          aria-label="Sign out"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full px-3 py-3 rounded-xl flex items-center gap-4 text-zinc-600 hover:text-red-400 hover:bg-red-500/5 transition-all"
        >
          <div className="w-6 flex items-center justify-center flex-shrink-0">
            <SignOut size={20} />
          </div>
          <AnimatePresence>
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-sm font-semibold whitespace-nowrap"
              >
                Sign out
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Expand Toggle Button (Floating) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-colors z-30 shadow-xl"
      >
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
          <ArrowRight size={12} weight="bold" />
        </motion.div>
      </button>
    </motion.aside>
  );
};

export default Sidebar;