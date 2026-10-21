# 0002: Walkthrough video, PDF and findings for the full product

- **Period / Focus:** started 2026-10-21 (end-to-end walkthrough that doubles as a flow audit)
- **Status:** In Progress. Phase 0 (plan for the full build) complete; per-package plan written 2026-10-21; **paused** before Phase 0b and Phase 1 (session ended; resume at `docs/HANDOVER.md` section 0)
- **Priority:** High
- **Assignee:** Claude, maintainer for decisions D3 to D9 (D1, D2 settled, D10 decided)
- **Target Branch / PR:** `dev` (D2 settled: `dev` was fast-forwarded to `main` on 2026-10-21). PRs from feature branches into `dev`
- **Started:** 2026-10-21 (time not logged)
- **Ended:** —
- **Duration:** —

> **How to tick:** change `[ ]` to `[x]`.

---

## 1. Objective
One continuous recording, one PDF and a findings file for the whole product, driven only by what a person can do (click, type with real key presses, choose a file, follow a link, back/forward, sign out and in), against a production build and a new empty dedicated database. Whatever a person cannot do is a finding; each finding is fixed or escalated with the decision needed.

## 2. Context & Related Docs
- Plan and decisions: [`../../tests/walkthrough/README.md`](../../tests/walkthrough/README.md); matrix: `tests/walkthrough/coverage.yaml` (255 rows); journey: `tests/walkthrough/storyboard.md` (100 steps).
- Same specification as AlEemaan's task 0033 (`/home/rojitech/Desktop/CODEC/NextJS/AlEemaan/docs/tasks/0033-walkthrough-flow-audit.md`), which is specified there but not built; nothing was reusable.
- Related issues: ISS-0001 (registration creates admins), ISS-0030 (login error reload), ISS-0064 (retailer shell), ISS-0084 (no change-password screen), ISS-0025 (demo credentials in the bundle).

## 3. Work Breakdown

### Phase 0: plan (done)
- [x] Coverage matrix from every page, API route, the nav config and the user-stories doc (62 pages, 78 API routes, 56 features, 10 role boundaries, 15 validation states, 16 empty states, 15 not-demonstrable items, 3 candidate findings)
- [x] Storyboard: 100 steps in 11 chapters; every step id in the matrix exists in the storyboard and the reverse (checked)
- [x] "Not demonstrable here" list with reasons; scope statement
- [x] Environment facts: Node 24, pnpm 10, no ffmpeg, Chromium builds present in `~/.cache/ms-playwright`, ports 3001 and 3002 in use, local Postgres and Redis running
- [x] **D1 database:** local `octalve_ims_test`, created empty (task 0003)
- [x] **D2 PR base:** `dev`, synced (task 0003)
- [x] **D10 one walkthrough per package** (Core, Pro, Premium): decided; plan in [`../../tests/walkthrough/per-package-plan.md`](../../tests/walkthrough/per-package-plan.md); the meaning of "package" (tier) still to be confirmed with the owner
- [ ] **Decisions D3 to D9** still open (Redis logical database 15, viewports order, email catcher, third-party keys, ffmpeg, Playwright devDependencies, product decisions)

### Phase 0b: per-package matrices (not started)
- [ ] Smoke test: export, install, migrate, build, start and load `/login` for each of Core, Pro, Premium; record which fails (Core is the risk: 17 accepted type errors)
- [ ] Add a `tiers` field to every row of `coverage.yaml`; generate `coverage.core.yaml`, `coverage.pro.yaml`, `coverage.premium.yaml`
- [ ] Mark storyboard steps by tier; write Core and Pro variants only where a screen differs; re-run the step-ID cross-check per package
- [ ] Order of work: Premium, Pro, Core; desktop pass first for all three, then the other viewports

### Phase 1: guardrails (not started)
- [ ] `tests/walkthrough` Playwright config, `nav` wrapper, wrapped helpers, static guard with a negative test, runtime observers, cursor overlay, step timeline JSON, coverage gate, run manifest, preflight that hard-exits unless database name, local URL, production build, clean git tree and empty database all hold
- [ ] Fixtures: `products-import.csv`, `not-a-product-file.txt`, `product-image.png`
- [ ] Generators: PDF from the timeline, captions and chapters

### Phase 2: audit-and-fix loop (not started)
- [ ] Run, classify each failure, fix the product with a regression test, rerun from a fresh database; cap 15 iterations
- [ ] One green uninterrupted run per viewport **per package** on the final commit; the 15-iteration cap applies per package

## 4. Unified Verification & Quality Gates
- [ ] Guardrail unit test and its negative test green
- [ ] All matrix rows covered or not-demonstrable with a reason, in one green run
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build`, then the full existing suite on the final commit (lint and one test already fail on `main`: see task 0001)
- [ ] Video, PDF, findings and manifest reference the same commit SHA

## 5. Notes, Findings & Deviations
- The static scan and this walkthrough overlap on purpose: the scan reads code, the walkthrough proves behaviour a person can reach. It cannot prove direct-URL or API authorization, concurrency, or any third-party integration (see the scope statement).
- Candidate findings recorded in the matrix: no change-password screen, an unreferenced `product-owners` route, no screen for Business/Role/Permission; the retailer shell and the login error reload will be tested by steps S-120 and S-003.

## 6. Output & Deliverables
- **Commits:** the plan files are committed on local `dev` (task 0003), not pushed
- **PR:** none
- **Docs:** `tests/walkthrough/{README.md,per-package-plan.md,coverage.yaml,storyboard.md}`; deliverables go to the git-ignored `out/walkthrough/<tier>/` and are never committed
