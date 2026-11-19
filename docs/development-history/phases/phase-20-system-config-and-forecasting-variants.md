# Phase 20 — system config + forecasting variant pairs

**Status:** Complete and verified for the system-config and forecasting
clusters. **Date:** 2026-08-28.

## System config cluster

Unlike Phase 19's reclassifications, `SystemConfigSettings.tsx` genuinely
*is* Pro-only feature content (no evidence Core needs write access to
system config the way it needed stock allocation or portal reads) — this
needed a real variant pair on its shared parent, not a reclassification.

- **`components/admin/AdminSettingsContent.core.tsx`**: new — same header,
  renders a "System settings is a Pro feature" upsell placeholder instead
  of `<SystemConfigSettings>`. Takes no props (the default file's
  `initialConfigs` prop becomes meaningless without the form).
- **`app/admin/settings/page.core.tsx`**: new — skips the
  `getSystemConfigForAdmin()` SSR fetch entirely, renders
  `<AdminSettingsContent />` with no props.
- **`components/admin/SystemConfigSettings.tsx`**: shared → pro. Now
  orphaned in Core (nothing renders it there once `AdminSettingsContent.core.tsx`
  drops the import) — the same "orphan removal" logic as Phase 18, just
  applied to one file instead of a whole folder.
- **`app/api/system-config`**: core → pro. Only meaningfully called by the
  now-Pro-only admin settings mutation hook; moved to match.
- **`lib/server/system-config-data.core.ts`**: new — keeps
  `getThemePrimaryColor()` (runs on *every* page request via
  `app/layout.tsx`'s SSR theme-color injection, so this must keep working
  in Core), drops `getSystemConfigForAdmin()` (the Pro-only admin fetch)
  and its `DEFAULT_CONFIGS`/`SystemConfig` type dependency (the fallback
  HSL value is inlined directly instead of looked up from `DEFAULT_CONFIGS`).
- **`prisma/system-config.core.ts`**: new — keeps the 4 read functions
  (`getAllSystemConfigs`, `getPublicSystemConfigs`, `getSystemConfigByKey`,
  `getConfigValue`, needed by the theme-color path above), drops
  `updateSystemConfig(s)`/`initializeDefaultConfigs` (write/seed, Pro-only)
  and their `UpdateSystemConfigInput`/`DEFAULT_CONFIGS` dependency.

## Forecasting cluster

Different shape from system config: Core's own UI (`CategoryDetailPage.core.tsx`,
`SupplierDetailPage.core.tsx`, `WarehouseDetailPage.core.tsx` — all
existing since Phase 8) **already** unconditionally calls
`useForecastingSummary` and references `ForecastingSummary`. Checking
confirmed `hooks/queries/use-forecasting.ts` was *already* core-bucketed
(from an earlier phase) — only `types/forecasting.ts` (pure interfaces,
zero external imports) was still premium, the exact same barrel mismatch
shape as Phase 19's reclassifications.

- **`types/forecasting.ts`**: premium → core. Added the block back to both
  `types/index.core.ts` and `types/index.pro.ts` (Phase 15 had dropped it
  from both).
- **`components/admin/AdminAnalyticsContent.core.tsx` / `.pro.tsx`**: new
  (identical to each other, matching the established "Pro variant
  identical to Core variant" convention already used by
  `app/admin/dashboard-overall-insights/page.core.tsx`/`.pro.tsx`) — full
  copies of the ~1750-line default file with the `initialForecasting` prop
  and the trailing "Demand Forecasting & Predictions" `<ForecastingSection>`
  card removed. Everything else (KPIs, charts, recent-activity cards, AI
  insights) is identical.
