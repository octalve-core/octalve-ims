import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "./session";
import type { AccessTokenPayload } from "./jwt";

/**
 * Route-handler wrapper (ported from Proplity's lib/api/withAuth.ts, see
 * docs/auth-system-port-plan.md): requires a valid session, optionally
 * requires the session's role to be one of `roles`. Composes with, doesn't
 * replace, lib/auth/can.ts — use withAuth for "must be logged in, maybe
 * must have role X" at the top of a route, and can() inside the handler
 * for tier-aware fine-grained permission checks.
 */
export function withAuth<Ctx = unknown>(
  handler: (
    req: NextRequest,
    ctx: Ctx,
    auth: { session: AccessTokenPayload }
  ) => Promise<Response>,
  opts?: { roles?: string[] }
) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (opts?.roles && !opts.roles.includes(session.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(req, ctx, { session });
  };
}
