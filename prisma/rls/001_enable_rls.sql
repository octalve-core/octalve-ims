-- Milestone 0: prove the RLS mechanism on one table (Product) before rolling
-- it out to the rest of the tenant-scoped models. See
-- lib/server/tenant-prisma.ts for how the app sets app.tenant_id per request,
-- and docs/local-dev-setup.md for why FORCE is required even though the
-- connecting role (roji, locally) owns this table.

ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" FORCE ROW LEVEL SECURITY;

-- businessId IS NULL rows (not yet tenant-assigned) stay visible to everyone
-- for now — Milestone 0 doesn't backfill every existing row with a business,
-- so a strict equality-only policy would hide all pre-tenancy data. This
-- OR clause is a deliberate, temporary bridge, not the final policy shape;
-- narrow it once every Product row has a real businessId.
CREATE POLICY tenant_isolation ON "Product"
  USING (
    "businessId" IS NULL
    OR "businessId" = current_setting('app.tenant_id', true)
  );
