import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * ISS-0036 — DELETE had a session check but no ownership check: any
 * logged-in user could delete any product's ImageKit file by fileId alone.
 */

const {
  getSessionFromRequest,
  withRateLimit,
  prismaMock,
  deleteProductImageFromImageKit,
} = vi.hoisted(() => ({
  getSessionFromRequest: vi.fn(),
  withRateLimit: vi.fn(),
  prismaMock: { product: { findFirst: vi.fn() } },
  deleteProductImageFromImageKit: vi.fn(),
}));

vi.mock("@/utils/auth", () => ({ getSessionFromRequest }));
vi.mock("@/lib/api/rate-limit", () => ({
  withRateLimit,
  defaultRateLimits: { standard: {} },
}));
vi.mock("@/prisma/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/imagekit", () => ({
  uploadProductImageToImageKit: vi.fn(),
  deleteProductImageFromImageKit,
}));
vi.mock("@/lib/cache", () => ({ scheduleInvalidateProductCaches: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { DELETE } from "./route";

function request(fileId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/products/image?fileId=${fileId}`,
    {
      method: "DELETE",
      headers: { origin: "http://localhost", host: "localhost" },
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  withRateLimit.mockResolvedValue(null);
  deleteProductImageFromImageKit.mockResolvedValue(undefined);
});

describe("DELETE /api/products/image", () => {
  it("404s when the fileId isn't referenced by any product", async () => {
    getSessionFromRequest.mockResolvedValue({ id: "u1", role: "user" });
    prismaMock.product.findFirst.mockResolvedValue(null);
    const res = await DELETE(request("file_unknown"));
    expect(res.status).toBe(404);
    expect(deleteProductImageFromImageKit).not.toHaveBeenCalled();
  });

  it("403s when a non-owner, non-admin tries to delete another user's product image", async () => {
    getSessionFromRequest.mockResolvedValue({ id: "attacker", role: "user" });
    prismaMock.product.findFirst.mockResolvedValue({ userId: "owner" });
    const res = await DELETE(request("file_123"));
    expect(res.status).toBe(403);
    expect(deleteProductImageFromImageKit).not.toHaveBeenCalled();
  });

  it("allows the owning user to delete their own product's image", async () => {
    getSessionFromRequest.mockResolvedValue({ id: "owner", role: "user" });
    prismaMock.product.findFirst.mockResolvedValue({ userId: "owner" });
    const res = await DELETE(request("file_123"));
    expect(res.status).toBe(200);
    expect(deleteProductImageFromImageKit).toHaveBeenCalledWith("file_123");
  });

  it("allows admin to delete any product's image", async () => {
    getSessionFromRequest.mockResolvedValue({ id: "admin1", role: "admin" });
    prismaMock.product.findFirst.mockResolvedValue({ userId: "someone-else" });
    const res = await DELETE(request("file_123"));
    expect(res.status).toBe(200);
    expect(deleteProductImageFromImageKit).toHaveBeenCalledWith("file_123");
  });
});
