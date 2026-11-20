import type { NextRequest } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { ApiError } from "./http";

/** Verifies the `Authorization: Bearer <Firebase ID token>` header. */
export async function requireUser(request: NextRequest | Request): Promise<DecodedIdToken> {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new ApiError(401, "Sign in required.");
  try {
    return await adminAuth.verifyIdToken(token, true);
  } catch {
    throw new ApiError(401, "Invalid or expired session.");
  }
}

/** Returns the stored document of a DM chat or group, or throws 404. */
export async function getConversation(conversationId: string, isGroup: boolean) {
  const snap = await adminDb.collection(isGroup ? "groups" : "chats").doc(conversationId).get();
  if (!snap.exists) throw new ApiError(404, "Conversation not found.");
  return snap.data() ?? {};
}

export function membersOf(conversation: Record<string, unknown>, isGroup: boolean): string[] {
  const list = isGroup ? conversation.memberIds : conversation.participants;
  return Array.isArray(list) ? (list as string[]) : [];
}
