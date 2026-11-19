/**
 * Decrement warehouse stock allocations when product-level stock is sold.
 * REQ-0068: when warehouseId is set on the line, fulfill that pick; otherwise
 * greedily deduct from the largest available allocation (legacy / no pick).
 */

import { prisma } from "@/prisma/client";
import { planAllocationDecrements } from "@/lib/products/plan-allocation-decrements";
import { fulfillAllocationFromPick } from "@/lib/products/stock-allocation-order-sync";
import { logger } from "@/lib/logger";

export interface DecrementStockAllocationItem {
  productId: string;
  quantity: number;
  /** REQ-0068 — explicit warehouse pick from OrderItem */
  warehouseId?: string | null;
}

/**
 * Best-effort decrement of StockAllocation rows for order line items.
 * Uses quantity − reservedQuantity as available for greedy fallback.
 */
export async function decrementStockAllocations(
  items: DecrementStockAllocationItem[],
): Promise<void> {
  for (const item of items) {
    if (item.quantity <= 0) continue;

    if (item.warehouseId) {
      try {
        await fulfillAllocationFromPick(
          item.productId,
          item.warehouseId,
          item.quantity,
          { releaseReservation: true },
        );
      } catch (error) {
        // ISS-0044(b): non-blocking by design (product-level stock is
        // already adjusted by this point), but was previously silent.
        logger.warn("Failed to fulfill allocation from pick", { item, error });
      }
      continue;
    }

    const allocations = await prisma.stockAllocation.findMany({
      where: { productId: item.productId },
      select: { id: true, quantity: true, reservedQuantity: true },
    });

    const steps = planAllocationDecrements(
      allocations.map((a) => ({
        id: a.id,
        quantity: Number(a.quantity),
        reservedQuantity: Number(a.reservedQuantity),
      })),
      item.quantity,
    );

    for (const step of steps) {
      await prisma.stockAllocation.update({
        where: { id: step.id },
        data: {
          quantity: { decrement: step.deduct },
          updatedAt: new Date(),
        },
      });
    }
  }
}

/**
 * ISS-0044(a) — the symmetric restore for decrementStockAllocations' no-pick
 * (greedy) branch. That branch spreads a decrement across whichever
 * StockAllocation rows exist for the product with no record of exactly
 * which row(s) absorbed how much, so an exact reverse isn't possible without
 * new per-order bookkeeping. Without this, cancelling a confirmed no-pick
 * order restored Product.quantity (the catalog total) but never touched
 * StockAllocation at all — a real, accumulating drift where the catalog
 * total overstates what's actually sitting in any given warehouse. Same
 * "best-effort" spirit as the function it mirrors: put the whole restore
 * into whichever allocation is currently most depleted, rather than leaving
 * it unrestored anywhere.
 */
export async function restoreStockAllocations(
  items: DecrementStockAllocationItem[],
): Promise<void> {
  for (const item of items) {
    if (item.quantity <= 0 || item.warehouseId) continue;

    const allocation = await prisma.stockAllocation.findFirst({
      where: { productId: item.productId },
      orderBy: { quantity: "asc" },
      select: { id: true },
    });
    if (!allocation) continue;

    await prisma.stockAllocation.update({
      where: { id: allocation.id },
      data: {
        quantity: { increment: item.quantity },
        updatedAt: new Date(),
      },
    });
  }
}
