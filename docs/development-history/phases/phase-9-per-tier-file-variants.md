# Phase 9 — Per-tier file-variant export capability

**Status:** Complete and verified (rescoped from the tracker's original 3-item
list — see below). **Date:** 2026-08-27.

## Why

`tier-manifest.json`'s own `$comment` already anticipated this exact need: a
`page.core.tsx`/`page.pro.tsx`-style sibling-file override mechanism in
`scripts/export-tier.ts`, "unbuilt, would need its own design pass." Several
places statically import from a core-bucketed file into pro/premium-bucketed
code that a runtime role-check can't fix (the bundler/`tsc` needs the module
to exist regardless of which role is signed in).

## Rescoping (user decision, mid-phase)

Research before implementation found the three originally-tracked targets
were uneven in size:

- **`ProductDetailPage.tsx`** turned out much bigger than tracked: its two
  parent SSR routes reach into `lib/server/forecasting-data.ts` and
  `lib/server/product-reviews-detail-data.ts` — both bucketed **shared**
  (always-included) yet themselves import premium-only
  `lib/forecasting`/`@/prisma/product-review`, a shared→premium leak that
  breaks every tier's export, not just Core's. A 9th coupled page
  (`app/admin/dashboard-overall-insights`) was also found, missed by Phase
  8's 8-page sweep. Deferred to a new Phase 11 (see `out/ims_progress.md`).
- **Stripe reconciliation**: the SSR routes and `InvoiceDetailPage.tsx` were
  clean (1-2 offending imports each), but `components/admin/AdminOrderDetailContent.tsx`
  had **eight** unrelated pro/premium imports (invoice/order dialogs,
  shipping, audit-user-href, order-ship-eligibility, order detail,
  order-destructive-copy) — same "component-splitting project" shape as
  ProductDetailPage, not a contained Stripe fix. The orders-side route +
  content pair is deferred alongside it (new Phase 10).
- **`category-forecast-rollup.ts`**: genuinely clean and as-tracked.

This phase built the mechanism and applied it only to the confirmed-clean
set: the invoice side of Stripe reconciliation, and the category/supplier/
warehouse forecast-rollup coupling.

## What was built

**`scripts/export-tier.ts`** — a file `Foo.tsx` may have a sibling
`Foo.core.tsx` / `Foo.pro.tsx` / `Foo.premium.tsx` that replaces it (under
the original name) when exporting that *exact* tier. `copyPath` no longer
uses `fs.cpSync`'s filter (which can only include/exclude, not redirect
content) — it now walks directories manually and resolves each file through
`resolveSource()`, which checks for a same-tier variant and falls back to
the default file otherwise.

**Deliberately no cross-tier fallback.** The first implementation tried a
"pro falls back to core" fallback chain (reasoning: a core-safe variant is
always safe for pro too). Verification caught this as wrong: for
`InvoiceDetailPage.tsx`/`app/admin/invoices/[id]/page.tsx`, whose coupling
is to *pro*-bucketed `lib/payments`/`components/payments` (available in
Pro), the fallback silently substituted the Core-stripped variant into the
Pro export too — dropping the Stripe payment button from Pro even though
Pro is entitled to it. Confirmed via `pnpm export:pro` + grep: the fallback
version left `InvoiceDetailPage.tsx` with zero Stripe-related code in the
Pro output. Fixed by removing the fallback entirely (exact-tier match only)
and instead authoring explicit `.pro.tsx` duplicates for the three
forecast-rollup pages, whose gap really is premium-exclusive (Pro lacks
`lib/forecasting` too, unlike `lib/payments`).

**`scripts/check-tier-manifest-coverage.ts`** — one skip line: a filename
matching `\.(core|pro|premium)\.[jt]sx?$` is a variant override of its base
file, not an independently classified unit, so it's excluded from the
missing-classification scan.

## Files added

- `components/Pages/{Category,Supplier,Warehouse}DetailPage.{core,pro}.tsx`
  (6 files) — drop the `buildCategoryForecastRollup` import/usage/
  `showUrgentForecastTable` prop. `WarehouseDetailPage`'s variants also
  documented (not fixed) a second, separate coupling: `lib/insights/
  warehouse-insights-compute` (pro-bucketed) drives the page's basic
  stock-summary cards, not a forecast enrichment — stripping it would gut
  real functionality and needs its own design pass, so it's left importing
  fine in the `.pro.` variant (Pro has `lib/insights`) and left broken (as
  before) in the `.core.` variant, same as it was in the default file.
- `app/admin/invoices/[id]/page.core.tsx`,
  `components/Pages/InvoiceDetailPage.core.tsx` — drop
  `reconcileStripeReturnBeforeDetail` / `useStripeCheckoutReturn` /
  `PaymentDialog` (Core invoices are manual-PDF-only per the manifest's own
  documented non-bug).
- `lib/forecasting/category-forecast-rollup.test.ts` — a stray unit test for
  this premium function was living in the shared-bucketed
  `lib/server/category-detail-data.test.ts` (a second, smaller shared→
  premium leak, found via the `export:core` + `tsc` proof, not by the
  original research). Relocated to sit next to the implementation it tests;
  removed from the shared file.

## Verification

- `npx tsc --noEmit` (full repo) clean.
- `pnpm check:manifest` clean.
- `pnpm export:core` + symlinked `node_modules` + `npx tsc --noEmit`: every
  error touching the 5 fixed files is gone; the only remaining error on a
  touched file is the documented, deliberately-untouched
  `warehouse-insights-compute` import on `WarehouseDetailPage.tsx`.
- `pnpm export:pro` + the same check — **new, not previously run against
  this file set**: fully clean on all 5 fixed files, and confirmed (via
  grep on the exported output) that Pro's `InvoiceDetailPage.tsx` and
  `app/admin/invoices/[id]/page.tsx` still contain the real Stripe
  reconciliation code — proving the exact-tier-only fix actually prevents
  the silent Pro regression the earlier fallback design would have caused.
- `pnpm test`: 801/802 passing, same pre-existing unrelated failure
  (`lib/orders/invoice-event-date.test.ts` — a hardcoded due-date fixture
  now in the past relative to the real clock; untouched by this phase).
- `npx eslint` on every new file: 0 warnings, 0 errors.

## Deferred (new phases)

- **Phase 10** — `app/admin/orders/[id]/page.tsx` +
  `components/admin/AdminOrderDetailContent.tsx`'s 8-import coupling.
- **Phase 11** — `ProductDetailPage.tsx` + its 2 SSR routes + the
  `lib/server/forecasting-data.ts`/`lib/server/product-reviews-detail-data.ts`
  shared→premium leak + the newly-found `app/admin/dashboard-overall-insights`
  page.
- **Phase 12** (renumbered from the old Phase 10) — `app/api/products/route.ts`
  PUT stock-reconcile split.
- **Phase 13** (renumbered from the old Phase 11) — `hooks/queries/index.ts`
  barrel's 13 other pro/premium hooks.
