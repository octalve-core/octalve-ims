# Phase 17 — `ProductLineItemsList.tsx`'s 2 remaining shared→core warnings

**Status:** Complete and verified. **Date:** 2026-08-28.

## Why

Filed during Phase 12: `components/shared/ProductLineItemsList.tsx` had 2
ESLint `import/no-restricted-paths` warnings (shared bucket reaching into
core-bucketed folders) left over after fixing its reviews coupling —
`@/components/products/ProductOptionRow` (for `ProductThumb`) and
`@/lib/orders/proportional-line-amount` (for `orderHasFeeAdjustments`).
Both are harmless for `tsc`/build (the core bucket is always present
alongside shared in every real export), but architecturally impure. Left
open pending a look at whether the two imports are safe to reclassify down
to shared.

## What was done

Both turned out to be genuinely pure/leaf with zero core-only technical
dependency, so this was a relocation, not a variant or an accepted-debt
call:

- **`lib/orders/proportional-line-amount.ts`** (2 pure math functions, zero
  imports) relocated to `lib/proportional-line-amount.ts` — mirroring the
  existing precedent of individual root-level `lib/*.ts` files listed
  directly in the shared bucket (`lib/utils.ts`, `lib/logger.ts`,
  `lib/env.ts`, `lib/imagekit.ts`). 7 callers' import paths updated
  (`lib/orders/map-order-items.ts`, 3 `lib/server/*-detail-data.ts` files,
  the 3 `ProductLineItemsList.*.tsx` variants).
- **`ProductThumb`** extracted out of `components/products/ProductOptionRow.tsx`
  into a new `components/shared/ProductThumb.tsx`. Investigating its
  callers first showed *why* this one specific export was the problem:
  21 files import from `ProductOptionRow.tsx`, and all but 5 want only
  `ProductThumb` — including 3 files **already in `components/shared/`**
  (`DenseCatalogProductCell.tsx`, `CatalogDetailRecentOrdersList.tsx`,
  `CatalogDetailProductGrid.tsx`) carrying the exact same warning,
  undiscovered until now because Phase 12 only looked at
  `ProductLineItemsList.tsx`. The other 5 callers (`AllocateStockDialog.tsx`,
  `TransferStockDialog.tsx`, `OrderDialogCreateLineItem.tsx`,
  `ProductReviewDialog.tsx`, `SupportTicketDialog.tsx`) use the fuller
  `ProductOptionRow`/`DialogProductOptionRow` row components — those stay in
  `components/products/`, which now imports `ProductThumb` back from its
  new shared home for its own internal use. All 17 `ProductThumb`-only
  importers' paths updated to `@/components/shared/ProductThumb`.
- `tier-manifest.json`: added `lib/proportional-line-amount.ts` (+ its
  test) to the shared bucket's individual-file list. No manifest change
  needed for `ProductThumb.tsx` — `components/shared` is already a
  whole-folder shared entry.

## Verification

`npx eslint` on `ProductLineItemsList.tsx` (+ its `.core.`/`.pro.` variants),
`ProductOptionRow.tsx`, and the new `ProductThumb.tsx`: both target
warnings gone (only the already-tracked, already-variant-handled
`ProductReviewsSection` warning remains on the default file). Full-repo
`npx tsc --noEmit`: clean. `pnpm check:manifest`: OK. `pnpm export:core` +
`tsc --noEmit`: 266 errors, unchanged from Phase 16's end state (expected —
this was an ESLint-only fix, no `tsc` errors involved). `pnpm export:pro` +
`tsc --noEmit`: unchanged at 165. `pnpm test`: same 807/808 baseline (1
unrelated date-fixture failure).

## Noted, not fixed

While spot-checking `lib/server/*-detail-data.ts` during this pass, found
those 3 files (shared-bucketed) also carry several other pre-existing
shared→core `import/no-restricted-paths` warnings unrelated to this phase
(`@/prisma/category`, `@/prisma/supplier`, `@/lib/products/product-query`,
`@/lib/products/enrich-product-committed-quantity`,
`@/lib/orders/order-sales-eligibility`,
`@/lib/orders/order-status-display-date`, `@/lib/orders/order-party`) — out
of scope for this phase (`ProductLineItemsList.tsx` was the only file
Phase 12 flagged), not investigated further here.
