# Octalve IMS — Project Status & Handover

> **Auth hardening added 2026-10-26** (task 0004, branch `fix/auth-hardening-from-proplity`, [PR #29](https://github.com/octalve-core/octalve-ims/pull/29) open into `dev`): see section 0, item 9, and section 5.
>
> **Last updated:** 2026-10-21, end of the session that did: docs restructure, first full bug scan, walkthrough Phase 0, `dev` branch sync, local walkthrough database, commercial licence.
> **Repository:** `octalve-core/octalve-ims` · **Working branch: `dev`** (local `dev` tracks `origin/dev`; `dev`, `main` and `origin/main` are all at `d7e6720` after the sync described in section 3).
> **Scope:** inventory, order and warehouse management for admin, supplier, client and retailer roles, sold as three packages (tiers): Core, Pro and Premium.
> **Read first, in this order:** this file → [`open-items.md`](open-items.md) → [`tasks/current-tasks.md`](tasks/current-tasks.md) → [`issues/README.md`](issues/README.md) → [`adr/README.md`](adr/README.md). Where `CLAUDE.md` or `PROJECT_WALKTHROUGH.md` disagree with the code, trust the code: both still describe MongoDB and parts of a UI that no longer exist.

---

## 0. Resume here (the next session starts with this list)

Nothing below has been started unless it is ticked.

1. [x] **Read the decisions the owner already made** (section 2). Do not ask again about: local database, `dev` as PR base, commercial licence, walkthrough per package.
2. [x] **Confirm one interpretation with the owner in a single line:** "package" was taken to mean **tier** (Core, Pro, Premium) — confirmed 2026-10-23: resume the old plan's per-tier segmentation, reuse `octalve_ims_test` (the `wip_ims_walkthrough` database created mid-session was dropped).
3. [x] **Walkthrough Phase 0b** — done 2026-10-23: `coverage.yaml` now carries a `tiers:` field (`tools/annotate-tiers.mjs`, new); `coverage.core.yaml` (181 rows), `coverage.pro.yaml` (204), `coverage.premium.yaml` (255) generated from it. `storyboard.md` amended: the admin-bootstrap steps assumed "every self-registration is an admin", which this session's own ISS-0001 fix made false (self-registration now grants `"user"`, with no UI path to bootstrap the first admin at all) — first-admin provisioning is now treated as a stage-step, not a clicked-through step; a second throwaway identity ("Folake Adewale") was introduced to avoid colliding with the pre-existing admin-creates-a-user step's "Ngozi Obi".
4. [~] **First technical risk to test before anything else:** whether `next build` succeeds on the **Core** export (17 accepted type errors) and **Pro** (1). **Premium confirmed 2026-10-23**: `export:premium` → `pnpm install` → `tsc --noEmit` (clean, exit 0) → `prisma migrate deploy` (schema already present from an earlier apply; idempotent no-op) → RLS SQL applied → `NEXT_PUBLIC_API_URL=http://localhost:3100 pnpm build` (clean) → `next start -p 3100` → `GET /` returns 307 to `/login`, `GET /login` returns 200 with the expected title — all against the real dedicated `octalve_ims_test`, in a scratch directory outside the repo, server stopped afterward. Core and Pro not yet attempted — their accepted type errors make `next build`'s own type-check (not just `tsc --noEmit`) the open question. **Noted, not yet acted on:** the local `roji` role is itself a Postgres superuser (`rolsuper=t`), so it always bypasses RLS regardless of the policies applied — fine for what the walkthrough visibly shows (role-boundary enforcement here is `lib/auth/can.ts` + `userId`-scoped queries, not RLS; RLS exists for future multi-tenancy per ADR 0005/ISS-0002), but worth recording as a "not demonstrable" caveat in the final report rather than silently assuming RLS was exercised.
5. [x] **Phase 1 guardrails** — built and checked 2026-10-23 (`tsc`, `eslint`, `check:manifest`, `vitest` all green; see `tests/walkthrough/README.md`'s status line for the file list). Devdependency approval D8 given. **Phase 2 audit-and-fix loop**, per package — [ ] not started: no journey step exists yet under `tests/walkthrough/steps/`, and Phase 1 guardrail code has not yet been run against a live build (stage.ts's drop/recreate/build/start lifecycle is unit-guard-tested only, not exercised end to end).
6. [ ] **Decide the scan fix order** with the owner (open-items section 1), then fix in batches, each with a failing test first.
7. [ ] **Push the local commits** on `dev` when the owner is happy (section 3 says what is pushed and what is not).
9. [~] **Auth hardening from Proplity** (task 0004, ADR 0008 Proposed): code and tests done on `fix/auth-hardening-from-proplity` (off local `dev`), pushed, [PR #29](https://github.com/octalve-core/octalve-ims/pull/29) open into `dev`, CI green; register rows ISS-0027, 0028, 0029, 0032, 0033 updated. Decision (a) (user status + email verification) and decision (b) (minimum password length 6→8) approved and built 2026-10-26; decision (a) opened ISS-0102 (no admin way to SUSPEND yet). Left for the maintainer: review and merge the PR; the remaining decisions in [`open-items.md`](open-items.md) section 1 (register's 409, the login interceptor); confirm the app is behind exactly one trusted proxy; ISS-0102.
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
| Auth hardening (2026-10-26, branch `fix/auth-hardening-from-proplity`) | 61 new tests in `lib/auth/` (70 in the folder: the original 47 across five files, plus 14 more for decision (a)'s status/verification gate in the same files), plus 5 more for decision (b)'s password-length boundary (2 in `lib/validations/auth-api.test.ts`, 2 in a new `lib/validations/user-management.test.ts`, 1 in `lib/auth/password-routes.test.ts`), each written first and shown failing against the old routes/schemas. Full `vitest` run (database-writing test excluded): **989 passed, 0 failed, 151 files** (983/150 after decision (a); 968 before it; +14 in `lib/auth/` and +1 in `invalidate-coverage.test.ts`'s per-component loop for decision (a)'s `VerifyEmailPage.tsx`). `tsc --noEmit` clean, `eslint` 0 errors on the touched files, `check:manifest` OK (after adding `VerifyEmailPage.tsx` to the pre-auth-page allowlist). The new migration (`20261026020000_add_user_status`) applied cleanly end to end against the local walkthrough database, never against the hosted Neon one. `pnpm build` not run. CI on PR #29 confirmed green (both "Tests (ephemeral DB)" and "Typecheck, tier-manifest & build") as of the decision-(a)/ISS-0103 commits; not yet re-confirmed after decision (b) — see PR checks before merge |
| Bug scan | 85 issues in [`issues/README.md`](issues/README.md): 2 P0, 24 P1, 43 P2, 16 P3. **None is fixed.** ISS-0069 (licence) is now fixed pending legal review. About 15 of the high-severity rows were re-read by hand; the rest are reviewer claims |
| Walkthrough | Phase 0 and 0b complete (255-row matrix with a per-tier `tiers:` field, 100-step storyboard amended for the ISS-0001 fix). Phase 1 guardrail code built and checked (preflight, stage/run-manifest, guarded nav, guard test, observers, overlay, timeline, fixtures — found ISS-0086 while building the import fixture). Phase 1 end-to-end run and Phase 2 not started. Nothing has been run or recorded |

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
| `tests/walkthrough/` | `README.md` (brief, assumptions, decisions D1 to D10), `per-package-plan.md`, `coverage.yaml` (255 rows), `storyboard.md` (100 steps), `tools/` (the inventory and first-matrix generators, with a README). Not shipped in exports |
| `AGENTS.md`, `CLAUDE.md` (repository root) | auto-loaded instructions for AI tools; both point here; neither is exported |

Differences from AlEemaan: no `legacy-*` or `feature-reconciliation` document (no legacy repository to reconcile); the task tracker lives in the repository; `AGENTS.md` was added at the repository root (2026-10-21) for tools that read it, and `CLAUDE.md` now starts with a pointer to this file; neither is exported.

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
- Walkthrough Phase 1 end-to-end (run against a live build) and Phase 2, for all three packages. Phase 0b is done; Phase 1 guardrail code, fixtures, preflight and observers now exist (`tests/walkthrough/lib/`, `observers/`, `fixtures/`) but no journey step is written and no recording exists.
- Pushing the local `dev` commits; promoting anything to `prod`.
- Repointing the `out/phases/...` citations in `tier-manifest.json` (about 13) to `docs/development-history/phases/...`, then deleting the original `out/` copies after the owner checks the copies.
- Remaining documentation drift (ISS-0065, ISS-0066, and the rest of `issues/scan-2026-10-21-docs.md`): `docs/PROJECT_WALKTHROUGH.md` lines 31 and 50 still describe MongoDB; `README.md:537` mentions "collections"; `CLAUDE.md` still shows `npm run` commands and its line 76 refers to legacy MongoDB rows. (Done on 2026-10-21: `CLAUDE.md` pointer, its Stack line and its schema-change line; `AGENTS.md`.)
- Fixing `lib/orders/invoice-event-date.test.ts` (ISS-0057) and the 8 ESLint errors so CI can go green.
- Legal review of `LICENSE` (copyright holder name "Octalve" and the terms are an assumption).
- A production build (`pnpm build`) has never been run during this work.

## 9. Continuing with another AI or person

**A different AI does not remember this work.** It knows only the files it reads and anything you tell it. It will not volunteer these decisions, caveats or findings unless it is pointed at them. What makes that work here:

- `CLAUDE.md` (read automatically by Claude Code) and `AGENTS.md` (read by many other tools) both start with a pointer to this file. A tool that loads neither must be told to read the files below first.
- This file and `open-items.md` hold the decisions and the next steps; `AGENTS.md` holds the safety rules in a short list.

**Paste this to start any other AI:**

> Read `docs/HANDOVER.md` first, then `docs/open-items.md`, `docs/tasks/current-tasks.md`, `AGENTS.md`, and `tests/walkthrough/per-package-plan.md`. Do not change anything until you have read them. Then tell me, in your own words: which branch PRs go into; which database the walkthrough may use; whether you may push to `prod`; what the licence is and what `NOTICE` is for; what "package" means for the walkthrough and which assumption about that is still unconfirmed; which scan findings are unfixed and why ISS-0001 comes first; and what the first technical risk for the Core package is. Then follow the "Resume here" list.

**Check it understood.** The right answers are: `dev`; the local `octalve_ims_test`, recreated empty per run; no, never without the owner; commercial, and `NOTICE` keeps the upstream MIT text that MIT requires to stay with derived code; "package" means tier (Core, Pro, Premium) and that reading is not yet confirmed; 84 of 85 are unfixed and ISS-0001 (anyone can register as admin) underlies the P0s and most P1 authorization rows; the Core export has 17 accepted type errors, so a type-checking `next build` may fail.

**What is in the files (a new AI can rely on it):** every decision the owner made on 2026-10-21 and what was done; the exact git record and what was and was not pushed; the local database and its cautions; 85 findings with severity, scenario, fix direction and evidence level; seven ADRs; the walkthrough plan (255-row matrix, 100-step storyboard, per-package plan, and the scripts that built the first matrix); the licence decision and its open follow-ups; the safety rules.

**What is not in the files:**
- The reasoning discussion in the conversation beyond what is written down.
- The raw reports of the seven delegated reviewers: they are distilled into `issues/scan-2026-10-21-*.md`; the originals existed only in the conversation. They were model output, which is why most rows say "Read" and not "Reproduced".
- Raw logs of `tsc`, `eslint` and `vitest` (their numbers are in section 5 and in task 0001), and the script that built the issue register (re-running it would overwrite hand edits; the register is the record).
- The conversation transcript, which exists only on this machine: `/home/rojitech/.claude-schulltech/projects/-home-rojitech-Desktop-CODEC-OCTALVE-ims-projects-ims-django-0/b5431ac2-f983-42bc-b30c-ebe36896bc0b.jsonl`. It is large; hand it to another AI only if it must recover a detail the docs lack.
- Anything about the live deployment: every register row says `Live? unknown` because nobody checked what is deployed (`open-items.md` section 2).

**Where a new AI could still be misled:** `docs/PROJECT_WALKTHROUGH.md` (still describes MongoDB), `CLAUDE.md` below its first lines (older conventions, `npm run`), `README.md` claims about environment validation (ISS in `issues/scan-2026-10-21-docs.md`), and any ADR (all `Proposed`, backfilled from commit messages).
