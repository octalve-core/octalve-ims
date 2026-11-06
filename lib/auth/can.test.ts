import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ISS-0071 — legacyCan() used to resolve a null/undefined role to "user"'s
 * grants (`role ?? "user"`), contradicting can()'s own docstring ("a lookup
 * failure... resolves false"). A session whose role failed to resolve must
 * be denied, not quietly inherit "user"'s write access.
 */

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/prisma/client", () => ({ prisma: { permission: { findFirst } } }));

import { can, canManageCatalogSupportEntities } from "./can";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("can() legacy (no roleId) path", () => {
  it("denies when role is null", async () => {
    expect(await can({ id: "u1", role: null }, "Products", "create")).toBe(false);
  });

  it("denies when role is undefined", async () => {
    expect(await can({ id: "u1" }, "Products", "create")).toBe(false);
  });

  it("admin is always allowed, regardless of resource/action", async () => {
    expect(await can({ id: "u1", role: "admin" }, "Users", "delete")).toBe(true);
  });

  it("'user' role keeps its existing grants (create on Products)", async () => {
    expect(await can({ id: "u1", role: "user" }, "Products", "create")).toBe(true);
  });

  it("'client' role is denied a grant it doesn't have (edit on Stock)", async () => {
    expect(await can({ id: "u1", role: "client" }, "Stock", "edit")).toBe(false);
  });
});

describe("can() Pro+ (roleId) path", () => {
  it("looks up Permission rows and ignores session.role entirely", async () => {
    findFirst.mockResolvedValue({ id: "perm1" });
    const allowed = await can(
      { id: "u1", roleId: "role1", role: null },
      "Products",
      "create",
    );
    expect(allowed).toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: { roleId: "role1", resource: "Products", action: "create" },
      select: { id: true },
    });
  });

  it("resolves false, not throws, on a DB lookup failure", async () => {
    findFirst.mockRejectedValue(new Error("db down"));
    expect(await can({ id: "u1", roleId: "role1" }, "Products", "create")).toBe(false);
  });
});

/** ISS-0055 — categories/suppliers/warehouses mutation gate. */
describe("canManageCatalogSupportEntities", () => {
  it("allows admin and user", () => {
    expect(canManageCatalogSupportEntities("admin")).toBe(true);
    expect(canManageCatalogSupportEntities("user")).toBe(true);
  });

  it("denies client, supplier, retailer, and null/undefined", () => {
    expect(canManageCatalogSupportEntities("client")).toBe(false);
    expect(canManageCatalogSupportEntities("supplier")).toBe(false);
    expect(canManageCatalogSupportEntities("retailer")).toBe(false);
    expect(canManageCatalogSupportEntities(null)).toBe(false);
    expect(canManageCatalogSupportEntities(undefined)).toBe(false);
  });
});