- **`components/admin/AdminDashboardMergedView.core.tsx` / `.pro.tsx`**:
  new (also identical to each other) — drops the `initialForecasting` prop
  from the type and from the call to `AdminAnalyticsContent` (its callers,
  `app/admin/dashboard-overall-insights/page.core.tsx`/`.pro.tsx`, already
  don't pass one, from Phase 11).
- **`components/admin/ForecastingSection.tsx`**: shared → premium. Now
  orphaned in both Core and Pro (only the default `AdminAnalyticsContent.tsx`
  renders it), same "orphan removal" logic again.
- **Self-inflicted test fix**: the new `AdminAnalyticsContent.core.tsx`/`.pro.tsx`
  copies carry the same inline `fetch("/api/ai/insights", ...)` POST call
  as the original — `lib/react-query/invalidate-coverage.test.ts` walks
  every `components/**/*.tsx` file looking for exactly this pattern and
  requires `invalidateAllRelatedQueries` unless the file is in its
  `COMPONENT_FETCH_CRUD_ALLOWLIST`. Added both new paths to that allowlist
  (same exemption reason as the original: AI-insight generation is
  read-only, no cache to invalidate).

## Left alone, correctly out of scope

`components/shared/WarehouseInsightsSection.tsx`'s own, separate
`@/types/warehouse-insights` import (a different type file entirely,
flagged back in Phase 15 as "a separate, distinct rabbit hole") —
untouched.

## An important discovery, deliberately not acted on

Investigating the forecasting/stock-allocation/portal hooks surfaced a
deeper question than "is this file's TypeScript import correct": **the
underlying API routes several of these hooks call are bucketed at a
*higher* tier than the hooks themselves**, even after Phase 19/20's
reclassifications:

- `hooks/queries/use-stock-allocation.ts` (core) calls
  `apiClient.stockAllocations.*` / `apiClient.stockTransfers.*` →
  `app/api/stock-allocations`/`app/api/stock-transfers` are **pro**-bucketed.
- `hooks/queries/use-portal.ts` (core) calls `apiClient.portal.*` →
  `app/api/portal` is **premium**-bucketed.
- `hooks/queries/use-forecasting.ts` (core) calls
  `apiClient.forecasting.getSummary()` → `app/api/forecasting` is
  **premium**-bucketed.

This means a real Core deployment's already-shipped UI
(`WarehouseDetailPage.core.tsx`'s `AllocateStockDialog`/`TransferStockDialog`,
`OrderDialog.tsx`'s client-browse picker, `CategoryDetailPage.core.tsx`'s
forecast display, etc.) would call an API route that doesn't exist in that
deployment — a 404 at runtime, invisible to both `tsc --noEmit` (routes
are URL strings, not type-checked imports) and `check:manifest` (which
only verifies bucket coverage, not cross-route consistency). This is a
**pre-existing gap that predates this entire engagement** — Phase 19/20's
hook/type reclassifications didn't create it (the same already-shipped
Core UI already called these same routes before today, just with a
compile error attached that obscured the real question). Reclassifying
the hook/type files was still correct and necessary on its own terms
(Core's UI genuinely needs the *type* to compile); whether the *API
routes* themselves should also move tiers is a real product/business
decision — moving a billable feature's actual backend between paid tiers —
squarely the same class of call Phase 13 established shouldn't be made
casually during tier-export hygiene work. **Not investigated or fixed
here.** Flagged as a new, higher-priority backlog item (see
`out/ims_progress.md`'s Phase 21) — whoever picks it up should audit every
hook now in the core bucket against its own API route's bucket, not just
the 3 found incidentally above.

## Verification

Each cluster verified independently: `node -e "JSON.parse(...)"` (manifest
valid) → `pnpm check:manifest` (OK) → `pnpm export:core` + symlinked
`node_modules` + `tsc --noEmit` (confirmed cluster's errors gone, diffed
against the running baseline: 125→104→100 for system config, 100→83 for
forecasting) → `pnpm export:pro` + same check (64→64→64 for system config
since Pro already had the feature; 64→47 for forecasting) → full-repo
`npx tsc --noEmit` (clean) → `npx eslint` on every new/changed file (clean
except the already-expected shared→pro warning on the default
`AdminSettingsContent.tsx`/`lib/server/system-config-data.core.ts`) →
`pnpm test` (809/810 after the allowlist fix — 2 more than the running
808 baseline because the new `.core.tsx`/`.pro.tsx` files add 2 dynamic
test cases to `invalidate-coverage.test.ts`, exactly the kind of count
shift its own header comment warns is expected; still only the 1
unrelated pre-existing date-fixture failure).
