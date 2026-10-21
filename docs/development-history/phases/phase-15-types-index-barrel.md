# Phase 15 — `types/index.ts` barrel: split into per-tier variants

**Status:** Complete and verified. **Date:** 2026-08-28.

## Why

Discovered in Phase 11: the shared-bucketed barrel `types/index.ts`
re-exports type modules from all four buckets in one file — 4 pro-bucketed
(`./history`, `./payment`, `./system-config`, `./audit-log`) and 7
premium-bucketed (`./support-ticket`, `./product-review`, `./forecasting`,
`./portal`, `./shipping`, `./client-portal`, `./supplier-portal`), none of
which exist in a Core export, and the 7 premium ones don't exist in a Pro
export either. Same shape as Phase 14's `hooks/queries` barrel, just for
types.

## What was done

- Added `types/index.core.ts` (drops all 11 pro/premium blocks — Core keeps
  only `product`, `category`, `supplier`, `warehouse`, `auth`, `order`,
  `notification`, `invoice`, `dashboard`, `stock-allocation`,
  `user-management`, `api`, plus the `@/lib/email/types` re-export) and
  `types/index.pro.ts` (drops only the 7 premium-only blocks, keeps the 4
  pro ones). `export-tier.ts`'s existing per-tier variant mechanism picks
  these up automatically under the original `types/index.ts` filename —
  no caller needs to change its import path.
- `tier-manifest.json`'s `$comment`: this item moved from "Still open" to
  resolved.

## An important, larger finding surfaced by finishing this correctly

This is the same shape of discovery as Phase 14, larger in scale. Before
this fix, `types/index.ts`'s own 11 broken relative re-exports already
showed up as `TS2307` errors in a full `tsc --noEmit` run (unlike the hooks
barrel, which stayed silent) — but they did **not** cascade to any of the
~60 Core-bucketed files that import a pro/premium type name through
`"@/types"`. TypeScript still typed each broken re-export as `any` rather
than reporting "no exported member" to importers, so those ~60 files typed
clean under the old barrel despite genuinely needing a type that will not
exist in their tier's export.

Proof: the pre-fix Core baseline (`pnpm export:core` + `tsc --noEmit`,
captured before writing the two variants) had 169 errors and **zero**
`TS2305`/`TS2724` ("has no exported member") errors. The same check after
adding the two variants has 280 errors — all 111 new ones are
`TS2305`/`TS2694`/`TS2724` against `"@/types"`, confirming this is exactly
the same "leniency was hiding real gaps" pattern as Phase 14, not a
regression from splitting the barrel. Running `pnpm export:pro` +
`tsc --noEmit` shows the same effect at Pro scale: 77 errors before → 165
after, all premium-type usages in pro/core-bucketed files.

**Net effect**: ~56 Core-bucketed files (and largely the same set at the
Pro layer, since these are core-bucketed files with no premium content)
depend directly on a pro/premium type with no tier-gating. Grouped by
feature area for whoever scopes the follow-up phase:

- **Support tickets** (premium): `AdminSupportTicketDetailContent.tsx`,
  `AdminSupportTicketsContent.tsx`, `SupportTicketActions.tsx`,
  `SupportTicketList.tsx`, `SupportTicketTable.tsx`,
  `SupportTicketTableColumns.tsx`.
- **Product reviews** (premium): `AdminProductReviewDetailContent.tsx`,
  `AdminProductReviewsContent.tsx`, `ProductReviewActions.tsx`,
  `ProductReviewList.tsx`, `ProductReviewTable.tsx`,
  `ProductReviewTableColumns.tsx`, `ProductActions.tsx`,
  `components/Pages/ProductDetailPage.tsx`,
  `lib/server/order-review-context-data.ts`,
  `lib/server/product-review-detail-data.ts`,
  `lib/server/product-reviews-data.ts`.
- **History / audit log** (pro): `AdminHistoryContent.tsx`,
  `AdminHistoryDetailContent.tsx`, `HistoryList.tsx`, `HistoryTable.tsx`,
  `HistoryTableColumns.tsx`, `ImportStatusFilter.tsx`,
  `ImportTypeFilter.tsx`, `ActivityLogSection.tsx`.
- **System config** (pro): `SystemConfigSettings.tsx`,
  `app/api/system-config/route.ts`, `lib/server/system-config-data.ts`,
  `prisma/system-config.ts`.
- **Client/supplier portal dashboards** (premium): `AdminClientPortalContent.tsx`,
  `AdminSupplierPortalContent.tsx`, `AdminProductsContent.tsx`,
  `InvoiceList.tsx`, `OrderList.tsx`, `InvoicesPage.tsx`, `OrdersPage.tsx`,
  `ProductsPage.tsx`, `ClientProductList.tsx`, `ProductList.tsx`,
  `lib/server/client-browse-data.ts` (+ its test), `client-catalog-data.ts`,
  `client-dashboard.ts`, `client-portal-data.ts`, `list-page-stats.ts`,
  `supplier-dashboard.ts`, `supplier-portal-data.ts`.
- **Forecasting** (premium): `CategoryDetailPage.tsx`,
  `SupplierDetailPage.tsx`, `WarehouseDetailPage.tsx`,
  `ForecastingSection.tsx`, `CatalogInsightsSection.tsx`,
  `hooks/queries/use-forecasting.ts`, `AdminAnalyticsContent.tsx`,
  `AdminDashboardMergedView.tsx`.
- **`lib/api/client.ts`** — one monolithic API client file touching nearly
  every feature above (~25 distinct member errors in one file).

Filed as new backlog Phase 19 in `out/ims_progress.md` — deliberately not
attempted here, same reasoning as Phase 14's ~30-file hooks finding:
fixing even one group properly (splitting a shared component into
`.core.`/`.pro.` variants per group, or relocating call sites) is its own
project: This finding and Phase 18 (the hooks/queries equivalent) overlap
heavily in file list (e.g. `AdminSupportTicketDetailContent.tsx`,
`AdminProductReviewDetailContent.tsx` show up in both), which makes sense
— they're the same ungated features, just two different technical symptoms
(a broken hook import and a broken type import) of the same "core shell
holds premium content" gap. Whoever scopes Phase 18/19 should treat them
as one combined per-feature effort, not two separate passes over the same
files.

## Verification

Full-repo `npx tsc --noEmit` (unstripped): clean, exit 0. `pnpm
check:manifest`: OK. `pnpm export:core` + symlinked `node_modules` + fresh
`tsc --noEmit`: barrel's own 11 lines no longer error; total count rose
169→280, all 111 new errors are the `TS2305`/`TS2694`/`TS2724` cascade
described above (verified by diffing sorted, position-stripped error sets
against the pre-fix baseline captured before any edit this phase — the
old barrel produced zero of these). `pnpm export:pro` + same check: 77→165,
same pattern. `pnpm test`: same 807/808 baseline (1 unrelated
date-fixture failure).
