import { type NextRequest, NextResponse } from "next/server";
import { adminMessaging, adminDb } from "@/lib/firebase-admin";
import { ApiError, asString, handleApiError, readJson } from "@/lib/server/http";
import { getConversation, membersOf, requireUser } from "@/lib/server/auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";

// Shared by web and mobile (mobile has no Cloud Functions backend). The caller
// must be authenticated and both caller and recipient must belong to the
// referenced conversation, so it cannot be used to push-spam arbitrary users.
export async function POST(request: NextRequest) {
  try {
    const caller = await requireUser(request);
    await enforceRateLimit("notify-push", caller.uid, { limit: 120, windowSeconds: 60 });

    const body = await readJson(request);
    const recipientId = asString(body.recipientId, "recipientId", { max: 128 });
    const chatId = asString(body.chatId, "chatId", { max: 128 });
    const messageBody = asString(body.body, "body", { max: 500 });
    const collectionName = body.collectionName;
    if (collectionName !== "chats" && collectionName !== "groups") {
      throw new ApiError(400, "collectionName must be chats or groups.");
    }
    const isGroup = collectionName === "groups";
    const senderName = typeof body.senderName === "string" ? body.senderName.trim().slice(0, 100) : "";
    const senderPhotoUrl =
      typeof body.senderPhotoUrl === "string" && body.senderPhotoUrl.startsWith("https://")
        ? body.senderPhotoUrl.slice(0, 500)
        : "";

    const conversation = await getConversation(chatId, isGroup);
    const members = membersOf(conversation, isGroup);
    if (!members.includes(caller.uid) || !members.includes(recipientId) || recipientId === caller.uid) {
      throw new ApiError(403, "Not allowed to notify this user.");
    }

    const userDoc = await adminDb.collection("users").doc(recipientId).get();
    if (!userDoc.exists) throw new ApiError(404, "User not found");
    const userData = userDoc.data();

    if (userData?.settings?.notificationsEnabled === false) {
      return NextResponse.json({ success: true, message: "User disabled notifications" });
    }
    const tokens: string[] = userData?.fcmTokens || [];
    if (tokens.length === 0) {
      return NextResponse.json({ success: true, message: "No active FCM tokens for user" });
    }

    const unreadCount = (conversation.unreadCount as Record<string, number> | undefined)?.[recipientId] || 0;
    const name = senderName || "New Message";
    const finalTitle =
      unreadCount > 1 ? `Chatly • ${name} (${unreadCount} new messages)` : `Chatly • ${name}`;

    const response = await adminMessaging.sendEachForMulticast({
      webpush: {
        notification: {
          title: finalTitle,
          body: messageBody,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
        },
        fcmOptions: { link: "/chat" },
      },
      apns: { payload: { aps: { alert: { title: finalTitle, body: messageBody }, sound: "default" } } },
      android: { priority: "high" },
      data: { chatId, senderPhotoUrl, senderName: name, title: finalTitle, body: messageBody },
      tokens,
    });

    // Prune tokens FCM reports as dead.
    const dead = tokens.filter((_, i) => !response.responses[i]?.success);
    if (dead.length > 0) {
      await adminDb
        .collection("users")
        .doc(recipientId)
        .update({ fcmTokens: tokens.filter((t) => !dead.includes(t)) });
    }

    return NextResponse.json({ success: true, sent: response.successCount });
  } catch (error) {
    return handleApiError(error, "notify");
  }
}
