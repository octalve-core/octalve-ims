# Octalve IMS — Project Status & Handover

> **Last updated:** 2026-10-21, end of the session that did: docs restructure, first full bug scan, walkthrough Phase 0, `dev` branch sync, local walkthrough database, commercial licence.
> **Repository:** `octalve-core/octalve-ims` · **Working branch: `dev`** (local `dev` tracks `origin/dev`; `dev`, `main` and `origin/main` are all at `d7e6720` after the sync described in section 3).
> **Scope:** inventory, order and warehouse management for admin, supplier, client and retailer roles, sold as three packages (tiers): Core, Pro and Premium.
> **Read first, in this order:** this file → [`open-items.md`](open-items.md) → [`tasks/current-tasks.md`](tasks/current-tasks.md) → [`issues/README.md`](issues/README.md) → [`adr/README.md`](adr/README.md). Where `CLAUDE.md` or `PROJECT_WALKTHROUGH.md` disagree with the code, trust the code: both still describe MongoDB and parts of a UI that no longer exist.

---

## 0. Resume here (the next session starts with this list)

Nothing below has been started unless it is ticked.

1. [ ] **Read the decisions the owner already made** (section 2). Do not ask again about: local database, `dev` as PR base, commercial licence, walkthrough per package.
2. [ ] **Confirm one interpretation with the owner in a single line:** "package" was taken to mean **tier** (Core, Pro, Premium). If the owner meant something else, only [`tests/walkthrough/per-package-plan.md`](../tests/walkthrough/per-package-plan.md) changes.
3. [ ] **Walkthrough Phase 0b** (planning, no browser code yet): derive `coverage.core.yaml`, `coverage.pro.yaml`, `coverage.premium.yaml` from the existing 255-row `tests/walkthrough/coverage.yaml` by filtering against each tier's export; adjust the storyboard for the steps whose screens differ by tier. Steps are in the per-package plan.
4. [ ] **First technical risk to test before anything else:** whether `next build` succeeds on the **Core** export. `development-history/ims_progress.md` records 17 accepted type errors in the Core export and 1 in Pro. If the build type-checks, Core cannot be built and the walkthrough for that package is blocked until those errors are fixed or the build is configured to tolerate them (a product decision, not a test decision).
5. [ ] **Phase 1 guardrails** (needs devDependency approval D8, below) and **Phase 2 audit-and-fix loop**, per package, per the brief in `tests/walkthrough/README.md`.
6. [ ] **Decide the scan fix order** with the owner (open-items section 1), then fix in batches, each with a failing test first.
7. [ ] **Push the local commits** on `dev` when the owner is happy (section 3 says what is pushed and what is not).
8. [ ] **Promote `main` → `prod` only deliberately** (section 3, last paragraph).

---

## 1. What this is

A Next.js 16 (App Router) and React 19 monolith on PostgreSQL through Prisma 6, with TanStack Query, Tailwind and shadcn/ui, managed with pnpm. About 78 API routes, 62 pages, 307 components, 121 test files. Optional integrations are switched on by environment variables: Stripe, Shippo, Brevo email, ImageKit, Upstash/ioredis Redis, QStash, Sentry, OpenRouter and Groq, Google OAuth. Only `DATABASE_URL`, `JWT_SECRET` and `NEXT_PUBLIC_API_URL` are required.

Key decisions, each with its reason and what enforces it, are in `docs/adr/`: one monorepo with tier-gated export (0001), `.core`/`.pro` file variants (0002), PostgreSQL and one shared schema (0003), the Proplity-derived auth design (0004), the row-level-security prototype (0005), the `dev`/`main`/`prod` branch model (0006), and the commercial licence with the upstream MIT notice kept (0007). All seven are **Proposed** until the maintainer accepts them; only a person can.

**Packages (tiers).** Core, Pro and Premium are not separate repositories. They are built by `pnpm export:core | export:pro | export:premium`, which copies the files each tier needs from this one repository into an output directory (`scripts/export-tier.ts`, `tier-manifest.json`). The full monorepo itself contains everything (Premium behaviour).

## 2. Decisions the owner has made (2026-10-21), and what was done about each

