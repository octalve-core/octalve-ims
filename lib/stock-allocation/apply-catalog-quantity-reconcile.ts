/**
 * REQ-0102 — apply catalog reconcile shrink in a Prisma transaction.
 */

import { prisma } from "@/prisma/client";
import type { AllocationDecrementStep } from "@/lib/products/plan-allocation-decrements";

export type ApplyCatalogReconcileInput = {
  productId: string;
  newCatalog: number;
  shrinkSteps: AllocationDecrementStep[];
  /** Additional product fields from PUT body */
  productUpdate: Record<string, unknown>;
  /**
   * ISS-0046 — the quantity the reconcile PLAN was computed from (the PUT
   * handler's earlier, now possibly-stale read). Guards the write so a
   * second concurrent PUT that read the same stale snapshot can't silently
   * apply its own now-invalid plan on top of this one.
   */
  expectedCurrentQuantity: bigint;
};

export type ApplyCatalogReconcileResult = {
  unitsRemovedFromWarehouses: number;
};

export class ProductConcurrentModificationError extends Error {
  constructor(productId: string) {
    super(`Product ${productId} was modified concurrently`);
    this.name = "ProductConcurrentModificationError";
  }
}

/** Update catalog qty and shrink allocation rows; delete rows that reach zero. */
export async function applyCatalogQuantityReconcile(
  input: ApplyCatalogReconcileInput,
): Promise<ApplyCatalogReconcileResult> {
  const { productId, newCatalog, shrinkSteps, productUpdate, expectedCurrentQuantity } = input;
  const unitsRemovedFromWarehouses = shrinkSteps.reduce(
    (sum, step) => sum + step.deduct,
    0,
  );

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.product.updateMany({
      where: { id: productId, quantity: expectedCurrentQuantity },
      data: {
        ...productUpdate,
        quantity: BigInt(newCatalog) as never,
      },
    });
    if (claimed.count === 0) {
      throw new ProductConcurrentModificationError(productId);
    }

    for (const step of shrinkSteps) {
      const updated = await tx.stockAllocation.update({
        where: { id: step.id },
        data: {
          quantity: { decrement: step.deduct },
          updatedAt: new Date(),
        },
        select: { quantity: true },
      });
      if (Number(updated.quantity) <= 0) {
        await tx.stockAllocation.delete({ where: { id: step.id } });
      }
    }
  });

  return { unitsRemovedFromWarehouses };
}
