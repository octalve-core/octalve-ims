/**
 * Next.js 16 Proxy — real Edge JWT verification.
 * Runs as a network boundary handler so unauthenticated (or expired-token)
 * visitors are redirected to /login instantly without starting a
 * serverless function.
 *
 * Ported from Proplity, see out/auth-system-port-plan.md, Phase 5. Upgraded
 * from a lightweight cookie-EXISTENCE check to real verification because
 * this now uses `jose` (Edge-compatible) instead of the old `jsonwebtoken`
 * library, which needs Node crypto APIs unavailable on the Edge runtime —
 * that limitation is exactly why this used to only check whether a cookie
 * was present, not whether it was valid.
 *
 * No role-based path gating added here (unlike Proplity's own proxy.ts,
 * which blocks non-admin roles from /admin): this app's /admin/* tree is
 * the shared authenticated shell for every role (client/supplier included
 * — they get role-scoped data within it, e.g. app/orders/page.tsx branches
 * on session.role internally), not an admin-only area. Adding a blanket
 * role check here would break legitimate client/supplier access.
 *
 * Still no fetch/refresh here — an expired-but-refreshable session just
 * redirects to /login on first load of a protected route; the client-side
 * interceptors (utils/axiosInstance.ts, lib/api/client.ts) and the
 * proactive hooks/use-auth-refresh.ts handle silent renewal for the
 * already-loaded app.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";

const PUBLIC = new Set(["/login", "/register"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC.has(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("access_token")?.value;
  const payload = token ? await verifyToken(token) : null;

  if (!payload) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.woff|.*\\.woff2).*)",
  ],
};
