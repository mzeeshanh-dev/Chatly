import { type NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { sendOTPEmail } from "@/lib/nodemailer";
import {
  ApiError,
  asEmail,
  asString,
  getClientIp,
  handleApiError,
  readJson,
} from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { generateOtp, storeOtp } from "@/lib/server/otp";

/**
 * Step 1 of registration. The Firebase Auth account is created *disabled* and
 * only enabled once the emailed code is verified, so nobody can sign in with an
 * unverified address.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const email = asEmail(body.email);
    const displayName = asString(body.displayName, "Name", { min: 2, max: 60 });
    const password = asString(body.password, "Password", { min: 8, max: 128 });

    await enforceRateLimit("register-ip", getClientIp(request), { limit: 10, windowSeconds: 3600 });
    await enforceRateLimit("register-email", email, { limit: 4, windowSeconds: 3600 });

    let uid: string;
    try {
      const existing = await adminAuth.getUserByEmail(email);
      const profile = await adminDb.collection("users").doc(existing.uid).get();
      if (profile.exists && profile.data()?.isActivated) {
        throw new ApiError(409, "An account with this email already exists.");
      }
      // Abandoned, never-verified registration: allow the owner to retry.
      await adminAuth.updateUser(existing.uid, { password, displayName, disabled: true });
      uid = existing.uid;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
      const created = await adminAuth.createUser({ email, password, displayName, disabled: true });
      uid = created.uid;
    }

    const code = generateOtp();
    await storeOtp("register", email, code, { uid, displayName });
    await sendOTPEmail(email, code);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "send-otp");
  }
}
