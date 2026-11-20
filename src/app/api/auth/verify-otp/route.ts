import { type NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { asEmail, asOtp, getClientIp, handleApiError, readJson } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { consumeOtp } from "@/lib/server/otp";

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const email = asEmail(body.email);
    const code = asOtp(body.code);

    await enforceRateLimit("verify-ip", getClientIp(request), { limit: 20, windowSeconds: 3600 });
    await enforceRateLimit("verify-email", email, { limit: 10, windowSeconds: 3600 });

    const otp = await consumeOtp("register", email, code);
    const uid = String(otp.uid);
    const displayName = String(otp.displayName ?? "");

    await adminAuth.updateUser(uid, { disabled: false, emailVerified: true });
    await adminDb.collection("users").doc(uid).set({
      uid,
      displayName,
      email,
      photoURL: null,
      bio: "",
      phone: "",
      location: "",
      isActivated: true,
      createdAt: FieldValue.serverTimestamp(),
      settings: { theme: "dark", notificationsEnabled: true },
      blockedUsers: [],
      acceptedContacts: [],
      fcmTokens: [],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "verify-otp");
  }
}
