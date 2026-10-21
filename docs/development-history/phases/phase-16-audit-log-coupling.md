# Phase 16 — `prisma/audit-log.ts` core/pro coupling

**Status:** Complete and verified. **Date:** 2026-08-28.

## Why

Filed during Phase 10 as a single-file finding: `app/api/orders/[id]/route.ts`
imports `createAuditLog` from `@/prisma/audit-log`, a pro-bucketed file, so
it breaks under `pnpm export:core` + `tsc --noEmit`. Re-investigated this
phase rather than fixed narrowly — grepping the repo showed this isn't an
orders-specific issue: **9 core-bucketed API routes**
(`categories`, `invoices`, `invoices/[id]`, `orders`, `orders/[id]`,
`products`, `suppliers`, `users`, `users/[id]`, `warehouses`) all call
`createAuditLog` fire-and-forget for basic audit trail on every write.
Only one route (`app/api/audit-logs`, itself pro-bucketed) uses the file's
other export, `getAuditLogs` (the paginated browse/filter query backing the
Pro-gated admin audit-log viewing UI).

This is the same "core write path + pro-gated read path in one file" shape
as `lib/products/decrement-stock-allocations.ts` and
`lib/server/order-review-context-data.ts` (Phase 12) — audit-trail writing
is core-tier value every route needs, while *browsing* the log is the
actual Pro feature.

## What was done

Mirrors Phase 12's transparent-variant approach exactly, rather than the
9-separate-route-variants that a narrower read of the original finding
would have produced:

- Reclassified `types/audit-log.ts` and `prisma/audit-log.ts` from `pro` to
  `core` in `tier-manifest.json` — `createAuditLog`'s input type and the
  file that defines it are core-tier needs, not Pro-only.
- Added the `AuditAction`/`AuditEntityType`/`AuditLog`/`CreateAuditLogInput`/
  `AuditLogFilters` re-export block back into `types/index.core.ts` (dropped
  there in Phase 15) — Core genuinely needs these now.
- Added `prisma/audit-log.core.ts`: a real `createAuditLog` (identical
  logic to the default file) with **no** `getAuditLogs` — Core's
  `tsc --noEmit` doesn't need it since `app/api/audit-logs` stays
  pro-bucketed and excluded from Core's export regardless.
- No `.pro.ts` variant needed: Pro/Premium correctly keep the default,
  full `prisma/audit-log.ts` (both functions) since Pro already includes
  the pro bucket, and only Core needs the stripped variant.
- Because the tier swap happens transparently at `prisma/audit-log.ts`'s
  existing import path, **none of the 9 calling routes needed to change.**

## Verification

`pnpm check:manifest`: OK (moving the same file to a different single
bucket doesn't create a double-classification). `pnpm export:core` +
symlinked `node_modules` + `tsc --noEmit`: all `@/prisma/audit-log` and
audit-log-type errors gone; total Core error count dropped 280→266 (the
Phase 15 end-state baseline, since Phase 15 and 16 landed back-to-back with
no intervening full re-verification of Phase 15's count — the 14-error
drop matches the 9 route-level `TS2307`s plus a few dependent errors).
`pnpm export:pro` + `tsc --noEmit`: unchanged at 165 — confirmed the
default file (with `getAuditLogs`) still exports correctly, no regression.
Full-repo `npx tsc --noEmit`: clean, exit 0. `pnpm test`: same 807/808
baseline (1 unrelated date-fixture failure).
