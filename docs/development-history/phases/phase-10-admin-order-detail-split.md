# Phase 10 — AdminOrderDetailContent.tsx + orders-side Stripe reconciliation

**Status:** Complete and verified. **Date:** 2026-08-27.

## Why

Phase 9 deferred this as "`AdminOrderDetailContent.tsx`'s 8-import
coupling — a real component-splitting project, same class as
`ProductDetailPage.tsx`." Research this pass found that framing too
pessimistic: only 2 of the 8 flagged imports were genuine cross-tier
entanglement. The other 6 were a plain mis-bucketing bug —
`components/admin` (this file's home) is bucketed **shared**, but
`AdminOrderDetailContent.tsx` is core-tier order-detail UI, not shared
infrastructure. Proof: its non-admin sibling `components/Pages/OrderDetailPage.tsx`
(already core-bucketed) imports the same 6 "violating" modules with zero
lint warnings, since they're all core-bucketed themselves. Only
`hooks/use-stripe-checkout-return.ts` (pro) and `components/shipping`
(premium) are real tier crossings — and `OrderDetailPage.tsx` already has
those same two, confirmed via direct `eslint`.

## What was done

**Fix 1 — relocation (no manifest edit needed).** `git mv
components/admin/AdminOrderDetailContent.tsx components/orders/AdminOrderDetailContent.tsx`
— both `components/admin` (shared) and `components/orders` (core) are
whole-folder-bucketed entries, so no `tier-manifest.json` change was
required; the file is automatically covered by its new folder's existing
bucket. Updated the one importer, `app/admin/orders/[id]/page.tsx`. This
alone dropped the file from 8 lint warnings to 2.

**Fix 2 — per-tier variants for the 2 genuine crossings**, using Phase 9's
mechanism. Unlike Phase 9's forecast-rollup case, Core and Pro need
*different* content here, not identical duplicates:
- `hooks/use-stripe-checkout-return.ts` is pro-bucketed → available in
  Pro, missing only in Core.
- `components/shipping` is premium-bucketed → missing in both Core and
  Pro.

Added `components/orders/AdminOrderDetailContent.{core,pro}.tsx` and
`components/Pages/OrderDetailPage.{core,pro}.tsx`: the `.core.` variants
drop both the Stripe hook call and all shipping-component usage
(`OrderTrackingInfo`, `ShippingManagement`, `CarrierGlassBadge`); the
`.pro.` variants keep the Stripe hook and drop only the shipping usage.
Where shipping usage was the only reason for a two-column
"stack + tracking" layout (`hasShipping` ternary), simplified to always
render the plain status-badge grid. Where it gated the "Generate Shipping
Label" button, removed that branch entirely (manual tracking-number entry,
which doesn't depend on `components/shipping`, is unaffected and remains
the only way to add tracking in Core/Pro). Where it was a read-only
carrier badge next to the tracking number/link, removed just the badge —
the tracking number and link themselves are plain order fields, kept as-is.

Added `app/admin/orders/[id]/page.core.tsx` and
`app/orders/[id]/page.core.tsx` — drop `reconcileStripeReturnBeforeDetail`
(pro-only), mirroring the invoices-side fix from Phase 9 exactly. The
non-admin route needing this was a new discovery this pass — not
previously tracked.

## Verification

- `npx tsc --noEmit` (full repo) clean.
- `pnpm check:manifest` clean.
- `npx eslint` on all touched/new files: the relocation alone dropped
  `AdminOrderDetailContent.tsx` from 8 to 2 warnings; both `.core.`
  variants (in the whole-folder-bucketed `components/orders`) show 0
  warnings; `OrderDetailPage.{core,pro}.tsx` (in the individually-tracked
  `components/Pages`) show 0 since new suffixed filenames don't match any
  manifest-listed target; `AdminOrderDetailContent.pro.tsx` correctly still
  shows its one intentionally-kept Stripe-hook warning.
- `pnpm export:core` + symlinked `node_modules` + `npx tsc --noEmit`: no
  errors on any of the 6 touched files. One unrelated, pre-existing error
  remains (`app/api/orders/[id]/route.ts` → `@/prisma/audit-log`, confirmed
  via `git status`/`git diff` to be untouched by this phase — a separate
  audit-log coupling gap, not previously catalogued, flagged here rather
  than silently fixed).
- `pnpm export:pro` + the same check: fully clean on all 6 files. Grepped
  the Pro output directly to confirm `useStripeCheckoutReturn` is present
  (Pro is entitled to it) on both files, while `components/shipping`/
  `OrderTrackingInfo`/`ShippingManagement`/`CarrierGlassBadge` are entirely
  absent (only my own docblock comments mention the string
  "components/shipping", not real imports).
- `pnpm test`: 805/806 passing, same pre-existing unrelated date-fixture
  failure carried over from Phase 9.
- Confirmed via full-repo grep that `AdminOrderDetailContent.tsx` had
  exactly one importer before the move, and that
  `lib/react-query/invalidate-coverage.test.ts`'s allowlist has no
  reference to it (no test/allowlist update needed).

## New discovery, not fixed here

`app/api/orders/[id]/route.ts` (core-bucketed) statically imports
`@/prisma/audit-log` (pro-bucketed) — pre-existing, unrelated to
orders/shipping/Stripe, not previously catalogued in `tier-manifest.json`'s
gap notes. Flagged for a future phase rather than folded in here.
