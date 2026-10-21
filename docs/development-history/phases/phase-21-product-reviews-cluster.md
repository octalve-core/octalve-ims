# Phase 21 (part 2) — product reviews cluster

**Status:** Complete and verified. **Date:** 2026-08-28.

## What was broken

Four files, three different shapes of the same underlying issue — a
`ProductReview` type or the premium-only review data module leaking into
Core/Pro through a file that's otherwise correctly tier-scoped:

1. **`components/Pages/ProductDetailPage.core.tsx` / `.pro.tsx`**
   (Phase 11 variants) and **`lib/server/order-review-context-data.core.ts`
   / `.pro.ts`** (Phase 12 variants) each still had
   `import type { ProductReview } from "@/types"` — but Phase 15's
   `types/index.core.ts`/`.pro.ts` barrel split correctly dropped
   `ProductReview` (it's premium-only content). These 4 files only use the
   type to satisfy a prop/return signature that's **never actually read**
   in Core/Pro (`initialReviews`/`reviewsByProductId` are always empty —
   the file headers already said so). Fixed the same way the existing
   `ReviewEligibilityResult` local type in these same files already
   handled this: added a local `type ProductReview =
   Record<string, unknown>` mirror instead of importing the real one.
   Zero behavior change — the value was already never read.
2. **`components/products/ProductActions.tsx`** (the product-list
   dropdown menu — distinct from the already-premium
   `components/admin/ProductReviewActions.tsx`, a same-named different
   file) mixes core product CRUD (view/copy/edit/delete) with premium-only
   review actions (write/edit/delete review, via
   `hooks/queries/use-product-reviews.ts` and
   `components/product-reviews/WriteEditReviewDialog.tsx`) in one
   component — the same "core actions mixed with premium actions in one
   file" shape as Phase 20's `AdminSettingsContent.tsx`, needing a real
   variant pair, not a reclassification. Added
   `ProductActions.core.tsx`/`.pro.tsx` (identical to each other, same
   convention as `AdminAnalyticsContent.core/pro.tsx`): keeps the product
   CRUD actions and their dialog, drops the 3 review menu items, the
   review dialog, and the review-only imports/hooks/state entirely — no
   upsell placeholder, since a disabled "Write Review" item would be more
   confusing than the item simply not existing.
3. **`lib/server/product-reviews-data.ts`** (admin product-reviews list
   SSR data) and **`lib/server/product-review-detail-data.ts`** (review
   detail SSR data) are genuinely premium-only content — every real caller
   (`app/admin/product-reviews/page.tsx`, `app/admin/product-reviews/[id]/
   page.tsx`, `app/api/product-reviews/route.ts`,
   `app/api/product-reviews/[id]/route.ts`) is already premium-bucketed —
   but both files sat inside `lib/server`, which was one bare whole-folder
   `shared` manifest entry, so they shipped (broken) in every tier
   regardless. Same root cause as Phase 18's `components/admin` and this
   phase's own `app/api/admin` finding: a folder mis-bucketed wholesale.

## Fix for the folder mis-bucketing

`lib/server` has 54 files; `tsc` had already proven 52 of them compile
cleanly as `shared` in the current Core/Pro exports (only these 2 were
broken) — so this wasn't a full re-audit, just carving the 2 broken files
out. Added `"lib/server"` to `FOLDER_LEVEL_DIRS` in
`scripts/check-tier-manifest-coverage.ts` (so its children are each
individually classified instead of the whole folder being one atomic
unit), replaced the bare `"lib/server"` shared entry with all 49
individually-listed sibling files (kept `shared`, matching their proven
current behavior — no change), and added the 2 broken files to
`premium`. No application code in those 2 files changed.

## Left alone, deliberately not touched here

`lib/api/client.ts`'s 3 remaining `ProductReview`/`CreateProductReviewInput`/
`UpdateProductReviewInput` type errors — these belong to that file's own
dedicated per-tier split (Phase 21's next item), not this cluster; fixing
them in isolation here would leave `client.ts` in a half-split, confusing
state.

**New finding, not acted on, added to the backlog**: the same `tsc` sweep
that surfaced this cluster also showed `lib/server/client-portal-data.ts`,
`lib/server/client-dashboard.ts`, `lib/server/supplier-portal-data.ts`,
`lib/server/supplier-dashboard.ts`, and `lib/server/dashboard-data.ts` are
*also* currently broken in the Core/Pro exports — the same
folder-mis-bucketing shape, likely premium-only content (the dedicated
`/client`/`/supplier` portal apps' own data layer) sitting in the newly
carved-up `lib/server` shared list. Left as `shared` for now (status quo,
unchanged by this phase) since fixing them wasn't this cluster's scope —
flagged as a new Phase 21 follow-up: "client/supplier portal dashboard
data cluster."

## Verification

`node -e "JSON.parse(...)"` (manifest valid) → `pnpm check:manifest` (OK)
→ `pnpm export:core` + symlinked `node_modules` + `npx tsc --noEmit`:
**83 → 69** (-14), only the 3 already-deferred `lib/api/client.ts` errors
remain product-review-related → `pnpm export:pro` + same check: **47 →
33** (-14) → full-repo `npx tsc --noEmit` (clean) → `npx eslint` on all 6
new/changed files (clean) → `pnpm test` (811/812 — the 1 pre-existing
unrelated date-fixture failure, +2 dynamic test cases from the new
`ProductActions.core/pro.tsx` files' fetch-pattern scan, same expected
shift as Phase 20).
