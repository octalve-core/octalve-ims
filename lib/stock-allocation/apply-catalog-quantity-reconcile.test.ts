import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyCatalogQuantityReconcile,
  ProductConcurrentModificationError,
} from "./apply-catalog-quantity-reconcile";

const mockProductUpdateMany = vi.fn();
const mockAllocationUpdate = vi.fn();
const mockAllocationDelete = vi.fn();

vi.mock("@/prisma/client", () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<void>) =>
      callback({
        product: { updateMany: mockProductUpdateMany },
        stockAllocation: {
          update: mockAllocationUpdate,
          delete: mockAllocationDelete,
        },
      }),
    ),
  },
}));

describe("applyCatalogQuantityReconcile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProductUpdateMany.mockResolvedValue({ count: 1 });
    mockAllocationUpdate.mockResolvedValue({ quantity: BigInt(5) });
  });

  it("updates catalog qty and applies shrink steps", async () => {
    const result = await applyCatalogQuantityReconcile({
      productId: "prod-1",
      newCatalog: 70,
      shrinkSteps: [{ id: "alloc-a", deduct: 10 }],
      productUpdate: { updatedBy: "user-1" },
      expectedCurrentQuantity: BigInt(80),
    });

    expect(result.unitsRemovedFromWarehouses).toBe(10);
    expect(mockProductUpdateMany).toHaveBeenCalledWith({
      where: { id: "prod-1", quantity: BigInt(80) },
      data: expect.objectContaining({
        updatedBy: "user-1",
        quantity: BigInt(70),
      }),
    });
    expect(mockAllocationUpdate).toHaveBeenCalledWith({
      where: { id: "alloc-a" },
      data: {
        quantity: { decrement: 10 },
        updatedAt: expect.any(Date),
      },
      select: { quantity: true },
    });
    expect(mockAllocationDelete).not.toHaveBeenCalled();
  });

  it("deletes allocation rows that reach zero quantity", async () => {
    mockAllocationUpdate.mockResolvedValueOnce({ quantity: BigInt(0) });

    await applyCatalogQuantityReconcile({
      productId: "prod-1",
      newCatalog: 50,
      shrinkSteps: [{ id: "alloc-b", deduct: 5 }],
      productUpdate: {},
      expectedCurrentQuantity: BigInt(55),
    });

    expect(mockAllocationDelete).toHaveBeenCalledWith({
      where: { id: "alloc-b" },
    });
  });

  it("ISS-0046 — rejects when the product no longer matches the expected (stale) quantity", async () => {
    mockProductUpdateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      applyCatalogQuantityReconcile({
        productId: "prod-1",
        newCatalog: 70,
        shrinkSteps: [{ id: "alloc-a", deduct: 10 }],
        productUpdate: {},
        expectedCurrentQuantity: BigInt(80),
      }),
    ).rejects.toBeInstanceOf(ProductConcurrentModificationError);

    expect(mockAllocationUpdate).not.toHaveBeenCalled();
  });
});
