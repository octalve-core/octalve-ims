import { describe, expect, it } from "vitest";
import { loginBodySchema, registerBodySchema } from "./auth";

describe("loginBodySchema", () => {
  it("accepts valid login", () => {
    expect(
      loginBodySchema.safeParse({
        email: "user@example.com",
        password: "secret",
      }).success,
    ).toBe(true);
  });

  it("rejects empty password", () => {
    expect(
      loginBodySchema.safeParse({
        email: "user@example.com",
        password: "",
      }).success,
    ).toBe(false);
  });
});

describe("registerBodySchema", () => {
  it("rejects invalid email", () => {
    expect(
      registerBodySchema.safeParse({
        name: "Test",
        email: "bad",
        password: "123456",
      }).success,
    ).toBe(false);
  });
});
