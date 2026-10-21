# Phase 3 — Close documented Core-export cross-tier couplings

**Status:** Complete for the low-risk batch (10 items); 4 items explicitly
deferred and documented. **Date:** 2026-08-24 and earlier.

## Why

Running `pnpm export:core` + `tsc --noEmit` against the real stripped output
(the authoritative test established in Phase 1) proved several Core-bucketed
files statically import Pro/Premium-only code — a real Core export didn't
compile. Three Explore agents investigated every documented case in
`tier-manifest.json`'s "KNOWN REAL GAP" note.

## What was fixed (low-risk relocations/reclassifications, all verified via
the `export:core` + `tsc` test)

1. `components/supplier/*` (8 files) — zero portal-specific content; moved
   manifest bucket premium → core.
2. `lib/payments/order-payment-from-amounts.ts` → renamed/relocated to
   `lib/invoices/order-payment-sync.ts` — pure money-math, zero Stripe
   imports; was miscategorized as Pro. 5 callers updated.
3. `lib/server/support-tickets-data.ts` + `support-ticket-detail-data.ts` +
   `support-ticket-replies-data.ts` — genuinely Premium SSR fetchers, wrong
   folder; moved into `lib/support-tickets/`. 7 callers updated.
4. `lib/server/product-insights.ts` — removed dead `stockAllocations`
   parameter/inline computation (both real callers already passed `null`);
   now imports `CATALOG_LOW_STOCK_THRESHOLD` from
   `@/lib/server/catalog-insights` instead of the deleted
   `@/lib/insights/constants`.
5. `lib/server/catalog-insights.ts` — was importing Pro-bucketed
   `CatalogEntityInsights`/`CatalogSalesTrendPoint` purely for a return-type
   annotation it never actually used (`warehouseStock` never set/read here).
   Now defines `CATALOG_LOW_STOCK_THRESHOLD` locally instead of re-exporting
   from the deleted `lib/insights/constants.ts` (removed after confirming
   zero remaining references).
6. `app/api/products/import/route.ts` → relocated to
   `app/api/products-import/route.ts`, bucketed pro (out from under the
   core-bucketed `app/api/products/` folder). Updated
   `ProductImportDialog.tsx`'s fetch URL, `ApiDocsPage.tsx`'s docs entry, and
   `invalidate-coverage.test.ts`'s path-keyed lookup table.
7. `app/admin/warehouses/page.tsx` — dropped the blocking SSR
   `getWarehouseStockSummary(user.id)` call; `AdminWarehousesContent`'s
   already-optional `initialWarehouseSummary` prop simply isn't passed —
   relies entirely on the existing client-side `useWarehouseStockSummary`
   hook (tolerates `undefined` initial data). Supplementary panel, not core
   page content — no flash-prevention concern.
8. `lib/history/history-data.ts` + `history-detail-data.ts` — confirmed
   exclusively used by already-pro-bucketed pages; relocated out of
   `lib/server/`. 3 callers updated.

Plus the RBAC async-conversion follow-through from Phase 1
(`ticket-assignee-policy.ts` and its test, `stock-product-access.ts`,
`catalog-entity-access.ts`, and their call sites across
`app/api/support-tickets/*`, `lib/server/*-detail-data.ts`).

## What was investigated and deliberately NOT fixed yet (documented in
`tier-manifest.json`'s "KNOWN REAL GAP" note)

- **`ProductDetailPage.tsx`'s six Pro/Premium imports** — see Phase 4 below;
  this was reassessed and mostly resolved.
- **Stripe checkout-return SSR reconciliation** (`app/admin/orders/[id]`,
  `app/admin/invoices/[id]` → `lib/payments/reconcile-stripe-return`) — the
  SSR call is deliberately blocking (REQ-0209) to avoid a Pending→Confirmed
  flash after a Stripe redirect. Moving it client-side would reintroduce
  that exact flash. Needs either a new "per-tier file variant" export
  capability (unbuilt) or an accepted UX trade-off. Not decided.
- **`app/api/products/route.ts`'s PUT handler** mixes a core reserved-quantity
  guard with genuinely-Pro warehouse-shrink planning in one transaction —
  splitting changes atomicity on live inventory-mutation code. Left as-is,
  documented.

## Verification

`tsc --noEmit`, `pnpm check:manifest`, `pnpm export:core` + `tsc --noEmit`
against a fresh export, `pnpm test` (794/795 baseline — the 1 failure is a
pre-existing unrelated hardcoded-date test), `pnpm lint`, `next build`.

## Next up

Phase 4 — reassess the two items flagged as "systemic architecture
projects" (product-detail enrichment imports, 8-page AI-forecasting SSR
coupling) now that the actual scope is understood in detail.
