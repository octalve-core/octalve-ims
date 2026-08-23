import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/prisma/client";
import { forTenant } from "./tenant-prisma";

/**
 * The one test in this repo that hits a real Postgres connection instead of
 * a mocked Prisma client (every other *.test.ts file mocks @/prisma/client).
 * Proves the RLS + set_config mechanism from tenant-prisma.ts actually
 * isolates rows by businessId, not just that the code compiles.
 *
 * Skipped automatically if DATABASE_URL isn't set/reachable, so it doesn't
 * break the fast default suite in environments without a local Postgres.
 */
describe.skipIf(!process.env.DATABASE_URL)("forTenant row-level security", () => {
  let categoryId: string;
  const businessAId = `test-biz-a-${Date.now()}`;
  const businessBId = `test-biz-b-${Date.now()}`;
  let productAId: string;
  let productBId: string;

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: {
        name: `RLS test category ${Date.now()}`,
        userId: "test-user",
        createdBy: "test-user",
      },
    });
    categoryId = category.id;

    // WITH CHECK defaults to the same expression as USING, so inserting a
    // row with a real businessId requires app.tenant_id to already be set
    // to that same value — the plain untenant-scoped client can't do this
    // (current_setting returns null with no context set, and `businessId =
    // null` is never true), which is FORCE RLS correctly rejecting a
    // tenant-owned write with no tenant context, not a test bug.
    const productA = await forTenant(businessAId).product.create({
      data: {
        name: "RLS test product A",
        price: 1,
        quantity: 1,
        sku: `rls-test-a-${Date.now()}`,
        status: "active",
        userId: "test-user",
        createdBy: "test-user",
        categoryId,
        businessId: businessAId,
      },
    });
    productAId = productA.id;

    const productB = await forTenant(businessBId).product.create({
      data: {
        name: "RLS test product B",
        price: 1,
        quantity: 1,
        sku: `rls-test-b-${Date.now()}`,
        status: "active",
        userId: "test-user",
        createdBy: "test-user",
        categoryId,
        businessId: businessBId,
      },
    });
    productBId = productB.id;
  });

  afterAll(async () => {
    // Same RLS/WITH CHECK reasoning as the create above applies to DELETE:
    // the plain client has no tenant context, so it can't see (or delete)
    // either row — must clean up through the same forTenant scope each row
    // was created under.
    await forTenant(businessAId).product.delete({ where: { id: productAId } });
    await forTenant(businessBId).product.delete({ where: { id: productBId } });
    await prisma.category.delete({ where: { id: categoryId } });
  });

  it("only returns the requesting tenant's rows", async () => {
    const asA = forTenant(businessAId);
    const seenByA = await asA.product.findMany({
      where: { id: { in: [productAId, productBId] } },
    });
    expect(seenByA.map((p) => p.id)).toEqual([productAId]);

    const asB = forTenant(businessBId);
    const seenByB = await asB.product.findMany({
      where: { id: { in: [productAId, productBId] } },
    });
    expect(seenByB.map((p) => p.id)).toEqual([productBId]);
  });

  it("does not leak tenant context between separate forTenant calls", async () => {
    // Sequential calls with different tenants must not see each other's
    // context bleed through — this is the exact race FORCE + transaction-
    // local set_config is meant to prevent under connection pooling.
    const asA = forTenant(businessAId);
    const asB = forTenant(businessBId);

    const [resultA, resultB] = await Promise.all([
      asA.product.findUnique({ where: { id: productAId } }),
      asB.product.findUnique({ where: { id: productBId } }),
    ]);

    expect(resultA?.id).toBe(productAId);
    expect(resultB?.id).toBe(productBId);
  });
});
