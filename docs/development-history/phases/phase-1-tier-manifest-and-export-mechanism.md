# Phase 1 — Tier manifest, export mechanism, and RBAC primitive

**Status:** Complete and verified. **Date:** 2026-08 (session prior to 2026-08-24).

## Why

The monorepo + tier-gated export strategy decided in Phase 0 needed the
actual machinery: a single source of truth for which files belong to which
tier, a script that strips a monorepo checkout down to a real Core/Pro/Premium
export, automated enforcement so nothing can drift out of bucket unnoticed,
and — since Pro+ introduces a real permission model — a shared authorization
primitive so tier-gating and role-gating don't diverge into two competing
systems.

## What was built

- **`tier-manifest.json`** (repo root) — four buckets (`shared`, `core`,
  `pro`, `premium`; core ⊂ pro ⊂ premium, additive). Covers folder-level dirs
  and individually-tracked loose files.
- **`eslint.tier-boundaries.mjs`** — generates `import/no-restricted-paths`
  zones from the manifest at config-load time: `shared` can't import from
  `core`/`pro`/`premium`; `core` can't import from `pro`/`premium`; `pro`
  can't import from `premium`. Catches cross-tier leaks at lint time, before
  a real export is even attempted.
- **`scripts/check-tier-manifest-coverage.ts`** — walks the tracked
  directories/files and fails the moment anything is unmapped or
  double-mapped. Wired as `pnpm check:manifest`.
- **`scripts/export-tier.ts`** — copies the monorepo into a stripped tier
  export. Has an `INTERNAL_ONLY` exclusion set (files that never ship even if
  "shared"-bucketed, e.g. `tier-manifest.json` itself), an `ALWAYS_COPY_ROOT`
  list (root config outside the manifest's tracked scope), and an
  `ALWAYS_EXCLUDE` set (`node_modules`, `.next`, `.git`, `.env`, etc.). Wired
  as `pnpm export:core` / `export:pro` / `export:premium`.
- **`lib/auth/can.ts`** — `can(session, resource, action): Promise<boolean>`.
  Pro+ path queries `prisma.permission.findFirst`; Core/legacy path uses a
  hardcoded `LEGACY_ROLE_PERMISSIONS` table keyed by the existing free-text
  `role` string (`admin`/`user`/`supplier`/`client`/`retailer`), with `admin`
  short-circuiting to always-true. Wired into the three centralized policy
  files that previously hardcoded role checks
  (`lib/support-tickets/ticket-assignee-policy.ts`,
  `lib/products/stock-product-access.ts`, `lib/server/catalog-entity-access.ts`)
  and their call sites.

## Critical architectural finding

The schema/database is **shared in full across all tier exports** — one
Postgres DB, every model always present — because Core-tier code (e.g.
`lib/products/decrement-stock-allocations.ts`) has real runtime dependencies
on Pro-tier tables (`StockAllocation`). This means the authoritative test for
"does a Core export actually work" is `pnpm export:core` → `tsc --noEmit`
against the output, not manual reasoning about imports. This finding drove
every later coupling-fix phase.

## Errors and fixes

- **Off-by-one in `export-tier.ts`**: `BUCKET_ORDER.slice(0,
  indexOf(tier)+2)` pulled in one extra tier bucket (a Core export also got
  Pro). Caught before running, fixed to `+1`.

## Verification

`tsc --noEmit`, `pnpm check:manifest`, `pnpm export:core` + `tsc --noEmit`
against the stripped output, `pnpm test`.

## Next up

Phase 2 — Postgres/Prisma multi-file schema split (with tier ownership
comments) and the editable color-palette feature.
