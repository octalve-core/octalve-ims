# Phase 21 (part 1) — API-route/hook bucket mismatch audit

**Status:** Audit complete. One class of mismatch found and fixed
(folder mis-bucketing, same root cause as Phase 18). Three mismatches
confirmed as genuine product/business decisions, left unfixed per
Phase 20's framing. **Date:** 2026-08-28.

## Method

Built a full map of every hook in the `core` bucket → the `apiClient`
namespace(s) it calls (`lib/api/client.ts`) → the `API_ENDPOINTS` path
(`lib/api/endpoints.ts`) → that path's owning `app/api/*` folder → that
folder's tier-manifest bucket. 15 core-bucketed hooks checked:

| hook | apiClient namespace(s) | route bucket | verdict |
|---|---|---|---|
| use-categories | categories | core | OK |
| use-orders | orders | core | OK |
| use-orders | admin (getClientOrders) | **pro** | mismatch → fixed |
| use-products | products | core | OK |
| use-warehouses | warehouses | core | OK |
| use-invoices | invoices | core | OK |
| use-invoices | admin (getClientInvoices) | **pro** | mismatch → fixed |
| use-notifications | notifications | core | OK |
| use-dashboard | dashboard | core | OK |
| use-suppliers | suppliers | core | OK |
| use-admin-counts | admin (getCounts) | **pro** | mismatch → fixed |
| use-email-preferences | user | shared | OK |
| use-auth | auth | shared | OK |
| use-user-management | users | shared | OK |
| use-forecasting | forecasting | premium | mismatch → **not fixed**, see below |
| use-stock-allocation | stockAllocations, stockTransfers | pro | mismatch → **not fixed**, see below |
| use-portal | portal | premium | mismatch → **not fixed**, see below |

## Fixed: `app/api/admin` folder mis-bucketing

Same shape as Phase 18's `components/admin` discovery: `app/api/admin`
was declared as **one whole-folder `pro` bucket entry**, but it has 3
route children with different real tier needs:

- `app/api/admin/client-orders` — "orders that contain products owned
  by the current user (product owner)". Called by
  `hooks/queries/use-orders.ts`'s `useClientOrders`, itself called from
  `components/orders/OrderList.tsx` (already shared) for the `client`/
  `supplier` role self-view path — the same "self-view within the
  shared list is core-tier" reasoning Phase 19 established for
  `use-portal.ts`. Confirmed core-necessary: `app/admin/client-orders`
  (the page route) was **already** core-bucketed — its own API route
  just hadn't followed.
- `app/api/admin/client-invoices` — same shape, called by
  `use-invoices.ts`'s `useClientInvoices` from `InvoiceDialog.tsx`.
  `app/admin/client-invoices` was also already core-bucketed.
- `app/api/admin/counts` — admin sidebar badge counts
  (`lib/server/admin-counts.ts`'s `getAdminCounts`, itself already
  shared-bucketed and safe: it queries `prisma.supportTicket`/
  `prisma.productReview` directly, not through any pro/premium-gated
  application module, so it compiles fine in Core and simply returns 0
  for tiers where those tables are unused). Called by
  `use-admin-counts.ts` from `components/layouts/AppSidebar.tsx` — the
  main app shell, rendered in every tier.

Fix: added `"app/api/admin"` to `FOLDER_LEVEL_DIRS` in
`scripts/check-tier-manifest-coverage.ts` (so its 3 children are each
individually classified instead of the folder being one atomic unit),
removed the bare `"app/api/admin"` entry from the `pro` bucket, and
added the 3 children individually to `core`. No application code
changed — pure manifest correction, exactly like Phase 18.

## Confirmed as genuine product decisions, still not fixed

The 3 mismatches already documented in Phase 20's discovery remain
unfixed, for the same reason given there — moving a billable backend
feature (stock allocation, portal, forecasting) to a lower paid tier is
a product/business call, not tier-export hygiene:

- `use-stock-allocation.ts` (core) → `app/api/stock-allocations`/
  `stock-transfers` (pro)
- `use-portal.ts` (core) → `app/api/portal` (premium)
- `use-forecasting.ts` (core) → `app/api/forecasting` (premium)

No new instances of this kind were found — the audit requested at the
end of Phase 20 is now complete: every core hook's route dependency has
been checked, not just the 3 found incidentally there.

## Verification

`node -e "JSON.parse(...)"` (manifest valid) → `pnpm check:manifest`
(OK) → `pnpm export:core` + symlinked `node_modules` + `npx tsc
--noEmit` (83 errors, unchanged from Phase 20's baseline — expected,
since this fix is runtime-route-availability, not a compile-time
import, so `tsc` can't see it either way) → `pnpm export:pro` + same
check (47 errors, unchanged) → full-repo `npx tsc --noEmit` (clean).
