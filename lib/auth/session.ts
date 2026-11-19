import { cookies } from "next/headers";
import { verifyToken, verifyTokenAllowExpired, type AccessTokenPayload } from "./jwt";

/**
 * Lightweight, DB-free session read — decodes the `access_token` JWT only
 * (ported from Proplity's getServerSession(), see
 * docs/auth-system-port-plan.md). Use this where only identity+role is
 * needed and a DB round-trip isn't worth it.
 *
 * This is deliberately NOT a replacement for
 * utils/auth.ts's getSessionFromRequest, which most of the ~150 existing
 * role-check call sites depend on for a full Prisma User row (email, name,
 * etc.) — that helper stays. Use this one in new, latency-sensitive code
 * paths where the JWT's {sub, role} claims are enough.
 */
export async function getServerSession(): Promise<AccessTokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Like getServerSession, but also accepts an access token that has expired (the signature must
 * still be valid). For logout only: an idle tab past 15 minutes must still revoke its refresh
 * tokens (ISS-0033). Never use it to authorize anything.
 */
export async function getExpiredSession(): Promise<AccessTokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;
  return verifyTokenAllowExpired(token);
}
