/**
 * Change Password API Route Handler — new route (the original codebase had no dedicated
 * password-change endpoint). Ported from Proplity, see
 * out/auth-system-port-plan.md. Revokes every active refresh token for the
 * user (same "log out everywhere" semantics as logout), forcing full
 * re-login on all devices/sessions after a password change.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/prisma/client";
import { logger } from "@/lib/logger";
import { scheduleInvalidateAuthCaches } from "@/lib/cache";
import { validateCSRF } from "@/lib/auth/csrf";
import { getServerSession } from "@/lib/auth/session";
import { clearAuthCookies } from "@/lib/auth/cookies";

export async function POST(request: NextRequest) {
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      currentPassword?: unknown;
      newPassword?: unknown;
    };
    if (
      typeof body.currentPassword !== "string" ||
      typeof body.newPassword !== "string" ||
      body.newPassword.length < 6
    ) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: session.sub } });
    if (!user || !user.password) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isValid = await bcrypt.compare(body.currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    const newHash = await bcrypt.hash(body.newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { password: newHash } }),
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    const cookieStore = await cookies();
    clearAuthCookies(cookieStore);
    await scheduleInvalidateAuthCaches();

    return NextResponse.json({
      success: true,
      message: "Password updated. Please log in again.",
    });
  } catch (error) {
    logger.error("Change password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
