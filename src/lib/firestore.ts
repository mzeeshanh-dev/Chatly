/**
 * Firestore typed helpers — all DB access uses the centralized firebase.ts
 * singleton to avoid duplicate Firebase app initialization.
 */
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Collection names (single source of truth) ───────────────────────────────
export const COLLECTIONS = {
  USERS: "users",
  CHATS: "chats",
  GROUPS: "groups",
  OTP: "otps",
  FOLLOW_UPS: "followUps",
} as const;

// ─── Type definitions ─────────────────────────────────────────────────────────
export interface FirestoreUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  photoPublicId?: string | null;
  bio: string;
  phone: string;
  designation?: string;
  location: string;
  isActivated: boolean;
  isSuspended?: boolean;
  status: "online" | "offline";
  lastSeen: unknown; // Firestore Timestamp
  createdAt: unknown; // Firestore Timestamp
  fcmTokens?: string[];
  settings?: { theme: "dark" | "light"; notificationsEnabled: boolean };
  blockedUsers?: string[];
  acceptedContacts?: string[];
}

export interface ChatDoc {
  participants: [string, string];
  status: "pending" | "active" | "rejected";
  requestedBy: string;
  createdAt: unknown;
  lastMessage?: string;
  lastMessageAt?: unknown;
}

export interface GroupDoc {
  name: string;
  description: string;
  photoURL: string | null;
  photoPublicId?: string | null;
  adminId: string;
  members: Array<{ uid: string; status: "pending" | "accepted" }>;
  memberIds: string[];
  createdAt: unknown;
  lastMessage?: string;
  lastMessageAt?: unknown;
}

export interface MessageMediaMeta {
  fileName?: string;
  sizeBytes: number;
  mimeType: string;
  /** Voice notes only. */
  durationMs?: number;
  /** Cloudinary public id, needed to delete the asset later. */
  publicId: string;
}

export interface MessageDoc {
  text: string;
  senderId: string;
  timestamp: unknown;
  type: "text" | "system";
  deletedFor?: string[];
  forwarded?: boolean;
  edited?: boolean;
  editedAt?: unknown;
  /** Present when this message carries an attachment; `text` doubles as an optional caption for image/file. */
  mediaType?: "image" | "file" | "voice";
  mediaUrl?: string;
  mediaMeta?: MessageMediaMeta;
}

/** A message tagged as a Question — one per source message. */
export interface QuestionDoc {
  sourceMessageId: string;
  sourceText: string;
  askedBy: string;
  status: "open" | "answered";
  answerText?: string;
  answeredBy?: string;
  createdAt: unknown;
  answeredAt?: unknown;
}

/** A message tagged as a Decision. */
export interface DecisionDoc {
  sourceMessageId: string;
  sourceText: string;
  summary: string;
  decidedBy: string[];
  createdBy: string;
  createdAt: unknown;
}

/** A message turned into a Task. */
export interface TaskDoc {
  sourceMessageId: string;
  sourceText: string;
  title: string;
  assignedTo: string;
  createdBy: string;
  dueAt: unknown;
  status: "pending" | "done";
  createdAt: unknown;
  completedAt?: unknown;
}

/**
 * A personal reminder attached to a message — owned by the user who set it,
 * not shared with the rest of the conversation. Lives in a top-level
 * collection (not nested under the chat) so the scheduled Cloud Function that
 * delivers due reminders can run one flat query instead of a collectionGroup.
 * Identical shape to the mobile app's FollowUpDoc (mobile/src/lib/firestore.ts).
 */
export interface FollowUpDoc {
  uid: string;
  chatId: string;
  isGroup: boolean;
  messageId: string;
  sourceText: string;
  remindAt: unknown;
  status: "pending" | "sent" | "dismissed";
  createdAt: unknown;
}

// ─── User helpers ─────────────────────────────────────────────────────────────
export async function getUser(uid: string): Promise<FirestoreUser | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  return snap.exists() ? (snap.data() as FirestoreUser) : null;
}

export async function createUser(user: Omit<FirestoreUser, "createdAt">): Promise<void> {
  await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
    ...user,
    createdAt: serverTimestamp(),
  });
}

export async function updateUser(
  uid: string,
  data: Partial<Omit<FirestoreUser, "uid" | "email" | "createdAt">>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.USERS, uid), data);
}

export async function getActivatedUsers(): Promise<FirestoreUser[]> {
  const q = query(
    collection(db, COLLECTIONS.USERS),
    where("isActivated", "==", true)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as FirestoreUser);
}

// ─── Chat helpers ─────────────────────────────────────────────────────────────
/**
 * Deterministic chatId — same two UIDs always produce the same document ID.
 * Sorted lexically: sorted([uidA, uidB]).join("_")
 */
export function getDMChatId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join("_");
}

export function chatRef(chatId: string) {
  return doc(db, COLLECTIONS.CHATS, chatId);
}

export function groupRef(groupId: string) {
  return doc(db, COLLECTIONS.GROUPS, groupId);
}

export function messagesRef(
  parentCollection: "chats" | "groups",
  parentId: string
) {
  return collection(db, parentCollection, parentId, "messages");
}

export function questionsRef(parentCollection: "chats" | "groups", parentId: string) {
  return collection(db, parentCollection, parentId, "questions");
}

export function decisionsRef(parentCollection: "chats" | "groups", parentId: string) {
  return collection(db, parentCollection, parentId, "decisions");
}

export function tasksRef(parentCollection: "chats" | "groups", parentId: string) {
  return collection(db, parentCollection, parentId, "tasks");
}

/** Top-level — see FollowUpDoc for why this isn't nested under the chat. */
export function followUpsRef() {
  return collection(db, COLLECTIONS.FOLLOW_UPS);
}
