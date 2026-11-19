# Phase 19 — remaining hook/type mis-bucketing (read-only feature hooks)

**Status:** Complete and verified for the reclassification-safe subset.
**Date:** 2026-08-28.

## Why

After Phase 18's `components/admin` fix, ~18 files still failed under
`pnpm export:core` + `tsc --noEmit` for hook/type import reasons. Rather
than assume each needs a `.core.tsx`/`.pro.tsx` variant (dropping the
premium usage), each group was investigated on its own terms first —
Phase 18 already proved "the file is just mis-bucketed" can be the real
answer more often than "the usage needs gating."

## What was done — 4 more reclassifications, same shape as Phase 16/18

1. **`hooks/queries/use-stock-allocation.ts`**: pro → core. Its own
   imports are all shared/core already (`@/lib/api`, `@/lib/react-query`,
   and `@/types`' `StockAllocation` family — already core since Phase 13).
   Proof this was needed, not optional: `WarehouseDetailPage.core.tsx` and
   `ProductDetailPage`'s Core path *already* unconditionally use
   `AllocateStockDialog.tsx`/`TransferStockDialog.tsx`/`useStockByProduct`
   — Core's own existing UI depends on this hook working, confirming (per
   Phase 13's finding) that Core genuinely supports multi-row stock
   allocation, "Core: single location" being a marketing framing, not an
   enforced constraint. Fixes `ProductDetailPage.tsx`,
   `WarehouseDetailPage.tsx`, `OrderDialogCreateLineItem.tsx`,
   `ProductFormDialog.tsx` (partially — see below),
   `AllocateStockDialog.tsx` (partially), `TransferStockDialog.tsx`,
   `WarehouseList.tsx`, `hooks/use-order-line-stock-validation.ts`,
   `lib/orders/order-line-stock-validation.ts`.
2. **`hooks/queries/use-portal.ts` + `types/portal.ts`**: premium → core
   (both moved together — the hook's only non-shared imports are this
   type file's 5 exports). Confirmed needed by checking real usage:
   `components/orders/OrderDialog.tsx` — imported unconditionally by
   `AdminOrderDetailContent.core.tsx` — uses `useClientBrowseProducts`;
   `components/Pages/ProductsPage.tsx` (no variants, single default file)
   unconditionally renders `ClientProductList.tsx` when `role === "client"`.
   This confirmed client/supplier self-service *within the shared
   order/invoice/product list UI* (role-branching, same pattern noted in
   `proxy.ts`'s own comments) is Core-tier functionality — distinct from
   the *dedicated* `/client`, `/supplier`, `app/admin/client-portal`,
   `app/admin/supplier-portal` apps, which stay Premium-gated (their own
   `use-client-portal.ts`/`use-supplier-portal.ts`/`types/client-portal.ts`/
   `types/supplier-portal.ts` were **not** touched — genuinely separate
   files backing the separate dedicated portal apps). Added the portal
   type block to both `types/index.core.ts` and `types/index.pro.ts` (it
   had been dropped from both in Phase 15 on the assumption it was
   premium-only). Fixes `InvoiceList.tsx`, `OrderDialog.tsx`,
   `OrderList.tsx`, `ClientProductList.tsx`, `ProductList.tsx`.
3. **`hooks/queries/use-admin-counts.ts`**: pro → core. Trivial — its only
   type dependency, `AdminCounts`, was already shared (`types/api.ts`).
   `components/layouts/AppSidebar.tsx` (whole-folder shared,
   used by every tier's shell) imports it unconditionally. Fixes
   `AppSidebar.tsx`.
4. **`hooks/queries/use-email-preferences.ts`**: pro → core. Also
   trivial — its types (`EmailPreferences`, `UpdateEmailPreferencesInput`)
   were already core (`types/auth.ts`). `components/Pages/EmailPreferencesPage.tsx`
   is itself individually shared-bucketed. Fixes `EmailPreferencesPage.tsx`.

All four are pure manifest changes (plus the 2 barrel-file edits for
`use-portal`'s types) — **no application code changed**. Each was checked
for safety the same way: does the file's own content depend on anything
still pro/premium-only (no, in all 4 cases), and is it provably needed by
an already-shared/core caller (yes, in all 4 cases) — this is a strict
widening (core ⊂ pro ⊂ premium), so Pro/Premium exports are unaffected
either way.

## Impact

- Core error count: 193 → **125** (-68, on top of Phase 18's -73).
- Pro error count: 106 → **64** (-42, on top of Phase 18's -59).
- Combined with Phase 18, Core has dropped from **280 → 125** and Pro from
  **165 → 64** since the types/hooks barrel fixes first surfaced these
  counts in Phases 14-15 — more than half of both totals resolved via
  reclassification and folder-fixing alone, zero feature code touched.

## What's still open (harder, needs real code changes)

- **System config** (`SystemConfigSettings.tsx` + its shared parent
  `AdminSettingsContent.tsx`, `app/api/system-config/route.ts`,
  `lib/server/system-config-data.ts`, `prisma/system-config.ts`): unlike
  the 4 above, `SystemConfig`/`ConfigCategory` etc. are genuinely Pro-gated
  (system configuration management is a real upsell, confirmed — no
  evidence Core needs write access the way it needs stock allocation or
  portal reads). Needs a `.core.tsx`/`.pro.tsx` variant pair on
  `AdminSettingsContent.tsx` dropping the `<SystemConfigSettings>` section
  in Core, not a reclassification.
- **Forecasting** (`ForecastingSection.tsx` + its shared parent
  `AdminAnalyticsContent.tsx`/`AdminDashboardMergedView.tsx`,
  `CategoryDetailPage.tsx`, `SupplierDetailPage.tsx`,
  `WarehouseDetailPage.tsx`, `CatalogInsightsSection.tsx`,
  `WarehouseInsightsSection.tsx`, `hooks/queries/use-forecasting.ts`):
  same "needs a variant on the shared parent" shape as system config.
- **Product reviews** (`components/products/ProductActions.tsx` — not the
  now-premium `components/admin/ProductReviewActions.tsx`, a
  same-named-but-different file — plus `components/Pages/ProductDetailPage.tsx`,
  `lib/server/order-review-context-data.ts`,
  `lib/server/product-review-detail-data.ts`,
  `lib/server/product-reviews-data.ts`): already has `.core.tsx`/`.pro.tsx`
  variants for `ProductDetailPage.tsx` (Phase 11) and `order-review-context-data.ts`
  (Phase 12) that drop reviews — the remaining errors are in files that
  don't have that treatment yet.
- **`lib/api/client.ts`**: still the single largest offender (~20 distinct
  member errors in one file) — likely needs its own per-tier split.
- **Known, already-accepted debt, unaffected by this phase**: the
  `lib/stock-allocation/*` business-logic folder (as opposed to the hooks
  file fixed here) remains pro-bucketed while several core files
  (`app/api/products/route.ts`, `ProductFormDialog.tsx`,
  `AllocateStockDialog.tsx`, `hooks/use-catalog-quantity-reconcile-preview.ts`,
  `lib/products/enrich-product-committed-quantity.ts`,
  `lib/products/order-stock-reservation.ts`,
  `lib/server/product-stock-data.ts`, `lib/server/warehouse-stock-data.ts`,
  `app/warehouses/page.tsx`) depend on it — Phase 13 already investigated
  and deliberately accepted this exact class of coupling as debt for
  `app/api/products/route.ts`; this phase's work incidentally surfaced 7
  more files with the same root cause, not new debt, just a fuller count
  of the same already-decided item.

## Verification

Each of the 4 reclassifications verified independently before moving to
the next: `node -e "JSON.parse(...)"` (manifest valid) →
`pnpm check:manifest` (OK) → `pnpm export:core` + symlinked `node_modules`
+ `tsc --noEmit` (confirmed the specific hook's errors gone, diffed
against the running baseline) → `pnpm export:pro` + same check (confirmed
no regression) → full-repo `npx tsc --noEmit` (clean) → `pnpm test` (same
807/808 baseline, 1 unrelated date-fixture failure) after each step.
