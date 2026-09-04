import { describe, expect, it } from "vitest";
import {
  loginBodySchema,
  registerBodySchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth";

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

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    expect(
      forgotPasswordSchema.safeParse({ email: "user@example.com" }).success,
    ).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "not-an-email" }).success).toBe(
      false,
    );
  });

  it("rejects a missing email", () => {
    expect(forgotPasswordSchema.safeParse({}).success).toBe(false);
  });

  it("strips fields beyond email (no privilege-field smuggling)", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "user@example.com",
      role: "admin",
      userId: "some-other-user-id",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ email: "user@example.com" });
    }
  });
});

describe("resetPasswordSchema", () => {
  it("accepts a valid token + password", () => {
    expect(
      resetPasswordSchema.safeParse({
        token: "a".repeat(64),
        password: "NewPassw0rd!",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty token", () => {
    expect(
      resetPasswordSchema.safeParse({ token: "", password: "NewPassw0rd!" })
        .success,
    ).toBe(false);
  });

  it("rejects a missing token", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "NewPassw0rd!" }).success,
    ).toBe(false);
  });

  it("rejects a password shorter than 6 characters", () => {
    expect(
      resetPasswordSchema.safeParse({ token: "a".repeat(64), password: "12345" })
        .success,
    ).toBe(false);
  });

  it("rejects a password longer than 100 characters", () => {
    expect(
      resetPasswordSchema.safeParse({
        token: "a".repeat(64),
        password: "a".repeat(101),
      }).success,
    ).toBe(false);
  });

  it("strips fields beyond token/password (no privilege-field smuggling)", () => {
    const result = resetPasswordSchema.safeParse({
      token: "a".repeat(64),
      password: "NewPassw0rd!",
      role: "admin",
      userId: "some-other-user-id",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        token: "a".repeat(64),
        password: "NewPassw0rd!",
      });
    }
  });
});
