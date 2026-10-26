import { describe, expect, it } from "vitest";
import { createUserAdminSchema } from "./user-management";

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