| # | Owner's instruction | Result |
|---|---|---|
| 1 | "Can we have walkthrough for each package?" | Taken as: one walkthrough per tier export (Core, Pro, Premium). Plan written in [`tests/walkthrough/per-package-plan.md`](../tests/walkthrough/per-package-plan.md). Not started beyond planning. Recorded as walkthrough decision D10 |
| 2 | "Use a local db for now (create the local db referenced in `.env`)" | Done. Database `octalve_ims_test` created on the local Postgres at `127.0.0.1:5432`, using the third `DATABASE_URL` line in `.env`. It is empty (0 tables; migrations are **not** applied). Details and cautions in section 4. Resolves D1 (the database name changed from the planned `octalve_ims_walkthrough`) |
| 3 | "Sync `main`/`dev` carefully and properly" | Done as a fast-forward only. Details in section 3. Resolves D2: PR base is **`dev`** |
| 4 | "Licence: commercial" | Done. `LICENSE` is now a proprietary commercial licence; the upstream MIT notice moved to `NOTICE`; both ship in every export. [`adr/0007`](adr/0007-commercial-licence-with-upstream-mit-notice-kept.md). Legal review still needed (open-items) |
| 5 | "Commit to the `dev` branch after syncing" | Commits made on local `dev` (see section 3 for the list). **Not pushed.** `git push origin dev` is one command when ready |
| 6 | "Update all docs, especially the handover; detailed, broken down, comprehensive" | This file, `open-items.md`, `tasks/` (new task 0003; 0001 and 0002 updated), ADR 0007, the walkthrough README and the new per-package plan, the issue register row ISS-0069 |

## 3. Git state and the branch sync (what exactly was done)

**Before.** `main` and `origin/main` at `d7e6720`; `origin/dev` and `origin/prod` both at `baa1138` ("refactor(auth): split password reset onto its own token table"). Checked beforehand: `origin/dev` is an ancestor of `main` (so a fast-forward was possible); `origin/prod` is an ancestor of `origin/dev`; no local `dev` branch existed.

**The 5 commits `dev` was missing**, all CI and deployment pipeline work, no application code:
`2592ece` adopt Proplity's dev/staging/prod pipeline · `fc8a89d` apply RLS policies before seeding in the ephemeral test DB · `44c5bdd` merge of PR #1 · `8e8751e` correct `DEPLOYMENT.md` on the `tenant-prisma.test.ts` CI failure · `d7e6720` merge of PR #2.

**Done.**
1. `git fetch origin --prune`, then re-checked that `origin/dev` was still an ancestor of `main`.
2. `git push origin d7e6720:refs/heads/dev`, a plain push (no `--force`): `baa1138..d7e6720`. It could only succeed as a fast-forward.
3. `git checkout -b dev --track origin/dev` (the working tree changes carried over because `dev` and `main` were then identical).

**After.** `dev` = `main` = `origin/dev` = `origin/main` = `d7e6720`, before the new commits. **`origin/prod` was deliberately left at `baa1138`.** In the documented flow (ADR 0006) `prod` is promoted last and a push there is a release step, and the 2 P0 and 24 P1 scan findings are unfixed. Promote it only on purpose: open a PR `main` → `prod`, or `git push origin main:prod` (fast-forward), then run the manual production migration and deploy workflows in the order in `DEPLOYMENT.md`.

**What a push to `dev` triggers.** `.github/workflows/ci.yml` only (push to `main`, `dev` or `prod`). `migrate-staging.yml` runs on pushes to `main`, `migration-check.yml` on pull requests into `main` or `prod`, `preview.yml` on pull requests into `main`. Production migrate and deploy are manual workflows.

**Local commits on `dev` (not pushed).** Run `git log --oneline origin/dev..dev` for the exact list. Intended contents: (1) licence change and export script; (2) the internal documentation; (3) the walkthrough plan. If `origin/dev` has moved when you push, rebase or merge first; do not force.

## 4. Running things safely

