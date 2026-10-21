# 0005 — Tenant isolation is Postgres row-level security keyed by a transaction-local setting

Status: Proposed
Decided by: roji-tech (commit author; acceptance by the maintainer still needed) · Date: 2026-08-23
Recorded: 2026-10-21
Backfilled: commit `083bfbe` ("prove RLS + tenant-scoped Prisma extension on Product")

## Context

Pro and Premium need several businesses (tenants) in one database. Filtering by `businessId` in every query depends on no one forgetting it.

## Decision

- Tenant tables carry a nullable `businessId`. Postgres enforces visibility with `ENABLE` and `FORCE ROW LEVEL SECURITY` (`FORCE` so the owning role is also bound).
- The policy compares `businessId` with `current_setting('app.tenant_id', true)`.
- `forTenant(businessId)` (`lib/server/tenant-prisma.ts`) wraps each query in a transaction whose first statement is `set_config('app.tenant_id', …, TRUE)`. The `TRUE` makes it transaction-local, so a pooled connection never carries one request's tenant into another. A plain session-level `SET` is forbidden.
- Rows with `businessId IS NULL` are visible to everyone. This is a deliberate temporary bridge because existing rows were not backfilled.
- RLS policies live in `prisma/rls/*.sql`, outside Prisma migrations, and are applied by hand (`psql`) and in the CI test database.

## Alternatives Considered

- **A `businessId` filter in every query**: not recorded as formally compared; the plan chose RLS as the safety net.

## Consequences

- This is a prototype. RLS is enabled on `Product` only. `forTenant` is not called by any route or page at the time of writing, so no request is tenant-isolated yet.
- The `IS NULL` bridge means a row without a business is readable by every tenant.
- `forTenant` wraps each call in its own batch transaction, so it cannot be combined with an explicit nested `$transaction` (for example a stock transfer).
- `prisma migrate deploy` does not apply `prisma/rls/*.sql`, so staging and production have the policy only if someone ran it.
- **Revisit if:** the first tenant-scoped feature ships, or any tenant other than the null one is created in a shared database.

## Enforced by

`lib/server/tenant-prisma.test.ts`, which runs only when `DATABASE_URL` is set and then writes to that database (see `docs/HANDOVER.md`, "Running the tests safely"). Nothing else.

## Binds

- `lib/server/tenant-prisma.ts`
- `prisma/rls/001_enable_rls.sql`
- `docs/local-dev-setup.md`
- `.github/workflows/ci.yml` (RLS applied before seeding)
