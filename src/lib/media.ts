"use client";

import { auth } from "./firebase";
import type { MessageMediaMeta } from "./firestore";

// Kept in sync with mobile/src/config/constants.ts and the server-side cap in
// src/app/api/upload/chat-media/route.ts.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type ChatMediaType = "image" | "file" | "voice";

export interface UploadedChatMedia {
  mediaType: ChatMediaType;
  mediaUrl: string;
  mediaMeta: MessageMediaMeta;
}

/**
 * Uploads an image/file/voice-note attachment via /api/upload/chat-media
 * (auth-checked + membership-checked server-side, unlike the legacy avatar
 * upload route) and returns the fields to write onto the message doc.
 */
export async function uploadChatMediaFile(
  file: File,
  mediaType: ChatMediaType,
  chatId: string,
  isGroup: boolean,
  durationMs?: number
): Promise<UploadedChatMedia> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Chatly supports attachments up to 10MB.");
  }
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in required.");
  const idToken = await user.getIdToken();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("chatId", chatId);
  formData.append("isGroup", String(isGroup));
  formData.append("mediaType", mediaType);

  const res = await fetch("/api/upload/chat-media", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Upload failed");
  }

  const result = (await res.json()) as { url: string; publicId: string; sizeBytes: number };
  return {
    mediaType,
    mediaUrl: result.url,
    mediaMeta: { fileName: file.name, sizeBytes: result.sizeBytes, mimeType: file.type, durationMs, publicId: result.publicId },
  };
}
