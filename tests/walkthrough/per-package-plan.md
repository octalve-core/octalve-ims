# Walkthrough per package (Core, Pro, Premium)

Decided 2026-10-21 by the owner ("can we have walkthrough for each package?"); recorded as **D10**. Status: **plan only**. Nothing here has been built or run.

**Assumption to confirm:** "package" means **tier**. Octalve IMS is sold as Core, Pro and Premium, and each is produced by `pnpm export:core | export:pro | export:premium`. If the owner meant something else, only this file changes; the guardrail design in `README.md` does not.

## 1. Why this changes the plan

The Phase 0 matrix (`coverage.yaml`, 255 rows) and storyboard (100 steps) were written for the **full monorepo build**, which is Premium behaviour. The thing a customer receives is an **export** of one tier, built and run on its own. Each export contains a different set of files (`tier-manifest.json` buckets `shared`, `core`, `pro`, `premium`, plus `.core` / `.pro` file variants chosen by exact tier, with no fallback between tiers; ADR 0001 and 0002). So each package needs its own coverage matrix, its own journey and its own recording. Running only the monorepo would not show what a Core or Pro customer gets, nor catch a Core export that fails to build.

## 2. What stays the same for every package

- The human-only rule, the forbidden list, the passive-observer rule, the preflight conditions, the coverage gate, the run manifest and the 15-iteration cap (all in `README.md`).
- The tests live in the **source repository** under `tests/walkthrough/` and drive a browser against a URL. They are never copied into an export (`tests/` is not exported; checked). So Playwright is a devDependency of the source repository only, and the same guardrail code serves all three packages.
- One schema for every tier (ADR 0003): the same `prisma/migrations` apply to each package's database.
- Data is fictional, credentials are throwaway, nothing third-party is configured (same "not demonstrable" list, filtered per tier).

## 3. What differs per package

| Item | Core | Pro | Premium |
|---|---|---|---|
| Source of files | `pnpm export:core <dir>` | `pnpm export:pro <dir>` | `pnpm export:premium <dir>` |
| Coverage matrix | `coverage.core.yaml` | `coverage.pro.yaml` | `coverage.premium.yaml` |
| Storyboard | steps that exist in Core | Core steps plus Pro-only screens | the existing 100-step storyboard, to be re-checked against the export |
| Known build risk | 17 accepted type errors in the export (`development-history/ims_progress.md`); if `next build` type-checks, the build fails | 1 accepted type error | none recorded |
| Walkthrough order | third | second | first (its storyboard already exists) |
| Port | 3100 (one package at a time) | 3100 | 3100 |
| Output directory | `out/walkthrough/core/` | `out/walkthrough/pro/` | `out/walkthrough/premium/` |

The exact per-tier feature lists are **not yet known to this plan**; they come from the export, not from memory. Expectation to verify: Premium is the full monorepo behaviour, Pro is Premium minus Premium-only features, Core is Pro minus Pro-only features.

## 4. Phase 0b: build the per-package matrices (planning only)

1. Export each tier to a scratch directory **outside the repository** (for example under the session scratchpad or `~/octalve-walkthrough-builds/<tier>/app`), so the source repository's `tsc`, `eslint` and `vitest` cannot pick the copy up. Always an explicit new path (ISS-0061).
2. List each export's `app/**/page.tsx` and `app/api/**/route.ts` files (variants resolved to their final names).
3. For every row in `coverage.yaml`, record `tiers: [...]`, the tiers whose export contains the row's page or route. Feature, validation, empty-state, role-boundary and not-demonstrable rows inherit the tiers of the pages they depend on; rows tied to a storyboard step take the tiers of that step. Keep one source matrix with a `tiers` field and **generate** `coverage.<tier>.yaml` from it, so the three can never drift apart.
4. In `storyboard.md`, mark each step with the tiers it applies to; write a Core and a Pro variant only where a screen differs, and name the step IDs involved.
5. Add rows for tier-specific behaviour a customer would notice: a Core user not seeing Pro screens in the navigation (`lib/navigation/*`), and what a Core export does at a Pro-only route if one is reachable by clicking.
6. Re-run the cross-check used in Phase 0 (every step ID in a matrix exists in the storyboard and the reverse) once per package.
7. **Smoke test, before writing any browser code:** for each tier, export, install, apply migrations to an empty database, `next build`, `next start`, load `/login`. Record which tier fails and why. This is the first technical risk, and a Core build failure is a product finding (and a decision, see `docs/open-items.md`).

