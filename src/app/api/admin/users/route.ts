import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import { adminHandler } from "@/lib/admin/auth";
import { ADMIN_DASHBOARD_REVALIDATE_SECONDS, ADMIN_DASHBOARD_TAG } from "@/lib/admin/cache";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { asEmail, jsonError, readJson } from "@/lib/server/http";

const getCachedUsers = unstable_cache(
  async () => {
    const snap = await adminDb.collection("users").orderBy("createdAt", "desc").get();
    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: data.uid || doc.id,
        displayName: data.displayName || "",
        email: data.email || "",
        designation: data.designation || "",
        phone: data.phone || "",
        location: data.location || "",
        bio: data.bio || "",
        photoURL: data.photoURL || null,
        status: data.status || "offline",
        isActivated: data.isActivated === true,
        isSuspended: data.isSuspended === true,
        createdAt: data.createdAt?.toDate?.().toISOString?.() || null,
        lastSeen: data.lastSeen?.toDate?.().toISOString?.() || null,
        acceptedContacts: Array.isArray(data.acceptedContacts) ? data.acceptedContacts.length : 0,
        blockedUsers: Array.isArray(data.blockedUsers) ? data.blockedUsers.length : 0,
        raw: JSON.parse(JSON.stringify(data, (key, value) => {
          if (key === "fcmTokens") return undefined; // device push tokens are never sent to the browser
          if (value && typeof value.toDate === "function") return value.toDate().toISOString();
          return value;
        })),
      };
    });
  },
  ["admin-users"],
  { revalidate: ADMIN_DASHBOARD_REVALIDATE_SECONDS, tags: [ADMIN_DASHBOARD_TAG] }
);

async function getHandler() {
  const users = await getCachedUsers();
  return NextResponse.json({ users });
}

async function postHandler(request: Request) {
  const payload = (await readJson(request)) as {
    displayName?: string;
    email?: string;
    password?: string;
    phone?: string;
    designation?: string;
    location?: string;
    bio?: string;
  };

  const displayName = payload.displayName?.trim();
  const email = asEmail(payload.email);
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!displayName || displayName.length > 60 || password.length < 8 || password.length > 128) {
    return jsonError(400, "Name (max 60 chars) and an 8+ character password are required.");
  }

  const user = await adminAuth.createUser({
    displayName,
    email,
    password,
    emailVerified: true,
    disabled: false,
  });

  await adminDb.collection("users").doc(user.uid).set({
    uid: user.uid,
    displayName,
    email,
    photoURL: null,
    photoPublicId: null,
    bio: payload.bio?.trim() || "",
    phone: payload.phone?.trim() || "",
    designation: payload.designation?.trim() || "",
    location: payload.location?.trim() || "",
    isActivated: true,
    isSuspended: false,
    status: "offline",
    lastSeen: new Date(),
    createdAt: new Date(),
    fcmTokens: [],
    blockedUsers: [],
    acceptedContacts: [],
    settings: { theme: "light", notificationsEnabled: true },
  });

  revalidateTag(ADMIN_DASHBOARD_TAG, "max");
  return NextResponse.json({ success: true, uid: user.uid });
}

export const GET = adminHandler("admin-users", getHandler);
export const POST = adminHandler("admin-users", postHandler);
