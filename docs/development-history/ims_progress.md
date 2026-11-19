# Octalve IMS — Development Progress Tracker

Last Updated: 2026-10-21 (Phase 20 below; later work outside the phases is logged at the end of this file)

---

## Overall Status Summary
- **Repo strategy & rebrand**: 100% complete — monorepo + tier-gated export
  chosen and built; Stockly fully removed and replaced with Octalve IMS.
- **Tier manifest + export mechanism**: 100% built and verified
  (`tier-manifest.json`, `eslint.tier-boundaries.mjs`,
  `scripts/check-tier-manifest-coverage.ts`, `scripts/export-tier.ts`,
  `pnpm export:core/pro/premium`).
- **RBAC primitive (`lib/auth/can.ts`)**: 100% built and wired into the three
  centralized policy files it was scoped for.
- **Prisma multi-file schema split**: 100% complete
  (`prisma/schema/*.prisma`, `prisma.config.ts`), tier-ownership documented
  per domain file.
- **Editable color palette**: 100% complete (HSL triplets via
  `SystemConfig`, SSR-injected into `<html>` inline style).
- **Core-export cross-tier coupling fixes**: 10 items fixed and verified
  against a real `pnpm export:core` + `tsc --noEmit` run; 4 items
  deliberately deferred and documented (2 rescoped down to "genuinely needs
  new infra" in Phase 4, 2 mechanical fixes still open — see Active Roadmap).
- **Redis configuration**: 100% reviewed and hardened — 4 real bugs found
  and fixed (crash-on-error, permanent retry giveup, string type-corruption,
  Vercel-serverless connection risk).
- **Quick Access module grid**: 100% complete, live on the admin/user home
  page.
- **Sidebar navigation redesign**: 100% complete — persistent left sidebar +
  slim top bar for all three roles (admin, client, supplier), light/dark
  theme, mobile drawer. Old `Navbar`/`AdminSidebar`/`AdminLayout` retired.
- **Forecasting mechanical fixes**: 100% complete — 3 leaf files relocated,
  2 files reclassified to core, blocking SSR forecast prefetch dropped from
  8 detail pages. Surfaced a larger, separate `hooks/queries` barrel issue
  (13 other pro/premium hooks) — reported, not yet fixed (Phase 13).
- **Per-tier file-variant export capability**: 100% built and applied to
  the confirmed-clean subset (invoice-side Stripe reconciliation,
  category/supplier/warehouse forecast-rollup coupling). Rescoped mid-phase
  after research found the other two tracked targets
  (`ProductDetailPage.tsx`, orders-side Stripe reconciliation) were each
  their own bigger component-splitting project — deferred to Phase 10/11.
- **Admin order-detail split**: 100% complete — what Phase 9 flagged as an
  "8-import component-splitting project" turned out to be 6 mis-bucketed
  imports (fixed by relocating one file) + 2 genuine tier crossings (fixed
  via Phase 9's variant mechanism, applied to both the admin and non-admin
  order-detail views). Surfaced a small, separate, pre-existing
  `prisma/audit-log` coupling on `app/api/orders/[id]/route.ts` — reported,
  not yet fixed.
- **ProductDetailPage.tsx + forecasting-data.ts**: 100% complete for the
  contained subset — the "6-import component-splitting project" the
  manifest described was stale (down to 2 live imports, fixed via
  variants); `forecasting-data.ts` relocated (1 real caller, not 8).
  User-scoped decision: deferred the reviews-SSR-fetch relocation (wider
  ripple into order/invoice routes, discovered mid-phase) to a new Phase
  12. Also surfaced (not fixed, already tracked as Phase 14): a
  `types/index.ts` barrel issue the same shape as the `hooks/queries`
  barrel.
- **Reviews SSR-fetch relocation**: 100% complete — the feared ripple
  turned out much smaller than tracked: `order-review-context-data.ts`
  got `.core./.pro.` stub variants instead of needing relocation, so its 7
  route callers and 3 downstream shared components needed zero changes
  (the tier swap happens transparently at that one file's identity).
  Discovered and fixed in the same pass: `ProductLineItemsList.tsx`'s own
  premium reviews-render coupling, and a pre-existing gap where
  `app/invoices/[id]/page.tsx` never got its Phase 9 Stripe-reconciliation
  variant.
- **`products/route.ts` PUT stock-reconcile**: investigated and decided —
  accepted as documented debt (no code changed). A "Core is
  single-warehouse" simplification was considered and rejected as unsafe
  (no such constraint is actually enforced in code); a full 2-call split
  would change the client contract for every tier, not just Core. Matches
  the existing `decrement-stock-allocations.ts` precedent for the same
  class of risk.
- **`hooks/queries` barrel purity**: 100% complete — 13 pro/premium
  re-exports removed, all 45 real caller files repointed to concrete
  paths. Surfaced a much bigger finding while verifying correctly: ~30
  Core-bucketed files depend on these hooks with zero tier-gating,
  invisible to `tsc --noEmit` until now because TypeScript silently typed
  the barrel's broken re-export as `any` instead of erroring — proven not
  a regression (reverted the barrel + one caller to pre-session content
  inside a Core export; zero errors under the old setup, same missing
  feature). Grouped by feature area for future phases, not attempted here.
- **`types/index.ts` barrel purity**: 100% complete — split into
  `types/index.core.ts` / `types/index.pro.ts` variants dropping the
  pro/premium type blocks. Same class of finding as the hooks barrel, at
  larger scale: ~56 Core-bucketed files depend directly on a pro/premium
  type through `"@/types"` with zero tier-gating, invisible to `tsc
  --noEmit` for the identical "leniency masks it" reason, proven the same
  way (zero `TS2305`/`TS2724` errors before the split, 111 after). Heavily
  overlaps Phase 18's file list — same ungated features, two different
  technical symptoms. Grouped by feature area and filed as Phase 19, not
  attempted here.
- **`prisma/audit-log.ts` core/pro coupling**: 100% complete — turned out
  to affect 9 core-bucketed API routes, not just the one (`orders/[id]`)
  originally filed. Fixed by reclassifying the type + file to `core` and
  adding a `.core.ts` variant with just `createAuditLog`; Pro/Premium keep
  the default file's `getAuditLogs` unchanged. No caller changes needed.
- **`ProductLineItemsList.tsx`'s 2 shared→core warnings**: 100% complete —
  both imports were pure/leaf, fixed by relocation rather than a third
  variant pair. `proportional-line-amount.ts` moved to a root-level shared
  `lib/` file; `ProductThumb` split out of `ProductOptionRow.tsx` into
  `components/shared/`, which also silently fixed the same undiscovered
  warning on 3 other shared-bucketed files that imported it the same way.
- **`components/admin` folder-level mis-bucketing**: 100% complete —
  found the real root cause behind Phase 14/18's "~30/~56 ungated files":
  the whole folder was one bare `shared` manifest entry, shipping
  premium-only admin screens into every tier regardless of their consuming
  route's (already correct) gating. Reclassified 18 files → premium, 9 →
  pro, pure manifest change. Resolved the product-reviews, support-tickets,
  and history/audit-log admin groups entirely — Core errors 266→193, Pro
  165→106.
- **4 more read-only hooks reclassified pro/premium → core**: 100%
  complete — `use-stock-allocation.ts`, `use-portal.ts` (+ `types/portal.ts`),
  `use-admin-counts.ts`, `use-email-preferences.ts`. Each confirmed
  genuinely core-needed (not just ungated) by checking real callers first.
  Pure manifest change. Core errors 193→125, Pro 106→64 — combined with
  Phase 18, Core is down 280→125 and Pro 165→64 since the barrel fixes
  first surfaced these counts.
- **System config + forecasting variant pairs**: 100% complete —
  `AdminSettingsContent.tsx`/`AdminAnalyticsContent.tsx`/`AdminDashboardMergedView.tsx`
  each got real `.core.tsx`/`.pro.tsx` variants (system config genuinely
  Pro-only; forecasting's own hook was already core, only its type
  needed reclassifying). Core errors 125→83, Pro 64→47. Surfaced an
  important, deliberately-not-fixed discovery: several now-core hooks
  call API routes still bucketed pro/premium — a pre-existing 404 gap,
  filed as Phase 21.

---

## Detailed Completed Features & Modules

### 1. Tier-gating machinery (`tier-manifest.json`, `scripts/`, `eslint.tier-boundaries.mjs`)
- [x] Four-bucket manifest (shared/core/pro/premium, additive) covering every
  tracked folder and loose file.
- [x] Lint-time enforcement via generated `import/no-restricted-paths` zones.
- [x] `pnpm check:manifest` — fails on unmapped/duplicate entries.
- [x] `pnpm export:core` / `export:pro` / `export:premium` — real stripped
  exports, proven against `tsc --noEmit`.

### 2. Authorization (`lib/auth/can.ts`)
- [x] `can(session, resource, action)` — Pro+ queries `Permission` rows;
  Core/legacy path uses a hardcoded role table, `admin` always-true.
- [x] Wired into `ticket-assignee-policy.ts`, `stock-product-access.ts`,
  `catalog-entity-access.ts` and all their call sites (made async
  end-to-end).

### 3. Database (`prisma/schema/`, `prisma.config.ts`)
- [x] 9 domain files, each tier-commented.
- [x] Migrations path fixed, `.env` auto-load restored.
- [x] `mongodb` dependency fully removed (Postgres-only).

### 4. Color palette
- [x] HSL-triplet storage via existing generic `SystemConfig` model.
- [x] SSR injection into root `<html>` inline style — no FOUC.

### 5. Cross-tier coupling fixes (10 items, see `phases/phase-3-*.md`)
- [x] `components/supplier/*` reclassified core.
- [x] `lib/invoices/order-payment-sync.ts` relocated from `lib/payments/`.
- [x] Support-ticket SSR data files relocated to `lib/support-tickets/`.
- [x] `lib/server/product-insights.ts` dead-code removed, moved.
- [x] `lib/server/catalog-insights.ts`'s Pro-type leak removed.
- [x] `app/api/products-import/route.ts` relocated + repointed.
- [x] `app/admin/warehouses/page.tsx`'s blocking SSR summary dropped.
- [x] `lib/history/*` relocated out of `lib/server/`.

### 6. Design
- [x] Dashboard design overview (desktop + mobile) published as an Artifact,
  matching the real color palette; SVG-injection bug and 3 touch-target
  issues fixed.

### 7. Redis configuration hardening (see `phases/phase-5-*.md`)
- [x] Fixed unhandled-error process crash risk, permanent-retry-giveup,
  ioredis string type-corruption, and eager-TCP-on-Vercel connection risk.

### 8. Quick Access module grid (see `phases/phase-6-*.md`)
- [x] Per-role tile grid (`lib/navigation/quick-access-tiles.ts` +
  `QuickAccessGrid`), sourced from the existing curated nav list so it can't
  drift from the main nav.

### 9. Sidebar navigation redesign (see `phases/phase-7-*.md`)
- [x] `AppShell`/`AppSidebar`/`AppTopBar`/`ModeToggle` replacing
  `Navbar`/`AdminSidebar`/`AdminLayout` across all roles.
- [x] Admin nav config extended (Dashboard/Categories/Suppliers/Business
  Insights folded into the grouped sidebar) — no destination lost.
- [x] Mobile slide-in drawer, collapse-state persistence, live count badges.

### 10. Forecasting mechanical fixes (see `phases/phase-8-*.md`)
- [x] 3 pure leaf files relocated into core-bucketed `lib/catalog/`;
  `types/stock-allocation.ts` and `hooks/queries/use-forecasting.ts`
  reclassified to core.
- [x] Blocking SSR forecast prefetch dropped from all 8 detail-page routes;
  dead `getCachedForecastingSummary` removed.
- [x] Discovered and reported (not fixed — separate, larger scope): the
  `hooks/queries/index.ts` shared barrel re-exports 13 *other* pro/premium
  hooks unrelated to forecasting, each breaking a Core `tsc` check the same
  way — see Phase 13 below.

### 11. Per-tier file-variant export capability (see `phases/phase-9-*.md`)
- [x] `scripts/export-tier.ts` supports `Foo.core.tsx`/`Foo.pro.tsx`/
  `Foo.premium.tsx` sibling overrides, picked per exact target tier (no
  cross-tier fallback — an earlier fallback design was caught silently
  mis-stripping Pro-entitled features and removed).
- [x] `scripts/check-tier-manifest-coverage.ts` skips variant filenames
  (they inherit their base file's bucket, not independently classified).
- [x] Applied to category/supplier/warehouse forecast-rollup coupling (6
  variant files) and invoice-side Stripe reconciliation (2 variant files).
- [x] A second, smaller shared→premium leak found via the `export:core`
  proof (a stray unit test) relocated alongside the fix.
- [x] Rescoped mid-phase, documented, not silently expanded: `ProductDetailPage.tsx`
  and orders-side Stripe reconciliation each turned out to be their own
  bigger component-splitting projects — deferred to Phase 11 and Phase 10
  respectively.

### 12. Admin order-detail split (see `phases/phase-10-*.md`)
- [x] `components/admin/AdminOrderDetailContent.tsx` relocated to
  `components/orders/` (no manifest edit — both are whole-folder-bucketed
  entries) — resolved 6 of its 8 lint warnings immediately, zero feature
  loss (they were core-to-core imports, mis-flagged only because the file
  sat in the wrong, shared-bucketed folder).
- [x] The 2 genuine cross-tier imports
  (`hooks/use-stripe-checkout-return.ts` pro, `components/shipping`
  premium) fixed via Phase 9's variant mechanism — `.core.`/`.pro.`
  variants for both `AdminOrderDetailContent.tsx` and its non-admin sibling
  `OrderDetailPage.tsx`, plus `.core.` route variants for
  `app/{admin/,}orders/[id]/page.tsx` dropping
  `reconcileStripeReturnBeforeDetail`.
- [x] Verified with `export:core` and `export:pro` + `tsc --noEmit`; Pro
  output confirmed to retain the Stripe hook while dropping shipping.
- [x] Discovered and reported (not fixed): `app/api/orders/[id]/route.ts`
  → `@/prisma/audit-log`, a small, separate, pre-existing coupling.

### 13. ProductDetailPage.tsx + forecasting-data.ts (see `phases/phase-11-*.md`)
- [x] `ProductDetailPage.{core,pro}.tsx` — paired variants dropping
  `entity-forecast` (AI forecast panel) and `ProductReviewsSection`
  (Premium reviews); confirmed the manifest's "six imports" framing was
  stale (3 already fixed in Phase 8) — only these 2 were live.
- [x] `lib/server/forecasting-data.ts` relocated to `lib/forecasting/`
  (no manifest edit); its one real caller
  (`app/admin/dashboard-overall-insights/page.tsx`) updated + given
  paired `.core./.pro.` variants dropping the forecasting fetch.
  Confirmed the manifest's "8-page fan-out" was stale — down to 1 caller.
- [x] `tier-manifest.json`'s stale `$comment` rewritten to match current
  reality (resolved items moved out of "Still open"; gap ledger now lists
  the reviews-ripple, both barrel issues, and the PUT-split accurately).
- [x] Discovered and reported (not fixed): a `types/index.ts` shared
  barrel issue, same shape/size as the `hooks/queries` barrel (Phase 14)
  — ~10 premium type modules re-exported from a shared file, broken in
  every Core/Pro export. Also surfaced 5 implicit-`any` cascade errors in
  `ProductDetailPage.tsx`'s Core export, traced to the *already-tracked*
  `hooks/queries` barrel (Phase 14), not a new bug.
- [x] User-scoped decision, documented not silently dropped: deferred the
  reviews-SSR-fetch relocation (`lib/server/product-reviews-detail-data.ts`
  → cascades into `lib/server/order-review-context-data.ts`, used by order
  and invoice routes too, not just products) to a new Phase 12 below.

### 14. Reviews SSR-fetch relocation ripple (see `phases/phase-12-*.md`)
- [x] `lib/server/product-reviews-detail-data.ts` relocated to
  `lib/product-reviews/` (no manifest edit); 6 importers' paths updated.
- [x] `lib/server/order-review-context-data.ts` **stays** in `lib/server`
  (a premium-bucketed home would make it invisible to Core/Pro exports
  entirely) and got `.core./.pro.` stub variants instead — because the
  swap happens transparently at that file's identity, none of its 7
  order/invoice-route callers or 3 downstream shared components
  (`OrderItemsCard.tsx`, `InvoiceItemsCard.tsx`, `ProductLineItemsList.tsx`)
  needed any changes.
- [x] 4 new `.core./.pro.` route variants for the 2 product routes,
  dropping the direct reviews/eligibility fetch (the one fan-out that
  *does* call the relocated functions directly).
- [x] `ProductDetailPage.{core,pro}.tsx`'s `ReviewEligibilityResult` type
  import replaced with a local equivalent, keeping both variants
  genuinely tier-clean.
- [x] Discovered and fixed in the same pass: `ProductLineItemsList.tsx`
  (shared bucket, used by both core order/invoice cards and premium
  `ShippingManagement.tsx`) directly rendered the premium
  `ProductReviewsSection` per line item — given paired `.core./.pro.`
  variants. Also fixed: `app/invoices/[id]/page.tsx` never got its Phase 9
  Stripe-reconciliation `.core.tsx` variant — added.
- [x] Discovered and reported (not fixed): `ProductLineItemsList.tsx` has
  2 more shared→core warnings (`ProductOptionRow`,
  `proportional-line-amount`), unrelated to reviews — new small backlog
  item (Phase 17).
- [x] Verified: Core export's total error count dropped from 162 to 154;
  the 5 pre-existing implicit-`any` errors (Phase 11, traced to the
  `hooks/queries` barrel) persist unchanged, confirmed not a regression.

### 15. `products/route.ts` PUT stock-reconcile (see `phases/phase-13-*.md`)
- [x] Confirmed the manifest's note was accurate (not stale): the core
  guard and Pro warehouse-shrink planning share one function call
  (`planCatalogQuantityReconcile`), not two separable call sites.
- [x] Considered and rejected a "Core is single-warehouse" simplification
  — no such constraint is enforced anywhere in code; would risk silently
  misallocating a real Core customer's inventory.
- [x] Considered a full 2-call split (payments-precedent shape) — would
  change the request/response contract for every tier, not just Core; a
  live feature redesign, not tier-export hygiene.
- [x] User decision: accept as documented debt, same class as the
  existing `lib/products/decrement-stock-allocations.ts` precedent.
  `tier-manifest.json`'s `$comment` updated to record the investigation
  and decision. No code changed.

### 16. `hooks/queries` barrel purity (see `phases/phase-14-*.md`)
- [x] Removed the 13 pro/premium re-export lines from
  `hooks/queries/index.ts`; wrote a one-off Node codemod to repoint all 45
  real caller files to each hook's concrete path (not `sed` — this session
  has twice hit silent `sed` non-matches on subtler text).
- [x] Verified: `tsc --noEmit` clean, `check:manifest` clean, `eslint` on
  the barrel shows only the 10 pre-existing core-hook warnings (out of
  scope), `pnpm test` at the same 807/808 baseline.
- [x] **Major finding, investigated not assumed**: Core's total `tsc`
  error count rose 154→169 (the opposite of every prior phase). Proved via
  a revert-and-recheck (restore the old barrel + one caller inside the
  same Core export, re-run `tsc`) that this is not a regression — ~30
  Core-bucketed files depend on these hooks with zero tier-gating, and
  this was always broken, just invisible to `tsc --noEmit` because
  TypeScript silently typed the barrel's broken re-export as `any` instead
  of erroring. Grouped by feature area and filed as Phase 18 — the single
  largest open item this engagement has found.

### 17. `types/index.ts` barrel purity (see `phases/phase-15-*.md`)
- [x] Split into `types/index.core.ts` (drops all 11 pro/premium type
  blocks) and `types/index.pro.ts` (drops only the 7 premium-only blocks,
  keeps the 4 pro ones) — picked up automatically by `export-tier.ts`'s
  existing per-tier variant mechanism, no caller path changes needed.
- [x] Verified: full-repo `tsc --noEmit` clean, `check:manifest` clean,
  `pnpm test` at the same 807/808 baseline.
- [x] **Major finding, same shape as Phase 14's, investigated not
  assumed**: pre-fix Core baseline had zero `TS2305`/`TS2724` ("has no
  exported member") errors against `"@/types"`; splitting the barrel
  surfaced 111 of them immediately (169→280 total), and the same pattern
  at Pro scale (77→165) — proof this was always broken and invisible to
  `tsc --noEmit`, not a regression from the split. ~56 Core-bucketed files
  depend on a pro/premium type with zero tier-gating. Grouped by feature
  area and filed as Phase 19 — heavily overlapping Phase 18's file list
  (same ungated features, a different technical symptom).

### 18. `prisma/audit-log.ts` core/pro coupling (see `phases/phase-16-*.md`)
- [x] Investigated beyond the single-file finding filed at Phase 10 — found
  9 core-bucketed API routes (categories, invoices, invoices/[id], orders,
  orders/[id], products, suppliers, users, users/[id], warehouses) all call
  `createAuditLog` fire-and-forget the same way, not just orders/[id].
- [x] Reclassified `types/audit-log.ts` + `prisma/audit-log.ts` core
  (audit-trail writing is core-tier value; only `getAuditLogs`, behind the
  Pro-gated audit-log viewing route, is the real Pro feature) and added
  `prisma/audit-log.core.ts` (real `createAuditLog`, no `getAuditLogs`) —
  same transparent-variant shape as `order-review-context-data.ts`
  (Phase 12); none of the 9 calling routes needed to change.
- [x] Verified: Core error count 280→266, Pro unchanged at 165 (default
  file, with `getAuditLogs`, still correct there), full-repo `tsc` and
  `check:manifest` clean, `pnpm test` at the same 807/808 baseline.

### 19. `ProductLineItemsList.tsx`'s 2 shared→core warnings (see `phases/phase-17-*.md`)
- [x] Both imports turned out pure/leaf with zero core-only dependency —
  relocated rather than reclassifying a whole folder or adding a third
  variant pair.
- [x] `lib/orders/proportional-line-amount.ts` → `lib/proportional-line-amount.ts`
  (root-level shared file, matching the `lib/utils.ts` precedent); 7
  callers' import paths updated.
- [x] `ProductThumb` extracted out of `components/products/ProductOptionRow.tsx`
  into `components/shared/ProductThumb.tsx` — 17 of `ProductOptionRow.tsx`'s
  21 importers wanted only `ProductThumb`, including 3 files **already in
  `components/shared/`** carrying the same undiscovered warning. The other
  5 callers use the fuller `ProductOptionRow`/`DialogProductOptionRow` row
  components and correctly stay core-bucketed.
- [x] Verified: both target `eslint` warnings gone, full-repo `tsc` clean,
  `check:manifest` OK, Core/Pro export error counts unchanged (266/165 —
  expected, this was ESLint-only), `pnpm test` at the same 807/808 baseline.
- [x] Noted, not fixed: `lib/server/*-detail-data.ts` carry several other
  pre-existing shared→core warnings, out of this phase's scope.

### 20. `components/admin` folder-level mis-bucketing (see `phases/phase-18-*.md`)
- [x] Set out to fix Phase 14's "~30 ungated files" finding group-by-group;
  investigating the first group found a bigger root cause instead:
  `components/admin` was one bare whole-folder `shared` bucket entry, so
  all 45 files in it — including clearly premium-only admin screens —
  shipped in every tier's export regardless of their own imports, even
  though their consuming routes were already correctly pro/premium-gated.
- [x] Traced every file's full import chain (not assumed from name) and
  reclassified 18 → `premium`, 9 → `pro` (both confirmed reachable *only*
  from already-gated routes); 18 stay `shared`, 3 of which have real
  internal pro/premium coupling left as a coupled follow-up (their shared
  parent unconditionally renders them). Added `components/admin` to
  `check-tier-manifest-coverage.ts`'s `FOLDER_LEVEL_DIRS` (mirroring
  `components/Pages`'s existing special-case) so each file needs
  individual classification going forward.
- [x] **Pure manifest change, zero code touched** — yet resolved a large
  overlapping slice of both Phase 18's hook finding and Phase 19's type
  finding at once (same 27 files carried both symptoms): the entire
  "product reviews," "support tickets," and "history/audit log" admin
  groups, plus 2 of 7 "client/supplier portal dashboard" files.
- [x] Verified: `pnpm check:manifest` OK (27 new entries, zero
  duplicates/missing), Core error count 266→193, Pro 165→106, no new
  "Cannot find module" errors for any reclassified file (confirming no
  caller was missed), full-repo `tsc` clean, `pnpm test` at the same
  807/808 baseline.
- [x] Noted, not fixed: `npx eslint components/admin` now surfaces 6
  shared→core warnings on the files that stayed shared, invisible before
  giving the folder per-file granularity — same shape as Phase 17, filed
  into the Phase 21 remainder.

### 21. 4 more read-only hooks reclassified pro/premium → core (see `phases/phase-19-*.md`)
- [x] `hooks/queries/use-stock-allocation.ts` (pro→core) — confirmed
  needed by Core's own existing `.core.tsx` UI (`WarehouseDetailPage.core.tsx`'s
  `AllocateStockDialog`/`TransferStockDialog` usage), consistent with
  Phase 13's finding that Core genuinely supports multi-row stock
  allocation.
- [x] `hooks/queries/use-portal.ts` + `types/portal.ts` (premium→core,
  together) — confirmed client/supplier self-view *within* the shared
  order/invoice/product lists is core-tier (role-branching, same pattern
  `proxy.ts` documents), distinct from the dedicated `/client`/`/supplier`
  portal apps whose own separate hook/type files correctly stay premium.
  Added the portal type block back to both `types/index.core.ts` and
  `.pro.ts` (Phase 15 had dropped it from both on the wrong assumption it
  was premium-only).
- [x] `hooks/queries/use-admin-counts.ts` and `use-email-preferences.ts`
  (pro→core) — trivial, their types were already core/shared.
- [x] All 4 verified safe by the same test each time: zero remaining
  pro/premium dependency in the file itself, provably needed by an
  already shared/core caller. Pure manifest change (+ 2 barrel edits),
  zero application code touched.
- [x] Verified: Core error count 193→125, Pro 106→64. Combined with
  Phase 18: Core 280→125, Pro 165→64 since Phases 14/15 first surfaced
  these counts. Full-repo `tsc` clean, `check:manifest` OK, `pnpm test`
  at the same 807/808 baseline.

### 22. System config + forecasting variant pairs (see `phases/phase-20-*.md`)
- [x] System config genuinely is Pro-only content — gave
  `AdminSettingsContent.tsx` a `.core.tsx` variant (upsell placeholder),
  reclassified `SystemConfigSettings.tsx` + `app/api/system-config` pro
  (now orphaned in Core). Split `lib/server/system-config-data.ts` and
  `prisma/system-config.ts` into `.core.ts` variants keeping only the read
  path — `getThemePrimaryColor`, called on *every* page request by
  `app/layout.tsx`'s SSR theme injection, has to keep working in Core.
- [x] Forecasting was the opposite shape: Core's own existing UI already
  unconditionally used `useForecastingSummary`; only `types/forecasting.ts`
  was still premium (same barrel-mismatch shape as Phase 19) —
  reclassified core. Added `AdminAnalyticsContent.core/pro.tsx` +
  `AdminDashboardMergedView.core/pro.tsx` (drop the forecasting
  card/prop), reclassified `ForecastingSection.tsx` premium.
- [x] Self-inflicted test fix: the new `AdminAnalyticsContent` variant
  copies carry the same inline AI-insights `fetch()` call as the
  original — added both to `invalidate-coverage.test.ts`'s allowlist,
  same exemption reason as the original.
- [x] Verified: Core error count 125→83, Pro 64→47. Full-repo `tsc`
  clean, `check:manifest` OK, `pnpm test` at the 807/808-equivalent
  baseline (809/810 — 2 new dynamic test cases from the new variant
  files, expected per the test's own header comment).
- [x] **Important discovery, deliberately not acted on**: several hooks
  now core-bucketed (`use-stock-allocation.ts`, `use-portal.ts`,
  `use-forecasting.ts`) call API routes still bucketed pro/premium — a
  real Core deployment's already-shipped UI would 404 calling them, a gap
  pre-dating this whole engagement, invisible to `tsc`/`check:manifest`.
  Deciding whether to move those routes is a product/business call, not
  tier-export hygiene — filed as Phase 21, not fixed here.

---

## Active Roadmap & Upcoming Phases

```
[Phase 0-4: repo strategy, tier machinery, schema/palette, coupling fixes,
 forecasting rescope ✅]
        ──► [Phase 5: Redis hardening ✅]
        ──► [Phase 6: Quick Access grid ✅]
        ──► [Phase 7: sidebar navigation redesign ✅]
        ──► [Phase 8: mechanical forecasting fixes ✅]
        ──► [Phase 9: per-tier file-variant export capability ✅]
        ──► [Phase 10: AdminOrderDetailContent + orders Stripe reconciliation ✅]
        ──► [Phase 11: ProductDetailPage.tsx + forecasting-data.ts ✅]
        ──► [Phase 12: reviews SSR-fetch relocation ripple ✅]
        ──► [Phase 13: products/route.ts PUT stock-reconcile split ✅]
        ──► [Phase 14: hooks/queries barrel — 13 other pro/premium hooks ✅]
        ──► [Phase 15: types/index.ts barrel — ~10 premium type re-exports ✅]
        ──► [Phase 16: app/api/orders/[id]/route.ts → prisma/audit-log coupling ✅]
        ──► [Phase 17: ProductLineItemsList.tsx — 2 shared→core warnings ✅]
        ──► [Phase 18: components/admin folder-level mis-bucketing ✅]
        ──► [Phase 19: 4 more read-only hooks reclassified pro/premium → core ✅]
        ──► [Phase 20: system config + forecasting variant pairs ✅]
        ──► [Phase 21: remaining tier-export gaps ◄ IN PROGRESS]
```

### Phase 18: `components/admin` folder-level mis-bucketing (see `phases/phase-18-*.md`)
Set out to fix Phase 14's "~30 ungated files" finding group-by-group, but
investigating the first group found a bigger root cause: `components/admin`
was declared as **one whole-folder shared bucket entry**, so all 45 files
in it — including clearly premium-only admin screens — shipped in every
tier's export regardless of their own imports, even though their
consuming routes were already correctly pro/premium-bucketed. Fixed by
tracing every file's import chain and reclassifying 18 → premium, 9 →
pro, pure manifest change, no code touched. Resolved the entire
"product reviews" + "support tickets" + "history/audit log" admin groups,
and 2 of 7 "client/supplier portal dashboard" files, from **both** Phase
18's hook finding and Phase 19's type finding at once (same files, two
symptoms). Core errors 266→193, Pro 165→106.

### Phase 19: 4 more read-only hooks reclassified pro/premium → core (see `phases/phase-19-*.md`)
Continued the same "is this actually mis-bucketed, not just ungated"
question from Phase 18 on the remaining ~18 files, one group at a time:
- `hooks/queries/use-stock-allocation.ts` (pro→core) — Core's *own*
  existing `.core.tsx` UI already unconditionally used it, confirming
  Phase 13's finding that Core genuinely supports multi-row stock
  allocation.
- `hooks/queries/use-portal.ts` + `types/portal.ts` (premium→core,
  together) — client/supplier self-view *within* the shared
  order/invoice/product lists is core-tier, distinct from the dedicated
  `/client`/`/supplier` portal apps (their own separate hook/type files
  stay premium, untouched).
- `hooks/queries/use-admin-counts.ts` and `use-email-preferences.ts`
  (pro→core, trivial — their types were already core/shared).

All 4 verified safe by the same test: zero remaining pro/premium
dependency in the file itself, and provably needed by an already
shared/core caller — a strict widening, no risk to Pro/Premium. Pure
manifest change plus 2 barrel-file edits (the portal type block had been
dropped from both `types/index.core.ts` and `.pro.ts` in Phase 15 on the
wrong assumption it was premium-only). Core errors 193→125, Pro 106→64.
Combined with Phase 18: Core **280→125**, Pro **165→64** since Phases
14/15 first surfaced these counts.

### Phase 20: system config + forecasting variant pairs (see `phases/phase-20-*.md`)
Two different shapes: system config genuinely is Pro-only content, so
`AdminSettingsContent.tsx` got a `.core.tsx` variant (upsell placeholder)
and `SystemConfigSettings.tsx`/`app/api/system-config` reclassified pro
(now-orphaned in Core). `lib/server/system-config-data.ts` and
`prisma/system-config.ts` each split into `.core.ts` variants keeping only
the read path — `getThemePrimaryColor`, called on *every* page request by
`app/layout.tsx`'s SSR theme injection, has to keep working in Core.
Forecasting was the opposite shape: Core's own existing UI already
unconditionally used `useForecastingSummary` (already core-bucketed);
only `types/forecasting.ts` was still premium (same barrel-mismatch shape
as Phase 19) — reclassified core, added `AdminAnalyticsContent.core/pro.tsx`
+ `AdminDashboardMergedView.core/pro.tsx` (drop the forecasting card/prop),
reclassified `ForecastingSection.tsx` premium (now orphaned everywhere but
Premium). Core errors 125→83, Pro 64→47.

**Important discovery, not acted on**: investigating this surfaced that
several hooks now core-bucketed (`use-stock-allocation.ts`, `use-portal.ts`,
`use-forecasting.ts`) call API routes still bucketed pro/premium
(`app/api/stock-allocations`, `stock-transfers`, `portal`, `forecasting`)
— a real Core deployment's already-shipped UI would 404 calling them, a
gap invisible to `tsc`/`check:manifest` and pre-dating this whole
engagement. Whether to move those routes is a real product decision, not
tier-export hygiene — filed as Phase 21, not fixed here.

### Phase 21: remaining tier-export gaps (In Progress)
- [x] **API-route/hook bucket mismatches** — audit complete (see
      `phases/phase-21-api-route-audit.md`). Checked all 15 core-bucketed
      hooks against their `apiClient`/`API_ENDPOINTS` route. Found and
      **fixed** one more folder-mis-bucketing case (same shape as Phase
      18): `app/api/admin` was one whole-folder `pro` entry, but its 3
      children (`client-orders`, `client-invoices`, `counts`) are
      core-necessary — called by `use-orders.ts`/`use-invoices.ts`/
      `use-admin-counts.ts` from already-core callers (`OrderList.tsx`,
      `InvoiceDialog.tsx`, `AppSidebar.tsx`), and their PAGE routes
      (`app/admin/client-orders`/`client-invoices`) were already
      core-bucketed. Fixed via `FOLDER_LEVEL_DIRS` + reclassification,
      pure manifest change. The 3 previously-known mismatches
      (`use-stock-allocation.ts` → `app/api/stock-allocations`/
      `stock-transfers` (pro), `use-portal.ts` → `app/api/portal`
      (premium), `use-forecasting.ts` → `app/api/forecasting` (premium))
      remain **confirmed but deliberately unfixed** — moving a billable
      backend feature down a paid tier is a product/business call, same
      class as Phase 13's accepted debt, not something to decide during
      tier-export hygiene work.
- [x] **Product reviews** (see
      `phases/phase-21-product-reviews-cluster.md`) — fixed. 4 files
      (`ProductDetailPage.core/pro.tsx`, `order-review-context-data.core/pro.ts`)
      still imported the real `ProductReview` type for a value that's never
      read; switched to a local mirror type, same as their existing
      `ReviewEligibilityResult` handling. `components/products/ProductActions.tsx`
      (distinct from the already-premium `components/admin/ProductReviewActions.tsx`)
      mixed core product CRUD with premium review actions — got
      `.core.tsx`/`.pro.tsx` variants dropping the review actions entirely.
      `lib/server/product-reviews-data.ts` + `product-review-detail-data.ts`
      are genuinely premium-only content that sat inside `lib/server`'s one
      bare whole-folder `shared` entry — reclassified to premium (added
      `lib/server` to `FOLDER_LEVEL_DIRS`, individually listed all 51
      siblings). Core errors 83→69, Pro 47→33.
      **New follow-up filed, not fixed**: `lib/server/client-portal-data.ts`,
      `client-dashboard.ts`, `supplier-portal-data.ts`,
      `supplier-dashboard.ts`, `dashboard-data.ts` are also currently broken
      in Core/Pro, same shape — "client/supplier portal dashboard data
      cluster," next up.
- [x] **Client/supplier portal dashboard data + warehouse insights** (see
      `phases/phase-21-portal-dashboard-and-warehouse-insights.md`) —
      fixed. Turned out to be two different answers: `dashboard-data.ts`/
      `client-dashboard.ts`/`supplier-dashboard.ts` were already correctly
      `shared` (they back `list-page-stats.ts`'s prefetch for core list
      pages, using the core-bucketed `types/portal.ts` — easy to confuse
      with the similarly-named but actually-premium
      `types/client-portal.ts`/`supplier-portal.ts`); their only bug was
      `lib/insights/payment-money-stats.ts`, a pure dependency-free util
      wrongly bucketed `pro` wholesale — reclassified `core`. The same
      `lib/insights` audit fixed the long-flagged (Phase 15)
      `types/warehouse-insights.ts` coupling too — also pure content,
      wrongly `pro`, reclassified `core`. `client-portal-data.ts` +
      `supplier-portal-data.ts` genuinely did need premium reclassification
      (real callers are the dedicated premium portal admin/api routes).
      Core errors 69→47, Pro 33→18.
      **New follow-up filed, not fixed**: "payments/shipping/export
      action-bar mixing cluster" — `app/api/invoices/[id]/send/route.ts`,
      `InvoiceFilters.tsx`/`OrderFilters.tsx`, `OrderDetailActionBar.tsx`
      (broken in both Core and Pro), `hooks/use-back-with-refresh.ts` each
      mix a core feature with a pro/premium one, needing real variant
      pairs rather than reclassification.
- [x] **Payments/shipping/export action-bar mixing cluster** (see
      `phases/phase-21-payments-shipping-export-cluster.md`) — fixed.
      `OrderDetailActionBar.tsx` (Pay=Pro, Ship=Premium, broken in both
      Core and Pro) got `.core.tsx` (drops both)/`.pro.tsx` (drops Ship
      only); `InvoiceFilters.tsx`/`OrderFilters.tsx` (Export=Pro, real
      paid-tier CSV/Excel bulk export, not a stray util) got `.core.tsx`
      dropping the Export dropdown; `app/api/invoices/[id]/send/route.ts`
      (inline Stripe payment-link generation=Pro, already optional in the
      default file) got `.core.ts` dropping it. `hooks/use-back-with-refresh.ts`
      was different: `lib/payments/stripe-return.ts` is a tiny
      dependency-free `sessionStorage` helper, pure content wrongly swept
      into the wholesale `lib/payments` Pro bucket — same pattern as
      `payment-money-stats.ts` — reclassified `shared` instead of forking
      the hook. New leftover found and fixed in the same pass:
      `prisma/order.ts`'s `cancelOrder()` (shared by Cancel Order and
      Process Refund) does a best-effort Stripe refund only when a
      `paymentIntentId` exists — never set on a Core order — got a
      `prisma/order.core.ts` dropping just that one call. Core errors
      25→17 (all `lib/stock-allocation` accepted debt, nothing else), Pro
      18→**0** — Pro's `tsc --noEmit` is now fully clean.
- [x] **`lib/api/client.ts` per-tier split** (see
      `phases/phase-21-api-client-split.md`) — fixed. This one shared
      ~1730-line `ApiClient` class's single `@/types` import pulled in
      every domain's types together, including several only in the
      untiered/Premium barrel — the single largest offender (22 of Core's
      47 errors, all 18 of Pro's). None reachable from that tier's UI, so
      fixed with `client.core.ts`/`client.pro.ts` variants that are
      byte-identical to `client.ts` from the `ApiResponse<T>` interface
      onward — only the import block differs, with each missing name
      locally aliased to `Record<string, unknown>` so the ~1700-line
      class body needed zero edits. Core errors 47→25 (zero
      `lib/api/client.ts` errors left), Pro 18→**1** (every other Pro
      error was this file). Also browser-tested at runtime (real dev
      server + migrated Postgres): logged in, confirmed `/admin/settings`
      and `/products`/`/categories` still render with no console errors.
- [ ] **Already-accepted debt, fuller count found incidentally**: the
      `lib/stock-allocation/*` business-logic folder (Phase 13's already-
      decided debt for `app/api/products/route.ts`) turns out to affect 7
      more files too (`ProductFormDialog.tsx`, `AllocateStockDialog.tsx`,
      `hooks/use-catalog-quantity-reconcile-preview.ts`,
      `lib/products/enrich-product-committed-quantity.ts`,
      `lib/products/order-stock-reservation.ts`,
      `lib/server/product-stock-data.ts`,
      `lib/server/warehouse-stock-data.ts`, `app/warehouses/page.tsx`) —
      not new debt, just a fuller picture of the same decided item.
- [x] `components/shared/WarehouseInsightsSection.tsx`'s separate
      `@/types/warehouse-insights` coupling (flagged Phase 15) —
      **verified resolved** (2026-09-02): confirmed as a side effect of
      Phase 21 part 3's `types/warehouse-insights.ts` reclassification
      to `core`. Fresh `pnpm export:core` + `tsc --noEmit` shows 17
      errors, all in `lib/stock-allocation/*` (the already-accepted
      Phase 13 debt below); none reference `WarehouseInsightsSection`
      or `types/warehouse-insights`. No code change needed.
- [ ] **Small finding from Phase 18, still open**: `npx eslint components/admin`
      surfaces 7 shared→core warnings (was 6; re-counted 2026-09-02, no
      investigation done into the delta) on the files that stayed
      shared — same false-positive shape as Phase 17 (ESLint's
      restricted-paths rule can't see that the imported file is itself
      core-bucketed). Known limitation, not a real bug; still open only
      in the sense that no suppression/config fix has been written.
- [ ] For each group: design whether the fix is a variant pair or a
      relocation. Verify each with `pnpm export:core`/`export:pro` +
      `tsc --noEmit`.

---

## Notes on tracking convention

This `out/phases/` + `out/ims_progress.md` structure mirrors the one already
in use for the `proplity` project. It did not exist for this repo before
2026-08-25 — work up to that point was tracked via `tier-manifest.json`'s
inline "KNOWN REAL GAP" documentation and in-conversation summaries only.
Phases 0-4 were backfilled from that record when this tracker was set up;
treat their dates as approximate where not independently confirmed. Phases
5 onward are logged contemporaneously.

---

## Work outside the phases (2026-10-21)

Phase 21 is still in progress and was not touched. The work below is
repository housekeeping and audit work, tracked as numbered tasks in
`docs/tasks/` rather than as phases.

- **Canonical location of this tracker.** From 2026-10-21 this file and
  `phases/*.md` live in `docs/development-history/` (copied from the
  git-ignored `out/`, identical per `diff -r`). Edit these copies; the
  originals in `out/` are no longer updated. `tier-manifest.json` still cites
  `out/phases/...` in about 13 places until it is repointed.
- **Docs structure adopted** from AlEemaan: `docs/adr/`, `docs/issues/`,
  `docs/tasks/`, `docs/HANDOVER.md`, `docs/open-items.md` (task 0001).
- **First full static bug scan:** 85 issues (2 P0, 24 P1, 43 P2, 16 P3) in
  `docs/issues/README.md`. None fixed except the licence row (task 0003).
- **Export hardening:** the internal docs and `AGENTS.md`/`CLAUDE.md` are never
  exported; `NOTICE` ships with `LICENSE` in every export.
- **Branches:** `origin/dev` fast-forwarded from `baa1138` to `d7e6720` so
  `dev` = `main`; `origin/prod` left at `baa1138` (task 0003).
- **Licence:** commercial; the upstream MIT notice kept in `NOTICE`
  (`docs/adr/0007-*`).
- **Walkthrough audit** (task 0002): Phase 0 plan for the full build, then a
  per-package plan (Core, Pro, Premium). Not run yet.
- Start at `docs/HANDOVER.md` for status and next steps.
