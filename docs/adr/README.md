# Decisions (ADRs) — Octalve IMS

One short file per decision that someone might later **reverse by mistake**, or that **cost real effort to learn**. Not every change gets one.

| Document | Role |
|---|---|
| `development-history/ims_progress.md` | what is built, and the phase roadmap |
| `development-history/phases/*.md` | append-only history per phase |
| `docs/adr/` (here) | the decisions and the reasons, half a page each |
| `docs/tasks/` | the task tracker (`current-tasks.md` is the dashboard) |
| `docs/issues/` | known and suspected problems, with severity and evidence |
| `docs/open-items.md` | the one place for questions waiting on the maintainer |
| `docs/HANDOVER.md` | start here: status, rules, how to run things safely |

Plans and phase records link to the ADR instead of re-arguing the reason.

## Rules
- Template: follow [`template.md`](template.md) (11 canonical rules). This folder follows the same conventions as AlEemaan's `docs/adr/`.
- Files are `NNNN-kebab-title.md`, numbered in the order they are written, never reused.
- **Never edit an accepted ADR's decision.** To change one, write a new ADR that supersedes it and set the old one's status to `Superseded`. Allowed in place: the status line, typos, broken links.
- Keep it to about half a page. Fields: Title, Status, Decided by, Recorded, Context, Decision, Alternatives, Consequences (with *Revisit if*), **Enforced by** (the test, lint rule, CI job or file that holds it in place, or "review only"), Binds.
- **An agent may draft an ADR; only a person can accept it.** Every ADR below is `Proposed` until the maintainer changes the status and the date.
- Code that enforces or depends on a decision cites it in a comment (`ADR-0004`).

## Index
| # | Decision | Status |
|---|---|---|
| [0001](0001-one-monorepo-three-tiers-built-by-export.md) | One private monorepo; Core, Pro and Premium are built by export | Proposed (backfilled) |
| [0002](0002-tier-differences-inside-one-file-use-core-pro-variants.md) | A file that differs by tier gets `.core` / `.pro` variants, chosen by exact tier | Proposed (backfilled) |
| [0003](0003-postgres-replaces-mongodb-one-schema-for-every-tier.md) | PostgreSQL replaces MongoDB; one schema and one database serve every tier | Proposed (backfilled) |
| [0004](0004-auth-is-a-port-of-proplity-with-rotating-refresh-tokens.md) | Authentication is the Proplity design: short access JWT plus rotating refresh token | Proposed (backfilled) |
| [0005](0005-tenant-isolation-by-row-level-security-with-a-transaction-local-setting.md) | Tenant isolation is Postgres row-level security keyed by a transaction-local setting | Proposed (backfilled; prototype, not wired in) |
| [0006](0006-dev-main-prod-branches-with-manual-production-migrate-and-deploy.md) | `dev` development, `main` staging, `prod` production; production migrated and deployed by hand | Proposed (backfilled) |
| [0007](0007-commercial-licence-with-upstream-mit-notice-kept.md) | Octalve IMS is commercial software; the upstream MIT notice is kept in `NOTICE` | Proposed (owner's instruction 2026-10-21; legal review pending) |
| [0008](0008-auth-hardening-after-the-port.md) | Auth hardening after the port: a database limiter for credential routes, a refresh grace window, inherited session length | Proposed (drafted 2026-10-26 with task 0004) |
