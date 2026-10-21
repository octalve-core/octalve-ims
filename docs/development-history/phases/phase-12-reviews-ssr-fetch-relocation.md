# Phase 12 — Reviews SSR-fetch relocation ripple

**Status:** Complete and verified. **Date:** 2026-08-27.

## Why

Phase 11 deferred this: relocating `lib/server/product-reviews-detail-data.ts`
(shared-bucketed but directly importing `@/prisma/product-review`, a real,
already-flagged leak) cascades into `lib/server/order-review-context-data.ts`,
used by all 7 order/invoice detail routes, not just the 2 product routes —
a wider ripple than tracked. This phase resolved the design question and
applied the fix.

## The key design win

Research found the cascade is much smaller than it looked. Since
`order-review-context-data.ts` can get its own `.core.ts`/`.pro.ts` stub
variants (same per-tier file-variant mechanism from Phase 9), and the
variant swap happens transparently at that one file's identity, **none of
its 7 route callers or its 3 downstream shared-component consumers
(`OrderItemsCard.tsx`, `InvoiceItemsCard.tsx`, `ProductLineItemsList.tsx`)
needed to change at all.** They keep importing
`@/lib/server/order-review-context-data` exactly as before; whichever
content (`.ts` default, `.core.ts`, or `.pro.ts`) lands at that path during
export is what they get.

Confirmed via research this pass: `order-review-context-data.ts` **must
stay physically in `lib/server` (shared)**, not move into
`lib/product-reviews` (premium) — `export-tier.ts` only walks a bucket's
manifest entries for tiers that include that bucket, so a file living
inside a premium-only folder would never even be considered for copying
(let alone variant-swapping) in a Core/Pro export, breaking its 7 callers
outright with a hard "module not found" instead of a clean tier-stripped
build.

## What was done

- `git mv lib/server/product-reviews-detail-data.ts lib/product-reviews/product-reviews-detail-data.ts`
  — no manifest edit (both are whole-folder entries). Fixed its own
  `@/prisma/product-review` leak. Updated 6 importers' paths:
  `order-review-context-data.ts`, the 2 product routes, and the 3
  `ProductDetailPage.{tsx,core.tsx,pro.tsx}` variants.
- `lib/server/order-review-context-data.core.ts` / `.pro.ts` — stub
  implementations of `getOrderReviewContextForPage`, returning `{ eligible:
  false, slots: [] }` and empty review lists for every product, using a
  **locally-defined** `ReviewEligibilityResult`-equivalent type (not
  imported from premium) so the variants stay genuinely tier-clean.
- 4 new route variants: `app/{admin/,}products/[id]/page.{core,pro}.tsx`
  dropping the `getReviewsForProductPage`/`getReviewEligibilityForProduct`
  fetch (Fan-out A — the only routes that call these functions directly,
  not through `order-review-context-data.ts`).
- `ProductDetailPage.{core,pro}.tsx` — replaced their `ReviewEligibilityResult`
  type import (which would otherwise point at the new premium path) with a
  small locally-defined equivalent, keeping both variants genuinely
  tier-clean rather than reaching into premium for an unused type.
- **Newly discovered mid-phase**: `components/shared/ProductLineItemsList.tsx`
  (shared bucket, used by both core `OrderItemsCard.tsx`/`InvoiceItemsCard.tsx`
  AND premium `components/shipping/ShippingManagement.tsx` — genuinely
  cross-tier, not a relocation candidate like `AdminOrderDetailContent.tsx`
  was) directly renders the premium `ProductReviewsSection` component
  inline per line item. Added `.core.tsx`/`.pro.tsx` variants dropping that
  import and render block. No barrel or caller changes needed — same
  transparent-swap design as `order-review-context-data.ts`.
- **Bonus fix, same family**: `app/invoices/[id]/page.tsx` never got a
  `.core.tsx` Stripe-reconciliation variant in Phase 9, unlike its 3
  siblings (`app/admin/invoices/[id]`, `app/admin/orders/[id]`,
  `app/orders/[id]`) — added, same proven pattern.
- `tier-manifest.json`'s `$comment` updated: this item moved from "Still
  open" to "Resolved"; a new small item added for
  `ProductLineItemsList.tsx`'s 2 remaining shared→core warnings
  (`ProductOptionRow`, `proportional-line-amount`) — found in the same
  `eslint` pass but out of this phase's reviews-focused scope, not fixed.

## Verification

`tsc --noEmit` clean. `pnpm check:manifest` clean. `npx eslint` on every
touched/new file: all `.core.`/`.pro.` variants show 0 warnings (except
`ProductLineItemsList`'s 2 pre-existing, deliberately-deferred shared→core
ones); default files keep only their expected Premium-facing warnings.
`pnpm export:core`/`export:pro` + symlinked `node_modules` + fresh `tsc
--noEmit`: confirmed via grep that the swapped files contain the right
content per tier (e.g. Pro's `order-review-context-data.ts` is the stub,
not the real implementation; Core's `ProductLineItemsList.tsx` has no
`ProductReviewsSection` import) and that no `.core.`/`.pro.` file leaked
into the output under its own suffixed name. Core's total error count
dropped from 162 (Phase 11 baseline) to 154 — `product-reviews-detail-data.ts`'s
own internal errors are now excluded from Core entirely instead of
breaking a copied-but-broken shared file. The same 5 pre-existing
implicit-`any` errors in `ProductDetailPage.tsx` (traced in Phase 11 to
the already-tracked `hooks/queries` barrel, Phase 14) persist unchanged —
confirmed not a regression. `pnpm test`: same 807/808 baseline (1
unrelated date-fixture failure).
