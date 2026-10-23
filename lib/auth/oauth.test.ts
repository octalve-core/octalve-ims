import { describe, expect, it } from "vitest";
import { isVerifiedGoogleEmail } from "./oauth";

/**
 * ISS-0007 — Google OAuth sign-in used to trust `email` to look up (and
 * silently link sign-in to, then mint a session for) an existing account
 * with no check that Google verified it, letting an attacker with an
 * arbitrary unverified secondary email on their own Google account take
 * over any existing IMS account sharing that email.
 */
describe("isVerifiedGoogleEmail (ISS-0007)", () => {
  it("accepts only a strict boolean true", () => {
    expect(isVerifiedGoogleEmail(true)).toBe(true);
  });

  it("rejects false", () => {
    expect(isVerifiedGoogleEmail(false)).toBe(false);
  });

  it("rejects a missing field", () => {
    expect(isVerifiedGoogleEmail(undefined)).toBe(false);
  });

  it("rejects a truthy-looking non-boolean", () => {
    expect(isVerifiedGoogleEmail("true")).toBe(false);
    expect(isVerifiedGoogleEmail(1)).toBe(false);
  });
});
