"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Checks, CheckCircle, FileText, DownloadSimple, Play, Pause, Microphone, DotsThree } from "@phosphor-icons/react";
import clsx from "clsx";
import type { MessageMediaMeta } from "@/lib/firestore";

const spring = { type: "spring", stiffness: 300, damping: 25 } as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms?: number): string {
  if (!ms) return "0:00";
  const totalSeconds = Math.round(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function VoiceMessagePlayer({ url, durationMs }: { url: string; durationMs?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setProgress((audio.currentTime / (audio.duration || 1)) * 100);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const seekTo = (parseFloat(e.target.value) / 100) * (audio.duration || 0);
    audio.currentTime = seekTo;
    setProgress(parseFloat(e.target.value));
  };

  return (
    <div className="flex items-center gap-3 min-w-[220px] py-1 mb-1">
      <audio 
        ref={audioRef} 
        src={url} 
        onPlay={() => setPlaying(true)} 
        onPause={() => setPlaying(false)} 
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={handleTimeUpdate}
      />
      <button 
        type="button" 
        onClick={toggle} 
        className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-current flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"
      >
        {playing ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" className="ml-1" />}
      </button>
      <div className="flex flex-col flex-1 gap-1.5 justify-center mt-1">
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={progress || 0} 
          onChange={handleSeek}
          className="w-full h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer accent-current [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
        />
        <div className="flex justify-between items-center px-0.5">
          <span className="text-[10px] opacity-75 font-medium">{formatDuration(durationMs)}</span>
          <Microphone size={12} weight="fill" className="opacity-50" />
        </div>
      </div>
    </div>
  );
}

interface MessageItemProps {
  id?: string;
  text: string;
  sent: boolean;
  time: string;
  status?: string;
  type?: "text" | "system";
  senderId?: string;
  showSenderName?: boolean;
  forwarded?: boolean;
  edited?: boolean;
  mediaType?: "image" | "file" | "voice";
  mediaUrl?: string;
  mediaMeta?: MessageMediaMeta;
  selected?: boolean;
  selectionMode?: boolean;
  onToggleSelect?: () => void;
}

const MessageItem = ({
  id,
  text,
  sent,
  time,
  status,
  type,
  senderId,
  showSenderName,
  forwarded,
  edited,
  mediaType,
  mediaUrl,
  mediaMeta,
  selected,
  selectionMode,
  onToggleSelect,
}: MessageItemProps) => {
  const [showMenu, setShowMenu] = useState(false);

  if (type === "system") {
    return (
      <div id={id} className="flex justify-center my-4 px-6">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500 bg-zinc-900/60 px-4 py-1.5 rounded-full border border-zinc-800/40 text-center">
          {text}
        </span>
      </div>
    );
  }

  const isRead = status === "read";

  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className={clsx("flex px-4", sent ? "justify-end" : "justify-start")}
    >
      <div
        role={selectionMode && onToggleSelect ? "button" : undefined}
        tabIndex={selectionMode && onToggleSelect ? 0 : undefined}
        onClick={(e) => {
          if (selectionMode && onToggleSelect) {
            onToggleSelect();
          }
        }}
        onMouseLeave={() => setShowMenu(false)}
        className={clsx(
          "max-w-[85%] sm:max-w-[70%] py-2.5 rounded-2xl text-sm leading-relaxed relative group transition-all",
          onToggleSelect && !selectionMode ? "pl-4 pr-8" : "px-4",
          selectionMode && onToggleSelect && "cursor-pointer",
          selected && "ring-2 ring-emerald-400/70",
          selectionMode && !selected && "ring-1 ring-white/10",
          sent
            ? "bg-emerald-600 text-white rounded-br-sm shadow-lg shadow-emerald-900/20"
            : "bg-[#1a1d28] border border-white/[0.04] text-zinc-200 rounded-bl-sm"
        )}
      >
        {onToggleSelect && !selectionMode && (
          <div className="absolute top-1.5 right-1.5 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu((prev) => !prev);
              }}
              className="p-1 rounded-full bg-black/20 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/40"
            >
              <DotsThree size={16} weight="bold" />
            </button>
            {showMenu && (
              <div className="absolute top-full right-0 mt-1 bg-white dark:bg-[#252936] border border-zinc-200 dark:border-zinc-700/50 shadow-xl rounded-xl py-1 min-w-[120px] overflow-hidden">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onToggleSelect();
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                >
                  Select
                </button>
              </div>
            )}
          </div>
        )}
        {selected && (
          <span className={clsx("absolute -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg", sent ? "-left-2" : "-right-2")}>
            <CheckCircle size={14} weight="fill" />
          </span>
        )}
        {showSenderName && senderId && (
          <p className="text-[10px] font-bold text-emerald-400 mb-1 truncate">
            {senderId}
          </p>
        )}
        {forwarded && (
          <p className="mb-1 text-[10px] font-semibold italic opacity-60">Forwarded</p>
        )}
        {mediaType === "image" && mediaUrl ? (
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary URLs, arbitrary remote hosts not worth wiring into next/image config */}
            <img src={mediaUrl} alt="attachment" className={clsx("rounded-xl max-w-[240px] max-h-[240px] object-cover hover:opacity-90 transition-opacity", text && "mb-1.5")} />
          </a>
        ) : mediaType === "file" && mediaUrl ? (
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 min-w-[160px] hover:opacity-90">
            <FileText size={24} weight="fill" className="flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{mediaMeta?.fileName ?? "File"}</p>
              <p className="text-[10px] opacity-70">{formatBytes(mediaMeta?.sizeBytes ?? 0)}</p>
            </div>
            <DownloadSimple size={16} className="flex-shrink-0" />
          </a>
        ) : mediaType === "voice" && mediaUrl ? (
          <VoiceMessagePlayer url={mediaUrl} durationMs={mediaMeta?.durationMs} />
        ) : null}
        {text && <p className="whitespace-pre-wrap break-words">{text}</p>}
        <div className="flex items-center justify-end gap-1.5 mt-1">
          {edited && <span className="text-[10px] font-medium opacity-45">Edited</span>}
          <span className="text-[10px] font-medium opacity-50">{time}</span>
          {sent && (
            <div className={clsx("flex items-center", isRead ? "text-[#3dfc82] drop-shadow-[0_0_2px_rgba(61,252,130,0.4)]" : "text-white/40")}>
              {status === "sent" ? (
                <Check size={12} weight="bold" />
              ) : (
                <Checks size={15} weight="bold" />
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default MessageItem;
