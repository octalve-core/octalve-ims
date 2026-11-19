import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ISS-0025 — the demo "Test Accounts To Login With" Select on the login page
 * shipped unconditionally: every production bundle included test@admin.com
 * and the other demo accounts' shared password. NEXT_PUBLIC_DISABLE_DEMO_LOGIN
 * must empty out testAccounts/roleMeta/testAccountRoleKeys so the real prod
 * deployment can opt out and drop those literals from its bundle.
 */
describe("test-accounts (ISS-0025)", () => {
  const originalEnv = process.env.NEXT_PUBLIC_DISABLE_DEMO_LOGIN;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    (process.env as { NEXT_PUBLIC_DISABLE_DEMO_LOGIN?: string }).NEXT_PUBLIC_DISABLE_DEMO_LOGIN =
      originalEnv;
  });

  it("exposes demo credentials when the flag is unset (dev/staging default)", async () => {
    delete (process.env as { NEXT_PUBLIC_DISABLE_DEMO_LOGIN?: string })
      .NEXT_PUBLIC_DISABLE_DEMO_LOGIN;

    const { isDemoLoginEnabled, testAccounts, roleMeta, testAccountRoleKeys } =
      await import("./test-accounts");

    expect(isDemoLoginEnabled).toBe(true);
    expect(testAccountRoleKeys.length).toBeGreaterThan(0);
    expect(testAccounts["guest-user"]).toEqual({
      email: "test@admin.com",
      password: "12345678",
    });
    expect(roleMeta["guest-user"].label).toContain("test@admin.com");
  });

  it("drops demo credentials entirely when the flag is true (real prod)", async () => {
    (process.env as { NEXT_PUBLIC_DISABLE_DEMO_LOGIN?: string }).NEXT_PUBLIC_DISABLE_DEMO_LOGIN =
      "true";

    const { isDemoLoginEnabled, testAccounts, roleMeta, testAccountRoleKeys } =
      await import("./test-accounts");

    expect(isDemoLoginEnabled).toBe(false);
    expect(testAccountRoleKeys).toEqual([]);
    expect(testAccounts).toEqual({});
    expect(roleMeta).toEqual({});
  });
});
