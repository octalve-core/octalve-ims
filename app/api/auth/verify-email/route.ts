/**
 * Verify Email API Route Handler — new route (the original codebase had no email
 * verification flow at all; ported from Proplity, see
 * docs/auth-system-port-plan.md). Deliberately CSRF-exempt: reached via an
 * emailed link, a legitimate cross-origin-by-nature flow that can't rely
 * on a pre-existing same-origin session.
 */

import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/prisma/client";
import { logger } from "@/lib/logger";
import { scheduleInvalidateAuthCaches } from "@/lib/cache";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      token?: unknown;
      password?: unknown;
    };

    if (typeof body.token !== "string" || body.token.length === 0) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }
    if (body.password !== undefined) {
      if (typeof body.password !== "string" || body.password.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }
    }

    const tokenHash = crypto.createHash("sha256").update(body.token).digest("hex");
    const record = await prisma.verificationToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      );
    }

    // Note: the original User model has no PENDING_VERIFICATION/ACTIVE status
    // field (unlike Proplity's) — registration already creates fully active
    // users directly, so there's no "activation" step to perform here. This
    // route currently only covers the "set a password for an invited user"
    // case; add a status transition here if/when an invite-flow feature
    // needs one.
    if (typeof body.password === "string") {
      const passwordHash = await bcrypt.hash(body.password, 12);
      await prisma.$transaction([
        prisma.user.update({
          where: { id: record.userId },
          data: { password: passwordHash },
        }),
        prisma.verificationToken.delete({ where: { id: record.id } }),
      ]);
    } else {
      await prisma.verificationToken.delete({ where: { id: record.id } });
    }
    await scheduleInvalidateAuthCaches();

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Verify email error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
