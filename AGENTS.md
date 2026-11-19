# AGENTS.md — Octalve IMS

For any AI coding agent or new engineer. Not shipped in tier exports.

## Read before touching anything

1. [`docs/HANDOVER.md`](docs/HANDOVER.md): current status, what the owner has decided, the exact git state, how to run things safely, and a "Resume here" list.
2. [`docs/open-items.md`](docs/open-items.md): questions that wait on the owner. Do not guess them.
3. [`docs/tasks/current-tasks.md`](docs/tasks/current-tasks.md): active work and the next task number.
4. [`docs/issues/README.md`](docs/issues/README.md): 85 known or suspected problems with evidence levels. "Read" means someone read the code, not that it was reproduced.
5. [`docs/adr/README.md`](docs/adr/README.md): decisions and reasons. All are `Proposed` until a person accepts them.
6. [`CLAUDE.md`](CLAUDE.md): code conventions. It is older than the PostgreSQL move; trust the code where they disagree.

## Rules that are easy to break

- **Never connect to the hosted Neon database** in `.env` (it is staging). The only database you may use is the local `octalve_ims_test`.
- **Never use a password found in a document.** `docs/local-dev-setup.md` contains one; using it was blocked. Credentials come from `.env` and only for the local database.
- **Never print secrets** from `.env`.
- **Never run** `script:reset-demo-db`, `script:seed-full-demo`, `script:delete-all-data`, `prisma db seed` or `prisma migrate reset` against a database you have not looked at.
- **Run tests as** `env -u DATABASE_URL -u DIRECT_URL pnpm exec vitest run --exclude lib/server/tenant-prisma.test.ts` (that file writes real rows).
- **`pnpm export:<tier> <dir>` deletes `<dir>` first.** Always pass an explicit new path.
- **PRs go into `dev`.** Do not push to `prod` and do not force-push; promoting to production is a deliberate human step.
- **New files must be classified** in `tier-manifest.json` (`pnpm check:manifest`).
- **An agent may draft an ADR; only a person accepts it.** Record every suspected problem in the issue register with honest evidence.
- **Do not claim a result you did not observe.** Paste real command output when reporting status.

## What the licence means for you

The code is commercial and proprietary (`LICENSE`); `NOTICE` keeps the upstream MIT text and must stay with every copy. Do not copy code out of this repository into other projects.
