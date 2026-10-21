# 0001: Docs structure adoption and first full bug scan

- **Period / Focus:** 2026-10-21 to 2026-10-21 (documentation structure; static security and defect scan)
- **Status:** Completed (documentation written and checked; committed on local `dev` in task 0003, **not pushed**; no scan finding fixed, except ISS-0069 in task 0003)
- **Priority:** High
- **Assignee:** Claude (delegated reviewers for the scan), maintainer to accept ADRs
- **Target Branch / PR:** local `dev` (was untracked on `main` until 2026-10-21)
- **Started:** 2026-10-21 (time not logged)
- **Ended:** 2026-10-21 (time not logged)
- **Duration:** —

> **How to tick:** change `[ ]` to `[x]`.

---

## 1. Objective
Give the repository the same documentation structure as AlEemaan (ADRs, issue register, task tracker, development history, handover, open items) and fill it from a thorough static scan of the whole codebase and its docs.

## 2. Context & Related Docs
- Structure source: `/home/rojitech/Desktop/CODEC/NextJS/AlEemaan/docs/` (`adr/`, `issues/`, `tasks/`, `development-history/`, `HANDOVER.md`, `open-items.md`).
- Output: [`../issues/README.md`](../issues/README.md) (85 rows) and seven detail files `../issues/scan-2026-10-21-*.md`; ADRs 0001 to 0006.
- Method note: seven delegated reviewers read the code statically; their output is model output. Rows say "re-verified" only where the main session re-read the cited code.

## 3. Work Breakdown

### Module A: Scan
- [x] Auth, sessions, tenancy
- [x] API authorization, ownership, validation
- [x] Orders, stock, invoices, payments, shipping
- [x] Schema, migrations, Redis, email, import/export, scripts, logging
- [x] Client state and server-rendered pages
- [x] Build, CI, dependencies, tiers, tests
- [x] Documentation accuracy against the code
- [x] Local checks: typecheck, manifest, vitest (database test excluded), eslint, export of Core to a scratch directory
- [ ] Reproduce the race and authorization findings with failing tests (none has one yet except the time-bomb test)

### Module B: Documentation structure
- [x] `docs/adr/` with README, template adapted to this repository, six backfilled ADRs (all `Proposed`)
- [x] `docs/issues/` README (register, taxonomy, priority scale) and seven detail files
- [x] `docs/tasks/` template, this dashboard, this file and 0002
- [x] `docs/development-history/`: `ims_progress.md` and 26 phase files copied from the gitignored `out/` (identical per `diff -r`; originals untouched)
- [x] `docs/HANDOVER.md`, `docs/open-items.md`
- [x] Commit on a branch: done on local `dev` after `dev` was fast-forwarded to `main` (task 0003); not pushed
- [ ] Repoint `out/phases/...` citations in `tier-manifest.json`; delete the `out/` originals after the maintainer checks the copies
- [ ] Pointer from `CLAUDE.md` to `docs/HANDOVER.md`; correct the MongoDB statements

### Module C: Safety change to the export
- [x] `scripts/export-tier.ts`: the internal docs (`docs/adr`, `docs/issues`, `docs/tasks`, `docs/development-history`, `docs/HANDOVER.md`, `docs/open-items.md`) are added to `ALWAYS_EXCLUDE`, because `docs` is copied whole into every customer export. Verified by exporting Core to a scratch directory.
- [ ] The older docs (`local-dev-setup.md` with a database password, `auth-system-port-plan.md`) still ship (ISS-0062)

## 4. Unified Verification & Quality Gates
- [x] `tsc --noEmit` clean (0 errors), run with `DATABASE_URL` unset
- [ ] `pnpm lint` clean: **fails** with 8 `react-hooks/set-state-in-effect` errors and 210 warnings (pre-existing; DEPLOYMENT.md states the same figures)
- [x] `pnpm check:manifest` OK, including with the new folders
- [ ] Production build: **not run**
- [ ] Zero regressions on the test suite: 826 passed, 1 failed (pre-existing `invoice-event-date.test.ts`, a clock-dependent test); `lib/server/tenant-prisma.test.ts` deliberately not run because it writes to the database named by `DATABASE_URL`
- [x] `pnpm export:core` to a scratch directory: no tier leak; internal docs and `tests/` absent from the export

## 5. Notes, Findings & Deviations
- A first attempt to list local databases used a credential read from `docs/local-dev-setup.md`; the permission system blocked it and it was not retried. Recorded in `open-items.md` (D1).
- `/out/` is gitignored, so the progress tracker and phase records were never in git; the tracked `tier-manifest.json` cites them in about 13 places.
- Two reviewer claims were checked and the register wording adjusted: the Stripe confirm replay and the Shippo webhook are confirmed by reading; whether anything is exploitable on a deployed environment is unknown (`Live? unknown` on every row).
- Several citations in `open-items.md` and `HANDOVER.md` had wrong ISS numbers at first draft and were corrected against the generated register.

## 6. Output & Deliverables
- **Commits:** on local `dev` (task 0003): the documentation commit and the export-script commit; run `git log --oneline origin/dev..dev`
- **PR:** none
- **Docs:** everything under `docs/adr`, `docs/issues`, `docs/tasks`, `docs/development-history`, `docs/HANDOVER.md`, `docs/open-items.md`; one change to `scripts/export-tier.ts`
