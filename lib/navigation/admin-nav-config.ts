/**
 * Admin sidebar nav config (REQ-0094).
 * Single source for AdminSidebar hrefs and RouteWarmPrefetch admin RSC warm.
 */

import type { AdminCounts } from "@/types";

export type AdminNavItemConfig = {
  href: string;
  label: string;
  /** Key in admin counts for badge (optional) */
  countKey?: keyof Pick<
    AdminCounts,
    | "clientOrders"
    | "clientInvoices"
    | "supportTickets"
    | "productReviews"
    | "products"
    | "warehouses"
    | "suppliers"
    | "clients"
    | "users"
  >;
  /**
   * The page itself `redirect()`s anyone whose role isn't "admin" straight
   * back to /admin (ISS-0064/0088) — "user"/"retailer" always had real
   * grants on everything else in this list, so hiding only these three
   * for them stops the sidebar advertising dead ends, not legitimate work.
   */
  adminOnly?: true;
};

export const ADMIN_MY_STORE_ITEMS: AdminNavItemConfig[] = [
  {
    href: "/",
    label: "Dashboard",
  },
  {
    href: "/admin/dashboard-overall-insights",
    label: "Store Overview",
  },
  {
    href: "/business-insights",
    label: "Business Insights",
  },
  {
    href: "/admin/orders",
    label: "Orders",
    countKey: "clientOrders",
  },
  {
    href: "/admin/invoices",
    label: "Invoices",
    countKey: "clientInvoices",
  },
  {
    href: "/admin/support-tickets",
    label: "Support Tickets",
    countKey: "supportTickets",
  },
  {
    href: "/admin/product-reviews",
    label: "Product Reviews",
    countKey: "productReviews",
  },
];

export const ADMIN_MANAGEMENT_ITEMS: AdminNavItemConfig[] = [
  {
    href: "/admin/products",
    label: "Products",
    countKey: "products",
  },
  {
    href: "/categories",
    label: "Categories",
  },
  {
    href: "/suppliers",
    label: "Suppliers",
  },
  {
    href: "/admin/warehouses",
    label: "Warehouses",
    countKey: "warehouses",
  },
  {
    href: "/admin/supplier-portal",
    label: "Supplier Portal",
    countKey: "suppliers",
    adminOnly: true,
  },
  {
    href: "/admin/client-portal",
    label: "Client Portal",
    countKey: "clients",
    adminOnly: true,
  },
  {
    href: "/admin/user-management",
    label: "User Management",
    countKey: "users",
    adminOnly: true,
  },
  {
    href: "/admin/activity-history",
    label: "Activity History",
  },
];

export const ADMIN_MY_ACTIVITY_ITEMS: AdminNavItemConfig[] = [
  {
    href: "/admin/my-activity",
    label: "My Activity",
  },
];

export const ADMIN_SETTINGS_EMAIL_HREF = "/admin/settings/email-preferences";

/** Drops the admin-exclusive items for any role but "admin" (ISS-0064/0088). */
export function filterAdminOnlyItems(
  items: AdminNavItemConfig[],
  role: string | null | undefined,
): AdminNavItemConfig[] {
  if (role === "admin") return items;
  return items.filter((item) => !item.adminOnly);
}

/** Flat deduped admin sidebar paths for idle RSC warm (admin/user roles). */
export function getAdminSidebarWarmPaths(
  role: string | null | undefined,
): string[] {
  const paths = [
    ...ADMIN_MY_STORE_ITEMS.map((item) => item.href),
    ...filterAdminOnlyItems(ADMIN_MANAGEMENT_ITEMS, role).map((item) => item.href),
    ...ADMIN_MY_ACTIVITY_ITEMS.map((item) => item.href),
    ADMIN_SETTINGS_EMAIL_HREF,
  ];
  return [...new Set(paths)];
}
