/**
 * User Detail API Route Handler (admin User Management)
 * GET /api/users/:id — fetch one user (admin-only)
 * PUT /api/users/:id — update user role/name (admin-only)
 * DELETE /api/users/:id — delete user (admin-only)
 */

import { NextRequest, NextResponse } from "next/server";
import { validateCSRF } from "@/lib/auth/csrf";
import { getSessionFromRequest } from "@/utils/auth";
import { logger } from "@/lib/logger";
import {
  getUserById,
  updateUserAdmin,
  deleteUserAdmin,
} from "@/prisma/user-admin";
import { updateUserAdminSchema } from "@/lib/validations";
import { withRateLimit, defaultRateLimits } from "@/lib/api/rate-limit";
import { createAuditLog } from "@/prisma/audit-log";
import { isProtectedEmail } from "@/lib/auth/protected-emails";
import type { UpdateUserAdminInput } from "@/types";
import {
  getUserDetailForPage,
  transformUserForAdmin,
} from "@/lib/server/user-detail-data";
import { scheduleInvalidateUserCaches } from "@/lib/cache";

/**
 * GET /api/users/:id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const rateLimitResponse = await withRateLimit(
      request,
      defaultRateLimits.standard,
    );
    if (rateLimitResponse) return rateLimitResponse;

    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const detail = await getUserDetailForPage(
      { id: session.id, role: session.role },
      id,
    );
    if (!detail) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    logger.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/users/:id
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const rateLimitResponse = await withRateLimit(
      request,
      defaultRateLimits.standard,
    );
    if (rateLimitResponse) return rateLimitResponse;

    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await getUserById(id);
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateUserAdminSchema.safeParse(body);
    if (!parsed.success) {
      logger.warn("Invalid user update data", {
        errors: parsed.error.errors,
      });
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.errors },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // ISS-0102 — a status change (and only a status change) is refused for your own account or
    // a protected demo account (lib/auth/protected-emails.ts), same accounts DELETE already
    // refuses for yourself and the UI already locks role/name edits for. Role/name on these
    // accounts are unaffected by this check.
    if (data.status !== undefined) {
      if (id === session.id) {
        return NextResponse.json(
          { error: "Cannot change your own status" },
          { status: 400 },
        );
      }
      if (isProtectedEmail(existing.email)) {
        return NextResponse.json(
          { error: "Cannot change this account's status" },
          { status: 400 },
        );
      }
    }

    const updatePayload: UpdateUserAdminInput = {};
    if (data.role !== undefined) updatePayload.role = data.role;
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.status !== undefined) updatePayload.status = data.status;

    const updated = await updateUserAdmin(id, updatePayload);

    createAuditLog({
      userId: session.id,
      action: "update",
      entityType: "user",
      entityId: id,
    }).catch(() => {});
    await scheduleInvalidateUserCaches();
    return NextResponse.json(transformUserForAdmin(updated));
  } catch (error) {
    logger.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/users/:id
 * Delete a user (admin-only). Cannot delete self.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const rateLimitResponse = await withRateLimit(
      request,
      defaultRateLimits.standard,
    );
    if (rateLimitResponse) return rateLimitResponse;

    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Prevent admin from deleting themselves
    if (id === session.id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 },
      );
    }

    const existing = await getUserById(id);
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const deleted = await deleteUserAdmin(id);

    createAuditLog({
      userId: session.id,
      action: "delete",
      entityType: "user",
      entityId: id,
    }).catch(() => {});
    await scheduleInvalidateUserCaches();
    return NextResponse.json(transformUserForAdmin(deleted));
  } catch (error) {
    logger.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 },
    );
  }
}
