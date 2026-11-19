import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * ISS-0070 — the OAuth CSRF state used to be built from Math.random(),
 * which is not cryptographically secure. Proves it's now unpredictable
 * (two calls never collide) and URL-safe (base64url: no +, /, or =).
 */

const { isGoogleOAuthConfigured, getGoogleOAuthUrl } = vi.hoisted(() => ({
  isGoogleOAuthConfigured: vi.fn(),
  getGoogleOAuthUrl: vi.fn(),
}));

vi.mock("@/lib/auth/oauth", () => ({ isGoogleOAuthConfigured, getGoogleOAuthUrl }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { GET } from "./route";

function request(): NextRequest {
  return new NextRequest("http://localhost/api/auth/oauth/google");
}

describe("GET /api/auth/oauth/google state generation", () => {
  it("generates a different state on every call", async () => {
    isGoogleOAuthConfigured.mockReturnValue(true);
    getGoogleOAuthUrl.mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth");

    const res1 = await GET(request());
    const state1 = res1.cookies.get("oauth_state")?.value;
    const res2 = await GET(request());
    const state2 = res2.cookies.get("oauth_state")?.value;

    expect(state1).toBeTruthy();
    expect(state2).toBeTruthy();
    expect(state1).not.toBe(state2);
  });

  it("the state is base64url (no +, /, or = characters Math.random's base64 could produce)", async () => {
    isGoogleOAuthConfigured.mockReturnValue(true);
    getGoogleOAuthUrl.mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth");

    const res = await GET(request());
    const state = res.cookies.get("oauth_state")?.value ?? "";
    expect(state.length).toBeGreaterThan(0);
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
