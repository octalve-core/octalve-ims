/**
 * Register API Route Handler
 * Auth mechanics ported from Proplity — see docs/auth-system-port-plan.md.
 * Rate limiting reuses the existing Redis-backed lib/api/rate-limit.ts
 * (same 5/60s "auth" preset Proplity used) rather than porting a second,
 * DB-backed limiter alongside it.
 */

import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { registerSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";
import { scheduleInvalidateAuthCaches } from "@/lib/cache";
import { prisma } from "@/prisma/client";
import { validateCSRF } from "@/lib/auth/csrf";
import { signAccessToken } from "@/lib/auth/jwt";
import { setAuthCookies, REFRESH_DAYS } from "@/lib/auth/cookies";
import { withRateLimit, defaultRateLimits } from "@/lib/api/rate-limit";

/**
 * POST /api/auth/register
 * Register a new user
 */
export async function POST(request: NextRequest) {
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimited = await withRateLimit(request, defaultRateLimits.auth);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();

    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      logger.warn("Invalid registration data", {
        errors: validationResult.error.errors,
      });
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const { name, email, password } = validationResult.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists. Please sign in instead." },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate a unique username (Postgres unique index is sparse-by-default
    // w.r.t. NULLs, so — unlike the old Mongo path this replaces — no
    // dropIndex/createIndex self-heal is needed for googleId uniqueness).
    const baseUsername = email.split("@")[0];
    let username = baseUsername;
    let counter = 1;
    while (await prisma.user.findFirst({ where: { username } })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    // New signups get admin role for full manipulation power (existing
    // original product decision, unchanged by the auth port).
    const createdUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        username,
        role: "admin",
      },
    });

    const familyId = crypto.randomUUID();
    const rawRefreshToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawRefreshToken)
      .digest("hex");
    await prisma.refreshToken.create({
      data: {
        userId: createdUser.id,
        tokenHash,
        familyId,
        expiresAt: new Date(Date.now() + REFRESH_DAYS.default * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = await signAccessToken({
      sub: createdUser.id,
      role: createdUser.role ?? "admin",
    });

    const cookieStore = await cookies();
    setAuthCookies(
      cookieStore,
      accessToken,
      rawRefreshToken,
      REFRESH_DAYS.default * 24 * 60 * 60
    );

    await scheduleInvalidateAuthCaches();
    return NextResponse.json(
      {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("Registration error:", error);

    const message =
      error instanceof Error ? error.message : "An unknown error occurred";

    return NextResponse.json(
      { error: `Registration failed: ${message}` },
      { status: 500 }
    );
  }
}
