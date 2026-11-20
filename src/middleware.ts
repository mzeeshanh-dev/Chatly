import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

const PROTECTED_ROUTES = ["/chat"];
const ADMIN_SESSION_COOKIE = "chatly_admin_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const adminCookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const isAuthenticated = Boolean(sessionCookie);
  const isAdminAuthenticated = Boolean(adminCookie);

  if (pathname === "/admin") {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !isAdminAuthenticated) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (pathname === "/admin/login" && isAdminAuthenticated) {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  // Redirect unauthenticated users away from protected routes
  // Exact segment match so e.g. "/chatter" is not treated as "/chat".
  const isProtected = PROTECTED_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  // Authenticated pages must never be cached by shared caches or the bfcache.
  if (isProtected) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - public folder
     * - api routes (they handle their own auth)
     */
    "/((?!_next/static|_next/image|favicon.ico|public|api).*)",
  ],
};