## 5. Run recipe per package (Phase 1 and later; commands are untested assumptions)

All of this is harness work outside the recorded journey. The recording starts at the first screen a person sees.

1. **Preflight** (hard exit unless all hold): `DEDICATED_DB` equals `octalve_ims_test`; the database host is `127.0.0.1` or `localhost`; the source repository tree is clean (record its commit SHA); the build is a production build; `BASE_URL` is local.
2. **Fresh start:** drop and recreate `octalve_ims_test` (it must be empty; nothing else may use it, including `lib/server/tenant-prisma.test.ts`); flush Redis logical database 15 only.
3. **Export** the tier to the outside-repo directory; `pnpm install` there (check whether the export includes the lockfile; if not, record that as a finding for the export).
4. **Apply migrations** with `prisma migrate deploy` in the export against the database from step 2. If the RLS SQL (`prisma/rls/001_enable_rls.sql`) is expected by the export, apply it here too and note it, because CI applies it before seeding.
5. **Build** with `NEXT_PUBLIC_API_URL=http://localhost:3100 pnpm build` (the public URL is baked in at build time), then **start** with `pnpm exec next start -p 3100`, a throwaway `JWT_SECRET`, `DATABASE_URL` pointing at the local database and `REDIS_URL=redis://localhost:6379/15`.
6. **Run** the Playwright journey from `tests/walkthrough/` against `http://localhost:3100`, one worker, no retries, fixed viewport.
7. **Collect** `walkthrough.webm` (and `.mp4` if ffmpeg is approved, D7), `walkthrough.pdf`, `findings.md`, `timeline.json`, `run-manifest.json` and `coverage.yaml` into `out/walkthrough/<tier>/`. The manifest records the source commit SHA and the export's file listing hash, so video, PDF and findings can be tied to one build.
8. Stop the server. Move to the next package from step 1 (fresh database each time).

## 6. Viewports and cost

The brief asks for desktop, 1100 px, tablet and mobile. Three packages times four viewports is 12 full passes. Recommended order: three **desktop** passes first (Premium, Pro, Core); once those are green on a final commit, run the other three viewports for each package (amends D4). The owner may cut this to desktop only plus a responsive spot-check chapter.

## 7. Findings, fixes and the final report

- Every finding records the package(s) it affects (`core`, `pro`, `premium`, or `all`). A finding that appears in one tier only is a tiering or export defect, which is a different kind of fix from a product bug.
- A fix that touches a tiered folder or a `.core` / `.pro` variant must be proved with `pnpm check:manifest`, `pnpm export:core`, `pnpm export:pro`, `tsc --noEmit` in each output, and the walkthrough rerun for every package it affects (`docs/HANDOVER.md`, rule 4).
- PRs go into **`dev`** (D2 settled). The audit-and-fix cap is 15 iterations **per package**.
- Done when, per package: every row is covered or marked not-demonstrable with a reason, in one green uninterrupted run; guardrail tests are green; every finding is fixed or escalated; `tsc`, `lint`, `build` and the full test suite pass on the final commit; video, PDF, findings and manifest cite the same commit SHA. The final report has one findings table per package and a summary table across the three.

## 8. Open questions for the owner

1. Does "package" mean tier? (one line)
2. Desktop first for all three, then other viewports? (recommended) Or desktop only?
3. If the Core export cannot be built because of its type errors: fix the errors, or tolerate them in the export's build configuration?
4. D3 to D9 in `README.md` are still open (Redis logical database, email catcher, third-party keys, ffmpeg, Playwright devDependencies, the product decisions the run will expose).
