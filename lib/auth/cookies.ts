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

/**
 * Structural type matching both next/headers' cookies() mutable store (used
 * in Route Handlers) and NextResponse's own .cookies (used when a response
 * — e.g. a redirect — is built directly, like the OAuth callback route).
 */
interface CookieWriter {
  set(
    name: string,
    value: string,
    options: {
      httpOnly?: boolean;
      sameSite?: "lax" | "strict" | "none";
      secure?: boolean;
      path?: string;
      maxAge?: number;
    }
  ): void;
  delete(options: { name: string; path?: string } | string): void;
}

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

export function setAuthCookies(
  cookieStore: CookieWriter,
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

export function clearAuthCookies(cookieStore: CookieWriter): void {
  cookieStore.delete({ name: "access_token", path: "/" });
  cookieStore.delete({ name: "refresh_token", path: REFRESH_TOKEN_PATH });
}

export const REFRESH_DAYS = {
  default: 7,
  rememberMe: 30,
  short: 1,
} as const;
