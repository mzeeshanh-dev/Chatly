import { ApiError } from "./http";
import { adminDb } from "@/lib/firebase-admin";

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export type AvatarKind = "profile" | "group";

/** Ensures the caller may overwrite/delete the avatar for `id` of the given kind. */
export async function assertAvatarOwner(callerUid: string, kind: AvatarKind, id: string) {
  if (kind === "profile") {
    if (id !== callerUid) throw new ApiError(403, "You can only change your own profile photo.");
    return;
  }
  const group = await adminDb.collection("groups").doc(id).get();
  if (!group.exists) throw new ApiError(404, "Group not found.");
  if (group.data()?.adminId !== callerUid) {
    throw new ApiError(403, "Only the group admin can change the group photo.");
  }
}

const AVATAR_PUBLIC_ID = /^[Cc]hatly\/(profiles|groups)\/([A-Za-z0-9_-]{1,128})$/;

/** Parses a Cloudinary avatar public id; rejects anything outside the avatar folders. */
export function parseAvatarPublicId(publicId: string): { kind: AvatarKind; id: string } {
  const match = AVATAR_PUBLIC_ID.exec(publicId);
  if (!match) throw new ApiError(400, "Invalid publicId.");
  return { kind: match[1] === "profiles" ? "profile" : "group", id: match[2] };
}
