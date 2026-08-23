/**
 * Shared Prisma where clauses for Product queries.
 * Catalog/list UIs must exclude soft-deleted products (deletedAt set).
 */

import type { Prisma } from "@prisma/client";

/**
 * Active catalog products: not archived (deletedAt is null).
 *
 * Postgres: every row always has the column, defaulting to NULL — unlike
 * Mongo, there's no "field absent on legacy documents" case to also match,
 * so a plain equality check is sufficient (was previously
 * `{ OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] }` to cover
 * Mongo documents predating the soft-delete field; `isSet` has no Postgres
 * equivalent and isn't needed once every row has the column).
 */
export const productNotDeletedWhere = {
  deletedAt: null,
} satisfies Prisma.ProductWhereInput;

/**
 * Merge catalog filter with additional where fields (userId, supplierId, id, etc.).
 */
export function mergeProductListWhere(
  where: Prisma.ProductWhereInput,
): Prisma.ProductWhereInput {
  return {
    AND: [productNotDeletedWhere, where],
  };
}

/** True when product row is archived (soft-deleted). */
export function isProductArchived(
  product: { deletedAt?: Date | null },
): boolean {
  return product.deletedAt != null;
}
