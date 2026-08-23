/**
 * Login API Route Handler
 * Auth mechanics ported from Proplity — see out/auth-system-port-plan.md.
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
import { withRateLimit, defaultRateLimits } from "@/lib/api/rate-limit";

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

    const rateLimited = await withRateLimit(
      request,
      defaultRateLimits.auth,
      `${email}`
    );
    if (rateLimited) return rateLimited;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401, headers: responseHeaders },
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401, headers: responseHeaders },
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
