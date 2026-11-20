import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { adminDb } from "@/lib/firebase-admin";
import { ApiError } from "./http";

const OTP_COLLECTION = "otps";
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export type OtpPurpose = "register" | "reset";

const docId = (purpose: OtpPurpose, email: string) =>
  createHash("sha256").update(`${purpose}:${email}`).digest("hex");

const hashCode = (code: string, salt: string) =>
  createHash("sha256").update(`${salt}:${code}`).digest("hex");

/** Cryptographically secure 6-digit code. */
export function generateOtp(): string {
  return randomInt(100000, 1000000).toString();
}

/** Stores only a salted hash of the code, never the code itself. */
export async function storeOtp(
  purpose: OtpPurpose,
  email: string,
  code: string,
  extra: Record<string, unknown> = {}
) {
  const salt = randomBytes(8).toString("hex");
  await adminDb
    .collection(OTP_COLLECTION)
    .doc(docId(purpose, email))
    .set({
      purpose,
      email,
      salt,
      codeHash: hashCode(code, salt),
      attempts: 0,
      expiresAt: Date.now() + OTP_TTL_MS,
      ...extra,
    });
}

/** Validates the code (single-use, attempt-limited) and returns the stored metadata. */
export async function consumeOtp(
  purpose: OtpPurpose,
  email: string,
  code: string
): Promise<Record<string, unknown>> {
  const ref = adminDb.collection(OTP_COLLECTION).doc(docId(purpose, email));
  const invalid = new ApiError(422, "Incorrect or expired verification code.");

  // Throwing inside a transaction rolls back writes, so failures are recorded
  // outside of it.
  type Stored = Record<string, unknown> & {
    salt: string;
    codeHash: string;
    attempts: number;
    expiresAt: number;
  };
  const result = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false as const };
    const data = snap.data() as Stored;

    if (Date.now() > data.expiresAt || data.attempts >= MAX_ATTEMPTS) {
      tx.delete(ref);
      return { ok: false as const };
    }

    const a = Buffer.from(hashCode(code, data.salt));
    const b = Buffer.from(data.codeHash);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      tx.update(ref, { attempts: data.attempts + 1 });
      return { ok: false as const };
    }

    tx.delete(ref);
    return { ok: true as const, data };
  });

  if (!result.ok) throw invalid;
  return result.data;
}
