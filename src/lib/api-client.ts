import type { User } from "firebase/auth";

/** fetch() that attaches the signed-in user's Firebase ID token as a Bearer token. */
export async function authFetch(user: User, input: string, init: RequestInit = {}): Promise<Response> {
  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

/** Throws with the server-provided message when a response is not OK. */
export async function ensureOk(res: Response, fallback: string): Promise<Response> {
  if (res.ok) return res;
  const body = await res.json().catch(() => ({}));
  throw new Error(typeof body.error === "string" ? body.error : fallback);
}
