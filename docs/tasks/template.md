# [NNNN]: <Work Session / Milestone Title>

- **Period / Focus:** YYYY-MM-DD to YYYY-MM-DD (<Milestone or Session Theme>)
- **Status:** Pending | In Progress | Blocked | Completed
- **Priority:** Critical | High | Medium | Low
- **Assignee:** <Agent / Maintainer>
- **Target Branch / PR:** `<branch-name>` / [PR #`<number>`](<link>)
- **Started:** YYYY-MM-DD HH:MM:SS UTC
- **Ended:** YYYY-MM-DD HH:MM:SS UTC
- **Duration:** —

> **How to tick:** change `[ ]` to `[x]`. The table shows the characters, not a clickable box.

---

## 1. Objective
<Clear 1–2 sentence description of what success looks like for this batch or milestone.>

## 2. Context & Related Docs
- <Architectural constraints, ADRs bound (e.g. ADR-0014), plan sections.>
- <Related issues, dependencies, or preceding PRs.>

---

## 3. Work Breakdown (Grouped by Module / Sub-Phase)

### Module A: <Module Name / Feature Focus>
- [ ] Subtask 1
- [ ] Subtask 2

### Module B: <Module Name / Feature Focus>
- [ ] Subtask 3
- [ ] Subtask 4

### Module C: <Infrastructure / Docs / Governance>
- [ ] Subtask 5
- [ ] Subtask 6

---

## 4. Unified Verification & Quality Gates
- [ ] `pnpm typecheck` clean (0 errors)
- [ ] `pnpm lint` clean (no new warnings; `import/no-restricted-paths` tier warnings must not grow)
- [ ] `pnpm check:manifest` OK (every new file classified in `tier-manifest.json`)
- [ ] Production build succeeds (`pnpm build`)
- [ ] Targeted tests passed across modified modules; `pnpm test:invalidate` if a mutation or write route changed
- [ ] Zero regressions on existing test suite (see `docs/HANDOVER.md`, "Running the tests safely": `DATABASE_URL` unset, or a database whose name ends in `_test`)
- [ ] If the change touches a tiered folder or a `.core`/`.pro` variant: `pnpm export:core` and `pnpm export:pro` + `tsc --noEmit` in the export, error counts not worse than `docs/development-history/ims_progress.md`

---

## 5. Notes, Findings & Deviations
- <Decisions made during implementation, bugs found and fixed, deviations from plan.>

## 6. Output & Deliverables
- **Commits:** `<commit-hash>`
- **PR:** [PR #`<number>`](<link>)
- **Docs:** `<docs-updated>`

---

## Guidelines: Session & Milestone Grouping

| Use the Same Batch File When | Start a New Numbered File When |
|---|---|
| • Tasks are worked on in the same session, day, or sprint window.<br>• They ship together in the same PR or release train.<br>• They share a common quality gate (`tsc`, `lint`, `test`).<br>• They are contemporaneous maintenance items across modules. | • A PR is merged and you start a new branch/feature track.<br>• The scope represents a fundamentally distinct future milestone.<br>• A major architectural pivot or new phase begins. |

### Golden Rules
1. **Naming:** `NNNN-<kebab-case-title>.md` (e.g. `0001-phase-1-2-people-and-enrolment.md`), four digits, sequentially numbered.
2. **Prevent File Proliferation:** Group contemporaneous work by work session, sprint slice, or release milestone. Avoid micro-files for single routes, migrations, or tests.
3. **Living Dashboard:** `current-tasks.md` serves as your active HUD while coding, linking to sequential files.
4. **How to tick:** Always change `[ ]` to `[x]`.
5. **Timestamps:** Record `Started` when work commences and `Ended` upon verification in `YYYY-MM-DD HH:MM:SS UTC`.
