# Phase 4 — Rescoping the "systemic AI-forecasting coupling"

**Status:** Investigation complete, fix not yet applied. **Date:** 2026-08-25.

## Why

Phase 3's deferred note called this "not a relocation fix... a real
architecture project on the same scale as the export mechanism itself" —
`lib/server/forecasting-data.ts`'s `getCachedForecastingSummary` (AI demand
forecasting, Premium) statically imported by 8 different Core-bucketed
pages, plus `ProductDetailPage.tsx` carrying 6 Pro/Premium imports. Before
committing to building new export-mechanism infrastructure to solve this,
today's session re-read every file involved to check whether that estimate
still held.

## What was found

Of `ProductDetailPage.tsx`'s 6 flagged imports, only 2 are genuinely
premium:

- **Genuinely premium (real Prisma/server logic or real gated UI):**
  - `lib/server/product-reviews-detail-data.ts` (type-only import of
    `ReviewEligibilityResult`) — real Prisma-backed SSR fetcher.
  - `components/product-reviews/ProductReviewsSection` — real Premium UI
    component (reviews feature).
- **Mis-bucketed pure leaf functions, zero server/Prisma imports** (same
  class of bug as the `CATALOG_LOW_STOCK_THRESHOLD` leak fixed in Phase 3):
  - `lib/forecasting/entity-forecast.ts` (`findProductForecast`) — pure
    lookup over an already-fetched `ForecastingSummary`.
  - `lib/insights/product-insights-enrich.ts`
    (`enrichProductInsightsWithWarehouseStock`) — pure merge function.
  - `lib/insights/warehouse-stock-aggregate.ts` (`sumAllocatedQuantity` and
    siblings) — pure aggregation over already-fetched `StockAllocation[]`.
  - `lib/stock-allocation/catalog-allocation-copy.ts`
    (`formatCatalogCommitWarehouseHint`) — pure string formatter.

None of these four call `@/prisma/client`, hit Redis, or do anything
tier-exclusive — they're display-formatting helpers over data the client
already has. Reclassifying their manifest bucket from pro/premium to core
requires zero code changes.

For the 8-page forecasting SSR coupling: all 8 pages
(`app/{admin/,}products/[id]`, `app/{admin/,}categories/[id]`,
`app/{admin/,}suppliers/[id]`, `app/{admin/,}warehouses/[id]`) already follow
the exact pattern already proven safe in Phase 3 item 7
(`app/admin/warehouses/page.tsx`'s warehouse-stock-summary fix): the SSR call
to `getCachedForecastingSummary(user.id)` is only a hydration convenience —
`ProductDetailPage.tsx` (and presumably its siblings) already has a
client-side `useForecastingSummary(initialForecasting ?? undefined, {
enabled: isAdminRole })` hook that tolerates `undefined` initial data. Every
page passes `initialForecasting` as `initialX ?? undefined`, same as the
already-fixed warehouse case. Dropping the blocking SSR prefetch here is
mechanical, not a new architecture project.

## What's actually left (genuinely hard, same class as the Stripe SSR-flash
case already deferred in Phase 3)

`ProductReviewsSection` and its SSR data are a real tier-exclusive **feature**,
not just enrichment data — the bundler statically resolves the import
regardless of runtime role checks, so the module must not exist at all in a
Core export. That can't be fixed by reclassification; it needs either a new
"per-tier file variant" capability in `export-tier.ts` (a `page.pro.tsx`
sibling the export script swaps in) or accepting the reviews section isn't
in Core's copy of `ProductDetailPage.tsx` at all. This is now understood to
be needed in exactly **two** known places (this one, plus the Stripe
checkout-return reconciliation from Phase 3) — not eight.

## Recommendation given to the user

1. Reclassify the 4 pure leaf files core-bucket (cheap, mechanical).
2. Drop the blocking SSR forecasting prefetch across the 8 pages (cheap,
   mechanical, same pattern as the already-fixed warehouse case).
3. Build the "per-tier file variant" export capability once, for the 2
   genuinely-hard cases (reviews section, Stripe reconciliation) rather than
   improvising two one-off hacks.
4. Treat `app/api/products/route.ts`'s PUT stock-reconcile split as a
   separate, smaller, bounded task — no new infrastructure needed.

User confirmed: proceed with this recommendation.

## Next up

Apply items 1 and 2 above (mechanical, low-risk); then design and build the
per-tier file-variant export capability for item 3; then item 4 as its own
pass.
