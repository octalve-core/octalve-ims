import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * ISS-0102 — PUT /api/users/[id] gains a status field (ACTIVE/SUSPENDED) with two new
 * server-side guardrails that didn't exist for any field on this route before: an admin can't
 * suspend themselves, and no field on a protected demo account (lib/auth/protected-emails.ts)
 * can be changed, closing a gap where the client hid the control but the API enforced nothing.
 */

const {
  getSessionFromRequest,
  getUserById,
  updateUserAdmin,
  deleteUserAdmin,
  isLastAdmin,
  createAuditLog,
  withRateLimit,
} = vi.hoisted(() => ({
  getSessionFromRequest: vi.fn(),
  getUserById: vi.fn(),
  updateUserAdmin: vi.fn(),
  deleteUserAdmin: vi.fn(),
  isLastAdmin: vi.fn(),
  createAuditLog: vi.fn(),
  withRateLimit: vi.fn(),
}));

vi.mock("@/utils/auth", () => ({ getSessionFromRequest }));
vi.mock("@/prisma/user-admin", () => ({
  getUserById,
  updateUserAdmin,
  deleteUserAdmin,
  isLastAdmin,
}));
vi.mock("@/prisma/audit-log", () => ({ createAuditLog }));
vi.mock("@/lib/api/rate-limit", () => ({
  withRateLimit,
  defaultRateLimits: { standard: {} },
}));
vi.mock("@/lib/cache", () => ({ scheduleInvalidateUserCaches: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { PUT, DELETE } from "./route";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/users/target-1", {
    method: "PUT",
    headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
    body: JSON.stringify(body),
  });
}

function deleteRequest() {
  return new NextRequest("http://localhost/api/users/target-1", {
    method: "DELETE",
    headers: { origin: "http://localhost", host: "localhost" },
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
  isLastAdmin.mockResolvedValue(false);
  deleteUserAdmin.mockResolvedValue({
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

/**
 * ISS-0094 — the UI's own canDelete flag used to require isOwner, which this route already
 * refuses outright ("Cannot delete your own account"), so "Delete User" could never actually
 * succeed for the one case the client allowed, and was disabled for every case that could.
 * These guards were real before this fix (self-delete, last-admin) or newly added by it
 * (protected demo account — a PUT comment claimed DELETE already had this; it didn't).
 */
describe("DELETE /api/users/[id] (ISS-0094)", () => {
  it("deletes an ordinary, unprotected, non-self user", async () => {
    const res = await DELETE(deleteRequest(), params("target-1"));
    expect(res.status).toBe(200);
    expect(deleteUserAdmin).toHaveBeenCalledWith("target-1");
  });

  it("refuses to let an admin delete themselves", async () => {
    getSessionFromRequest.mockResolvedValue({ id: "target-1", role: "admin" });
    const res = await DELETE(deleteRequest(), params("target-1"));
    expect(res.status).toBe(400);
    expect(deleteUserAdmin).not.toHaveBeenCalled();
  });

  it("refuses to delete a protected demo account", async () => {
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
    const res = await DELETE(deleteRequest(), params("target-1"));
    expect(res.status).toBe(400);
    expect(deleteUserAdmin).not.toHaveBeenCalled();
  });

  it("refuses to delete the only remaining admin", async () => {
    getUserById.mockResolvedValue({
      id: "target-1",
      email: "admin2@example.com",
      name: "Admin Two",
      username: null,
      role: "admin",
      image: null,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    isLastAdmin.mockResolvedValue(true);
    const res = await DELETE(deleteRequest(), params("target-1"));
    expect(res.status).toBe(400);
    expect(deleteUserAdmin).not.toHaveBeenCalled();
  });

  it("refuses when the target user doesn't exist", async () => {
    getUserById.mockResolvedValue(null);
    const res = await DELETE(deleteRequest(), params("target-1"));
    expect(res.status).toBe(404);
    expect(deleteUserAdmin).not.toHaveBeenCalled();
  });

  it("refuses a non-admin caller", async () => {
    getSessionFromRequest.mockResolvedValue({ id: "admin-1", role: "user" });
    const res = await DELETE(deleteRequest(), params("target-1"));
    expect(res.status).toBe(403);
    expect(deleteUserAdmin).not.toHaveBeenCalled();
  });
});
