# Walkthrough tools (Phase 0 record)

Saved on 2026-10-21 so they do not vanish with a session's scratch folder. They are not part of the journey and are never exported (`tests/` is not exported).

| File | What it is |
|---|---|
| `inventory.mjs` | Read-only. `node inventory.mjs <repoRoot> > inventory.json` lists every `page.tsx` and API `route.ts` with a few facts about each. |
| `inventory.json` | Its output for the full monorepo at the Phase 0 commit (62 pages, 78 API routes). Re-run it against each tier's export for Phase 0b (see `../per-package-plan.md`). |
| `gen-coverage.mjs` | One-off generator that produced the first `../coverage.yaml`: `node gen-coverage.mjs <inventory.json> <sourceCommit> > new-file.yaml`. The mapping tables inside it (URL to roles and steps) are the record of how each row was derived. |

## Cautions

- **Do not run `gen-coverage.mjs` over `../coverage.yaml`.** The YAML is the source of truth and may have been edited by hand since. Write to a new file and diff.
- `inventory.mjs` only reads the tree you point it at. For a tier, point it at the export directory (outside the repository), never at `.` while an export is in progress.
- The issue register was built by a similar one-off script that was **not** saved: re-running it would overwrite later hand edits. The register itself (`docs/issues/README.md`) is the record.
