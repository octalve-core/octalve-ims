import { describe, expect, it } from "vitest";
import { isProtectedEmail, PROTECTED_EMAILS } from "./protected-emails";

describe("isProtectedEmail (ISS-0102)", () => {
  it("matches every protected demo account", () => {
    for (const email of PROTECTED_EMAILS) {
      expect(isProtectedEmail(email)).toBe(true);
    }
  });

  it("is case-insensitive", () => {
    expect(isProtectedEmail("TEST@ADMIN.COM")).toBe(true);
  });

  it("does not match an ordinary account", () => {
    expect(isProtectedEmail("ada@example.com")).toBe(false);
  });

  it("does not match null or undefined", () => {
    expect(isProtectedEmail(null)).toBe(false);
    expect(isProtectedEmail(undefined)).toBe(false);
  });
});
