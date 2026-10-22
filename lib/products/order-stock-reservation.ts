/**
 * REQ-0103 — disjoint pending-order stock reservation (REQ-0102 AC6).
 * Warehouse pick → allocation.reservedQuantity only.
 * No warehouse pick → product.reservedQuantity only.
 */

import { prisma } from "@/prisma/client";
import { getReservedCommitment } from "@/lib/stock-allocation/catalog-quantity-reconcile";
import type { CatalogReconcileAllocationRow } from "@/lib/stock-allocation/catalog-quantity-reconcile";
import { decrementStockAllocations } from "@/lib/products/decrement-stock-allocations";
import {
  fulfillAllocationFromPick,
  releaseAllocationReservation,
  reserveAllocationForOrderItem,
} from "@/lib/products/stock-allocation-order-sync";

export type OrderStockLine = {
  productId: string;
  quantity: number;
  warehouseId?: string | null;
};

/** Catalog units still available for a new pending order line. */
export function getAvailableCatalogForOrder(
  productQty: number,
  productReserved: number,
  allocationRows: Pick<CatalogReconcileAllocationRow, "reservedQuantity">[],
): number {
  const committed = getReservedCommitment(
    productReserved,
    allocationRows.map((row, index) => ({
      id: String(index),
      quantity: 0,
      reservedQuantity: row.reservedQuantity,
    })),
  );
  return Math.max(0, productQty - committed);
}

/**
 * Pending create — reserve on exactly one path per line.
 *
 * ISS-0009 — the non-warehouse branch used to be a plain unconditional
 * `increment` with no check at write time (the caller's earlier
 * availableStock read was already stale by the time this ran). The UPDATE
 * below is atomic: its WHERE clause is evaluated against the row's
 * current committed state as Postgres takes the row lock for the
 * statement itself, so two concurrent reservations for the same product
 * — from two different orders, or two lines of the same product within
 * one order (reserved sequentially, see reservePendingOrderLines) — can
 * never both succeed past the real stock.
 */
export async function reservePendingOrderLine(
  line: OrderStockLine,
): Promise<void> {
  if (line.warehouseId) {
    await reserveAllocationForOrderItem(
      line.productId,
      line.warehouseId,
      line.quantity,
    );
    return;
  }

  const affected = await prisma.$executeRaw`
    UPDATE "Product"
    SET "reservedQuantity" = "reservedQuantity" + ${line.quantity}
    WHERE id = ${line.productId}
      AND ("quantity" - "reservedQuantity") >= ${line.quantity}
  `;
  if (affected === 0) {
    const product = await prisma.product.findUnique({
      where: { id: line.productId },
      select: { name: true, quantity: true, reservedQuantity: true },
    });
    const available = product
      ? Number(product.quantity) - Number(product.reservedQuantity)
      : 0;
    throw new Error(
      `Insufficient stock for product ${product?.name ?? line.productId}. Available: ${available}, Requested: ${line.quantity}`,
    );
  }
}

/** Pending cancel — release reservation on exactly one path per line. */
export async function releasePendingOrderLine(
  line: OrderStockLine,
): Promise<void> {
  if (line.warehouseId) {
    await releaseAllocationReservation(
      line.productId,
      line.warehouseId,
      line.quantity,
    );
    return;
  }

  await prisma.product.update({
    where: { id: line.productId },
    data: {
      reservedQuantity: { decrement: line.quantity },
    },
  });
}

/** Pending → confirmed/paid — deduct catalog and clear reservation on one path. */
export async function fulfillPendingOrderLine(
  line: OrderStockLine,
): Promise<void> {
  if (line.warehouseId) {
    await prisma.product.update({
      where: { id: line.productId },
      data: {
        quantity: { decrement: line.quantity },
      },
    });
    await fulfillAllocationFromPick(
      line.productId,
      line.warehouseId,
      line.quantity,
      { releaseReservation: true },
    );
    return;
  }

  await prisma.product.update({
    where: { id: line.productId },
    data: {
      quantity: { decrement: line.quantity },
      reservedQuantity: { decrement: line.quantity },
    },
  });

  await decrementStockAllocations([
    {
      productId: line.productId,
      quantity: line.quantity,
    },
  ]);
}

/**
 * Batch reserve after order create.
 *
 * ISS-0009 — if a later line in the same order fails (genuinely out of
 * stock, or lost a race), the lines that already succeeded in THIS call
 * are released before re-throwing, so a failure here never leaves a
 * torn partial reservation behind — the caller (createOrder) still must
 * not persist the order record itself in that case.
 */
export async function reservePendingOrderLines(
  lines: OrderStockLine[],
): Promise<void> {
  const reserved: OrderStockLine[] = [];
  try {
    for (const line of lines) {
      await reservePendingOrderLine(line);
      reserved.push(line);
    }
  } catch (err) {
    for (const line of reserved) {
      await releasePendingOrderLine(line).catch(() => {});
    }
    throw err;
  }
}

/** Batch release on pending cancel. */
export async function releasePendingOrderLines(
  lines: OrderStockLine[],
): Promise<void> {
  for (const line of lines) {
    try {
      await releasePendingOrderLine(line);
    } catch {
      // best-effort — mirrors syncReleasePendingOrderAllocations
    }
  }
}

/** Batch fulfill on pending → confirmed/paid. */
export async function fulfillPendingOrderLines(
  lines: OrderStockLine[],
): Promise<void> {
  for (const line of lines) {
    try {
      await fulfillPendingOrderLine(line);
    } catch {
      // best-effort — mirrors decrementStockAllocations warn-only callers
    }
  }
}
