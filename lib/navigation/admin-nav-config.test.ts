import { describe, expect, it } from "vitest";
import {
  ADMIN_MANAGEMENT_ITEMS,
  filterAdminOnlyItems,
} from "./admin-nav-config";

/**
 * ISS-0064/0088: "user"/"retailer" used to get the exact same sidebar as
 * "admin", including Supplier Portal/Client Portal/User Management — three
 * links whose own pages redirect anyone but an admin straight back out.
 * filterAdminOnlyItems is what both the desktop sidebar and the mobile flat
 * nav now share to drop those three (and only those three) for non-admins.
 */
describe("filterAdminOnlyItems", () => {
  it("keeps every item for admin", () => {
    expect(filterAdminOnlyItems(ADMIN_MANAGEMENT_ITEMS, "admin")).toEqual(
      ADMIN_MANAGEMENT_ITEMS,
    );
  });

  it("drops the admin-exclusive dead-end links for a non-admin role", () => {
    const result = filterAdminOnlyItems(ADMIN_MANAGEMENT_ITEMS, "user");

    expect(result.some((item) => item.adminOnly)).toBe(false);
    expect(result.map((item) => item.label)).not.toContain("Supplier Portal");
    expect(result.map((item) => item.label)).not.toContain("Client Portal");
    expect(result.map((item) => item.label)).not.toContain("User Management");
    // Everything else (Products, Categories, Suppliers, Warehouses,
    // Activity History) stays — "user" has real grants on those.
    expect(result.map((item) => item.label)).toContain("Products");
    expect(result.map((item) => item.label)).toContain("Warehouses");
  });

  it("drops the same links for retailer", () => {
    const result = filterAdminOnlyItems(ADMIN_MANAGEMENT_ITEMS, "retailer");
    expect(result.some((item) => item.adminOnly)).toBe(false);
  });
});
