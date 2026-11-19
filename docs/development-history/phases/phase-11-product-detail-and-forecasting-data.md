# Phase 11 — ProductDetailPage.tsx's 2 direct premium imports + forecasting-data.ts relocation

**Status:** Complete and verified (rescoped mid-phase, documented). **Date:** 2026-08-27.

## Why

Phase 9 deferred `ProductDetailPage.tsx` as a "real architecture project on
the same order of size as the tier-export mechanism itself," per
`tier-manifest.json`'s own `$comment`. Fresh research at the start of this
phase found that framing stale on two counts:

- Of the "six Pro/Premium imports" the manifest named, 3
  (`lib/insights/product-insights-enrich`, `lib/insights/warehouse-stock-aggregate`,
  `lib/stock-allocation/catalog-allocation-copy`) had already been relocated
  into core-bucketed `lib/catalog/` back in Phase 8. A direct `npx eslint`
  run on the file showed only 2 live warnings, not six.
- The manifest's "8-page forecasting fan-out" (naming a function
  `getCachedForecastingSummary`) doesn't exist anywhere in the repo — a
  prior cleanup pass had already dropped it down to a single live caller,
  `app/admin/dashboard-overall-insights/page.tsx`.

## What Phase 9's own research surfaced that hadn't been caught

Fixing the third piece — the SSR reviews/eligibility fetch
(`lib/server/product-reviews-detail-data.ts`) — turned out to have a wider
blast radius than tracked: it's also consumed by
`lib/server/order-review-context-data.ts`, shared infrastructure reused by
the order and invoice detail routes (not just the 2 product routes), since
"can this user write a review" is cross-cutting across all three entity
types. Presented to the user as a scope choice; **decision: defer that
piece to a new phase** rather than pull order/invoice routes into what was
scoped as a ProductDetailPage fix. See Phase 12 (new) below.

## What was done

- `ProductDetailPage.{core,pro}.tsx` — paired variants (both tiers need
  the same drop; `lib/forecasting` and `components/product-reviews` are
  both premium-exclusive) dropping `findProductForecast` (entity-forecast)
  + its `productForecast` `useMemo`/prop, and `ProductReviewsSection` +
  its JSX render block. The `initialReviews`/`initialEligibility` props
  stay in the signature unused (routes still fetch and pass them) —
  intentional, matches the deferred scope in Phase 12.
- `git mv lib/server/forecasting-data.ts lib/forecasting/forecasting-data.ts`
  — no manifest edit needed (both are whole-folder `FOLDER_LEVEL_DIRS`
  entries). Fixed the file's own direct value-import leak
  (`generateForecastingSummary`).
- Updated the one real caller,
  `app/admin/dashboard-overall-insights/page.tsx`, to the new import path,
  and added paired `.core.tsx`/`.pro.tsx` variants dropping the
  forecasting fetch entirely (`initialForecasting` is an optional prop on
  `AdminDashboardMergedView`, confirmed before assuming it could be
  omitted).
- Rewrote `tier-manifest.json`'s stale `$comment` block: moved the
  now-resolved Stripe-reconciliation and ProductDetailPage items (Phases
  9-11) into a new "RESOLVED" section, corrected the forecasting-data.ts
  narrative (1 caller, not 8; `getCachedForecastingSummary` doesn't exist),
  and added the two barrel issues (`types/index.ts`, `hooks/queries/index.ts`)
  and the deferred reviews-SSR-fetch ripple to the "Still open" list so
  the gap ledger matches current reality.

## A second, separate discovery — reported, not fixed here

Running the authoritative `pnpm export:core` + `tsc --noEmit` check
surfaced 5 implicit-`any` errors in `ProductDetailPage.tsx` around
`warehouseAllocations.reduce(...)` calls. Traced to a *different*,
already-known, already-tracked cause: `useStockByProduct` is consumed via
the `hooks/queries/index.ts` shared barrel (Phase 8's discovery, Phase 13
backlog — 13 other pro/premium hooks re-exported from a shared file break
Core `tsc` the same way), degrading inference for co-located barrel
exports. Confirmed via the full-repo `tsc --noEmit` (against real,
unstripped `node_modules`) being completely clean — this is Core-export
specific, not a real bug in the source. Not fixed here; it's the same
barrel issue already scoped as its own phase, not new scope creep.

## Verification

`tsc --noEmit` (full repo) clean; `pnpm check:manifest` clean; `npx eslint`
on all touched/new files — default files keep their pre-existing warnings,
all `.core.`/`.pro.` variants show 0; `pnpm export:core` + symlinked
`node_modules` + `tsc --noEmit`: confirmed the entity-forecast/
ProductReviewsSection/forecasting-data errors are gone, `types/index.ts`
and `product-reviews-detail-data.ts` pre-existing barrel errors remain
(expected, tracked separately, not a regression); `pnpm export:pro` + the
same check: confirmed both `.pro.tsx` pairs are picked up and clean (grep
confirmed zero `ProductReviewsSection`/`entity-forecast`/`forecasting-data`
occurrences beyond doc-comment mentions in either stripped tree);
`pnpm test` at the same 807/808 baseline (1 pre-existing unrelated
date-fixture failure).
