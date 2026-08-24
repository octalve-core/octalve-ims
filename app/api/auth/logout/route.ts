/**
 * Logout API Route Handler
 * Ported from Proplity, see docs/auth-system-port-plan.md. Can't read
 * refresh_token directly (it's path-scoped away from this route — see
 * lib/auth/cookies.ts), so revokes by userId via the access-token session
 * instead: same "log out everywhere" blast radius as change-password, not
 * just the current session/family.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createCorsHeaders, handleCorsPreflight } from "@/lib/api/cors";
import { logger } from "@/lib/logger";
import { prisma } from "@/prisma/client";
import { validateCSRF } from "@/lib/auth/csrf";
import { getServerSession } from "@/lib/auth/session";
import { clearAuthCookies } from "@/lib/auth/cookies";

/**
 * POST /api/auth/logout
 * Clear session cookies and logout user everywhere
 */
export async function POST(request: NextRequest) {
  const responseHeaders = createCorsHeaders(request);

  if (!validateCSRF(request)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: responseHeaders }
    );
  }

  try {
    const session = await getServerSession();
    if (session) {
      await prisma.refreshToken
        .updateMany({
          where: { userId: session.sub, revokedAt: null },
          data: { revokedAt: new Date() },
        })
        .catch((error) => {
          logger.error("Failed to revoke refresh tokens on logout:", error);
        });
    }

    const cookieStore = await cookies();
    clearAuthCookies(cookieStore);

    return NextResponse.json(
      { success: true },
      { status: 200, headers: responseHeaders }
    );
  } catch (error) {
    logger.error("Logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/auth/logout
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}
