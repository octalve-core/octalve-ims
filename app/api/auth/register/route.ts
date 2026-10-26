/**
 * Register API Route Handler
 * Auth mechanics ported from Proplity — see docs/auth-system-port-plan.md.
 * Rate limiting uses the database-backed lib/auth/rate-limit-db.ts (ISS-0027); the Redis limiter
 * in lib/api/rate-limit.ts allows everything when Redis is missing, which is wrong for auth.
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
import { getClientIp, reserveAttempt, tooManyAttempts } from "@/lib/auth/rate-limit-db";

/**
 * POST /api/auth/register
 * Register a new user
 */
export async function POST(request: NextRequest) {
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Per address; every registration counts (ISS-0027). Uses the database limiter, which cannot
  // switch itself off when Redis is missing.
  const reservation = await reserveAttempt(`register:${getClientIp(request)}`);
  if (!reservation.allowed) {
    return NextResponse.json(tooManyAttempts(reservation), { status: 429 });
  }

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

    // ISS-0001: self-registration used to grant "admin" unconditionally,
    // letting any anonymous visitor mint a global admin account — one with
    // full, unscoped access to every user, order and invoice in the
    // deployment (see docs/issues/README.md). "user" is the least-privileged
    // legacy role (lib/auth/can.ts) and already has everything a new
    // self-service signup actually needs: view/create/edit on Products,
    // Stock, Orders, Invoicing, and view/create on SupportTickets. Admin
    // accounts must be provisioned out-of-band (seed scripts, or a future
    // invite flow), never handed out by self-registration.
    const createdUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        username,
        role: "user",
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

    // ISS-0001: fallback role claim must not be "admin" either.
    const accessToken = await signAccessToken({
      sub: createdUser.id,
      role: createdUser.role ?? "user",
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

    // The cause is logged above; the caller gets no database or library error text (ISS-0032).
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
