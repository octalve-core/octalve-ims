/**
 * Supplier read-only access gates for catalog entity detail pages.
 * REQ-0029 — Option B: suppliers view category/supplier detail when tied to assigned products.
 */

import { getSupplierByUserId } from "@/prisma/supplier";
import { prisma } from "@/prisma/client";
import { mergeProductListWhere } from "@/lib/products/product-query";
import type { SessionForDetail } from "@/lib/server/order-detail-data";
import { can } from "@/lib/auth/can";

export type SupplierEntityRef = {
  id: string;
  name: string;
};

/**
 * Coarse-grained gate on catalog (Products/Category/Supplier) detail pages —
 * a no-op against every legacy Core role today (all grant Products/view, see
 * lib/auth/can.ts), but the hook a Pro+ custom role that explicitly revokes
 * Products/view needs: without this, nothing in the supplier/owner scoping
 * below would ever consult Permission rows at all. Row-level scoping
 * (supplierCanAccessCategory etc.) still applies on top of this — this only
 * answers "is this session allowed to view catalog detail pages at all".
 */
export async function canViewCatalogEntities(
  session: SessionForDetail,
): Promise<boolean> {
  return can(session, "Products", "view");
}

/**
 * Resolve the supplier catalog entity linked to a supplier login user.
 * Returns null when the user is not linked to a supplier record.
 */
export async function resolveSupplierEntityForSession(
  userId: string,
): Promise<SupplierEntityRef | null> {
  return getSupplierByUserId(userId);
}

/**
 * True when the supplier has at least one active product in the given category.
 * Used to authorize read-only category detail for role=supplier.
 */
export async function supplierHasAssignedProductInCategory(
  categoryId: string,
  supplierEntityId: string,
): Promise<boolean> {
  const product = await prisma.product.findFirst({
    where: mergeProductListWhere({
      categoryId,
      supplierId: supplierEntityId,
    }),
    select: { id: true },
  });
  return product != null;
}

/** Read-only category detail gate for suppliers. */
export async function supplierCanAccessCategory(
  categoryId: string,
  supplierEntityId: string,
): Promise<boolean> {
  return supplierHasAssignedProductInCategory(categoryId, supplierEntityId);
}

/**
 * Suppliers may only open their own supplier entity detail (not other suppliers).
 */
export function supplierCanAccessSupplierRecord(
  supplierRecordId: string,
  supplierEntityId: string,
): boolean {
  return supplierRecordId === supplierEntityId;
}

/**
 * Redis detail cache scope suffix for role-scoped payloads.
 * Admin/client/retailer use unscoped keys; supplier uses supplier:{entityId}.
 */
export function catalogDetailCacheScope(
  session: SessionForDetail,
  supplierEntityId?: string,
): string | undefined {
  if (session.role !== "supplier") return undefined;
  if (!supplierEntityId) return undefined;
  return `supplier:${supplierEntityId}`;
}
