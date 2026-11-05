import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { validateCSRF } from "@/lib/auth/csrf";

function request(headers: Record<string, string>) {
  return new NextRequest("http://localhost/api/whatever", {
    method: "POST",
    headers,
  });
}

describe("validateCSRF", () => {
  it("passes when Origin matches Host", () => {
    expect(
      validateCSRF(request({ origin: "http://localhost:3000", host: "localhost:3000" })),
    ).toBe(true);
  });

  it("fails when Origin's host differs from the request Host (ISS-0031)", () => {
    expect(
      validateCSRF(request({ origin: "http://attacker.example", host: "localhost:3000" })),
    ).toBe(false);
  });

  it("falls back to Referer when Origin is absent, and matches", () => {
    expect(
      validateCSRF(
        request({ referer: "http://localhost:3000/some/page", host: "localhost:3000" }),
      ),
    ).toBe(true);
  });

  it("falls back to Referer and fails on a mismatched host", () => {
    expect(
      validateCSRF(
        request({ referer: "http://attacker.example/some/page", host: "localhost:3000" }),
      ),
    ).toBe(false);
  });

  it("fails closed when neither Origin nor Referer is present", () => {
    expect(validateCSRF(request({ host: "localhost:3000" }))).toBe(false);
  });

  it("fails closed when Host itself is missing", () => {
    expect(validateCSRF(request({ origin: "http://localhost:3000" }))).toBe(false);
  });

  it("prefers X-Forwarded-Host over Host when both are present", () => {
    expect(
      validateCSRF(
        request({
          origin: "http://public.example",
          host: "internal:3000",
          "x-forwarded-host": "public.example",
        }),
      ),
    ).toBe(true);
  });

  it("fails on a malformed Origin header instead of throwing", () => {
    expect(() =>
      validateCSRF(request({ origin: "not a url", host: "localhost:3000" })),
    ).not.toThrow();
    expect(validateCSRF(request({ origin: "not a url", host: "localhost:3000" }))).toBe(false);
  });
});
