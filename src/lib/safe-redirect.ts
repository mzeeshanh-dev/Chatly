const DEFAULT_REDIRECT = "/chat";

/** Internal paths a user may be sent to after authenticating. */
const ALLOWED_PREFIXES = ["/chat"];

/**
 * Normalises a user-supplied `from` parameter into a safe, same-origin path.
 * Anything that is not an allow-listed internal path (absolute URLs, protocol-
 * relative URLs, backslash tricks, control characters, auth pages) falls back
 * to the default so the login flow can never be abused as an open redirect.
 */
export function getSafeRedirectPath(
  raw: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT
): string {
  if (!raw || typeof raw !== "string" || raw.length > 512) return fallback;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }

  if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (decoded.includes("\\") || /[\u0000-\u001f\u007f]/.test(decoded)) return fallback;

  let url: URL;
  try {
    url = new URL(decoded, "http://localhost");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://localhost") return fallback;

  const allowed = ALLOWED_PREFIXES.some(
    (p) => url.pathname === p || url.pathname.startsWith(`${p}/`)
  );
  return allowed ? `${url.pathname}${url.search}` : fallback;
}