- **`.env` has three `DATABASE_URL` lines** (it used to be described as two): (1) hosted Neon pooled, (2) hosted Neon direct (`DEPLOYMENT.md` designates this database as **staging**), (3) `127.0.0.1:5432/octalve_ims_test`, a local role. **Which line is effective has not been confirmed.** By the dotenv convention a later duplicate overrides an earlier one, so line 3 (local) probably wins; check by printing only the host name, never the whole URL. Do not print or paste secrets from `.env`.
- **Local database `octalve_ims_test`.** Created empty on 2026-10-21. It is the walkthrough's dedicated database (`DEDICATED_DB`). The preflight must drop and recreate it before every package run and refuse to run if its name differs. Anything else that touches it breaks the "empty start" rule: in particular **`lib/server/tenant-prisma.test.ts` writes real rows into whatever `DATABASE_URL` points at**, so with line 3 effective, running the full test suite would write into this database.
- **Tests.** Run the suite as `env -u DATABASE_URL -u DIRECT_URL pnpm exec vitest run --exclude lib/server/tenant-prisma.test.ts`. Every other test file mocks `@/prisma/client`.
- **Never run** `script:reset-demo-db`, `script:seed-full-demo`, `script:delete-all-data`, `prisma db seed` or `prisma migrate reset` against a database you have not looked at; none checks the target and each wipes it (ISS-0026). Never aim anything at the hosted Neon URLs.
- **Credentials from documents.** `docs/local-dev-setup.md` contains a local Postgres password. An attempt to use it on 2026-10-21 was blocked by the permission system and not retried; the owner then authorised the local database named in `.env` instead. Use the `.env` credential only for that local database; do not reuse a password from a document for anything else without the owner's say-so.
- **Exports.** `pnpm export:<tier> <dir>` deletes its output directory first. Always pass an explicit new path, never `.` or `..` (ISS-0061). Internal docs under `docs/adr`, `docs/issues`, `docs/tasks`, `docs/development-history`, `docs/HANDOVER.md` and `docs/open-items.md` are excluded from every export by `scripts/export-tier.ts`; the older docs still ship (ISS-0062). `LICENSE` and `NOTICE` ship in every export (checked on a Core export to a scratch folder: both present, `package.json` carries `"license": "SEE LICENSE IN LICENSE"`).
- **First admin.** There is no setup wizard: open `/register`; the new account is an **admin** (ISS-0001). Further users are created in User Management.
- **Walkthrough.** Needs the dedicated database above, a production build with `NEXT_PUBLIC_API_URL` set at build time, and its own Redis logical database (15). Plan: `tests/walkthrough/README.md` and `per-package-plan.md`.
- **Stray processes.** At the end of the previous context, `ps` showed several `next start` / `next-server` processes (ports 3130, 3132, 3211, 3297). They were not started by this work and were not touched. Ports 3001 and 3002 are also taken; 3000 and 3100 to 3103 were free.

## 5. Where things stand (checked 2026-10-21)

| Check | Result |
|---|---|
| `tsc --noEmit` (after the licence change) | prints no errors |
| `check:manifest` (after adding `NOTICE`) | OK, "every folder/file is classified in exactly one tier bucket" |
| `export:core` to a scratch directory (after the licence change) | OK, "no pro/premium paths leaked"; contains `LICENSE` and `NOTICE`; the internal docs are absent |
| `vitest` (excluding the database-writing test) | 826 passed, **1 failed**: `lib/orders/invoice-event-date.test.ts` is a time bomb (ISS-0057). Not re-run after the licence change (no code touched) |
| `eslint .` | 8 errors (`react-hooks/set-state-in-effect`), 210 warnings (197 tier-boundary). Not re-run |
| `pnpm build` | **never run** |
| Tier build progress | Phases 0 to 20 done; Phase 21 in progress; Core export has 17 type errors (accepted debt), Pro 1 (`development-history/ims_progress.md`) |
| Bug scan | 85 issues in [`issues/README.md`](issues/README.md): 2 P0, 24 P1, 43 P2, 16 P3. **None is fixed.** ISS-0069 (licence) is now fixed pending legal review. About 15 of the high-severity rows were re-read by hand; the rest are reviewer claims |
| Walkthrough | Phase 0 complete for the full monorepo (255-row matrix, 100-step storyboard). Per-package plan written. Phase 0b, Phase 1 and Phase 2 not started. Nothing has been run or recorded |

