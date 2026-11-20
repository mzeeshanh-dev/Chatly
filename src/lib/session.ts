/** httpOnly cookie issued by /api/auth/session; used by middleware as a route guard. */
export const SESSION_COOKIE = "chatly_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;

/** Establishes the server session from the signed-in Firebase user's ID token. */
export async function createServerSession(idToken: string): Promise<void> {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not start your session.");
  }
}

export async function clearServerSession(): Promise<void> {
  await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
}
