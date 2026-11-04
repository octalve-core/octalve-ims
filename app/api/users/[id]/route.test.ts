import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * ISS-0102 — PUT /api/users/[id] gains a status field (ACTIVE/SUSPENDED) with two new
 * server-side guardrails that didn't exist for any field on this route before: an admin can't
 * suspend themselves, and no field on a protected demo account (lib/auth/protected-emails.ts)
 * can be changed, closing a gap where the client hid the control but the API enforced nothing.
 */

const { getSessionFromRequest, getUserById, updateUserAdmin, createAuditLog, withRateLimit } =
  vi.hoisted(() => ({
    getSessionFromRequest: vi.fn(),
    getUserById: vi.fn(),
    updateUserAdmin: vi.fn(),
    createAuditLog: vi.fn(),
    withRateLimit: vi.fn(),
  }));

vi.mock("@/utils/auth", () => ({ getSessionFromRequest }));
vi.mock("@/prisma/user-admin", () => ({
  getUserById,
  updateUserAdmin,
  deleteUserAdmin: vi.fn(),
}));
vi.mock("@/prisma/audit-log", () => ({ createAuditLog }));
vi.mock("@/lib/api/rate-limit", () => ({
  withRateLimit,
  defaultRateLimits: { standard: {} },
}));
vi.mock("@/lib/cache", () => ({ scheduleInvalidateUserCaches: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { PUT } from "./route";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/users/target-1", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  withRateLimit.mockResolvedValue(null);
  createAuditLog.mockResolvedValue(undefined);
  getSessionFromRequest.mockResolvedValue({ id: "admin-1", role: "admin" });
  getUserById.mockResolvedValue({
    id: "target-1",
    email: "regular@example.com",
    name: "Regular User",
    username: null,
    role: "user",
    image: null,
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  updateUserAdmin.mockResolvedValue({
    id: "target-1",
    email: "regular@example.com",
    name: "Regular User",
    username: null,
    role: "user",
    image: null,
    status: "SUSPENDED",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
});

describe("PUT /api/users/[id] — status (ISS-0102)", () => {
  it("suspends an ordinary, unprotected user", async () => {
    const res = await PUT(request({ status: "SUSPENDED" }), params("target-1"));
    expect(res.status).toBe(200);
    expect(updateUserAdmin).toHaveBeenCalledWith("target-1", { status: "SUSPENDED" });
  });

  it("refuses to let an admin suspend themselves", async () => {
    getSessionFromRequest.mockResolvedValue({ id: "target-1", role: "admin" });
    getUserById.mockResolvedValue({
      id: "target-1",
      email: "admin-self@example.com",
      name: "Self",
      username: null,
      role: "admin",
      image: null,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await PUT(request({ status: "SUSPENDED" }), params("target-1"));
    expect(res.status).toBe(400);
    expect(updateUserAdmin).not.toHaveBeenCalled();
  });

  it("refuses to change the status of a protected demo account", async () => {
    getUserById.mockResolvedValue({
      id: "target-1",
      email: "test@admin.com",
      name: "Protected",
      username: null,
      role: "admin",
      image: null,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await PUT(request({ status: "SUSPENDED" }), params("target-1"));
    expect(res.status).toBe(400);
    expect(updateUserAdmin).not.toHaveBeenCalled();
  });

  it("still allows a protected account's name to be edited — only status is locked by this guard", async () => {
    getUserById.mockResolvedValue({
      id: "target-1",
      email: "test@admin.com",
      name: "Protected",
      username: null,
      role: "admin",
      image: null,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await PUT(request({ name: "New Name" }), params("target-1"));
    expect(res.status).toBe(200);
    expect(updateUserAdmin).toHaveBeenCalledWith("target-1", { name: "New Name" });
  });

  it("still allows an admin to edit their own name — only status is self-blocked", async () => {
    getSessionFromRequest.mockResolvedValue({ id: "target-1", role: "admin" });
    const res = await PUT(request({ name: "New Name" }), params("target-1"));
    expect(res.status).toBe(200);
    expect(updateUserAdmin).toHaveBeenCalledWith("target-1", { name: "New Name" });
  });
});
