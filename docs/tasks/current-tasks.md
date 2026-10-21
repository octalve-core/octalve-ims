# Octalve IMS — Current Active Tasks

> **Canonical location:** `docs/tasks/`
> **How to tick:** change `[ ]` to `[x]`. The table shows the characters, not a clickable box.
> Numbering starts at 0001 on 2026-10-21. Earlier engineering work (tier machinery, auth port, deployment pipeline) is recorded as phases in [`../development-history/ims_progress.md`](../development-history/ims_progress.md), not as tasks.

## Active & upcoming tasks

| # | Task file | Description | Status | Started | Ended | PR / Branch |
|---|---|---|---|---|---|---|
| 0001 | [`0001-docs-structure-and-first-bug-scan.md`](0001-docs-structure-and-first-bug-scan.md) | Adopt AlEemaan's docs structure; first full static bug scan (85 issues); internal-doc export exclusion | Completed (committed on local `dev`, not pushed; no scan finding fixed except ISS-0069) | 2026-10-21 | 2026-10-21 | local `dev` |
| 0002 | [`0002-walkthrough-flow-audit.md`](0002-walkthrough-flow-audit.md) | End-to-end walkthrough (video, PDF, findings), **one per package (Core, Pro, Premium)**, human-only rules | In progress: Phase 0 done for the full build; per-package plan written; Phase 0b, 1, 2 not started. D1, D2 settled; D3 to D9 open; D10 decided | 2026-10-21 | — | PRs go into `dev` |
| 0003 | [`0003-branch-sync-local-db-commercial-licence-and-handover.md`](0003-branch-sync-local-db-commercial-licence-and-handover.md) | `dev` fast-forwarded to `main`; local database `octalve_ims_test` created; commercial licence; per-package walkthrough plan; full docs update | Completed (committed on local `dev`, not pushed; the branch sync was pushed) | 2026-10-21 | 2026-10-21 | local `dev` |

## Not yet scheduled (waiting on decisions in [`../open-items.md`](../open-items.md))

- Fix batches for the scan: model decision on registration and admin scope (ISS-0001, 0002) first, then the unauthenticated endpoints, the money and stock rows, the data-exposure rows.
- Acceptance of ADRs 0001 to 0007.
- Push the local `dev` commits; decide when to promote `main` to `prod` (`origin/prod` is still at `baa1138`).
- Walkthrough Phase 0b (per-package matrices), then Phase 1 (needs D8 approval), then Phase 2, in the order Premium, Pro, Core.
- Legal review of the commercial `LICENSE` (copyright holder and terms are placeholders).
- Next numbered task: 0004.
