import { v2 as cloudinary } from "cloudinary";

// ─── Configuration (server-only — never expose in CLIENT bundle) ──────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UploadResult {
  url: string;
  publicId: string;
}

const CLOUDINARY_APP_FOLDER = "Chatly";

export function getAvatarPublicId(
  id: string,
  type: "profile" | "group" = "profile"
): string {
  return `${CLOUDINARY_APP_FOLDER}/${type}s/${id}`;
}

// ─── Upload avatar (always overwrites the same public_id) ────────────────────
export async function uploadAvatar(
  fileBuffer: Buffer,
  id: string,
  type: "profile" | "group" = "profile"
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadFolder = `${CLOUDINARY_APP_FOLDER}/${type}s`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: uploadFolder,
        public_id: id,
        overwrite: true,
        unique_filename: false,
        invalidate: true, // purge CDN cache on overwrite
        transformation: [{ width: 256, height: 256, crop: "fill", gravity: "face" }],
        resource_type: "image",
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Upload failed"));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );

    uploadStream.end(fileBuffer);
  });
}

// ─── Delete avatar ────────────────────────────────────────────────────────────
export async function deleteAvatar(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}

export async function deleteAvatars(publicIds: string[]): Promise<void> {
  await Promise.all(publicIds.map((publicId) => deleteAvatar(publicId)));
}

export type ChatMediaType = "image" | "file" | "voice";

// Cloudinary has no "audio" resource type — voice notes upload as "video"
// (its documented convention for audio-only assets); generic files use "raw".
// Mirrors functions/src/config/cloudinary.ts on the mobile/Cloud Functions side.
function resourceTypeFor(mediaType: ChatMediaType): "image" | "video" | "raw" {
  if (mediaType === "image") return "image";
  if (mediaType === "voice") return "video";
  return "raw";
}

export async function uploadChatMedia(fileBuffer: Buffer, chatId: string, mediaType: ChatMediaType, fileName?: string): Promise<{url: string, publicId: string, format?: string}> {
  return new Promise((resolve, reject) => {
    let ext = "";
    if (fileName && fileName.includes(".")) {
      ext = fileName.split(".").pop() || "";
    }
    
    // Cloudinary uses the public_id for the final URL. If we append the extension here,
    // the resulting secure_url will have the correct format, fixing "unknown format" bugs on download.
    const uniqueId = require("crypto").randomUUID().replace(/-/g, "");
    const customPublicId = ext ? `${uniqueId}.${ext}` : uniqueId;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `${CLOUDINARY_APP_FOLDER}/chat-media/${chatId}`,
        resource_type: resourceTypeFor(mediaType),
        public_id: customPublicId,
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Upload failed"));
        resolve({ url: result.secure_url, publicId: result.public_id, format: result.format });
      }
    );

    uploadStream.end(fileBuffer);
  });
}
