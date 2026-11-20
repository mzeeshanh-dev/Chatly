import { type NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { ApiError, handleApiError, readJson } from "@/lib/server/http";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/session";

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/** Exchanges a fresh Firebase ID token for an httpOnly session cookie. */
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const idToken = typeof body.idToken === "string" ? body.idToken : "";
    if (!idToken) throw new ApiError(400, "idToken is required.");

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken, true);
    } catch {
      throw new ApiError(401, "Invalid or expired session.");
    }

    const profile = await adminDb.collection("users").doc(decoded.uid).get();
    if (profile.data()?.isSuspended) throw new ApiError(403, "This account has been suspended.");

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      ...cookieBase,
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    return handleApiError(error, "session");
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, "", { ...cookieBase, maxAge: 0 });
  return response;
}
