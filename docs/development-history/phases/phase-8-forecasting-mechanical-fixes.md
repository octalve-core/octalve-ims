# Phase 8 — Apply the mechanical forecasting-coupling fixes

**Status:** Complete and verified. **Date:** 2026-08-27.

## Why

Phase 4 rescoped the "systemic 8-page AI-forecasting coupling" down to two
cheap, mechanical fixes: reclassify 4 pure leaf files, and drop a blocking
SSR forecast prefetch across 8 detail pages. Digging in to actually apply
them surfaced more real coupling than Phase 4's investigation had caught —
documented here rather than silently expanding scope.

## What Phase 4 didn't catch

- Of the 4 "pure leaf files," 3 (`product-insights-enrich.ts`,
  `warehouse-stock-aggregate.ts`, `catalog-allocation-copy.ts`) really were
  mis-bucketed — but they live in whole-folder-bucketed directories
  (`lib/insights` = pro, `lib/stock-allocation` = pro), and the manifest
  checker treats a bucketed folder as one atomic unit — individual files
  inside can't be reclassified without a physical move, following the same
  pattern as Phase 3's relocations.
- The 4th, `lib/forecasting/entity-forecast.ts`, is **not** actually
  mis-bucketed: its only parameter type, `ProductDemandForecast`, is defined
  in the deliberately premium-bucketed `types/forecasting.ts` (AI forecast
  result shape, not a shared DB row). Moving the file alone would just
  relocate the same compile error to a type-only import instead of a value
  import. Left in `lib/forecasting` (premium) — this one genuinely still
  needs the Phase 9 per-tier-file-variant capability for
  `ProductDetailPage.tsx`.
- `product-insights-enrich.ts`/`warehouse-stock-aggregate.ts` also
  type-depend on `StockAllocation` from `types/stock-allocation.ts` (pro).
  Checked whether Core code already has a precedent for touching this shape
  (`lib/products/decrement-stock-allocations.ts`, core) — it uses Prisma's
  own generated types directly, not this hand-written interface. Since the
  underlying `StockAllocation` **table** is already fully shared across
  every tier (Phase 1's core finding) and this type is a plain row/API
  shape with no business logic, reclassified `types/stock-allocation.ts`
  itself to core too — a data contract, not a feature.
- The blocking-SSR-prefetch drop had a second, separate blocker:
  `ProductDetailPage.tsx` and its siblings call `useForecastingSummary`
  (`hooks/queries/use-forecasting.ts`) via the **shared** barrel
  `hooks/queries/index.ts`. That hook is pure (`useQuery` + a generic HTTP
  client + shared query-key helpers, zero server-only imports) — genuinely
  the same class of mis-bucketed pure file as the others, just individually
  tracked (unlike the folder-bucketed ones) since `hooks/queries` files are
  tracked per-file in the manifest. Reclassified premium → core; no physical
  move needed.

## What was done

- `git mv`'d `product-insights-enrich.ts`, `warehouse-stock-aggregate.ts`
  (from `lib/insights/`) and `catalog-allocation-copy.ts` (from
  `lib/stock-allocation/`), plus their tests, into the already-core-bucketed
  `lib/catalog/`. Fixed the one internal cross-import and every external
  caller (5 + 4 + 3 files, some overlapping).
- Reclassified `types/stock-allocation.ts` (pro → core) and
  `hooks/queries/use-forecasting.ts` (premium → core) in
  `tier-manifest.json`.
- Dropped the blocking `getCachedForecastingSummary` SSR call +
  `initialForecasting` prop threading from all 8 detail-page route files
  (`app/{admin/,}products/[id]`, `app/{admin/,}categories/[id]`,
  `app/{admin/,}suppliers/[id]`, `app/{admin/,}warehouses/[id]`) — each now
  relies solely on the existing `useForecastingSummary` client hook
  (already used downstream, already tolerant of undefined initial data).
  Removed the now-fully-dead `getCachedForecastingSummary` function itself
  from `lib/server/forecasting-data.ts`.

## A separate, bigger discovery — reported, not fixed here

Investigating why the barrel didn't resolve `useForecastingSummary` in a
Core export led to checking the **whole** barrel: `hooks/queries/index.ts`
(shared) re-exports from **13 other** pro/premium hook files unrelated to
forecasting (support-tickets, product-reviews, admin-counts, client-portal,
supplier-portal, stock-allocation, system-config, audit-logs, portal,
payments, shipping, history, email-preferences) — every one of those
re-export lines fails `tsc` in a Core export the same way. Roughly 40 files
across the app import one of those hooks via the barrel and would need
their import switched to the concrete file path, plus the barrel's own
re-export lines removed. This is real, but it's a separate, much larger
piece of work spanning features never in this phase's scope (payments,
shipping, reviews, etc.) — flagged for the user to decide on rather than
silently absorbed into "the forecasting fix."

## Verification

`tsc --noEmit` clean; `pnpm check:manifest` clean; `pnpm test` at the
794/795 baseline (same pre-existing unrelated failure); `pnpm export:core` +
fresh `tsc --noEmit` confirmed every forecasting/leaf-file/stock-allocation
error from the earlier capture is gone, with only the already-known-deferred
items remaining (`entity-forecast.ts`, `category-forecast-rollup.ts` — not
previously catalogued, worth adding to the gap note — and the barrel's other
13 hooks, newly discovered above).
