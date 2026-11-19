# Phase 18 — `components/admin` folder-level mis-bucketing

**Status:** Complete and verified. **Date:** 2026-08-28.

## Why — a bigger root cause than the original framing

Phase 18 was filed as "~30 Core-bucketed files depend on ungated
pro/premium hooks, needs `.core.tsx`/`.pro.tsx` variant pairs per feature
group." Investigating the first group (product reviews/support tickets)
found a more fundamental cause: `tier-manifest.json` declares
`components/admin` as **one whole-folder `shared` bucket entry** — no
per-file overrides. Since `shared` is included in *every* tier's export
unconditionally, this means all 45 files under `components/admin` —
including clearly premium-only admin screens like
`AdminSupportTicketDetailContent.tsx` and `AdminClientPortalContent.tsx` —
were being physically copied into every Core and Pro export, even though
their consuming routes (`app/admin/support-tickets`,
`app/admin/product-reviews`, `app/admin/client-portal`,
`app/admin/supplier-portal`, `app/admin/activity-history`,
`app/admin/my-activity`) were already correctly pro/premium-bucketed. The
"ungated hooks" symptom Phase 14 found was these orphaned, unreachable
component files still sitting in the Core/Pro export and still failing to
resolve their pro/premium imports — not a missing-variant problem so much
as a missing-exclusion problem.

## What was done

Traced every one of the 45 files' full import chain (who renders it, and
transitively who renders that) to classify each individually, rather than
assume from name alone:

- **18 → `premium`**: reachable only from already-premium-bucketed routes.
  `AdminSupportTicketDetailContent.tsx`, `AdminSupportTicketsContent.tsx`,
  `SupportTicketList.tsx`, `SupportTicketTable.tsx`,
  `SupportTicketTableColumns.tsx`, `SupportTicketFilters.tsx`,
  `SupportTicketActions.tsx`, `AdminProductReviewDetailContent.tsx`,
  `AdminProductReviewsContent.tsx`, `ProductReviewList.tsx`,
  `ProductReviewDialog.tsx`, `ProductReviewFilters.tsx`,
  `ProductReviewTableColumns.tsx`, `ProductReviewTable.tsx`,
  `ProductReviewActions.tsx`, `AdminClientPortalContent.tsx`,
  `AdminSupplierPortalContent.tsx`, `AdminMyActivityContent.tsx`.
- **9 → `pro`**: reachable only from the already-pro-bucketed
  activity-history route. `AdminHistoryContent.tsx`,
  `AdminHistoryDetailContent.tsx`, `ActivityLogSection.tsx`,
  `HistoryList.tsx`, `HistoryTable.tsx`, `HistoryTableColumns.tsx`,
  `HistoryFilters.tsx`, `ImportStatusFilter.tsx`, `ImportTypeFilter.tsx`.
- **18 stay `shared`**: genuinely cross-tier (`AdminAnalyticsContent.tsx`,
  `AdminCombinedInvoicesContent.tsx`, `AdminCombinedOrdersContent.tsx`,
  `AdminDashboardMergedView.tsx`, `AdminEmbedDataTable.tsx`,
  `AdminProductsContent.tsx`, `AdminSettingsContent.tsx`,
  `AdminUserManagementContent.tsx`, `AdminUserManagementDetailContent.tsx`,
  `AdminWarehousesContent.tsx`, `CreateUserDialog.tsx`,
  `ForecastingSection.tsx`, `SystemConfigSettings.tsx`,
  `UserManagementFilters.tsx`, `UserManagementList.tsx`,
  `UserManagementTableColumns.tsx`, `UserManagementTable.tsx`,
  `UserRoleFilter.tsx`) — 3 of these (`ForecastingSection.tsx`,
  `SystemConfigSettings.tsx`, `AdminProductsContent.tsx`) have real
  internal pro/premium coupling of their own, deliberately **not**
  reclassified here since their parent (`AdminAnalyticsContent.tsx`,
  `AdminSettingsContent.tsx`) is itself shared and unconditionally renders
  them — reclassifying the child without first splitting the parent via a
  `.core.tsx`/`.pro.tsx` variant would break the parent's own Core/Pro
  export. Left as a coupled follow-up (see below), not attempted here.

