/**
 * can(session, resource, action) — the shared authorization primitive.
 *
 * Two paths:
 *  - Pro+ (session.roleId set): looks up Role -> Permission rows in the DB.
 *    A custom role can grant any (resource, action) pair an admin composes
 *    for it — see prisma/schema/tenancy.prisma's Role/Permission models.
 *  - Core (no roleId): falls back to LEGACY_ROLE_PERMISSIONS below, keyed by
 *    the free-text User.role string ("admin" | "supplier" | "client" |
 *    "user" | "retailer"). This table is deliberately conservative — it
 *    exists to match, not change, the behavior the app already has via its
 *    ~150 inline `role === "admin"` checks scattered across routes (see
 *    Milestone 0 plan, Step 6). Widening what a legacy role can do is a
 *    product decision for whoever's building that feature, not something to
 *    guess here.
 *
 * Resources: Products | Stock | Orders | Purchasing | Invoicing | Users |
 * Reports | SupportTickets | ProductReviews.
 * Actions: view | create | edit | delete | approve.
 */

import { prisma } from "@/prisma/client";

export type CanSession = {
  id: string;
  roleId?: string | null;
  role?: string | null;
};

export type Resource =
  | "Products"
  | "Stock"
  | "Orders"
  | "Purchasing"
  | "Invoicing"
  | "Users"
  | "Reports"
  | "SupportTickets"
  | "ProductReviews";

export type Action = "view" | "create" | "edit" | "delete" | "approve";

/**
 * Legacy-role fallback grants (Core path). "admin" isn't listed here — it's
 * a full-access short-circuit in legacyCan() below, not a table lookup.
 */
const LEGACY_ROLE_PERMISSIONS: Record<string, Partial<Record<Resource, Action[]>>> = {
  user: {
    Products: ["view", "create", "edit"],
    Stock: ["view", "create", "edit"],
    Orders: ["view", "create", "edit"],
    Invoicing: ["view", "create", "edit"],
    SupportTickets: ["view", "create"],
  },
  supplier: {
    Products: ["view"],
    Stock: ["view", "edit"], // matches clientMayWriteStock: every non-client role may write
    Orders: ["view"],
    Purchasing: ["view"],
    SupportTickets: ["view", "create"],
  },
  client: {
    Products: ["view"],
    Stock: ["view"], // never edit — matches clientMayWriteStock(role) === false for "client"
    Orders: ["view", "create"],
    Invoicing: ["view"],
    SupportTickets: ["view", "create"],
  },
  // Present in the UserRole type/validation lists but never assigned by any
  // signup flow today (confirmed by grep during the PRD audit) — treated as
  // a read-only external party like "client" until a feature needs more.
  retailer: {
    Products: ["view"],
    Stock: ["view"],
    Orders: ["view"],
  },
};

function legacyCan(role: string | null | undefined, resource: Resource, action: Action): boolean {
  const normalizedRole = role ?? "user";
  if (normalizedRole === "admin") return true;

  const grants = LEGACY_ROLE_PERMISSIONS[normalizedRole]?.[resource];
  return grants?.includes(action) ?? false;
}

/**
 * Whether `session` may perform `action` on `resource`. Never throws — a
 * lookup failure (bad roleId, DB hiccup on the Pro+ path) resolves false
 * rather than risk a caller treating a thrown error as "allowed by default".
 */
export async function can(
  session: CanSession,
  resource: Resource,
  action: Action,
): Promise<boolean> {
  if (session.roleId) {
    try {
      const match = await prisma.permission.findFirst({
        where: { roleId: session.roleId, resource, action },
        select: { id: true },
      });
      return match != null;
    } catch {
      return false;
    }
  }

  return legacyCan(session.role, resource, action);
}
