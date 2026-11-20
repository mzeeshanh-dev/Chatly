import { type NextRequest, NextResponse } from "next/server";
import { deleteAvatars } from "@/lib/cloudinary";
import { ApiError, handleApiError, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { assertAvatarOwner, parseAvatarPublicId } from "@/lib/server/uploads";

export async function DELETE(request: NextRequest) {
  try {
    const caller = await requireUser(request);
    await enforceRateLimit("avatar-delete", caller.uid, { limit: 20, windowSeconds: 3600 });

    const body = await readJson(request);
    const raw: unknown[] = Array.isArray(body.publicIds)
      ? body.publicIds
      : body.publicId
        ? [body.publicId]
        : [];
    if (raw.length === 0 || raw.length > 4 || raw.some((id) => typeof id !== "string")) {
      throw new ApiError(400, "publicId is required.");
    }

    const ids = [...new Set((raw as string[]).map((id) => id.trim()))];
    // Every id must be an avatar the caller owns before anything is deleted.
    for (const publicId of ids) {
      const { kind, id } = parseAvatarPublicId(publicId);
      await assertAvatarOwner(caller.uid, kind, id);
    }

    await deleteAvatars(ids);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "upload-delete");
  }
}
