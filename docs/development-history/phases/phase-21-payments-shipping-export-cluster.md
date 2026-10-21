# Phase 21 (continued) — payments/shipping/export action-bar mixing cluster

**Status:** Complete and verified. **Date:** 2026-09-02.

## The cluster

Four files, each genuinely mixing a core-necessary feature with a real
pro/premium one in the same file — needing real variant pairs, not
reclassification (confirmed by the same "is this actually mis-bucketed,
not just ungated" test as the rest of this phase — in every case here the
answer was no, the pro/premium half is a real feature this tier doesn't
have):

- **`components/orders/detail/OrderDetailActionBar.tsx`** — the shared
  order-detail footer. Mixes Back/Update/Invoice/Cancel/Refund (core) with
  a Pay button (`@/components/payments`, Pro) and a Ship button
  (`@/components/shipping`, Premium). Broken in **both** Core and Pro, so
  needed a 3-way split, not just core/pro.
- **`components/invoices/InvoiceFilters.tsx`** /
  **`components/orders/OrderFilters.tsx`** — each mixes its filter/search
  UI (core) with an Export dropdown (`@/lib/export`'s `exportToCSV`/
  `exportToExcel`, Pro — CSV/Excel bulk export is a real paid-tier
  capability, the same shape as `app/api/products-import`'s Pro gating,
  not a stray misplaced util).
- **`app/api/invoices/[id]/send/route.ts`** — sending an invoice email is
  core-necessary (Core has manual invoices), but the route also generates
  a Stripe payment link inline (`@/lib/stripe`, Pro) — already optional/
  best-effort in the default file (wrapped in `isStripeConfigured()` +
  try/catch), so Core just never attempts it.
- **`hooks/use-back-with-refresh.ts`** — called from *every* detail
  page's back button (order, invoice, product, category, supplier,
  warehouse, ...), but unconditionally called `consumeStripeCheckoutReturn()`
  from `@/lib/payments/stripe-return.ts` (Pro).

## What was done

**`OrderDetailActionBar`**: `.core.tsx` (drops Pay + Ship, and their
`resolveOrderPayAmount`/`canGenerateShippingLabel` support code) and
`.pro.tsx` (drops Ship only, keeps Pay) — both otherwise identical to the
default file.

**`InvoiceFilters`/`OrderFilters`**: `.core.tsx` variants dropping the
Export dropdown and its two handler functions + the `@/lib/export`/
`useToast` imports (`useToast` was only used inside the export handlers'
error/success toasts) — otherwise identical.

**`app/api/invoices/[id]/send/route.ts`**: `.core.ts` variant — drops the
`@/lib/stripe`/`@/lib/env` imports and the "generate Stripe payment link"
block, keeping `paymentLink = invoice.paymentLink` (the same value the
default file falls back to when Stripe isn't configured or already
failed) — otherwise byte-identical.

**`hooks/use-back-with-refresh.ts`**: investigating this one found a
different answer than the other three. `lib/payments/stripe-return.ts` is
a tiny, dependency-free `sessionStorage` flag helper (`markStripeCheckoutReturn`/
`consumeStripeCheckoutReturn`) — pure content, not a real Stripe
integration, swept into the wholesale `lib/payments` Pro bucket by
folder-level classification. Its own consumer here is a shared,
core-necessary hook. Same "pure content, wrongly bucketed" pattern as
`lib/insights/payment-money-stats.ts` (Phase 21 part 3): reclassified
`lib/payments/stripe-return.ts` to `shared` — no variant needed, no file
changed. Doing this required carving it out of the `lib/payments` bare
folder entry the same way `lib/insights` was carved in part 3: added
`lib/payments` to `check-tier-manifest-coverage.ts`'s `FOLDER_LEVEL_DIRS`,
removed the bare `"lib/payments"` folder entry from `pro`, and individually
listed its 6 remaining files there (`confirm-checkout-session.ts`,
`reconcile-stripe-return.ts`, `resolve-order-pay-amount.ts` + its test,
`stripe-checkout-return-urls.ts` + its test — all genuinely Pro: the
former backs the checkout-return SSR reconciliation pages, the latter two
back the Pay button/checkout-return URL building, both Pro-only features).
Carving out only the file (leaving the bare `"lib/payments"` folder entry
in `pro`) was tried first and tripped `export-tier.ts`'s leak-check — it
does a literal `fs.existsSync` per bucket-listed path, so a folder path
still listed whole in `pro` reads as leaked the moment *any* file under it
appears in the core/shared output, even a legitimately-carved-out one;
removing the bare folder entry and listing every sibling individually
(matching the part-3 precedent exactly) fixed this.

**New leftover, fixed in the same pass**: `prisma/order.ts` — Core's own
error list (`prisma/order.ts(7,36): Cannot find module '@/lib/stripe'`)
turned out to be this same cluster's leftover edge, not something new.
`cancelOrder()` (the same mutation both Cancel Order *and* Process Refund
call) does a best-effort Stripe refund only when a `paymentIntentId`
exists — which a Core order, having no Stripe checkout, never has. Fixed
with `prisma/order.core.ts`, byte-identical to the default 941-line file
except the `@/lib/stripe` import is dropped and the refund `try`/`catch`
block is replaced with a log line (matching the default file's own
"log but don't fail" fallback shape).

## Verification

`pnpm export:core` + symlinked `node_modules` + `tsc --noEmit`: 47 → 25
(the four cluster files' errors gone) → 18 (after the `stripe-return.ts`
reclassification) → **17**, all `lib/stock-allocation` accepted debt,
nothing else. `pnpm export:pro` + same check: 18 → **0** — Pro's export
now compiles with zero errors. Full-repo `npx tsc --noEmit` clean.
`pnpm check:manifest` OK. `npx eslint` on every new/changed file: clean
except `OrderDetailActionBar.pro.tsx`'s 2 `import/no-restricted-paths`
warnings on its Pay-button imports — a known false positive (the linter
classifies a `.pro.tsx` file by its folder path, same as its `.tsx`
sibling, with no awareness of the variant suffix meaning "this file only
ships in Pro+"; the real proof is the per-tier `tsc` result above, which
is clean). Same accepted-false-positive shape as Phase 17/18's still-open
ESLint findings. `pnpm test`: 811 passed, the 1 known pre-existing
`invoice-event-date.test.ts` date-fixture failure — the `tenant-prisma.test.ts`
DB-connectivity flake seen earlier this session is gone (was a transient
Neon-reachability issue, not a regression).

Also spot-checked at runtime (dev server, real migrated Postgres, logged
in via test account): confirmed `/login`, `/admin/settings`,
`/products`, `/categories` all still render cleanly. The new `.core.`/
`.pro.` files aren't exercised by this dev server (variant substitution
only happens inside `export-tier.ts`'s build step, not `next dev`), so
this only proves no regression to the untouched default files — seeing
the new variants render live would need building and running an isolated
Core/Pro export, which wasn't done here.
