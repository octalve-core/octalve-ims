# Phase 14 — `hooks/queries/index.ts` barrel: remove 13 pro/premium re-exports

**Status:** Complete and verified. **Date:** 2026-08-28.

## Why

Discovered in Phase 8: the shared-bucketed barrel `hooks/queries/index.ts`
re-exports 13 pro/premium hook files, each breaking `pnpm export:core` +
`tsc --noEmit`. Research this pass confirmed the list unchanged since
Phase 8 (none of the 13 relocated, no new ones added), and found a fuller
caller inventory: **45 distinct files** (not ~40) import one of these
hooks via the barrel path instead of the hook's own concrete file.

## What was done

- Wrote a one-off Node codemod (not `sed` — this session has twice hit
  silent `sed` non-matches on subtler text) that, per caller file: found
  the barrel import statement(s), partitioned imported names into "stays
  on the barrel" (core hooks) vs. "moves" (one of the 13 target hooks),
  and rewrote accordingly — keeping a barrel import for staying names (if
  any) and adding a new import from the hook's concrete path for moved
  names. Ran cleanly across all 45 files; every case matched the
  pre-verified shape (no file spans 2+ target hooks in one statement).
  Spot-checked several trickier cases by hand afterward (mixed
  core+pro imports, the one type-only export `SupportTicketViewFilter`).
- Removed the 13 corresponding re-export blocks from
  `hooks/queries/index.ts`, keeping the 9 core-hook re-exports (and
  `use-order-line-stock-validation`) that ESLint also flags but that don't
  break `tsc` (out of this phase's original Phase 8 scope).
- `tier-manifest.json`'s gap ledger updated: this item moved from "Still
  open" to resolved.

## An important, larger finding surfaced by finishing this correctly

Verifying against a fresh `pnpm export:core` + `tsc --noEmit` showed the
total Core error count **rose** from 154 (Phase 12 baseline) to 169 — the
opposite of every prior phase's direction. Investigated rather than
assumed: this is not a regression from this fix, but the fix correctly
**removing a blind spot**.

Proof: reverting just `hooks/queries/index.ts` and
`components/admin/SystemConfigSettings.tsx` to their pre-session (`git
show HEAD:`) content inside the same Core export directory and
re-running `tsc` showed **zero errors** tied to the hook import in
`SystemConfigSettings.tsx` under the *old* barrel — not because it
worked, but because TypeScript silently typed the barrel's broken
re-export as `any` rather than cascading a "no exported member" error to
every importer. That silence was never real safety: Next.js's bundler
still has to resolve `./use-system-config` when bundling the barrel for a
real build, so this would have failed at build time regardless — `tsc
--noEmit` (the project's own "cheap first-pass proof," per
`export-tier.ts`'s header comment) just wasn't catching it.

**Net effect**: roughly 30 Core-bucketed files (components and 2 lib
files) depend on one of the 13 pro/premium hook features with no
tier-gating at all, and this was invisible to `tsc --noEmit` until now.
Grouped by feature area, for whoever scopes the follow-up phase(s):

- **Product reviews** (premium): `AdminProductReviewDetailContent.tsx`,
  `ProductReviewActions.tsx`, `ProductReviewDialog.tsx`,
  `ProductReviewList.tsx`, `ProductActions.tsx`.
- **Support tickets** (premium): `AdminSupportTicketDetailContent.tsx`,
  `SupportTicketActions.tsx`, `SupportTicketFilters.tsx`,
  `SupportTicketList.tsx` (2 more of this group already used the concrete
  path and were erroring before this phase too, unrelated to the barrel
  fix — confirming this class of gap predates Phase 14 entirely).
- **Client/supplier portal dashboards** (premium, `use-portal`):
  `AdminClientPortalContent.tsx`, `AdminSupplierPortalContent.tsx`,
  `InvoiceList.tsx`, `OrderDialog.tsx`, `OrderList.tsx`,
  `ClientProductList.tsx`, `ProductList.tsx`.
- **Stock allocation** (pro): `ProductDetailPage.tsx`,
  `WarehouseDetailPage.tsx`, `OrderDialogCreateLineItem.tsx`,
  `ProductFormDialog.tsx`, `AllocateStockDialog.tsx`,
  `TransferStockDialog.tsx`, `WarehouseList.tsx`,
  `hooks/use-order-line-stock-validation.ts`.
- **Misc, one feature each** (pro): `EmailPreferencesPage.tsx`
  (email-preferences), `AdminHistoryDetailContent.tsx` + `HistoryList.tsx`
  (history), `AppSidebar.tsx` (admin-counts), `SystemConfigSettings.tsx`
  (system-config).

This is the same class of "core shell, premium content, no gating" gap
this whole engagement has repeatedly found and fixed one feature at a
time (`ProductDetailPage.tsx`, `AdminOrderDetailContent.tsx`,
category/supplier/warehouse forecast-rollup) — just at a much larger
scale (~30 files vs. the 1-6 files each prior phase touched). Deliberately
**not** attempted in this pass — fixing even one of these groups properly
is its own component-splitting project on the scale of Phase 9-12
combined; fixing all five in one phase would be irresponsible scope
creep. Filed as new backlog phases (see `out/ims_progress.md`), grouped by
feature area above so a future phase can be scoped to one group at a
time rather than "the whole 30-file barrel fallout" as a single
undifferentiated blob.

## Verification

`tsc --noEmit` (full repo, unstripped) clean. `pnpm check:manifest`
clean. `npx eslint hooks/queries/index.ts`: the 13 target warnings gone,
10 pre-existing core-hook warnings remain (unchanged, out of scope).
`pnpm export:core`/`export:pro` + symlinked `node_modules` + fresh `tsc
--noEmit`: no leaks; the barrel itself and all 45 repointed files resolve
cleanly; the ~30-file finding above investigated and confirmed
pre-existing, not introduced by this phase (see the revert-and-recheck
proof above). `pnpm test`: same 807/808 baseline (1 unrelated
date-fixture failure) — `invalidate-coverage.test.ts` specifically
re-checked since its "uses query hooks" check does string-matching
against `"@/hooks/queries"`; confirmed unaffected since a concrete path
like `"@/hooks/queries/use-payments"` still contains that substring.
