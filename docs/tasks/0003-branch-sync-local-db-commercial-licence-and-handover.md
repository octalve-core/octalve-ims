# 0003: Branch sync, local walkthrough database, commercial licence, per-package walkthrough plan, handover

- **Period / Focus:** 2026-10-21 to 2026-10-21 (repository housekeeping decided by the owner; ends with a full docs update because the working session was nearly out of capacity)
- **Status:** Completed (committed on local `dev`; **not pushed**, except the branch sync, which was pushed)
- **Priority:** High
- **Assignee:** Claude, owner for decisions
- **Target Branch / PR:** `dev` (local commits, no PR)
- **Started:** 2026-10-21 (time not logged)
- **Ended:** 2026-10-21 (time not logged)
- **Duration:** —

> **How to tick:** change `[ ]` to `[x]`.

---

## 1. Objective
Carry out the owner's five instructions of 2026-10-21: a walkthrough for each package; a local database for it; a careful sync of `main`, `dev` and `prod`; a commercial licence; commit to `dev` after syncing. Then update every doc so the next session can resume without this conversation.

## 2. Context & Related Docs
- Owner's wording: "can we have walkthrough for each package?"; "use a local db for now (create the local db referenced in .env)"; "sync them carefully and properly"; "Licence … commercial"; "commit to dev branch after syncing"; then, because the session was nearly out of capacity, "update all docs especially the handover … detailed, broken down and comprehensive".
- Related: [`0001`](0001-docs-structure-and-first-bug-scan.md), [`0002`](0002-walkthrough-flow-audit.md), [`../adr/0006-dev-main-prod-branches-with-manual-production-migrate-and-deploy.md`](../adr/0006-dev-main-prod-branches-with-manual-production-migrate-and-deploy.md), [`../adr/0007-commercial-licence-with-upstream-mit-notice-kept.md`](../adr/0007-commercial-licence-with-upstream-mit-notice-kept.md), ISS-0069, [`../../tests/walkthrough/per-package-plan.md`](../../tests/walkthrough/per-package-plan.md).

## 3. Work Breakdown

### Module A: Local database
- [x] Found the local entry in `.env` (the third `DATABASE_URL` line, host `127.0.0.1:5432`, database `octalve_ims_test`); password never printed
- [x] Refused-to-run guard in the command: it aborts unless the host is `127.0.0.1` or `localhost`
- [x] Created `octalve_ims_test` (it did not exist). Verified: connects, 0 public tables
- [ ] Apply migrations (deliberately not done: the walkthrough's start state is created by its preflight, per run)

### Module B: Branch sync
- [x] `git fetch origin --prune`; confirmed `origin/dev` (`baa1138`) is an ancestor of `main` (`d7e6720`), `origin/prod` an ancestor of `origin/dev`
- [x] Listed the 5 missing commits (all CI and deployment pipeline: `2592ece`, `fc8a89d`, `44c5bdd`, `8e8751e`, `d7e6720`)
- [x] Checked what a push to `dev` triggers: only `ci.yml`
- [x] `git push origin d7e6720:refs/heads/dev` (no force): `baa1138..d7e6720`
- [x] Local `dev` created tracking `origin/dev`; `dev` = `main` = `d7e6720` before the new commits
- [x] `origin/prod` left at `baa1138` on purpose (a push there is a release step and the P0/P1 findings are unfixed; see `HANDOVER.md` section 3)
- [ ] Check CI on `dev` (not checked)

### Module C: Commercial licence
- [x] `LICENSE` replaced by a proprietary commercial licence (copyright holder "Octalve" is an assumption)
- [x] `NOTICE` created with the upstream MIT text unchanged (MIT requires it to stay with derived portions)
- [x] `package.json` `"license": "SEE LICENSE IN LICENSE"`; README badge and License section updated
- [x] `scripts/export-tier.ts`: `NOTICE` added to `ALWAYS_COPY_ROOT`
- [x] Verified: `check:manifest` OK; `export:core` to a scratch directory contains `LICENSE`, `NOTICE`, the new `package.json` field, and no internal docs; `tsc --noEmit` prints no errors
- [x] ADR 0007 drafted (Proposed); ISS-0069 marked fixed pending review
- [ ] Legal review, real copyright holder, real per-tier terms (owner; `open-items.md`)

### Module D: Per-package walkthrough plan
- [x] Interpreted "package" as tier; wrote `tests/walkthrough/per-package-plan.md` (matrix generation per tier, run recipe, viewports, findings, done-when)
- [x] Recorded as decision D10; D1, D2 settled; D4 amended
- [ ] Phase 0b, Phase 1, Phase 2 (not started)

### Module E: Docs and commits
- [x] `HANDOVER.md` rewritten with a "Resume here" list, decisions table, exact git record, safety notes, status table, complete not-done list
- [x] `open-items.md` rewritten (settled items, maintainer decisions, facts to check, D1 to D10 table, housekeeping)
- [x] Tasks 0001, 0002 and the dashboard updated; this file; ADR index and ADR 0006 updated
- [x] Committed on local `dev` in three commits (licence and export script; internal documentation; walkthrough plan); not pushed

## 4. Unified Verification & Quality Gates
- [x] `tsc --noEmit`: no errors
- [x] `check:manifest`: OK
- [x] `export:core` to a scratch directory: OK, no tier leak
- [ ] `pnpm lint`: not re-run (8 errors and 210 warnings already on `main`)
- [ ] `pnpm test`: not re-run (no code changed other than the export constant; 1 known time-bomb failure)
- [ ] `pnpm build`: not run
- [ ] `export:pro` / `export:premium`: not run after the licence change (the change is a root-file entry, identical for all tiers, but not proved on those two)

## 5. Notes, Findings & Deviations
- Permission note: the local database was created with the credential the owner pointed at (`.env`), not the password in `docs/local-dev-setup.md`, which a permission check had blocked earlier.
- `.env` has three `DATABASE_URL` lines; which is effective is not confirmed. If the local line is effective, `lib/server/tenant-prisma.test.ts` (which writes rows) would write into `octalve_ims_test`.
- Possible risk found while planning: the Core export has 17 accepted type errors; a type-checking `next build` of the Core export may fail.
- Commit/push boundary: only the `dev` fast-forward was pushed; the new commits stay local until the owner says push.

## 6. Output & Deliverables
- **Commits:** local `dev`; see `git log --oneline origin/dev..dev`
- **PR:** none
- **Docs:** `docs/HANDOVER.md`, `docs/open-items.md`, `docs/adr/0007-*.md`, `docs/tasks/0003-*.md`, `tests/walkthrough/per-package-plan.md`