The two P0 items share a root: **any visitor can register and becomes an admin (ISS-0001)**, and many admin routes are global rather than per-owner. That is a model decision for the maintainer before any fix.

## 6. Documentation map (structure adopted from AlEemaan on 2026-10-21)

| Path | Role |
|---|---|
| `docs/HANDOVER.md` (here) | start here: status, rules, how to run things safely, what to do next |
| `docs/open-items.md` | the one place for questions waiting on the maintainer |
| `docs/adr/` | decisions and reasons, one per file, never rewritten once accepted (0001 to 0007) |
| `docs/issues/` | the issue register (85 rows) with severity, evidence and a link to detail; seven `scan-2026-10-21-*.md` detail files |
| `docs/tasks/` | `current-tasks.md` is the dashboard, one numbered file per work session (0001 to 0003) |
| `docs/development-history/` | `ims_progress.md` and `phases/*.md`: what was built and why; append-only. Copied here from the gitignored `out/` (originals still there) |
| `docs/PROJECT_WALKTHROUGH.md`, `docs/user-flows-and-stories.md`, `docs/auth-system-port-plan.md`, `docs/MANUAL_TEST_FIXTURES.md`, `docs/local-dev-setup.md`, … | reference and guides from before the restructure; known inaccuracies are in `issues/scan-2026-10-21-docs.md` |
| `tests/walkthrough/` | `README.md` (brief, assumptions, decisions D1 to D10), `per-package-plan.md`, `coverage.yaml` (255 rows), `storyboard.md` (100 steps). Not shipped in exports |

Differences from AlEemaan: no `legacy-*` or `feature-reconciliation` document (no legacy repository to reconcile); the task tracker lives in the repository; `AGENTS.md` was not added (`CLAUDE.md` plays that role here and still needs a short pointer to this file).

## 7. Rules

1. An ADR is never edited once accepted; a new one supersedes it. An agent may draft an ADR; only a person accepts it.
2. Every suspected problem goes into the issue register the moment it is suspected, with honest evidence ("Read" until a test or a run proves it).
3. A fix is a task: design, a test that fails first, the fix, docs updated in the same change.
4. New files must be classified in `tier-manifest.json` (`pnpm check:manifest`). A change that touches a tiered folder or a variant should also be proved with `pnpm export:core` and `pnpm export:pro` plus `tsc --noEmit` in the output.
5. Reports from delegated reviewers are claims, not facts, until the code has been re-read or a test exists.
6. Walkthrough rules (from the brief): steps may only do what a person can do (click, type with real key presses, choose a file in a dialog, follow a link, back/forward, sign out and in); no SQL, API calls, cookie edits, URL navigation after the first load, force-clicks, sleeps or retries; preflight hard-exits unless the database name, local URL, production build, clean git tree and empty database all hold; never weaken an assertion to make a run green; cap the audit-and-fix loop at 15 iterations.
7. Commits end with the attribution line the harness gives (`Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`).

## 8. What is not done (complete list)

- All 85 scan findings except ISS-0069. No finding has a reproducing test except the time-bomb test.
- Acceptance of ADRs 0001 to 0007.
- Walkthrough Phases 0b, 1 and 2, for all three packages. No Playwright dependency is installed; no fixtures, preflight, observers or recordings exist.
- Pushing the local `dev` commits; promoting anything to `prod`.
- Repointing the `out/phases/...` citations in `tier-manifest.json` (about 13) to `docs/development-history/phases/...`, then deleting the original `out/` copies after the owner checks the copies.
- A short pointer from `CLAUDE.md` to this file; correcting the MongoDB statements in `CLAUDE.md` and `docs/PROJECT_WALKTHROUGH.md` (ISS-0065, ISS-0066).
- Fixing `lib/orders/invoice-event-date.test.ts` (ISS-0057) and the 8 ESLint errors so CI can go green.
- Legal review of `LICENSE` (copyright holder name "Octalve" and the terms are an assumption).
- A production build (`pnpm build`) has never been run during this work.
