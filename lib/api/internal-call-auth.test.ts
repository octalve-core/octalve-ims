import { describe, expect, it } from "vitest";
import { isAuthorizedInternalCall } from "./internal-call-auth";

describe("isAuthorizedInternalCall", () => {
  it("rejects when INTERNAL_API_KEY is unset, even for the literal 'Bearer undefined' header (Failure: ISS-0004)", () => {
    expect(isAuthorizedInternalCall("Bearer undefined", undefined)).toBe(false);
  });

  it("rejects when INTERNAL_API_KEY is an empty string", () => {
    expect(isAuthorizedInternalCall("Bearer ", "")).toBe(false);
  });

  it("rejects a non-matching header when the key is set", () => {
    expect(isAuthorizedInternalCall("Bearer wrong-key", "secret-key")).toBe(false);
  });

  it("rejects a null header", () => {
    expect(isAuthorizedInternalCall(null, "secret-key")).toBe(false);
  });

  it("accepts the exact matching header when the key is set", () => {
    expect(isAuthorizedInternalCall("Bearer secret-key", "secret-key")).toBe(true);
  });
});
