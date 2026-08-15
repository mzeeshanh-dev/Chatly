import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { uploadChatMedia, type ChatMediaType } from "@/lib/cloudinary";
import { COLLECTIONS } from "@/lib/firestore";

// Kept in sync with mobile/src/config/constants.ts MAX_UPLOAD_BYTES and
// functions/src/functions/media.ts MAX_CHAT_MEDIA_BYTES.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Unlike /api/upload (avatar upload, unauthenticated today), chatId here is
// client-supplied and must be verified server-side: the caller's ID token is
// checked, then chat/group membership, before anything reaches Cloudinary.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(idToken);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const chatId = formData.get("chatId") as string | null;
    const isGroup = formData.get("isGroup") === "true";
    const mediaType = formData.get("mediaType") as ChatMediaType | null;

    if (!file || !chatId || !mediaType || !["image", "file", "voice"].includes(mediaType)) {
      return NextResponse.json({ error: "Missing file, chatId, or mediaType." }, { status: 400 });
    }

    const parentCollection = isGroup ? COLLECTIONS.GROUPS : COLLECTIONS.CHATS;
    const parentSnap = await adminDb.collection(parentCollection).doc(chatId).get();
    if (!parentSnap.exists) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }
    const membership: string[] = isGroup ? (parentSnap.data()?.memberIds ?? []) : (parentSnap.data()?.participants ?? []);
    if (!membership.includes(decoded.uid)) {
      return NextResponse.json({ error: "You are not a participant in this conversation." }, { status: 403 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File must be 10MB or smaller." }, { status: 400 });
    }

    const result = await uploadChatMedia(buffer, chatId, mediaType, file.name);
    return NextResponse.json({ url: result.url, publicId: result.publicId, sizeBytes: buffer.byteLength });
  } catch (error: unknown) {
    console.error("Chat media upload API error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
