import { createHash } from "crypto";
import { adminDb } from "@/lib/firebase-admin";
import { ApiError } from "./http";

/**
 * Fixed-window rate limiter backed by Firestore transactions.
 * Serverless instances share no memory, so counters live in the database
 * (`rateLimits` collection, admin-SDK access only) to hold across invocations.
 * Configure a Firestore TTL policy on `expiresAt` to garbage-collect old windows.
 */
export async function enforceRateLimit(
  scope: string,
  identity: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number }
): Promise<void> {
  const windowMs = windowSeconds * 1000;
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const key = createHash("sha256").update(`${scope}:${identity}:${windowStart}`).digest("hex");
  const ref = adminDb.collection("rateLimits").doc(key);

  let count = 0;
  try {
    count = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const next = (snap.exists ? (snap.data()?.count as number) : 0) + 1;
      tx.set(ref, { count: next, scope, expiresAt: new Date(windowStart + windowMs * 2) });
      return next;
    });
  } catch (error) {
    // Fail open on infrastructure errors so a limiter outage never locks users out.
    console.error("[rate-limit] transaction failed", error);
    return;
  }

  if (count > limit) {
    const retryAfter = Math.max(1, Math.ceil((windowStart + windowMs - Date.now()) / 1000));
    throw new ApiError(429, "Too many requests. Please try again shortly.", {
      "Retry-After": String(retryAfter),
    });
  }
}
