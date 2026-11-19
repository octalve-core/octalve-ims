# Phase 21 (continued) — `lib/api/client.ts` per-tier split

**Status:** Complete and verified. **Date:** 2026-09-02.

## The problem

`lib/api/client.ts` is a single `ApiClient` class used by every hook file
in every tier — one `apiClient` singleton, ~1730 lines, one method-group
property per API domain (`products`, `orders`, `supportTickets`,
`productReviews`, `systemConfig`, `shipping`, ...). Its top-of-file
`import type { ... } from "@/types"` pulled in every domain's request/
response type in one block, including several that only exist in
`types/index.ts` (the untiered/Premium barrel) — `SupportTicket*`,
`ProductReview*`, `ClientPortalStats`, `SupplierPortalStats`,
`CreateCheckoutInput`/`CheckoutSessionResponse`, shipping's
`GenerateLabelInput`/`GenerateLabelResponse`/`AddTrackingInput`/
`GetRatesInput`/`GetRatesResponse`, and (Core only) `SystemConfig`/
`UpdateSystemConfigInput`/`ImportHistoryForPage`. Since `lib/api` ships in
every tier's export unconditionally, this was the single largest
remaining offender: 22 errors in Core, all 18 of Pro's *entire* remaining
error count.

## Why not reclassify or relocate

Every one of the missing types backs a method group that this tier's UI
genuinely never calls (the admin-only support-ticket/product-review CRUD,
the dedicated client/supplier portal admin overview, Stripe checkout,
Shippo shipping, system-config admin CRUD) — confirmed by the same
"strict widening, provably needed by an already-core caller" test used
throughout this phase. There is nothing to widen here: these are real
pro/premium features. The fix has to be type-only.

## What was done

Used the existing "per-tier file variant" capability
(`export-tier.ts` already picks `client.core.ts`/`client.pro.ts` over the
default `client.ts` — no manifest change needed, variant siblings inherit
`lib/api`'s existing shared bucket automatically) — but instead of a full
divergent rewrite, `client.core.ts` and `client.pro.ts` are **byte-identical
to `client.ts` from the `ApiResponse<T>` interface onward** (verified by
diff). The only difference is the top import block: each variant drops
exactly the names its tier's `@/types` barrel doesn't export, and adds a
local block of `type Foo = Record<string, unknown>;` stand-ins for those
same names directly below the import — so the ~1700-line class body
needed zero edits. This is a deliberately weaker version of the
"transparent read/write split" pattern used elsewhere this phase
(`system-config-data.core.ts` inlines a real fallback value): here there's
no real value to inline, since the method is never called, so a
structural placeholder is the honest choice instead of fabricating a
believable one.

- `lib/api/client.core.ts` (new) — 22 names aliased: `ImportHistoryForPage`,
  the 6 `SupportTicket*` names, the 4 `ProductReview*` names +
  `ReviewEligibilitySlot`, `ClientPortalStats`, `SupplierPortalStats`, the
  2 checkout names, the 5 shipping names, `SystemConfig`,
  `UpdateSystemConfigInput`.
- `lib/api/client.pro.ts` (new) — 17 names aliased (Pro's barrel already
  has `ImportHistoryForPage`, the checkout pair, and the system-config
  pair — same subset difference already established by Phase 15/20's
  barrel work): the 6 `SupportTicket*`, the 4 `ProductReview*` +
  `ReviewEligibilitySlot`, `ClientPortalStats`, `SupplierPortalStats`, the
  5 shipping names.
- Built by a small Node script (`make-client-variants.mjs`, not committed
  — scratch tooling) that parses the original's import list, partitions
  it per tier, and writes each variant — avoiding hand-transcribing a
  1700-line file twice.

## Verification

`pnpm export:core` + symlinked `node_modules` + `tsc --noEmit`: Core
47 → 25, zero `lib/api/client.ts` errors remaining (the 25 left are the
two already-documented, already-tracked clusters: the accepted
`lib/stock-allocation` debt and the new "payments/shipping/export
action-bar mixing cluster" — nothing new). `pnpm export:pro` + same
check: Pro 18 → **1** — every remaining Pro error was this file; the one
left (`OrderDetailActionBar.tsx` → `@/components/shipping`) is that same
action-bar cluster's Pro half. Full-repo `npx tsc --noEmit` clean.
`pnpm check:manifest` OK (no manifest edit was needed). `npx eslint` on
both new files: only the same pre-existing `window.location.href`
warning the original `client.ts` already has. `pnpm test`: 809 passed (the
1 known pre-existing `invoice-event-date.test.ts` date-fixture failure,
unchanged) — a `lib/server/tenant-prisma.test.ts` DB-connectivity failure
seen mid-session was transient (Neon reachability), not a regression;
confirmed unrelated (that test doesn't touch `lib/api`) and not
reproducing after.

Also spot-checked at runtime: ran the actual dev server (real Postgres,
migrated) and logged in via a test account — confirmed `/admin/settings`
(the untouched default `AdminSettingsContent.tsx`) and `/products` /
`/categories` still render correctly with no console errors, i.e. no
regression in the untiered build these two new sibling files don't affect.

## Left alone, correctly out of scope

The class's internal structure itself (one property per domain, mixing
core/pro/premium method groups in a single object) is unchanged. A
"real" fix would split `lib/api` into per-domain modules each bucketed to
its true tier — but that means rewriting every one of ~40 hook files'
`apiClient.foo.bar()` call sites, a much larger blast-radius change than
this phase's scope. The stand-in-type approach fixes the compile error
with zero behavior change and zero caller-site risk; the deeper
architectural split is a separate, larger decision if ever wanted.
