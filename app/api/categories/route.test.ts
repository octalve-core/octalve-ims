import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * ISS-0055 — categories/suppliers/warehouses mutations never called can()
 * or any role check at all: any authenticated role, including the
 * external-buyer "client" role, could create/edit/delete them. Tested here
 * for categories; suppliers/warehouses wire the same helper identically.
 */

const { getSessionFromRequest, prismaMock, createAuditLog } = vi.hoisted(() => ({
  getSessionFromRequest: vi.fn(),
  prismaMock: { category: { create: vi.fn() } },
  createAuditLog: vi.fn(),
}));

vi.mock("@/utils/auth", () => ({ getSessionFromRequest }));
vi.mock("@/prisma/client", () => ({ prisma: prismaMock }));
vi.mock("@/prisma/audit-log", () => ({ createAuditLog }));
vi.mock("@/lib/cache", () => ({ scheduleInvalidateCategoryCaches: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { POST } from "./route";

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/categories", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      host: "localhost",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.category.create.mockResolvedValue({
    id: "c1",
    name: "Snacks",
    userId: "u1",
    status: true,
  });
  createAuditLog.mockResolvedValue(undefined);
});

describe("POST /api/categories role gate", () => {
  it("403s the external-buyer 'client' role", async () => {
    getSessionFromRequest.mockResolvedValue({ id: "u1", role: "client" });
    const res = await POST(request({ name: "Snacks" }));
    expect(res.status).toBe(403);
    expect(prismaMock.category.create).not.toHaveBeenCalled();
  });

  it("403s the 'supplier' role", async () => {
    getSessionFromRequest.mockResolvedValue({ id: "u1", role: "supplier" });
    const res = await POST(request({ name: "Snacks" }));
    expect(res.status).toBe(403);
    expect(prismaMock.category.create).not.toHaveBeenCalled();
  });

  it("allows 'admin' through", async () => {
    getSessionFromRequest.mockResolvedValue({ id: "u1", role: "admin" });
    const res = await POST(request({ name: "Snacks" }));
    expect(res.status).toBe(201);
    expect(prismaMock.category.create).toHaveBeenCalled();
  });

  it("allows 'user' through", async () => {
    getSessionFromRequest.mockResolvedValue({ id: "u1", role: "user" });
    const res = await POST(request({ name: "Snacks" }));
    expect(res.status).toBe(201);
  });
});
