# Phase 13 — `app/api/products/route.ts` PUT stock-reconcile split

**Status:** Investigated; decision made to accept as documented debt (no
code changed). **Date:** 2026-08-28.

## Why

Per `tier-manifest.json`'s own gap ledger, this PUT handler mixes a
core-relevant guard (`Product.reservedQuantity` floor check) with
genuinely Pro warehouse-shrink planning (`planCatalogQuantityReconcile`/
`applyCatalogQuantityReconcile` against `StockAllocation` rows), flagged as
"a real product trade-off on live inventory-mutation code... not decided."
This phase researched it thoroughly and closed the decision.

## What research found

- The core guard and Pro planning aren't two separable call sites — both
  live inside one call to `planCatalogQuantityReconcile`, which blends
  `productReserved` (core) and `allocations` (Pro `StockAllocation` rows)
  into a single `reservedCommitment` number used by the guard.
- `existingProduct` and `allocationRows` are read as two independent,
  non-transactional Prisma calls (a real TOCTOU window already exists
  today, unrelated to any split); only `applyCatalogQuantityReconcile`'s
  own writes (product quantity + allocation shrink/delete) are wrapped in
  one `prisma.$transaction`.
- `npx eslint app/api/products/route.ts` confirmed 4 warnings: the 3 named
  in the manifest, plus a previously-undocumented 4th
  (`@/prisma/audit-log`, unrelated — audit logging, not stock-reconcile;
  left for its own future look, not addressed here).
- A related, previously-undocumented instance of the same underlying
  coupling: `hooks/use-catalog-quantity-reconcile-preview.ts` (core) also
  imports `planCatalogQuantityReconcile` (pro) directly, for a client-side
  live-preview UX in the product form dialog. Any real split would need to
  decide what happens to this hook too — noted for whoever revisits this.

## Options considered

1. **Core-tier "single warehouse" simplification** — rejected. No hard
   single-warehouse constraint exists in code (verified by grep); the
   "Core: single location" framing elsewhere in the manifest is a
   product-marketing convention, not an enforced limit. A naive
   single-row-math Core variant risks silently misallocating a real Core
   customer's inventory if they have multiple `StockAllocation` rows —
   unacceptable risk on live inventory-mutation code.
2. **Full 2-call split**, modeled on the existing payments precedent
   (`useCreateCheckout()` as a separate, explicit follow-up call against
   an already-created invoice/order id — confirmed as a real, shipped
   pattern in this codebase). Architecturally the "correct" shape, but
   changes the request/response contract for **every** tier, not just
   Core: `hooks/queries/use-products.ts`'s `useUpdateProduct()` would need
   to chain two requests, and the untyped `stockReconcile` response-shape
   cast (accessed via a runtime type-cast today, not part of the formal
   `Product` type) would need reworking into a real second call/response.
   That's a live feature redesign, not tier-export hygiene — out of scope
   for this engagement.
3. **Accept as documented debt** — chosen. Directly comparable precedent
   already exists in this codebase:
   `lib/products/decrement-stock-allocations.ts` (core-bucketed) reads/writes
   the Pro `StockAllocation` model inline during order fulfillment,
   deliberately left unsplit per `tier-manifest.json`'s own `prisma/schema`
   note, for the identical atomicity-on-live-inventory-code reasoning.

## Outcome

No code changed. `tier-manifest.json`'s `$comment` updated to record the
investigation and the decision (not silently left as an open question) —
distinguishes this from genuinely-untouched items like the `hooks/queries`/
`types/index.ts` barrels, which are unfinished work, not accepted debt.

## Verification

`node -e "JSON.parse(...)"` confirms the manifest stays valid JSON. No
functional verification needed — zero code changed.