Mechanically: added `"components/admin"` to
`scripts/check-tier-manifest-coverage.ts`'s `FOLDER_LEVEL_DIRS` list
(mirroring the existing `components/Pages` special-case) so the coverage
check requires each file classified individually instead of accepting one
bare folder entry, then replaced the single `"components/admin"` shared
entry with the 27 pro/premium entries above (the other 18 files' shared
status is unchanged, just now explicit).

**No code changed** — this is a pure manifest correction. Once
premium/pro-bucketed, `export-tier.ts` simply stops copying these files
into Core/Pro exports, and their broken pro/premium imports become moot.

## Impact

This single reclassification resolved a large, overlapping slice of both
Phase 18's hook finding and Phase 19's type finding at once, since the
same 27 files carried both symptoms:

- Core error count: 266 → 193 (**-73**).
- Pro error count: 165 → 106 (**-59**).
- Of Phase 18's original hook-import errors, the entire "product reviews"
  and "support tickets" admin groups (8 files) and 2 of the 7
  "client/supplier portal dashboards" files (`AdminClientPortalContent.tsx`,
  `AdminSupplierPortalContent.tsx`) are gone. Of Phase 19's original
  type-import errors, the same files (plus their siblings
  `SupportTicketTable(Columns).tsx`, `ProductReviewTable(Columns).tsx`)
  are gone too — the entire "history/audit log" admin group is also fully
  resolved (8 files).

## What's still open (revised Phase 18/19 remainder)

`hooks/queries`-level (Core, 18 files remaining):
- **Stock allocation** (pro, 9 files): `ProductDetailPage.tsx`,
  `WarehouseDetailPage.tsx`, `OrderDialogCreateLineItem.tsx`,
  `ProductFormDialog.tsx`, `AllocateStockDialog.tsx`,
  `TransferStockDialog.tsx`, `WarehouseList.tsx`,
  `hooks/use-order-line-stock-validation.ts`,
  `lib/orders/order-line-stock-validation.ts`.
- **Client/supplier portal dashboards** (premium, `use-portal`, 5 files —
  down from 7): `InvoiceList.tsx`, `OrderDialog.tsx`, `OrderList.tsx`,
  `ClientProductList.tsx`, `ProductList.tsx`. These are core-bucketed list
  components directly coupled to `use-portal`, not admin wrappers — a
  different fix shape than the folder reclassification above.
- **Misc** (4 files): `EmailPreferencesPage.tsx` (email-preferences),
  `SystemConfigSettings.tsx` (system-config), `AppSidebar.tsx`
  (admin-counts), `components/products/ProductActions.tsx`
  (product-reviews — **not** the now-premium `components/admin/ProductReviewActions.tsx`,
  a same-named-but-different file).

`@/types`-level (Core, ~36 files remaining, down from ~56) — largely the
same file list as Phase 19's original write-up minus the now-excluded
admin files; `lib/api/client.ts`'s ~25-member monolith is still the
single largest remaining offender.

**New, smaller finding from giving `components/admin` per-file
granularity**: `npx eslint components/admin` now surfaces 6
`import/no-restricted-paths` warnings that were invisible before (the
whole folder being one shared bucket meant ESLint's boundary rule had
nothing to compare against per-file) — `AdminCombinedInvoicesContent.tsx`
→ `InvoiceList`, `AdminCombinedOrdersContent.tsx` → `OrderList`,
`AdminProductsContent.tsx` → `ProductList`,
`AdminUserManagementDetailContent.tsx` → `components/orders/detail`,
`AdminWarehousesContent.tsx` → `WarehouseList`, plus the already-known
`SystemConfigSettings.tsx` → `use-system-config`. Not investigated
further — a same-shape, smaller-scale future item.

## Verification

`node -e "JSON.parse(...)"`: manifest valid. `pnpm check:manifest`: OK (27
new individual entries, zero duplicates/missing). `pnpm export:core` +
symlinked `node_modules` + `tsc --noEmit`: confirmed all 27 files excluded
from Core, none appear as a "Cannot find module" source for any remaining
Core file (no caller was missed), error count 266→193. `pnpm export:pro` +
same check: 18 premium-only files excluded, 9 pro files present, error
count 165→106. Full-repo `npx tsc --noEmit`: clean, exit 0. `pnpm test`:
same 807/808 baseline (1 unrelated date-fixture failure).
