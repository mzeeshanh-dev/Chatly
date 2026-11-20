import { type NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import {
  asEmail,
  asOtp,
  asString,
  getClientIp,
  handleApiError,
  readJson,
} from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { consumeOtp } from "@/lib/server/otp";

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const email = asEmail(body.email);
    const code = asOtp(body.code);
    const newPassword = asString(body.newPassword, "Password", { min: 8, max: 128 });

    await enforceRateLimit("reset-ip", getClientIp(request), { limit: 20, windowSeconds: 3600 });
    await enforceRateLimit("reset-email", email, { limit: 10, windowSeconds: 3600 });

    const otp = await consumeOtp("reset", email, code);
    const uid = String(otp.uid);

    await adminAuth.updateUser(uid, { password: newPassword });
    // Sign out every existing session after a password change.
    await adminAuth.revokeRefreshTokens(uid);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "reset-password");
  }
}
