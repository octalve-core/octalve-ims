import { describe, expect, it } from "vitest";
import { createUserAdminSchema, updateUserAdminSchema } from "./user-management";

describe("createUserAdminSchema", () => {
  const base = { email: "new@example.com", name: "New User" };

  it("rejects a password shorter than 8 characters", () => {
    expect(
      createUserAdminSchema.safeParse({ ...base, password: "1234567" }).success,
    ).toBe(false);
  });

  it("accepts a password exactly 8 characters long", () => {
    expect(
      createUserAdminSchema.safeParse({ ...base, password: "12345678" }).success,
    ).toBe(true);
  });
});

describe("updateUserAdminSchema (ISS-0102)", () => {
  it("accepts ACTIVE and SUSPENDED", () => {
    expect(updateUserAdminSchema.safeParse({ status: "ACTIVE" }).success).toBe(true);
    expect(updateUserAdminSchema.safeParse({ status: "SUSPENDED" }).success).toBe(true);
  });

  it("rejects PENDING_VERIFICATION — only self-registration may set it", () => {
    expect(
      updateUserAdminSchema.safeParse({ status: "PENDING_VERIFICATION" }).success,
    ).toBe(false);
  });

  it("allows status to be omitted (role/name-only updates keep working)", () => {
    expect(updateUserAdminSchema.safeParse({ name: "New Name" }).success).toBe(true);
  });
});
