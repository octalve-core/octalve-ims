import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * ISS-0054 — this route had a session check but no role gate, no rate
 * limit, and no input-length cap: any authenticated role (including the
 * external-buyer "client" role) could send an unbounded body to a
 * third-party LLM with no throttling.
 */

const { getSessionFromRequest, withRateLimit, isLlmConfigured, createChatCompletion, getWarehouseStockSummary } =
  vi.hoisted(() => ({
    getSessionFromRequest: vi.fn(),
    withRateLimit: vi.fn(),
    isLlmConfigured: vi.fn(),
    createChatCompletion: vi.fn(),
    getWarehouseStockSummary: vi.fn(),
  }));

vi.mock("@/utils/auth", () => ({ getSessionFromRequest }));
vi.mock("@/lib/api/rate-limit", () => ({
  withRateLimit,
  defaultRateLimits: { strict: {} },
}));
vi.mock("@/lib/ai", () => ({ createChatCompletion, isLlmConfigured }));
vi.mock("@/prisma/stock-allocation", () => ({ getWarehouseStockSummary }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { POST } from "./route";

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/insights", {
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
  withRateLimit.mockResolvedValue(null);
  isLlmConfigured.mockReturnValue(true);
  getWarehouseStockSummary.mockResolvedValue([]);
  createChatCompletion.mockResolvedValue({
    ok: true,
    provider: "test",
    data: { choices: [{ message: { content: "Reorder widget X." } }] },
  });
});

describe("POST /api/ai/insights", () => {
  it("403s the external-buyer 'client' role", async () => {
    getSessionFromRequest.mockResolvedValue({ id: "u1", role: "client" });
    const res = await POST(request({ summary: "low stock on widgets" }));
    expect(res.status).toBe(403);
    expect(createChatCompletion).not.toHaveBeenCalled();
  });

  it("applies a per-user rate limit before calling the LLM", async () => {
    getSessionFromRequest.mockResolvedValue({ id: "u1", role: "admin" });
    await POST(request({ summary: "low stock on widgets" }));
    expect(withRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "u1",
    );
  });

  it("429s when the rate limiter says no", async () => {
    getSessionFromRequest.mockResolvedValue({ id: "u1", role: "admin" });
    withRateLimit.mockResolvedValue(new Response(null, { status: 429 }));
    const res = await POST(request({ summary: "low stock on widgets" }));
    expect(res.status).toBe(429);
    expect(createChatCompletion).not.toHaveBeenCalled();
  });

  it("rejects a summary over the 2000-char cap", async () => {
    getSessionFromRequest.mockResolvedValue({ id: "u1", role: "admin" });
    const res = await POST(request({ summary: "x".repeat(2001) }));
    expect(res.status).toBe(400);
    expect(createChatCompletion).not.toHaveBeenCalled();
  });

  it("allows admin through to the LLM", async () => {
    getSessionFromRequest.mockResolvedValue({ id: "u1", role: "admin" });
    const res = await POST(request({ summary: "low stock on widgets" }));
    expect(res.status).toBe(200);
    expect(createChatCompletion).toHaveBeenCalled();
  });
});
