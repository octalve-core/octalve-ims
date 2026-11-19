# 0003 — PostgreSQL replaces MongoDB; one schema and one database serve every tier

Status: Proposed
Decided by: roji-tech (commit author; acceptance by the maintainer still needed) · Date: 2026-08-23
Recorded: 2026-10-21
Backfilled: commits `a879dbf` (schema migration), `083bfbe` (migration applied)

## Context

The Stockly baseline used MongoDB through Prisma. The product needs relations with real foreign keys, row-level security, and tenancy/RBAC tables.

## Decision

- The database is PostgreSQL. The `mongodb` package is removed.
- The Prisma schema lives in a folder, `prisma/schema/*.prisma`, one file per domain (tenancy, auth, catalog, warehousing, sales, ops, crm, support, notifications). `prisma.config.ts` points the CLI at it.
- Ids are `cuid()` strings.
- Entity-to-entity links that existing features rely on are real relations. "Actor" fields (`userId`, `createdBy`, `assignedToId`, optional cross-links such as a ticket's `productId`) stay plain strings on purpose; the relation is added by the feature that needs the join.
- Every tier shares one database shape. `prisma/schema/` is bucketed `shared` and must not be stripped per tier, because Core order fulfilment reads and writes `StockAllocation`, a Pro model.
- The app uses the pooled URL (`DATABASE_URL`); the Prisma CLI uses `DIRECT_URL` when set.

## Alternatives Considered

- **Stay on MongoDB**: the reasons were recorded in a Milestone 0 plan outside this repository, not here.
- **A schema per tier**: rejected in the `schema.prisma` header comment because of the Core-to-Pro coupling above.

## Consequences

- Plain-string actor fields have no foreign-key protection; orphan references are possible.
- Money columns are `Float`.
- `CLAUDE.md` and `docs/PROJECT_WALKTHROUGH.md` still describe MongoDB and are wrong on this point.
- **Revisit if:** a tier can be shipped with a different database shape, or money moves to integer cents.

## Enforced by

`prisma migrate deploy` (staging automatic, production manual) and `.github/workflows/migration-check.yml` (schema/migration drift). The "do not strip the schema per tier" rule is `review only`.

## Binds

- `prisma/schema/`
- `prisma/migrations/`
- `prisma.config.ts`
- `scripts/export-tier.ts`
