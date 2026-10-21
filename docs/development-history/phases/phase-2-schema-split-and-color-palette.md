# Phase 2 — Prisma multi-file schema split, editable color palette

**Status:** Complete and verified. **Date:** 2026-08 (session prior to 2026-08-24).

## Why

Two independent user requests landed together: split the single
`prisma/schema.prisma` into per-domain files (annotated with which tier owns
each model, where possible), and make the app's color palette
user-editable rather than hardcoded in `globals.css`.

## What was built

### Prisma schema split
- `prisma/schema/` replacing the single `schema.prisma` — 9 domain files
  (`schema.prisma`, `tenancy.prisma`, `auth.prisma`, `catalog.prisma`,
  `warehousing.prisma`, `crm.prisma`, `sales.prisma`, `notifications.prisma`,
  `support.prisma`, `ops.prisma`), each header-commented with tier ownership.
  Uses Prisma 6.19.3's multi-file "schema folder" mode (GA since 6.7, no
  `previewFeatures` flag needed).
- **`prisma.config.ts`** (new): `schema: "prisma/schema"`,
  `migrations: { path: "prisma/migrations" }`, plus
  `process.loadEnvFile(".env")` at the top (Node 20.6+ native).
- Migrated the `mongodb` dependency out entirely (`pnpm remove mongodb`) —
  this project is Postgres-only.

### Editable color palette
- HSL-triplet string format (`"H S% L%"`, matching `globals.css`'s
  `--primary`/`--ring` CSS custom properties).
- Stored via the existing generic `SystemConfig` model/API — new `"color"`
  value type, new `"appearance"` category (no new model needed).
- Injected via SSR into the root `<html>` element's inline `style` object.

## Errors and fixes

- `prisma.config.ts`'s presence disabled Prisma's auto-`.env`-loading
  (`prisma validate` failed with `Environment variable not found:
  DATABASE_URL`) — fixed with `process.loadEnvFile(".env")`.
- `prisma migrate status` reported "No migration found" despite 3 real
  migrations on disk — `prisma.config.ts` changed where the CLI looks for
  migrations by default. Fixed by adding `migrations: { path:
  "prisma/migrations" }` to `defineConfig()`.
- `scripts/check-tier-manifest-coverage.ts` needed `"prisma"` added to
  `LOOSE_FILE_DIRS` once the 14 `prisma/*.ts` files started being tracked.

## Verification

`prisma validate`, `prisma migrate status`, `tsc --noEmit`,
`pnpm check:manifest`.

## Next up

Also delivered in this window (design-only, no code): a full dashboard
design overview (desktop + mobile), published as an Artifact, matching the
real color palette — fixed an SVG-injection rendering bug and 3 sub-44px
mobile touch targets along the way.

Phase 3 — close the cross-tier couplings the Phase 1 export mechanism
surfaced once actually run against real Core-bucketed code.
