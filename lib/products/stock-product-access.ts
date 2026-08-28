/**
 * REQ-0066 hardening — role-aware product access for stock allocation/transfer APIs.
 * Mirrors getProductDetailForPage access rules (admin/supplier/owner/client).
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import { mergeProductListWhere } from "@/lib/products/product-query";
import { getSupplierByUserId } from "@/prisma/supplier";
import { can } from "@/lib/auth/can";

export type StockSession = {
  id: string;
  role: string | null;
  roleId?: string | null;
};

export type StockProductAccessMode = "read" | "write";

/** Whether `session` may write stock (Stock/edit) — owner/admin/supplier under the Core fallback table, or a granted Pro+ custom role. */
export async function clientMayWriteStock(session: StockSession): Promise<boolean> {
  return can(session, "Stock", "edit");
}

/**
 * Build Prisma where clause for product access in stock APIs.
 * Returns null when the role cannot access the product (e.g. supplier without entity).
 */
export async function buildStockProductWhere(
  session: StockSession,
  productId: string,
  mode: StockProductAccessMode = "read",
): Promise<Prisma.ProductWhereInput | null> {
  const role = session.role ?? "client";

  if (role === "client") {
    if (mode === "write" && !(await clientMayWriteStock(session))) return null;
    return mergeProductListWhere({ id: productId });
  }

  if (role === "admin") {
    return mergeProductListWhere({ id: productId });
  }

  if (role === "supplier") {
    const supplier = await getSupplierByUserId(session.id);
    if (!supplier) return null;
    return mergeProductListWhere({ id: productId, supplierId: supplier.id });
  }

  return mergeProductListWhere({ id: productId, userId: session.id });
}

/** Resolve product if session may access it for stock operations. */
export async function findAccessibleProduct(
  session: StockSession,
  productId: string,
  mode: StockProductAccessMode = "read",
): Promise<{ id: string; name: string; sku: string } | null> {
  if (mode === "write" && !(await clientMayWriteStock(session))) {
    return null;
  }

  const where = await buildStockProductWhere(session, productId, mode);
  if (!where) return null;

  return prisma.product.findFirst({
    where,
    select: { id: true, name: true, sku: true },
  });
}
