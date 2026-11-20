import { NextResponse, type NextRequest } from "next/server";

/** An error that carries an HTTP status and a message that is safe to show clients. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly headers?: Record<string, string>
  ) {
    super(message);
  }
}

export function jsonError(status: number, message: string, headers?: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers });
}

/** Converts any thrown value into a response without leaking internals. */
export function handleApiError(error: unknown, context: string) {
  if (error instanceof ApiError) return jsonError(error.status, error.message, error.headers);
  console.error(`[api:${context}]`, error);
  return jsonError(500, "Something went wrong. Please try again.");
}

/** Reads a JSON object body, rejecting oversized or malformed payloads. */
export async function readJson<T extends Record<string, unknown>>(
  request: NextRequest | Request,
  maxBytes = 16 * 1024
): Promise<Partial<T>> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new ApiError(413, "Request body too large.");
  const text = await request.text();
  if (text.length > maxBytes) throw new ApiError(413, "Request body too large.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError(400, "Invalid JSON body.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ApiError(400, "Invalid JSON body.");
  }
  return parsed as Partial<T>;
}

export function getClientIp(request: NextRequest | Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

// ─── Validators ──────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

export function asEmail(value: unknown): string {
  if (typeof value !== "string") throw new ApiError(400, "A valid email is required.");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) throw new ApiError(400, "A valid email is required.");
  return email;
}

export function asString(value: unknown, field: string, { min = 1, max = 200 } = {}): string {
  if (typeof value !== "string") throw new ApiError(400, `${field} is required.`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new ApiError(400, `${field} must be between ${min} and ${max} characters.`);
  }
  return trimmed;
}

export function asOtp(value: unknown): string {
  if (typeof value !== "string" || !/^\d{6}$/.test(value)) {
    throw new ApiError(400, "Enter the 6-digit code.");
  }
  return value;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
