import { type NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { sendPasswordResetEmail } from "@/lib/nodemailer";
import { asEmail, getClientIp, handleApiError, readJson } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { generateOtp, storeOtp } from "@/lib/server/otp";

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const email = asEmail(body.email);

    await enforceRateLimit("forgot-ip", getClientIp(request), { limit: 10, windowSeconds: 3600 });
    await enforceRateLimit("forgot-email", email, { limit: 3, windowSeconds: 3600 });

    // The response is identical whether or not the account exists, so this
    // endpoint cannot be used to enumerate registered emails.
    try {
      const user = await adminAuth.getUserByEmail(email);
      const profile = await adminDb.collection("users").doc(user.uid).get();
      if (!user.disabled && profile.exists && profile.data()?.isActivated) {
        const code = generateOtp();
        await storeOtp("reset", email, code, { uid: user.uid });
        await sendPasswordResetEmail(email, code);
      }
    } catch (error) {
      if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "forgot-otp");
  }
}
