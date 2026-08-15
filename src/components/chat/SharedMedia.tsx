"use client";

import React, { useEffect, useState } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FileText, Microphone, Image as ImageIcon } from "@phosphor-icons/react";
import type { MessageDoc } from "@/lib/firestore";

interface SharedMediaProps {
  parentCollection: "chats" | "groups";
  parentId: string;
}

export default function SharedMedia({ parentCollection, parentId }: SharedMediaProps) {
  const [media, setMedia] = useState<MessageDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMedia = async () => {
      try {
        const q = query(
          collection(db, parentCollection, parentId, "messages"),
          where("mediaType", "in", ["image", "file", "voice"]),
          orderBy("timestamp", "desc")
        );
        const snap = await getDocs(q);
        setMedia(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MessageDoc));
      } catch (err) {
        console.error("Failed to fetch shared media:", err);
      } finally {
        setLoading(false);
      }
    };
    if (parentId) {
      fetchMedia();
    }
  }, [parentCollection, parentId]);

  if (!parentId) return null;
  if (loading) return <p className="text-xs text-zinc-500">Loading shared media...</p>;
  if (media.length === 0) return <p className="text-xs text-zinc-500 italic">No shared media.</p>;

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
      {media.map((msg) => (
        <div key={msg.id} className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/40 relative group">
          {msg.mediaType === "image" && msg.mediaUrl ? (
            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer">
              <img src={msg.mediaUrl} alt="Shared" className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
            </a>
          ) : msg.mediaType === "file" ? (
            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center w-full h-full text-blue-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
              <FileText size={32} weight="fill" />
              <span className="text-[10px] font-medium mt-1 truncate w-full px-2 text-center text-zinc-600 dark:text-zinc-300">
                {msg.mediaMeta?.fileName || "File"}
              </span>
            </a>
          ) : msg.mediaType === "voice" ? (
            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center w-full h-full text-orange-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
              <Microphone size={32} weight="fill" />
              <span className="text-[10px] font-medium mt-1 text-zinc-600 dark:text-zinc-300">Voice Note</span>
            </a>
          ) : null}
        </div>
      ))}
    </div>
  );
}
