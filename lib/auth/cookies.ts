import type { cookies as nextCookies } from "next/headers";

/**
 * Two-cookie scheme (ported from Proplity, see out/auth-system-port-plan.md)
 * — replaces the old single `session_id` cookie:
 *
 * - `access_token`: short-lived (15 min) JWT, path `/` (sent with every
 *   request — that's the point, proxy.ts and every route handler read it).
 * - `refresh_token`: opaque, path scoped ONLY to the refresh endpoint. The
 *   browser will never attach it to any other request, so no other route
 *   handler (or an XSS-adjacent fetch to some other endpoint) can see it —
 *   this is also why logout can't read it directly and instead revokes by
 *   userId via the access-token session.
 */

const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60; // 15 min, fixed
const REFRESH_TOKEN_PATH = "/api/auth/refresh";

type CookieStore = Awaited<ReturnType<typeof nextCookies>>;

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

export function setAuthCookies(
  cookieStore: CookieStore,
  accessToken: string,
  refreshToken: string,
  refreshMaxAgeSeconds: number
): void {
  cookieStore.set("access_token", accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd(),
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
  });
  cookieStore.set("refresh_token", refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd(),
    path: REFRESH_TOKEN_PATH,
    maxAge: refreshMaxAgeSeconds,
  });
}

export function clearAuthCookies(cookieStore: CookieStore): void {
  cookieStore.delete({ name: "access_token", path: "/" });
  cookieStore.delete({ name: "refresh_token", path: REFRESH_TOKEN_PATH });
}

export const REFRESH_DAYS = {
  default: 7,
  rememberMe: 30,
  short: 1,
} as const;
