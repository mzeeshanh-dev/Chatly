import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { ApiError, handleApiError } from "@/lib/server/http";

export const ADMIN_SESSION_COOKIE = "chatly_admin_session";
export const ADMIN_COLLECTION = "admins";

export type AdminSession = {
  uid: string;
  email: string;
};

/** Verifies an admin session cookie value (not a raw ID token). */
export async function verifyAdminToken(token: string): Promise<AdminSession | null> {
  try {
    const decoded = await adminAuth.verifySessionCookie(token, true);
    const email = decoded.email || "";
    if (!email) return null;

    const adminSnap = await adminDb.collection(ADMIN_COLLECTION).doc(decoded.uid).get();
    const adminData = adminSnap.exists ? adminSnap.data() : null;
    const claimAdmin = decoded.admin === true;
    const docAdmin = adminData?.role === "admin" && adminData?.active !== false;

    if (!claimAdmin && !docAdmin) return null;
    return { uid: decoded.uid, email };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  return token ? verifyAdminToken(token) : null;
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/api/admin/logout");
  }
  return session;
}

/** Same as requireAdmin but for route handlers: throws 401/403 instead of redirecting. */
export async function requireAdminApi(): Promise<AdminSession> {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) throw new ApiError(401, "Admin sign-in required.");
  const session = await verifyAdminToken(token);
  if (!session) throw new ApiError(403, "Admin access required.");
  return session;
}

const ADMIN_SESSION_SECONDS = 60 * 60 * 8;

export async function setAdminSessionCookie(idToken: string) {
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: ADMIN_SESSION_SECONDS * 1000,
  });
  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  });
}

export async function clearAdminSessionCookie() {
  const store = await cookies();
  store.delete(ADMIN_SESSION_COOKIE);
}

/** Wraps a route handler with admin authorization and uniform error responses. */
export function adminHandler<A extends unknown[]>(
  context: string,
  handler: (...args: A) => Promise<Response>
) {
  return async (...args: A): Promise<Response> => {
    try {
      await requireAdminApi();
      return await handler(...args);
    } catch (error) {
      return handleApiError(error, context);
    }
  };
}
