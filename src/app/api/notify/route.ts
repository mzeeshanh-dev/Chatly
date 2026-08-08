import { type NextRequest, NextResponse } from "next/server";
import { adminMessaging, adminDb } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const { recipientId, title, body, data, chatId, collectionName, senderName, senderPhotoUrl } = await request.json();

    if (!recipientId || (!title && !senderName) || !body) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const userDoc = await adminDb.collection("users").doc(recipientId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data();

    // Check if notifications are disabled
    if (userData?.settings?.notificationsEnabled === false) {
      return NextResponse.json({ success: true, message: "User disabled notifications" });
    }

    const tokens = userData?.fcmTokens || [];
    if (tokens.length === 0) {
      return NextResponse.json({ success: true, message: "No active FCM tokens for user" });
    }

    let finalTitle = title || senderName || "New Message";

    // Fetch unread count if we have context
    if (chatId && collectionName && senderName) {
      const parentDoc = await adminDb.collection(collectionName).doc(chatId).get();
      if (parentDoc.exists) {
        const parentData = parentDoc.data();
        const unreadCount = parentData?.unreadCount?.[recipientId] || 0;

        if (unreadCount > 1) {
          finalTitle = `Chatly • ${senderName} (${unreadCount} new messages)`;
        } else {
          finalTitle = `Chatly • ${senderName}`;
        }
      }
    } else {
      finalTitle = `Chatly • ${finalTitle}`;
    }


    const payload: any = {
      webpush: {
        notification: {
          title: finalTitle,
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          vibrate: [200, 100, 200],
        },
        fcmOptions: {
          link: '/chat'
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: finalTitle,
              body,
            },
            sound: "default"
          }
        }
      },
      android: {
        priority: "high"
      },
      tokens,
    };
    if (data || chatId || senderPhotoUrl || senderName || finalTitle || body) {
      payload.data = {
        ...(data || {}),
        chatId: chatId || "",
        senderPhotoUrl: senderPhotoUrl || "",
        senderName: senderName || "",
        title: finalTitle || "",
        body: body || "",
      };
    }

    const response = await adminMessaging.sendEachForMulticast(payload);

    // Cleanup invalid tokens
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp: any, idx: number) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });
      if (failedTokens.length > 0) {
        // Remove failed tokens from Firestore
        const newTokens = tokens.filter((t: string) => !failedTokens.includes(t));
        await adminDb.collection("users").doc(recipientId).update({
          fcmTokens: newTokens,
        });
      }
    }

    return NextResponse.json({ success: true, responses: response });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
