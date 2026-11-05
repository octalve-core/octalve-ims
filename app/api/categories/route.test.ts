import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * ISS-0031 — representative sample: confirms the CSRF guard added to this
 * route (and the ~25 others it was mechanically applied to) actually
 * short-circuits before any business logic runs, on a route the walkthrough
 * doesn't already cover with its own test file.
 */

vi.mock("@/utils/auth", () => ({ getSessionFromRequest: vi.fn() }));
vi.mock("@/prisma/client", () => ({ prisma: {} }));
vi.mock("@/prisma/audit-log", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/cache", () => ({ scheduleInvalidateCategoryCaches: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { POST } from "@/app/api/categories/route";
import { getSessionFromRequest } from "@/utils/auth";

function request(headers: Record<string, string>) {
  return new NextRequest("http://localhost/api/categories", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ name: "Snacks" }),
  });
}

describe("POST /api/categories — CSRF guard", () => {
  it("rejects a cross-origin request before touching the session", async () => {
    const res = await POST(
      request({ origin: "http://attacker.example", host: "localhost" }),
    );
    expect(res.status).toBe(403);
    expect(getSessionFromRequest).not.toHaveBeenCalled();
  });

  it("rejects a request with no Origin/Referer at all", async () => {
    const res = await POST(request({ host: "localhost" }));
    expect(res.status).toBe(403);
  });

  it("proceeds past the guard on a same-origin request", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(request({ origin: "http://localhost", host: "localhost" }));
    // Falls through to the real auth check next, not the CSRF guard.
    expect(res.status).toBe(401);
  });
});
