# Phase 21 (part 3) — portal dashboard data + warehouse insights clusters

**Status:** Complete and verified. **Date:** 2026-08-28.

## Portal dashboard data cluster

Investigating the 5 files flagged at the end of part 2
(`client-dashboard.ts`, `client-portal-data.ts`, `dashboard-data.ts`,
`supplier-dashboard.ts`, `supplier-portal-data.ts`) found **two different
answers**, not one — worth recording since the first hypothesis (all 5 are
premium-only, same shape as `product-reviews-data.ts`) turned out wrong
for 3 of them:

- **`dashboard-data.ts`, `client-dashboard.ts`, `supplier-dashboard.ts`
  were already correctly `shared`** — genuinely needed in every tier.
  `client-dashboard.ts`/`supplier-dashboard.ts` back
  `lib/server/list-page-stats.ts`'s `prefetchListPageStats()`, which
  branches by role (`client`/`supplier`/other) to prefetch the right stat
  cards for **`/orders`, `/invoices`, `/products`, `/categories`,
  `/warehouses`, `/suppliers`** — all core-bucketed list pages. Their
  `ClientPortalDashboard`/`SupplierPortalDashboard` types come from
  `types/portal.ts` (already core, Phase 19's "self-view within the
  shared lists" types) — a same-named-but-different-file trap: easy to
  confuse with the premium `types/client-portal.ts`/`supplier-portal.ts`.
  Their **only** real bug was the `payment-money-stats.ts` import (below)
  — fixed, no reclassification needed.
- **`client-portal-data.ts` and `supplier-portal-data.ts` genuinely are
  premium-only** — every real caller
  (`app/admin/client-portal/page.tsx`, `app/api/client-portal/route.ts`,
  `app/admin/supplier-portal/page.tsx`, `app/api/supplier-portal/route.ts`)
  is already premium-bucketed, and their types
  (`ClientPortalStats`/`SupplierPortalStats` etc.) come from the *actually*
  premium `types/client-portal.ts`/`types/supplier-portal.ts`. Reclassified
  both from the `lib/server` shared list to `premium`.

## The actual root cause: `lib/insights/payment-money-stats.ts`

All 3 of the "already shared, just broken" files failed on the same
single import: `@/lib/insights/payment-money-stats`. `lib/insights` was
one bare whole-folder `pro` manifest entry, but `payment-money-stats.ts`
is a pure, dependency-free invoice-math utility (own local types, no
prisma, no premium imports) needed by the **core** admin dashboard's
Revenue KPI card (`dashboard-data.ts`) as much as by the premium portal
dashboards. Reclassified it (and its test) to `core` — a strict widening,
safe for every tier above Core too.

The same `lib/insights` folder audit also caught
**`warehouse-insights-compute.ts`**, whose own header comment already
said "Client-safe: imported by WarehouseDetailPage for live stock CRUD
updates" — i.e. it was already known to be core-necessary, just never
fixed. It was broken for the same reason: bucketed `pro` when
`WarehouseDetailPage.core.tsx` needs it directly. Its own blocker was
**`types/warehouse-insights.ts`** — also `pro`-bucketed despite being a
pure, zero-dependency type file needed by `types/warehouse.ts` (core) and
`components/shared/WarehouseInsightsSection.tsx` (shared) — this is the
exact file Phase 15 flagged as "a separate, distinct rabbit hole" and
left untouched; it turned out to be the same one-line "wrong bucket, pure
content" fix as the others.

`lib/insights/business-insights-warehouse-rollup.ts` was checked too and
confirmed genuinely pro-only (its only callers,
`components/Pages/BusinessInsightPage.tsx` and
`components/business-insights/BusinessInsightsWarehouseSection.tsx`, are
both already pro-bucketed) — left as `pro`.

## Fix

- Added `"lib/insights"` to `FOLDER_LEVEL_DIRS` (same treatment as
  `lib/server`/`app/api/admin` this phase) and individually classified its
  6 files: `payment-money-stats.ts`/`.test.ts` and
  `warehouse-insights-compute.ts`/`.test.ts` → `core`;
  `business-insights-warehouse-rollup.ts`/`.test.ts` stays `pro`.
- `types/warehouse-insights.ts`: `pro` → `core`.
- `lib/server/client-portal-data.ts` + `supplier-portal-data.ts`:
  `shared` → `premium`.
- No application code changed — every fix here is a pure manifest
  reclassification once the real caller graph was traced.

## Verification

`node -e "JSON.parse(...)"` (manifest valid) → `pnpm check:manifest` (OK)
→ `pnpm export:core` + symlinked `node_modules` + `npx tsc --noEmit`:
**69 → 47** (-22) → `pnpm export:pro` + same check: **33 → 18** (-15) →
full-repo `npx tsc --noEmit` (clean) → `pnpm test` (811/812, same known
pre-existing date-fixture failure, no new dynamic test-case shift since
no new `.core`/`.pro` variant files were created this part).

## Remaining Core errors (47) — all already-known or newly filed

- `app/api/products/route.ts`, `components/products/ProductFormDialog.tsx`,
  `components/warehouses/AllocateStockDialog.tsx`,
  `hooks/use-catalog-quantity-reconcile-preview.ts`,
  `lib/products/enrich-product-committed-quantity.ts`,
  `lib/products/order-stock-reservation.ts`,
  `lib/server/product-stock-data.ts`,
  `lib/server/warehouse-stock-data.ts`, `app/warehouses/page.tsx` —
  Phase 13's already-accepted `lib/stock-allocation` debt.
- `lib/api/client.ts` — the already-flagged big split (18 remaining
  errors in Pro too).
- **New, not yet investigated**: `app/api/invoices/[id]/send/route.ts`
  (→ `@/lib/stripe`), `components/invoices/InvoiceFilters.tsx` +
  `components/orders/OrderFilters.tsx` (→ `@/lib/export`),
  `components/orders/detail/OrderDetailActionBar.tsx` (→
  `@/components/payments`, `@/components/shipping`,
  `@/lib/payments/resolve-order-pay-amount` — broken in **both** Core and
  Pro, so this one mixes pro-only payments with premium-only shipping in
  one file), `hooks/use-back-with-refresh.ts` (→
  `@/lib/payments/stripe-return`). Each looks like the same "core feature
  mixed with pro/premium feature in one file" shape as earlier phases,
  needing real `.core.`/`.pro.` variants rather than a reclassification
  (these are genuinely pro/premium features — send-invoice-with-payment-link,
  CSV/PDF export, payment/shipping actions, Stripe-return refresh — not
  misbucketed pure content). Filed as a new Phase 21 item: "payments/
  shipping/export action-bar mixing cluster."
