"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  PaperPlaneTilt,
  Smiley,
  ShieldCheck,
  Info,
  ArrowLeft,
  Trash,
  X,
  ArrowBendUpRight,
  PencilSimple,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Microphone,
  Stop,
  TagSimple,
} from "@phosphor-icons/react";
import { useChatsQuery, useGroupsQuery, useLiveChatDoc, useTrackedItemCounts } from "@/lib/firebase-hooks";
import { uploadChatMediaFile, type ChatMediaType } from "@/lib/media";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  increment,
  writeBatch,
  getDocs,
  arrayUnion,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS, messagesRef, type MessageDoc, type FirestoreUser } from "@/lib/firestore";
import { getPresenceDotColor } from "@/lib/presence";
import { useAuth } from "@/context/AuthContext";
import type { SelectedConversation } from "./ChatList";
import MessageItem from "./MessageItem";
import SystemLog from "./SystemLog";
import { MessageSkeleton } from "@/components/ui/Skeleton";
import { formatDistanceToNow } from "date-fns";
import GroupSettingsModal from "./GroupSettingsModal";
import UserProfileModal from "./UserProfileModal";
import MessageTagModal from "./MessageTagModal";
import DigestBanner from "./DigestBanner";

const spring = { type: "spring", stiffness: 300, damping: 25 } as const;
const EDIT_WINDOW_MS = 3 * 60 * 1000;
const QUICK_EMOJIS = ["😀", "😂", "😍", "😊", "🔥", "👍", "❤️", "🙏", "🎉", "😎", "🥲", "😅", "💯", "✅", "🤝", "✨"];

interface ChatWindowProps {
  conversation: SelectedConversation;
  /** Mobile: go back to chat list */
  onBack?: () => void;
}

