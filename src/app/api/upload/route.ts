import { NextRequest, NextResponse } from "next/server";
import { uploadAvatar } from "@/lib/cloudinary";
import { ApiError, handleApiError } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_AVATAR_BYTES,
  assertAvatarOwner,
  type AvatarKind,
} from "@/lib/server/uploads";

export async function POST(req: NextRequest) {
  try {
    const caller = await requireUser(req);
    await enforceRateLimit("avatar-upload", caller.uid, { limit: 20, windowSeconds: 3600 });

    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_AVATAR_BYTES + 64 * 1024) throw new ApiError(413, "Image must be 5MB or smaller.");

    const formData = await req.formData();
    const file = formData.get("file");
    const id = formData.get("id");
    const type: AvatarKind = formData.get("type") === "group" ? "group" : "profile";

    if (!(file instanceof File) || typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
      throw new ApiError(400, "Missing file or id");
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new ApiError(400, "Only JPEG, PNG, WebP or GIF images are allowed.");
    }
    if (file.size > MAX_AVATAR_BYTES) throw new ApiError(413, "Image must be 5MB or smaller.");

    await assertAvatarOwner(caller.uid, type, id);

    const result = await uploadAvatar(Buffer.from(await file.arrayBuffer()), id, type);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "upload");
  }
}
