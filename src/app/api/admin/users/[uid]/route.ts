import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { adminHandler } from "@/lib/admin/auth";
import { ADMIN_DASHBOARD_TAG } from "@/lib/admin/cache";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { ApiError, jsonError, readJson } from "@/lib/server/http";

const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;

/** Admin accounts cannot be suspended or deleted through the user-management API. */
async function assertManageable(uid: string) {
  if (!UID_RE.test(uid)) throw new ApiError(400, "Invalid uid.");
  const admin = await adminDb.collection("admins").doc(uid).get();
  const user = await adminAuth.getUser(uid).catch(() => null);
  if (!user) throw new ApiError(404, "User not found.");
  if (admin.exists || user.customClaims?.admin === true) {
    throw new ApiError(403, "Admin accounts cannot be modified here.");
  }
}

type Params = { params: Promise<{ uid: string }> };

async function patchHandler(request: NextRequest, { params }: Params) {
  const { uid } = await params;
  const payload = (await readJson(request)) as {
    action?: "suspend" | "activate" | "update";
    displayName?: string;
    phone?: string;
    designation?: string;
    location?: string;
    bio?: string;
  };
  const { action } = payload;

  if (!uid || !action || !["suspend", "activate", "update"].includes(action)) {
    return jsonError(400, "uid and a valid action are required.");
  }
  await assertManageable(uid);

  if (action === "update") {
    const displayName = payload.displayName?.trim();
    if (!displayName || displayName.length > 60) return jsonError(400, "Display name is required (max 60 characters).");

    await Promise.all([
      adminAuth.updateUser(uid, { displayName }),
      adminDb.collection("users").doc(uid).set(
        {
          displayName,
          phone: payload.phone?.trim() || "",
          designation: payload.designation?.trim() || "",
          location: payload.location?.trim() || "",
          bio: payload.bio?.trim() || "",
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ),
    ]);

    revalidateTag(ADMIN_DASHBOARD_TAG, "max");
    return NextResponse.json({ success: true });
  }

  const isSuspended = action === "suspend";
  await Promise.all([
    adminDb.collection("users").doc(uid).set(
      {
        isSuspended,
        status: isSuspended ? "offline" : "offline",
        suspendedAt: isSuspended ? new Date().toISOString() : null,
      },
      { merge: true }
    ),
    adminAuth.updateUser(uid, { disabled: isSuspended }),
  ]);

  revalidateTag(ADMIN_DASHBOARD_TAG, "max");
  return NextResponse.json({ success: true, isSuspended });
}

async function deleteHandler(_request: NextRequest, { params }: Params) {
  const { uid } = await params;
  await assertManageable(uid);

  await Promise.allSettled([
    adminAuth.deleteUser(uid),
    adminDb.collection("users").doc(uid).delete(),
  ]);

  revalidateTag(ADMIN_DASHBOARD_TAG, "max");
  return NextResponse.json({ success: true });
}

export const PATCH = adminHandler("admin-user", patchHandler);
export const DELETE = adminHandler("admin-user", deleteHandler);