const ChatWindow = ({ conversation, onBack }: ChatWindowProps) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Array<MessageDoc & { id: string }>>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwarding, setForwarding] = useState(false);
  const [editingMessage, setEditingMessage] = useState<(MessageDoc & { id: string }) | null>(null);
  const [editText, setEditText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ file: File; type: "image" | "file" } | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const { data: forwardChats = [] } = useChatsQuery(user?.uid);
  const { data: forwardGroups = [] } = useGroupsQuery(user?.uid);

  const isDM = conversation.type === "dm";
  const parentId = isDM ? conversation.chatId : conversation.groupId;
  const parentCollection: "chats" | "groups" = isDM ? "chats" : "groups";
  const visibleMessages = messages.filter((msg) => !user?.uid || !msg.deletedFor?.includes(user.uid));
  const selectedMessages = visibleMessages.filter((msg) => selectedMessageIds.includes(msg.id) && msg.type === "text");
  const selectionMode = selectedMessageIds.length > 0;
  const canDeleteSelectedForEveryone =
    selectedMessages.length > 0 && selectedMessages.every((msg) => msg.senderId === user?.uid);
  const selectedEditableMessage = selectedMessages.length === 1 ? selectedMessages[0] : null;
  const selectedEditableDate =
    selectedEditableMessage?.timestamp && (selectedEditableMessage.timestamp as { toDate?: () => Date }).toDate
      ? (selectedEditableMessage.timestamp as { toDate: () => Date }).toDate()
      : null;
  const canEditSelectedMessage =
    !!selectedEditableMessage &&
    selectedEditableMessage.senderId === user?.uid &&
    !!selectedEditableDate &&
    Date.now() - selectedEditableDate.getTime() <= EDIT_WINDOW_MS;

  // ─── Live document subscription via TanStack Query ────────────────────────
  // This gives us real-time status updates so the accept/decline card disappears
  // immediately after action — no page refresh needed.
  const { data: liveDoc } = useLiveChatDoc(parentCollection, parentId);
  const { openQuestionsCount, pendingTasksCount, pendingDecisionsCount } = useTrackedItemCounts(parentCollection, parentId);

  // Snapshot the "while you were away" digest numbers exactly once per open,
  // before the mark-as-read effect below zeroes unreadCount for this device.
  const [unreadOnOpen, setUnreadOnOpen] = useState<number | null>(null);
  const [digestDismissed, setDigestDismissed] = useState(false);
  useEffect(() => {
    setUnreadOnOpen(null);
    setDigestDismissed(false);
  }, [parentId]);
  useEffect(() => {
    if (!liveDoc || !user) return;
    setUnreadOnOpen((prev) => (prev !== null ? prev : ((liveDoc as any)?.unreadCount?.[user.uid] ?? 0)));
  }, [liveDoc, user]);

  // ─── Real-time User Presence Hook ──────────────────────────────────────────
  const otherUid = isDM ? (conversation as any).participants?.find((p: string) => p !== user?.uid) : null;
  const [liveProfile, setLiveProfile] = useState<FirestoreUser | null>(null);

  useEffect(() => {
    if (!otherUid) return;
    const unsub = onSnapshot(doc(db, COLLECTIONS.USERS, otherUid), 
      (snap) => {
        if (snap.exists()) setLiveProfile(snap.data() as FirestoreUser);
      },
      (err) => {
        console.warn(`Could not listen to user ${otherUid} profile:`, err);
      }
    );
    return unsub;
  }, [otherUid]);

  // Blocking logic
  const myBlockedUsers = profile?.blockedUsers || [];
  const theirBlockedUsers = liveProfile?.blockedUsers || [];
  const isBlocked = isDM && (myBlockedUsers.includes(otherUid!) || theirBlockedUsers.includes(user!.uid));

  // ─── Use liveDoc status if available (real-time), else fall back to prop ──
  const liveStatus = isDM
    ? (liveDoc as any)?.status ?? conversation.status
    : null;
  const liveMembers = !isDM
    ? (liveDoc as any)?.members ?? (conversation as any).members
    : null;

  const isRejected = isDM && liveStatus === "rejected";
  const headerDotColor = isDM
    ? getPresenceDotColor({ status: liveStatus ?? "active", isBlocked, isOnline: liveProfile?.status === "online" })
    : null;

  // Pending logic — derived from live data
  const groupMember = !isDM ? liveMembers?.find((m: any) => m.uid === user?.uid) : null;
  const isPending = isDM
    ? liveStatus === "pending"
    : groupMember?.status === "pending";

  const isRequester = isDM && conversation.requestedBy === user?.uid;
  // Requesters can send exactly one message during pending state; Recipients are locked until Accepted.
  const isLocked = (isPending && !isRequester) || (isPending && isRequester && visibleMessages.length >= 1) || isRejected || isBlocked;

  const displayName = isDM ? conversation.other.displayName : conversation.name;
  const photoURL = isDM ? conversation.other.photoURL : conversation.photoURL;

  useEffect(() => {
    setSelectedMessageIds([]);
    setShowForwardModal(false);
  }, [parentId]);

  // ─── Messages listener ────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    // Track active chat for suppressing foreground notifications
    sessionStorage.setItem("activeChatId", parentId);

    const msgRef = messagesRef(parentCollection, parentId);
    const q = query(msgRef, orderBy("timestamp", "asc"));
    const unsub: Unsubscribe = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as MessageDoc) })));
      setLoading(false);
    }, (error) => {
      console.warn("Error in messages listener:", error);
      setLoading(false);
    });

    return () => {
      unsub();
      sessionStorage.removeItem("activeChatId");
    };
  }, [parentCollection, parentId]);

  // ─── Typing Logic ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!input.trim() || !user || isLocked) {
      if (user) updateDoc(doc(db, parentCollection, parentId), { [`typing.${user.uid}`]: false });
      return;
    }

    updateDoc(doc(db, parentCollection, parentId), { [`typing.${user.uid}`]: true });
    
    const timeout = setTimeout(() => {
      updateDoc(doc(db, parentCollection, parentId), { [`typing.${user.uid}`]: false });
    }, 3000);

    return () => {
      clearTimeout(timeout);
      updateDoc(doc(db, parentCollection, parentId), { [`typing.${user.uid}`]: false });
    };
  }, [input, user, parentId, parentCollection, isLocked]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, parentCollection, parentId), (snap) => {
      const data = snap.data();
      if (data?.typing) {
        const typingIds = Object.keys(data.typing).filter(uid => data.typing[uid] && uid !== user?.uid);
        setTypingUsers(typingIds);
      }
    }, (error) => {
      console.warn("Error in typing listener:", error);
    });
    return unsub;
  }, [parentId, parentCollection, user?.uid]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages]);

  // ─── Mark as read ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !parentId || isPending) return;

    const markAsRead = async () => {
      try {
        const parentRef = doc(db, parentCollection, parentId);
        await updateDoc(parentRef, {
          [`lastRead.${user.uid}`]: serverTimestamp(),
          [`unreadCount.${user.uid}`]: 0,
        });
      } catch (err) {
        console.error("Mark as read error:", err);
      }
    };

    markAsRead();
  }, [user, parentId, parentCollection, messages, isPending]);

  const [memberProfiles, setMemberProfiles] = useState<Record<string, string>>({});

  // ─── Resolve Member Names ──────────────────────────────────────────────────
  useEffect(() => {
    if (isDM || !("members" in conversation)) return;

    const resolveNames = async () => {
      const names: Record<string, string> = {};
      for (const m of (conversation as any).members) {
        const snap = await getDoc(doc(db, COLLECTIONS.USERS, m.uid));
        if (snap.exists()) {
          names[m.uid] = snap.data().displayName;
        }
      }
      setMemberProfiles(names);
    };

    resolveNames();
  }, [conversation, isDM]);

  // Hook for live profile moved to top of file


  const otherLastRead = otherUid ? (conversation.lastRead?.[otherUid] as any) : null;

  // ─── Message Status Logic ──────────────────────────────────────────────────
  const getMessageStatus = (msg: MessageDoc) => {
    if (msg.senderId !== user?.uid || !otherLastRead || !msg.timestamp) return "sent";
    const msgTime = (msg.timestamp as any).toDate ? (msg.timestamp as any).toDate() : new Date();
    const readTime = otherLastRead.toDate ? otherLastRead.toDate() : new Date();
    return msgTime <= readTime ? "read" : "sent";
  };

  // ─── Accept connection request / Group invite ────────────────────────────────
  const handleAccept = async () => {
    if (isDM) {
      const batch = writeBatch(db);
      // ✅ Status update triggers useLiveChatDoc → liveStatus updates → isPending becomes false → card disappears
      batch.update(doc(db, COLLECTIONS.CHATS, conversation.chatId), {
        status: "active",
      });

      if (otherUid && user?.uid) {
        batch.update(doc(db, COLLECTIONS.USERS, user.uid), {
          acceptedContacts: arrayUnion(otherUid)
        });
      }

      await batch.commit();
    } else {
      // Update group member status
      const updatedMembers = conversation.members.map((m: any) =>
        m.uid === user?.uid ? { ...m, status: "accepted" } : m
      );
      await updateDoc(doc(db, COLLECTIONS.GROUPS, conversation.groupId), {
        members: updatedMembers,
      });
    }
  };

  const handleDeclineOrLeave = async () => {
    if (isDM) {
      const chatEmail = conversation.other.email;
      const myDisplayName = user?.displayName || "Someone";
      
      // Update status to rejected instead of deleting
      await updateDoc(doc(db, COLLECTIONS.CHATS, conversation.chatId), {
        status: "rejected",
      });

      // Notify User A that User B rejected
      if (isPending && !isRequester && user) {
        user.getIdToken().then((idToken) =>
          fetch("/api/notify/rejection", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ toEmail: chatEmail, fromName: myDisplayName }),
          })
        ).catch(err => console.error("Notify rejection error:", err));
      }
    } else {
      // Remove self from group
      const updatedMembers = (conversation as any).members.filter((m: any) => m.uid !== user?.uid);
      const updatedMemberIds = (conversation as any).members.filter((m: any) => m.uid !== user?.uid).map((m: any) => m.uid);
      await updateDoc(doc(db, COLLECTIONS.GROUPS, conversation.groupId), {
        members: updatedMembers,
        memberIds: updatedMemberIds,
      });
    }
  };

  const CONFIRM_CLEAR = async () => {
    if (!parentId || !user) return;
    setSending(true);
    try {
      const batch = writeBatch(db);

      const msgSnap = await getDocs(collection(db, parentCollection, parentId, "messages"));
      msgSnap.forEach((d) => {
        const msg = d.data() as MessageDoc;
        if (!msg.deletedFor?.includes(user.uid)) {
          batch.update(d.ref, { deletedFor: arrayUnion(user.uid) });
        }
      });

      await batch.commit();
    } finally {
      setSending(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!user || !otherUid) return;
    const isCurrentlyBlocked = myBlockedUsers.includes(otherUid);
    try {
      const newBlocked = isCurrentlyBlocked
        ? myBlockedUsers.filter((id: string) => id !== otherUid)
        : [...myBlockedUsers, otherUid];
      await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), { blockedUsers: newBlocked });
    } catch (err) {
      console.error("Block/Unblock error:", err);
    }
  };

  // ─── Context Menu Logic ────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.pageX, y: e.pageY });
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  // ─── Push notification fan-out ──────────────────────────────────────────────
  // Client-triggered (not a Cloud Functions Firestore trigger) — this app has
  // no Cloud Functions backend (see root README's "Server architecture"
  // section: staying on the Firebase Spark/free plan, which cannot run Cloud
  // Functions at all). Mobile calls this same /api/notify route for the same
  // reason — this is the one shared "server" both platforms use.
  const notifyMessageRecipients = async (body: string) => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` };
      if (isDM) {
        const otherId = conversation.participants.find((p: string) => p !== user.uid);
        if (!otherId) return;
        await fetch("/api/notify", {
          method: "POST",
          headers,
          body: JSON.stringify({
            recipientId: otherId,
            senderName: profile?.displayName || user.displayName || "Someone",
            senderPhotoUrl: profile?.photoURL || user.photoURL || "",
            body,
            chatId: parentId,
            collectionName: parentCollection,
          }),
        });
      } else {
        await Promise.all(
          (conversation as any).members
            .filter((m: any) => m.uid !== user.uid)
            .map((m: any) =>
              fetch("/api/notify", {
                method: "POST",
                headers,
                body: JSON.stringify({
                  recipientId: m.uid,
                  senderName: `${profile?.displayName || user.displayName || "Someone"} in ${displayName}`,
                  senderPhotoUrl: profile?.photoURL || user.photoURL || "",
                  body,
                  chatId: parentId,
                  collectionName: parentCollection,
                }),
              })
            )
        );
      }
    } catch (err) {
      console.error("Notify error:", err);
    }
  };

  // ─── Send message ─────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || !user || isLocked) return;
    const text = input.trim();
    setInput("");
    setShowEmojiPicker(false);
    setSending(true);
    try {
      const msgRef = messagesRef(parentCollection, parentId);
      await addDoc(msgRef, {
        text,
        senderId: user.uid,
        timestamp: serverTimestamp(),
        type: "text",
      } satisfies Omit<MessageDoc, "id">);

      // Update parent doc's last message and counters
      const parentRef = doc(db, parentCollection, parentId);
      const updateData: any = {
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
      };

      if (isDM) {
        const otherId = conversation.participants.find((p: string) => p !== user.uid);
        if (otherId) {
          updateData[`unreadCount.${otherId}`] = increment(1);
        }
      } else {
        (conversation as any).members.forEach((m: any) => {
          if (m.uid !== user.uid) {
            updateData[`unreadCount.${m.uid}`] = increment(1);
          }
        });
      }

      await updateDoc(parentRef, updateData);

      notifyMessageRecipients(text).catch((err) => console.error("Notify error:", err));

      // If it's the first message in a pending DM, notify the recipient via email route
      if (isDM && isPending && visibleMessages.length === 0) {
        user.getIdToken().then((idToken) =>
          fetch("/api/notify/request", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ toEmail: conversation.other.email, fromName: user.displayName }),
          })
        ).catch(err => console.error("Notify request error:", err));
      }
    } finally {
      setSending(false);
    }
  };

  // ─── Send a media message (image/file/voice) ───────────────────────────────
  const sendMediaMessage = async (file: File, mediaType: ChatMediaType, durationMs?: number, caption?: string) => {
    if (!user || isLocked) return;
    setShowAttachMenu(false);
    setUploading(true);
    try {
      const uploaded = await uploadChatMediaFile(file, mediaType, parentId, !isDM, durationMs);
      const msgRef = messagesRef(parentCollection, parentId);
      await addDoc(msgRef, {
        text: caption ?? "",
        senderId: user.uid,
        timestamp: serverTimestamp(),
        type: "text",
        mediaType: uploaded.mediaType,
        mediaUrl: uploaded.mediaUrl,
        mediaMeta: uploaded.mediaMeta,
      } satisfies Omit<MessageDoc, "id">);

      const preview =
        mediaType === "image" ? "📷 Photo" : mediaType === "voice" ? "🎤 Voice message" : `📎 ${uploaded.mediaMeta.fileName ?? "File"}`;
      const parentRef = doc(db, parentCollection, parentId);
      const updateData: any = { lastMessage: preview, lastMessageAt: serverTimestamp() };
      if (isDM) {
        const otherId = conversation.participants.find((p: string) => p !== user.uid);
        if (otherId) updateData[`unreadCount.${otherId}`] = increment(1);
      } else {
        (conversation as any).members.forEach((m: any) => {
          if (m.uid !== user.uid) updateData[`unreadCount.${m.uid}`] = increment(1);
        });
      }
      await updateDoc(parentRef, updateData);
      notifyMessageRecipients(preview).catch((err) => console.error("Notify error:", err));
    } catch (error) {
      console.error("Media send error:", error);
      alert(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handlePickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setPendingMedia({ file, type: "image" });
  };

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setPendingMedia({ file, type: "file" });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "file") {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          const type = file.type.startsWith("image/") ? "image" : "file";
          setPendingMedia({ file, type });
          break;
        }
      }
    }
  };

  const handleStartRecording = async () => {
    setShowAttachMenu(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordMs(0);
      recordTimerRef.current = setInterval(() => setRecordMs((ms) => ms + 1000), 1000);
    } catch (error) {
      console.error("Could not start recording:", error);
      alert("Microphone unavailable — check browser permissions.");
    }
  };

  const stopRecordingStream = () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    setRecording(false);
  };

  const handleStopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    const durationMs = recordMs;
    recorder.onstop = () => {
      const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      const file = new File([blob], `voice-note.${blob.type.includes("mp4") ? "m4a" : "webm"}`, { type: blob.type });
      sendMediaMessage(file, "voice", durationMs);
    };
    recorder.stop();
    stopRecordingStream();
  };

  const handleCancelRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder) recorder.onstop = null;
    recorder?.stop();
    stopRecordingStream();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingMedia) {
      await sendMediaMessage(pendingMedia.file, pendingMedia.type, undefined, input.trim());
      setPendingMedia(null);
      setInput("");
      return;
    }
    await sendMessage();
  };

  const handleComposerKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;
    if (e.altKey) return;

    e.preventDefault();
    if (pendingMedia) {
      await sendMediaMessage(pendingMedia.file, pendingMedia.type, undefined, input.trim());
      setPendingMedia(null);
      setInput("");
      return;
    }
    await sendMessage();
  };

  const insertEmoji = (emoji: string) => {
    const textarea = inputRef.current;
    if (!textarea) {
      setInput((current) => `${current}${emoji}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = `${input.slice(0, start)}${emoji}${input.slice(end)}`;
    setInput(next);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessageIds((current) =>
      current.includes(messageId)
        ? current.filter((id) => id !== messageId)
        : [...current, messageId]
    );
  };

  const clearSelection = () => {
    setSelectedMessageIds([]);
    setShowForwardModal(false);
  };

  const deleteSelectedForMe = async () => {
    if (!user || selectedMessages.length === 0) return;

    setSending(true);
    try {
      const batch = writeBatch(db);
      selectedMessages.forEach((msg) => {
        batch.update(doc(db, parentCollection, parentId, "messages", msg.id), {
          deletedFor: arrayUnion(user.uid),
        });
      });
      await batch.commit();
      clearSelection();
    } finally {
      setSending(false);
    }
  };

  const deleteSelectedForEveryone = async () => {
    if (!canDeleteSelectedForEveryone) return;

    const confirmed = window.confirm("Delete selected messages for everyone? They will be removed from all chats permanently.");
    if (!confirmed) return;

    setSending(true);
    try {
      const batch = writeBatch(db);
      selectedMessages.forEach((msg) => {
        batch.delete(doc(db, parentCollection, parentId, "messages", msg.id));
      });
      const remainingMessages = visibleMessages.filter((msg) => !selectedMessageIds.includes(msg.id) && msg.type === "text");
      const lastRemainingMessage = remainingMessages[remainingMessages.length - 1];
      batch.update(doc(db, parentCollection, parentId), {
        lastMessage: lastRemainingMessage?.text ?? "",
        lastMessageAt: lastRemainingMessage?.timestamp ?? serverTimestamp(),
      });
      await batch.commit();
      clearSelection();
    } finally {
      setSending(false);
    }
  };

  const startEditingSelectedMessage = () => {
    if (!canEditSelectedMessage || !selectedEditableMessage) return;
    setEditingMessage(selectedEditableMessage);
    setEditText(selectedEditableMessage.text);
  };

  const saveEditedMessage = async () => {
    if (!user || !editingMessage) return;

    const nextText = editText.trim();
    if (!nextText || nextText === editingMessage.text) {
      setEditingMessage(null);
      setEditText("");
      clearSelection();
      return;
    }

    const sentAt =
      editingMessage.timestamp && (editingMessage.timestamp as { toDate?: () => Date }).toDate
        ? (editingMessage.timestamp as { toDate: () => Date }).toDate()
        : null;

    if (editingMessage.senderId !== user.uid || !sentAt || Date.now() - sentAt.getTime() > EDIT_WINDOW_MS) {
      window.alert("This message can only be edited within 3 minutes after sending.");
      setEditingMessage(null);
      setEditText("");
      clearSelection();
      return;
    }

    setSending(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, parentCollection, parentId, "messages", editingMessage.id), {
        text: nextText,
        edited: true,
        editedAt: serverTimestamp(),
      });

      const lastVisibleTextMessage = visibleMessages.filter((msg) => msg.type === "text").at(-1);
      if (lastVisibleTextMessage?.id === editingMessage.id) {
        batch.update(doc(db, parentCollection, parentId), {
          lastMessage: nextText,
        });
      }

      await batch.commit();
      setEditingMessage(null);
      setEditText("");
      clearSelection();
    } finally {
      setSending(false);
    }
  };

  const getForwardTargetLabel = (target: SelectedConversation) =>
    target.type === "dm" ? target.other.displayName : target.name;

  const forwardSelectedMessages = async (target: SelectedConversation) => {
    if (!user || selectedMessages.length === 0) return;

    setForwarding(true);
    try {
      const targetCollection: "chats" | "groups" = target.type === "dm" ? "chats" : "groups";
      const targetId = target.type === "dm" ? target.chatId : target.groupId;
      const targetMessageRef = messagesRef(targetCollection, targetId);

      for (const msg of selectedMessages) {
        await addDoc(targetMessageRef, {
          text: msg.text,
          senderId: user.uid,
          timestamp: serverTimestamp(),
          type: "text",
          forwarded: true,
        } satisfies Omit<MessageDoc, "id">);
      }

      const lastForwarded = selectedMessages[selectedMessages.length - 1]?.text ?? "Forwarded message";
      const updateData: Record<string, unknown> = {
        lastMessage: lastForwarded,
        lastMessageAt: serverTimestamp(),
      };

      if (target.type === "dm") {
        const otherId = target.participants.find((p) => p !== user.uid);
        if (otherId) updateData[`unreadCount.${otherId}`] = increment(selectedMessages.length);
      } else {
        target.members.forEach((member) => {
          if (member.uid !== user.uid) {
            updateData[`unreadCount.${member.uid}`] = increment(selectedMessages.length);
          }
        });
      }

      await updateDoc(doc(db, targetCollection, targetId), updateData);
      clearSelection();
    } finally {
      setForwarding(false);
    }
  };

  const assignees: Array<{ uid: string; name: string }> = isDM
    ? [
        { uid: user?.uid ?? "", name: "You" },
        { uid: conversation.other.uid, name: conversation.other.displayName },
      ]
    : (conversation as any).members.map((m: { uid: string }) => ({
        uid: m.uid,
        name: m.uid === user?.uid ? "You" : memberProfiles[m.uid] ?? "Unknown",
      }));

  return (
    <div 
      onContextMenu={handleContextMenu}
      className="flex-1 flex flex-col relative bg-white dark:bg-[#11131a] min-w-0 w-full"
    >
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header className="h-[60px] border-b border-zinc-200 dark:border-zinc-800/40 bg-white/90 dark:bg-[#11131a]/90 backdrop-blur-md flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-10">
        <div className="flex items-center gap-2 md:gap-3">
          {/* Mobile back button */}
          {onBack && (
            <motion.button
              onClick={onBack}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              className="md:hidden p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg transition-colors -ml-1"
            >
              <ArrowLeft size={20} weight="bold" />
            </motion.button>
          )}
          <div className="relative">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700/30">
              {photoURL ? (
                <Image src={photoURL} alt={displayName} fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-emerald-500/10 text-emerald-400 font-semibold text-sm">
                  {displayName[0]?.toUpperCase()}
                </div>
              )}
            </div>
            {headerDotColor && (
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#11131a] ${
                  headerDotColor === "green"
                    ? "bg-[#3dfc82] shadow-[0_0_8px_rgba(61,252,130,0.6)]"
                    : headerDotColor === "red"
                      ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                      : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                }`}
              />
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{displayName}</h2>
            <p className="text-[10px] font-medium tracking-wider uppercase">
              {isDM ? (
                liveProfile?.status === "online" 
                  ? <span className="text-[#3dfc82] drop-shadow-[0_0_2px_rgba(61,252,130,0.4)]">Online</span> 
                  : <span className="text-zinc-500">
                      {liveProfile?.lastSeen 
                        ? `Last seen ${formatDistanceToNow((liveProfile.lastSeen as { toDate: () => Date }).toDate(), { addSuffix: true })}` 
                        : "Offline"}
                    </span>
              ) : (
                <span className="text-zinc-500">
                  {typingUsers.length > 0 
                    ? <span className="text-emerald-400 italic lowercase tracking-normal">some people are typing...</span>
                    : `${conversation.members?.length} members`}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {(openQuestionsCount > 0 || pendingTasksCount > 0) && (
            <div className="hidden sm:flex items-center gap-1.5">
              {openQuestionsCount > 0 && (
                <span className="text-[10px] font-medium text-zinc-500 bg-zinc-200/60 dark:bg-zinc-800/60 px-2 py-1 rounded-full">
                  ❓ {openQuestionsCount}
                </span>
              )}
              {pendingTasksCount > 0 && (
                <span className="text-[10px] font-medium text-zinc-500 bg-zinc-200/60 dark:bg-zinc-800/60 px-2 py-1 rounded-full">
                  📋 {pendingTasksCount}
                </span>
              )}
            </div>
          )}
          {!isDM && (
            <motion.button
              onClick={() => setShowGroupSettings(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all uppercase tracking-wider"
            >
              Group Info
            </motion.button>
          )}
          {isDM && liveProfile && (
            <motion.button
              onClick={() => setShowUserInfo(true)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              className="p-2 text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 rounded-xl transition-colors"
              title="User Info"
            >
              <Info size={18} />
            </motion.button>
          )}
        </div>
      </header>

      {unreadOnOpen !== null && unreadOnOpen >= 3 && !digestDismissed && (
        <DigestBanner
          unreadCount={unreadOnOpen}
          openQuestionsCount={openQuestionsCount}
          pendingTasksCount={pendingTasksCount}
          pendingDecisionsCount={pendingDecisionsCount}
          onDismiss={() => setDigestDismissed(true)}
        />
      )}

      {/* ─── Messages Feed ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-2 bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-[#11131a] dark:to-[#0e1015]">
        {loading ? (
          <div className="space-y-4">
            <MessageSkeleton />
            <MessageSkeleton sent />
            <MessageSkeleton />
          </div>
        ) : (
          <>
            {/* Inbound connection request banner */}
        <AnimatePresence>
          {isPending && !isRequester && (
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={spring}
              className="mx-auto max-w-sm bg-white/90 dark:bg-[#14161f]/90 backdrop-blur-xl border border-zinc-200 dark:border-white/[0.06] p-5 rounded-2xl text-center mb-4 shadow-sm"
            >
              <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <ShieldCheck size={24} className="text-emerald-500" weight="fill" />
              </div>
              <h3 className="text-sm font-semibold tracking-tight mb-1 text-zinc-900 dark:text-zinc-100">
                {isDM ? "Connection Request" : "Group Invitation"}
              </h3>
              <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                {isDM ? (
                  <>
                    <span className="text-zinc-300">{conversation.other.displayName}</span> wants to start a conversation with you.
                  </>
                ) : (
                  <>
                    You've been invited to join <span className="text-zinc-300">{conversation.name}</span>.
                  </>
                )}
              </p>
              <div className="flex gap-2">
                <motion.button
                  onClick={handleAccept}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  transition={spring}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-emerald-500/10"
                >
                  Accept
                </motion.button>
                  <motion.button
                  onClick={handleDeclineOrLeave}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  transition={spring}
                  className="flex-1 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  {isDM ? "Decline" : "Leave"}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* System log — conversation start */}
        {visibleMessages.length === 0 && !isPending && (
          <SystemLog text="Conversation started" />
        )}

        {/* Messages */}
        {visibleMessages.map((msg) => (
          <MessageItem
            key={msg.id}
            text={msg.text}
            sent={msg.senderId === user?.uid}
            senderId={!isDM && msg.senderId !== user?.uid ? memberProfiles[msg.senderId] || "Member" : undefined}
            showSenderName={!isDM && msg.senderId !== user?.uid}
            time={msg.timestamp ? new Date((msg.timestamp as { toDate: () => Date }).toDate()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
            type={msg.type}
            status={getMessageStatus(msg)}
            forwarded={msg.forwarded}
            edited={msg.edited}
            mediaType={msg.mediaType}
            mediaUrl={msg.mediaUrl}
            mediaMeta={msg.mediaMeta}
            selected={selectedMessageIds.includes(msg.id)}
            selectionMode={selectionMode}
            onToggleSelect={msg.type !== "system" ? () => toggleMessageSelection(msg.id) : undefined}
          />
        ))}
        <div ref={bottomRef} />
        
        {/* Typing indicator toast-like bubble */}
        <AnimatePresence>
          {isDM && typingUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-24 left-6 py-1.5 px-3 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200 dark:border-white/[0.04] rounded-full shadow-sm"
            >
              <p className="text-[10px] items-center flex gap-1.5 text-emerald-400/80 font-medium italic">
                <span className="flex gap-0.5">
                  <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1 }}>.</motion.span>
                  <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}>.</motion.span>
                  <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}>.</motion.span>
                </span>
                {displayName} is typing
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    )}
  </div>

      {/* ─── Input Bar ──────────────────────────────────────────────────── */}
      <div className="px-5 py-4 bg-zinc-50 dark:bg-[#0e1015] flex-shrink-0">
        {isBlocked ? (
          <div className="text-center py-3 text-xs text-red-400 font-medium bg-red-500/10 border border-red-500/20 rounded-xl">
            You cannot reply to this conversation.
          </div>
        ) : isRejected ? (
          <div className="text-center py-3 text-xs text-zinc-500 font-medium bg-zinc-200/50 dark:bg-zinc-800/40 border border-zinc-300/50 dark:border-zinc-700/40 rounded-xl">
            Connection request was rejected.
          </div>
        ) : selectionMode ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-300 bg-white px-3 py-2 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40">
            <button
              type="button"
              onClick={clearSelection}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100"
              aria-label="Cancel selection"
            >
              <X size={18} weight="bold" />
            </button>
            <span className="mr-auto text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              {selectedMessageIds.length} selected
            </span>
            {canEditSelectedMessage && (
              <button
                type="button"
                onClick={startEditingSelectedMessage}
                disabled={sending}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-700 transition-colors hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                <PencilSimple size={15} weight="bold" />
                Edit
              </button>
            )}
            {selectedEditableMessage && (
              <button
                type="button"
                onClick={() => setShowTagModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                <TagSimple size={15} weight="bold" />
                Mark as…
              </button>
            )}
            <button
              type="button"
              onClick={deleteSelectedForMe}
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-700 transition-colors hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <Trash size={15} weight="bold" />
              Delete for me
            </button>
            {canDeleteSelectedForEveryone && (
              <button
                type="button"
                onClick={deleteSelectedForEveryone}
                disabled={sending}
                className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-bold text-red-500 transition-colors hover:bg-red-500/20 disabled:opacity-50"
              >
                <Trash size={15} weight="bold" />
                Delete for everyone
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowForwardModal(true)}
              disabled={forwarding}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              <ArrowBendUpRight size={15} weight="bold" />
              Forward
            </button>
          </div>
        ) : recording ? (
          <div className="flex items-center gap-3 bg-white dark:bg-zinc-900/40 border border-zinc-300 dark:border-zinc-800/80 rounded-2xl px-4 py-3">
            <button type="button" onClick={handleCancelRecording} className="text-zinc-500 hover:text-red-500 transition-colors">
              <X size={18} />
            </button>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">
              Recording… {Math.floor(recordMs / 60000)}:{String(Math.floor((recordMs % 60000) / 1000)).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={handleStopRecording}
              className="w-9 h-9 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center justify-center transition-colors"
            >
              <Stop size={16} weight="fill" />
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSend}
            className={`relative flex items-end gap-2 bg-white dark:bg-zinc-900/40 border border-zinc-300 dark:border-zinc-800/80 rounded-2xl px-3 py-2 transition-all duration-300 focus-within:border-emerald-500/50 dark:focus-within:border-zinc-700/80 focus-within:bg-white dark:focus-within:bg-zinc-900/70 shadow-sm dark:shadow-none ${
              isLocked && !(!isRequester) ? "opacity-40 pointer-events-none blur-[1px]" : ""
            }`}
          >
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handlePickImage} />
            <input ref={fileInputRef} type="file" className="hidden" onChange={handlePickFile} />

            <AnimatePresence>
              {showAttachMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={spring}
                  className="absolute bottom-full left-2 mb-3 grid grid-cols-3 gap-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-2xl dark:border-white/[0.08] dark:bg-[#1a1d28] min-w-[240px]"
                >
                  <button
                    type="button"
                    onClick={() => { setShowAttachMenu(false); imageInputRef.current?.click(); }}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors text-emerald-500"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                      <ImageIcon size={20} weight="fill" />
                    </div>
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click(); }}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors text-blue-500"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                      <FileText size={20} weight="fill" />
                    </div>
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Document</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAttachMenu(false); handleStartRecording(); }}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors text-orange-500"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10">
                      <Microphone size={20} weight="fill" />
                    </div>
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Audio</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="button"
              onClick={() => setShowAttachMenu((current) => !current)}
              disabled={uploading}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={spring}
              className="mb-1 p-2 text-zinc-500 hover:text-emerald-400 transition-colors disabled:opacity-40"
              title="Attach"
            >
              {uploading ? (
                <span className="block w-5 h-5 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
              ) : (
                <Paperclip size={20} />
              )}
            </motion.button>

            {pendingMedia && (
              <div className="absolute bottom-full left-0 mb-3 ml-2 p-2 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xl flex items-center gap-3 animate-in fade-in zoom-in duration-200">
                <div className="w-10 h-10 relative rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center flex-shrink-0">
                  {pendingMedia.type === "image" ? (
                    <img src={URL.createObjectURL(pendingMedia.file)} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <FileText size={20} className="text-zinc-500" />
                  )}
                </div>
                <div className="flex flex-col flex-1 min-w-[120px] max-w-[180px]">
                  <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{pendingMedia.file.name}</span>
                  <span className="text-[10px] text-zinc-500">{(pendingMedia.file.size / 1024).toFixed(0)} KB</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingMedia(null)}
                  className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors flex-shrink-0"
                >
                  <X size={14} weight="bold" />
                </button>
              </div>
            )}

            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={spring}
                  className="absolute bottom-full left-2 mb-3 grid grid-cols-8 gap-1 rounded-2xl border border-zinc-200 bg-white p-2 shadow-2xl dark:border-white/[0.08] dark:bg-[#1a1d28]"
                >
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-lg transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.06]"
                    >
                      {emoji}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="button"
              onClick={() => setShowEmojiPicker((current) => !current)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={spring}
              className="mb-1 p-2 text-zinc-500 hover:text-emerald-400 transition-colors"
              title="Emoji"
            >
              <Smiley size={20} />
            </motion.button>


            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              onPaste={handlePaste}
              disabled={isLocked}
              placeholder={isLocked ? (isRequester ? "Waiting for acceptance..." : "Accept to reply...") : "Type a message..."}
              rows={1}
              className="max-h-32 min-h-10 flex-1 resize-none bg-transparent py-2.5 text-sm leading-5 text-zinc-900 outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed dark:text-zinc-200 dark:placeholder:text-zinc-600"
            />

            {input.trim() || pendingMedia ? (
              <motion.button
                type="submit"
                disabled={isLocked || sending}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={spring}
                className="w-9 h-9 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/10 disabled:opacity-40 disabled:pointer-events-none transition-colors flex-shrink-0 cursor-pointer"
              >
                <PaperPlaneTilt size={16} weight="fill" />
              </motion.button>
            ) : (
              <motion.button
                type="button"
                onClick={handleStartRecording}
                disabled={isLocked || sending}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={spring}
                className="w-9 h-9 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/10 disabled:opacity-40 disabled:pointer-events-none transition-colors flex-shrink-0 cursor-pointer"
              >
                <Microphone size={16} weight="fill" />
              </motion.button>
            )}
          </form>
        )}
      </div>

      {/* Context Menu Overlay */}
      {contextMenu && (
        <div 
          className="fixed z-[100] bg-white dark:bg-[#1a1d28] border border-zinc-200 dark:border-white/[0.08] rounded-xl shadow-2xl py-1.5 min-w-[160px] backdrop-blur-xl animate-in fade-in zoom-in duration-200"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button 
            onClick={() => (window as any).dispatchEvent(new CustomEvent("close-chat"))}
            className="w-full text-left px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:text-zinc-900 dark:hover:text-white transition-colors flex items-center justify-between"
          >
            Close Chat
            <span className="text-[10px] opacity-40">Esc</span>
          </button>
          <div className="h-px bg-zinc-200 dark:bg-white/[0.04] my-1" />
          
          {isDM && (
            <>
              <button 
                onClick={() => { handleToggleBlock(); setContextMenu(null); }}
                className="w-full text-left px-4 py-2 text-xs font-medium text-orange-500 hover:bg-orange-500/10 transition-colors"
              >
                {myBlockedUsers.includes(otherUid!) ? "Unblock User" : "Block User"}
              </button>
              <div className="h-px bg-zinc-200 dark:bg-white/[0.04] my-1" />
            </>
          )}

          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full text-left px-4 py-2 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors"
          >
            Clear Conversation
          </button>
        </div>
      )}

      {/* Edit Message Modal */}
      <AnimatePresence>
        {editingMessage && (
          <div className="fixed inset-0 z-[195] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setEditingMessage(null);
                setEditText("");
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.form
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onSubmit={(e) => {
                e.preventDefault();
                saveEditedMessage();
              }}
              className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1a1d28]"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-white/[0.06]">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Edit message</h3>
                  <p className="text-xs text-zinc-500">Available for 3 minutes after sending</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingMessage(null);
                    setEditText("");
                  }}
                  className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100"
                  aria-label="Close edit modal"
                >
                  <X size={18} weight="bold" />
                </button>
              </div>

              <div className="p-4">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  autoFocus
                  rows={4}
                  className="min-h-28 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none transition-colors focus:border-emerald-500/60 dark:border-white/[0.08] dark:bg-zinc-900/60 dark:text-zinc-100"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4 dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => {
                    setEditingMessage(null);
                    setEditText("");
                  }}
                  className="rounded-xl bg-zinc-100 px-4 py-2 text-xs font-bold text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editText.trim() || sending}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Forward Messages Modal */}
      <AnimatePresence>
        {showForwardModal && (
          <div className="fixed inset-0 z-[190] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForwardModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1a1d28]"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-white/[0.06]">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Forward messages</h3>
                  <p className="text-xs text-zinc-500">{selectedMessageIds.length} selected</p>
                </div>
                <button
                  onClick={() => setShowForwardModal(false)}
                  className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100"
                  aria-label="Close forward modal"
                >
                  <X size={18} weight="bold" />
                </button>
              </div>

              <div className="max-h-[360px] overflow-y-auto p-3">
                {[...forwardChats, ...forwardGroups].length === 0 ? (
                  <p className="px-3 py-8 text-center text-xs text-zinc-500">No chats available to forward to.</p>
                ) : (
                  <div className="space-y-1">
                    {[...forwardChats, ...forwardGroups].map((target) => (
                      <button
                        key={target.type === "dm" ? `dm-${target.chatId}` : `group-${target.groupId}`}
                        type="button"
                        onClick={() => forwardSelectedMessages(target)}
                        disabled={forwarding}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-zinc-100 disabled:opacity-60 dark:hover:bg-white/[0.06]"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-500/10 text-sm font-bold text-emerald-500">
                          {target.type === "dm"
                            ? target.other.displayName[0]?.toUpperCase()
                            : target.name[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {getForwardTargetLabel(target)}
                          </p>
                          <p className="truncate text-xs text-zinc-500">
                            {target.type === "dm" ? target.other.email : "Group chat"}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-xs bg-white dark:bg-[#1a1d28] border border-zinc-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-2xl"
            >
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Clear Chat?</h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                This will clear this conversation only for you. Other people will still keep their messages.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={CONFIRM_CLEAR}
                  disabled={sending}
                  className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 dark:text-red-400 text-xs font-bold rounded-xl transition-all border border-red-500/20 disabled:opacity-50"
                >
                  {sending ? "Clearing..." : "Clear for me"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Group Settings Modal */}
      {showGroupSettings && !isDM && (
        <GroupSettingsModal
          group={conversation as any}
          onClose={() => setShowGroupSettings(false)}
        />
      )}

      {/* User Info Modal */}
      {showUserInfo && isDM && liveProfile && (
        <UserProfileModal
          profile={liveProfile}
          onClose={() => setShowUserInfo(false)}
          chatId={parentId}
          myUid={user?.uid}
        />
      )}

      <MessageTagModal
        open={showTagModal}
        onClose={() => { setShowTagModal(false); clearSelection(); }}
        message={selectedEditableMessage ? { id: selectedEditableMessage.id, text: selectedEditableMessage.text } : null}
        parentCollection={parentCollection}
        parentId={parentId}
        myUid={user?.uid ?? ""}
        assignees={assignees}
      />
    </div>
  );
};

export default ChatWindow;
