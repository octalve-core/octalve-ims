/**
 * Login API Route Handler
 * Auth mechanics ported from Proplity — see docs/auth-system-port-plan.md.
 * No longer returns the access token in the response body (the old
 * `session_id` cookie was httpOnly server-side but the token was ALSO
 * echoed back in the JSON body, and contexts/auth-context.tsx used to
 * manually re-set it into a readable cookie + localStorage — an XSS-
 * exposed pattern this port removes). The two auth cookies are set
 * entirely server-side via Set-Cookie; the client never handles the
 * token value.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { loginSchema } from "@/lib/validations";
import { createCorsHeaders, handleCorsPreflight } from "@/lib/api/cors";
import { logger } from "@/lib/logger";
import { prisma } from "@/prisma/client";
import { validateCSRF } from "@/lib/auth/csrf";
import { signAccessToken } from "@/lib/auth/jwt";
import { setAuthCookies, REFRESH_DAYS } from "@/lib/auth/cookies";
import {
  ACCOUNT_MAX_ATTEMPTS,
  getClientIp,
  releaseAttempt,
  reserveAttempt,
  tooManyAttempts,
} from "@/lib/auth/rate-limit-db";
import { ACCOUNT_STATUS } from "@/lib/auth/account-status";

// A fixed bcrypt hash (cost 12, matching real password hashes) that no password produces. It is
// compared against whenever there is no real hash to compare (unknown email, or an account with
// no password), so the time taken does not tell an attacker which emails have accounts
// (ISS-0032). bcrypt's run time is set by its cost factor, not by the input.
const DUMMY_PASSWORD_HASH =
  "$2b$12$Ap7iynbmTBWuWC3S1WvT..O4K2cs/uJW2VBW265CJTYPUsltUghEq";

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
export async function POST(request: NextRequest) {
  const responseHeaders = createCorsHeaders(request);

  if (!validateCSRF(request)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: responseHeaders },
    );
  }

  try {
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400, headers: responseHeaders },
      );
    }

    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      logger.warn("Invalid login data", {
        errors: validationResult.error.errors,
      });
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validationResult.error.errors,
        },
        { status: 400, headers: responseHeaders },
      );
    }

    const { email, password } = validationResult.data;
    const rememberMe =
      typeof (body as { rememberMe?: unknown }).rememberMe === "boolean"
        ? (body as { rememberMe: boolean }).rememberMe
        : true;

    // Two budgets, both taken before the slow password check (ISS-0027). Per address and email,
    // so one person's guesses on one account do not lock the address out of others; and per
    // account across every address, so a distributed guesser does not get a fresh allowance from
    // each one. The account budget is the larger, so a victim is not easily locked out by a
    // stranger's bad guesses. Both are handed back on success: only failures count.
    const normalizedEmail = email.toLowerCase();
    const byAddress = await reserveAttempt(`login:${getClientIp(request)}:${normalizedEmail}`);
    if (!byAddress.allowed) {
      return NextResponse.json(tooManyAttempts(byAddress), {
        status: 429,
        headers: responseHeaders,
      });
    }
    const byAccount = await reserveAttempt(
      `login-account/${normalizedEmail}`,
      ACCOUNT_MAX_ATTEMPTS,
    );
    if (!byAccount.allowed) {
      await releaseAttempt(byAddress.attemptId);
      return NextResponse.json(tooManyAttempts(byAccount), {
        status: 429,
        headers: responseHeaders,
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    const isPasswordValid = await bcrypt.compare(
      password,
      user?.password ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !user.password || !isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401, headers: responseHeaders },
      );
    }

    await releaseAttempt(byAddress.attemptId);
    await releaseAttempt(byAccount.attemptId);

    // Decision (a): checked only after the real password has been confirmed correct, so a
    // guesser learns nothing about account status until they already have the password — the
    // same enumeration-avoidance invariant as the credential check above (ISS-0032).
    if (user.status === ACCOUNT_STATUS.SUSPENDED) {
      return NextResponse.json(
        { error: "This account has been suspended. Contact an administrator for help." },
        { status: 403, headers: responseHeaders },
      );
    }
    if (user.status === ACCOUNT_STATUS.PENDING_VERIFICATION) {
      return NextResponse.json(
        {
          error:
            "Please verify your email before signing in. Check your inbox for the verification link.",
        },
        { status: 403, headers: responseHeaders },
      );
    }

    const userRole = user.role ?? "user";

    const familyId = crypto.randomUUID();
    const rawRefreshToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawRefreshToken)
      .digest("hex");
    const refreshDays = rememberMe ? REFRESH_DAYS.rememberMe : REFRESH_DAYS.short;
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        familyId,
        expiresAt: new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = await signAccessToken({ sub: user.id, role: userRole });

    const response = NextResponse.json(
      {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole,
      },
      { status: 200, headers: responseHeaders },
    );

    const cookieStore = await cookies();
    setAuthCookies(
      cookieStore,
      accessToken,
      rawRefreshToken,
      refreshDays * 24 * 60 * 60
    );

    return response;
  } catch (error) {
    logger.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * OPTIONS /api/auth/login
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}
