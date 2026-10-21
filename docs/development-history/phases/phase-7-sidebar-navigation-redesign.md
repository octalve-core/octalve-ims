# Phase 7 — Persistent sidebar + slim top bar, all roles

**Status:** Complete and verified. **Date:** 2026-08-26.

## Why

The user shared a reference (screenshots + a Figma link for an "Inventory
Project" — confirmed by reading the actual source to be `inventory-pro-master`,
one of the sibling repos in this workspace) showing a persistent left
sidebar + slim top bar, and asked to redesign Octalve IMS's navigation this
way. Clarified via questions: apply to **all three roles** (admin, client,
supplier — client/supplier had no sidebar at all before this), and build it
as a genuine professional redesign inspired by the reference rather than a
literal clone (confirmed: "no let's redesign the navbar like a professional
UI/UX designer"). Light/dark theme support was an explicit late addition to
the ask.

A mockup artifact ("Sidebar Navigation Redesign") was built and approved
before any real code changed, per standing practice — light/dark toggle,
all three role variants shown side by side.

## Research findings that shaped the plan

- **No centralized layout existed.** ~30 files under `components/Pages/*`
  each individually imported and self-wrapped `<Navbar>{...}</Navbar>`
  (including duplicated wrapping in error-state early returns).
  `AdminSidebar` was mounted only via `AdminLayout` → `app/admin/layout.tsx`,
  route-scoped to `/admin/*` — root `/` had no sidebar at all.
- **Two separate, unreconciled nav sources existed**:
  `lib/navigation/role-nav-config.ts`'s flat `ADMIN_NAV_ITEMS`/
  `CLIENT_NAV_ITEMS`/`SUPPLIER_NAV_ITEMS` (drove the old Navbar's top row —
  and, per Phase 6, still drives the Quick Access grid, so it could not be
  changed) vs. `lib/navigation/admin-nav-config.ts`'s three grouped arrays
  (drove `AdminSidebar` only, admin/user role). The flat list had items
  (Categories, Suppliers, Business Insights, Dashboard) the grouped one
  lacked.
- No collapsible/drawer UI primitive existed (no shadcn `Sheet`/`Drawer`, no
  `vaul` dependency) — built by hand instead of adding a new dependency.
- `contexts/shell-ssr-context.tsx` already existed for exactly this shape of
  problem (root-layout SSR data made available to shell components without
  prop drilling, previously used only for notification counts) — extended
  rather than duplicated.

## What was built

- **`components/layouts/AppShell.tsx`** — the new top-level wrapper every
  page imports instead of the old `Navbar` (identical `{ children }`
  contract). Composes the sidebar + top bar + scrollable content, holds
  collapse/mobile-drawer state (collapse preference persisted to
  `localStorage`), ported the old Navbar's per-route width/footer
  special-casing and role-detection fallback unchanged.
- **`components/layouts/AppSidebar.tsx`** — persistent sidebar for all
  roles: admin/user gets the extended grouped config (see below); client/
  supplier get their existing flat lists unchanged. Desktop full + collapsed
  icon rail, hand-built mobile slide-in drawer, live count badges
  (`useAdminCounts`, SSR-seeded via the extended `ShellSsrContext`), and a
  static "Upgrade to Pro" card in the footer slot (in place of the
  reference's generic placeholder — a decision actually tied to this
  product's real Core/Pro/Premium tiering, not decoration).
- **`components/layouts/AppTopBar.tsx`** — slim top bar: sidebar
  collapse/hamburger toggle, notifications, theme toggle (extracted to
  **`components/layouts/ModeToggle.tsx`**), avatar + name/role dropdown.
  Deliberately ships **without** a search box (no backing search feature
  exists — a decorative dead search input would be worse than omitting one)
  and without a dynamic per-route page title (pages already render their own
  heading in-content).
- **`lib/navigation/admin-nav-config.ts`** extended in place: added
  Dashboard (`/`), Business Insights (`/business-insights`), Categories
  (`/categories`), Suppliers (`/suppliers`) into the existing "My Store"/
  "Management" groups — the reconciliation of the two nav sources described
  above. No IA redesign beyond this; every destination that worked before
  still works.
- **`contexts/shell-ssr-context.tsx`** extended with `initialAdminCounts`.
- **`components/layouts/AdminShellSsrMerge.tsx`** (new, small) — merges
  admin-counts SSR data into the existing `ShellSsrProvider` value rather
  than replacing it.
- **`app/admin/layout.tsx`** simplified: SSR-fetches counts as before, now
  renders `<AppShell>{children}</AppShell>` directly (replacing the old
  `AdminLayout`/`AdminSidebar`/`PageWithSidebar` stack).

## A real gap caught during verification, not by the type checker

Removing the old `AdminLayout` chain from `app/admin/layout.tsx` would have
left every `/admin/*` page with **no shell at all** — those pages rely on an
`embedInAdmin`/`embedded` prop to skip self-wrapping, on the assumption that
something upstream provides the wrap. Fixed by having `app/admin/layout.tsx`
itself render `AppShell`. Caught one resulting double-wrap
(`AdminSettingsContent.tsx`, which *did* self-wrap) and removed its
redundant wrap to match its sibling `components/admin/*Content.tsx`
components' existing convention.

## Retired

`components/layouts/Navbar.tsx`, `AdminSidebar.tsx`, `AdminLayout.tsx` —
deleted after confirming zero remaining importers.
`components/layouts/PageWithSidebar.tsx` kept (still used by
`BusinessInsightPage.tsx`'s unrelated internal tab sub-nav).

## Verification

`tsc --noEmit` clean; `pnpm check:manifest` clean (new files land inside the
already-core-bucketed `components/layouts` folder, no new manifest entries
needed); `pnpm test` at the same 794/795 baseline (the 1 failure is the
pre-existing unrelated hardcoded-date test) — one real test-allowlist fix
needed in `lib/react-query/invalidate-coverage.test.ts` (the logout fetch
moved from `Navbar.tsx` to `AppShell.tsx`, not `AppTopBar.tsx` as first
guessed); `pnpm export:core` + `tsc --noEmit` against a fresh stripped
export showed zero new errors — the full error list was confirmed to be
pre-existing, already-documented deferred coupling (Stripe reconciliation,
forecasting, reviews, support-tickets, audit-log) by cross-checking against
Phase 3/4's notes. Live dev-server + Playwright verification across admin
(desktop full/collapsed/dark, mobile drawer), client, and supplier, all
passing with zero new console errors.

One new lint finding fixed: a `react-hooks/set-state-in-effect` warning from
deferring a `localStorage` read past hydration in `AppShell.tsx` — the
deferral itself is correct (reading `localStorage` during render would
diverge from the server-rendered HTML) so it was suppressed with a comment
explaining why, not restructured away. The remaining `import/no-restricted-
paths` tier-boundary warnings on the new sidebar/topbar files were confirmed,
by linting the deleted `Navbar.tsx`/`AdminSidebar.tsx` directly from git
history, to be an identical pre-existing pattern (`components/layouts` is
`shared`-bucketed, `lib/navigation` is `core`-bucketed) — not a regression
introduced by this phase.
