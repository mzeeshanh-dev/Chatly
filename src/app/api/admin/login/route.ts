import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { asEmail, getClientIp, handleApiError, jsonError, readJson } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { ADMIN_COLLECTION, setAdminSessionCookie } from "@/lib/admin/auth";

type FirebasePasswordResponse = {
  idToken?: string;
  localId?: string;
  email?: string;
  error?: { message?: string };
};

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const email = asEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    if (!password || password.length > 128) return jsonError(400, "Email and password are required.");

    await enforceRateLimit("admin-login-ip", getClientIp(request), { limit: 10, windowSeconds: 900 });
    await enforceRateLimit("admin-login-email", email, { limit: 5, windowSeconds: 900 });

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Firebase API key is missing." }, { status: 500 });
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
        cache: "no-store",
      }
    );
    const payload = (await response.json()) as FirebasePasswordResponse;

    if (!response.ok || !payload.idToken || !payload.localId) {
      return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(payload.idToken, true);
    const adminSnap = await adminDb.collection(ADMIN_COLLECTION).doc(decoded.uid).get();
    const adminData = adminSnap.exists ? adminSnap.data() : null;
    const isAdmin = decoded.admin === true || (adminData?.role === "admin" && adminData?.active !== false);

    if (!isAdmin) {
      return NextResponse.json({ error: "This account is not an admin." }, { status: 403 });
    }

    await setAdminSessionCookie(payload.idToken);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "admin-login");
  }
}
