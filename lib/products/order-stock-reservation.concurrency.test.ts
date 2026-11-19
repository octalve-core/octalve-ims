import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/prisma/client";
import {
  reservePendingOrderLine,
  reservePendingOrderLines,
} from "./order-stock-reservation";

/**
 * ISS-0009 — proves the atomic-conditional-update fix actually closes the
 * overselling race, against a real Postgres connection (not a mocked
 * Prisma client, which order-stock-reservation.test.ts uses instead): a
 * mock can't exercise the "two concurrent UPDATEs serialize on the row
 * lock" behavior this fix depends on. Kept in its own file — rather than
 * added to order-stock-reservation.test.ts — because that file's
 * `vi.mock("@/prisma/client", ...)` is file-scoped in Vitest and would
 * silently apply here too if these tests lived in the same file.
 */
describe.skipIf(!process.env.DATABASE_URL)("reservePendingOrderLine, real DB (ISS-0009)", () => {
  const stamp = Date.now();
  let categoryId: string;

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: {
        name: `ISS-0009 test category ${stamp}`,
        userId: "test-user",
        createdBy: "test-user",
      },
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { categoryId } });
    await prisma.category.delete({ where: { id: categoryId } });
  });

  async function createProduct(suffix: string, quantity: number) {
    return prisma.product.create({
      data: {
        name: `ISS-0009 test product ${suffix}`,
        price: 10,
        quantity,
        sku: `iss-0009-${stamp}-${suffix}`,
        status: "active",
        userId: "test-user",
        createdBy: "test-user",
        categoryId,
        supplierId: "test-supplier",
      },
    });
  }

  it("only lets one of two concurrent over-committing reservations succeed (Failure: overselling)", async () => {
    const product = await createProduct("concurrent", 5);

    const [a, b] = await Promise.allSettled([
      reservePendingOrderLine({ productId: product.id, quantity: 5 }),
      reservePendingOrderLine({ productId: product.id, quantity: 5 }),
    ]);

    const succeeded = [a, b].filter((r) => r.status === "fulfilled").length;
    const failed = [a, b].filter((r) => r.status === "rejected").length;
    expect(succeeded).toBe(1);
    expect(failed).toBe(1);

    const refreshed = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    // Reserved exactly once (5), not twice (10) against only 5 real stock.
    expect(Number(refreshed.reservedQuantity)).toBe(5);
  });

  it("rejects a reservation that exceeds the real available stock", async () => {
    const product = await createProduct("exceeds", 3);

    await expect(
      reservePendingOrderLine({ productId: product.id, quantity: 4 }),
    ).rejects.toThrow(/Insufficient stock/);

    const refreshed = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(Number(refreshed.reservedQuantity)).toBe(0);
  });

  it("releases an already-succeeded line when a later line in the same order fails (Failure: partial reservation left behind)", async () => {
    const productA = await createProduct("batch-a", 5);
    const productB = await createProduct("batch-b", 2);

    await expect(
      reservePendingOrderLines([
        { productId: productA.id, quantity: 5 },
        { productId: productB.id, quantity: 5 }, // only 2 available — fails
      ]),
    ).rejects.toThrow(/Insufficient stock/);

    const refreshedA = await prisma.product.findUniqueOrThrow({
      where: { id: productA.id },
    });
    // productA's successful reservation was released, not left dangling.
    expect(Number(refreshedA.reservedQuantity)).toBe(0);

    const refreshedB = await prisma.product.findUniqueOrThrow({
      where: { id: productB.id },
    });
    expect(Number(refreshedB.reservedQuantity)).toBe(0);
  });

  it("rejects the second of two same-product lines in one order once combined quantity exceeds stock", async () => {
    const product = await createProduct("duplicate-line", 5);

    await expect(
      reservePendingOrderLines([
        { productId: product.id, quantity: 5 },
        { productId: product.id, quantity: 5 }, // same product again — no more left
      ]),
    ).rejects.toThrow(/Insufficient stock/);

    const refreshed = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    // Net reservation is zero — the first line's grant was released too.
    expect(Number(refreshed.reservedQuantity)).toBe(0);
  });
});
