import { NextRequest, NextResponse } from "next/server";
import { uploadChatMedia, type ChatMediaType } from "@/lib/cloudinary";
import { ApiError, handleApiError } from "@/lib/server/http";
import { getConversation, membersOf, requireUser } from "@/lib/server/auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";

// Kept in sync with mobile/src/config/constants.ts MAX_UPLOAD_BYTES.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MEDIA_TYPES: ChatMediaType[] = ["image", "file", "voice"];

// chatId is client-supplied, so the caller's ID token is verified and chat or
// group membership is checked before anything reaches Cloudinary.
export async function POST(req: NextRequest) {
  try {
    const caller = await requireUser(req);
    await enforceRateLimit("chat-media", caller.uid, { limit: 60, windowSeconds: 3600 });

    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_UPLOAD_BYTES + 64 * 1024) throw new ApiError(413, "File must be 10MB or smaller.");

    const formData = await req.formData();
    const file = formData.get("file");
    const chatId = formData.get("chatId");
    const isGroup = formData.get("isGroup") === "true";
    const mediaType = formData.get("mediaType") as ChatMediaType | null;

    if (
      !(file instanceof File) ||
      typeof chatId !== "string" ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(chatId) ||
      !mediaType ||
      !MEDIA_TYPES.includes(mediaType)
    ) {
      throw new ApiError(400, "Missing file, chatId, or mediaType.");
    }
    if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, "File must be 10MB or smaller.");

    const conversation = await getConversation(chatId, isGroup);
    if (!membersOf(conversation, isGroup).includes(caller.uid)) {
      throw new ApiError(403, "You are not a member of this conversation.");
    }

    const result = await uploadChatMedia(Buffer.from(await file.arrayBuffer()), chatId, mediaType, file.name);
    return NextResponse.json({ url: result.url, publicId: result.publicId, sizeBytes: file.size });
  } catch (error) {
    return handleApiError(error, "chat-media");
  }
}
