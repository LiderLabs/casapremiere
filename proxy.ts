// Next 16 renamed middleware to `proxy` (see "Migration to Proxy" in the Next docs): the file
// is proxy.ts and the exported function is `proxy`. It runs on the Node.js runtime by default.
//
// This proxy is a *cheap* gate: it only checks that a session cookie is present, so a
// signed-out visitor is redirected before any page work happens. It is deliberately not the
// authorization decision - a path-based check cannot see whether a session was revoked, so
// every admin page and route handler re-checks through requireUserPage/requireApiUser.

import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/admin/session-cookie";

/** Sign-in itself must be reachable while signed out. */
const PUBLIC_ADMIN_API = ["/api/admin/auth/login"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/api/admin")) {
    if (PUBLIC_ADMIN_API.includes(pathname)) return NextResponse.next();
    if (!hasSessionCookie) {
      // JSON, not a redirect: an API client should be told, not sent to a sign-in page.
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname === "/admin/signin") return NextResponse.next();

  if (!hasSessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/signin";
    url.search = "";

    const returnTo = `${pathname}${search}`;
    if (returnTo !== "/admin") url.searchParams.set("next", returnTo);

    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
