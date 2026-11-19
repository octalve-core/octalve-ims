# 0007 — Octalve IMS is commercial software; the upstream MIT notice is kept in `NOTICE`

Status: Proposed
Decided by: project owner (instruction given in the working session on 2026-10-21: "commercial"); drafted by an agent; legal review and acceptance still needed · Date: 2026-10-21
Recorded: 2026-10-21

## Context

`LICENSE` was the MIT licence in the name of "Arnob Mahmud", with a footer inviting forks and contributions. That text came from the Stockly codebase this repository was forked from (`development-history/phases/phase-0-repo-strategy-and-rename.md`). Meanwhile `SECURITY.md` calls Octalve IMS "a commercial inventory management codebase", the product is sold as Core, Pro and Premium packages, and `scripts/export-tier.ts` ships `LICENSE` in every customer export. So every export told its recipient they could copy, modify and resell it.

## Decision

- `LICENSE` is a proprietary commercial licence: all rights reserved, no use, copying, hosting or resale except under a written commercial agreement; having an export is not a licence; a licensee may use only the tier named in its agreement.
- The upstream MIT text moves, unchanged, to `NOTICE`, because MIT requires its copyright and permission notice to be kept with copies of the derived portions. `NOTICE` says it covers only those portions.
- `package.json` carries `"license": "SEE LICENSE IN LICENSE"` (the field was absent); `README.md` shows a "Commercial" badge and points to `LICENSE` and `NOTICE`.
- `scripts/export-tier.ts` copies `LICENSE` and `NOTICE` into every tier export.

## Alternatives Considered

- **Keep MIT.** Rejected: contradicts the commercial intent and lets any recipient of an export redistribute it.
- **Delete the MIT text and write only the new licence.** Rejected: removes a notice that MIT requires to stay with derived code.
- **Dual-license or source-available terms.** Not chosen by the owner; possible later by superseding this record.

## Consequences

- The copyright holder name "Octalve" is an assumption (product and GitHub organisation). The legal entity name and the real per-tier terms, warranty and liability wording have not been written; the text is a short placeholder in that sense.
- Copies already distributed under the old MIT file remain MIT; this change is not retroactive.
- It is not known which files still contain Stockly-derived code, so `NOTICE` is kept for the whole repository's derived portions.
- **Revisit if:** the legal entity is named, per-tier terms are drafted, or a licence-management or SPDX requirement appears.

## Enforced by

`scripts/export-tier.ts` (`ALWAYS_COPY_ROOT` lists `LICENSE` and `NOTICE`; checked once by exporting Core to a scratch folder: both present). Nothing automated checks that the files exist: review only.

## Binds

- `LICENSE`, `NOTICE`
- `package.json` (`license`), `README.md` (badge and License section), `SECURITY.md`
- `scripts/export-tier.ts`
- Issue ISS-0069
