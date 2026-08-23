# Local dev Postgres setup

Postgres 16 is already running natively on this machine (systemd, port 5432). This project needs a dedicated database and **two** roles — not one — because of an RLS-bypass trap: Postgres Row-Level Security is bypassed by default for the table owner, so the app must connect as a role that does *not* own the tables.

## 1. Create the roles and database

Run interactively (you'll be prompted for the Postgres admin password):

```bash
sudo -u postgres psql
```

Then at the `psql` prompt:

```sql
CREATE ROLE ims_migrator WITH LOGIN PASSWORD '<pick a password>';
CREATE ROLE ims_app WITH LOGIN PASSWORD '<pick a different password>' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE ims_dev OWNER ims_migrator;
\c ims_dev
GRANT USAGE ON SCHEMA public TO ims_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ims_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ims_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ims_app;
\q
```

## 2. Create `.env`

Copy `.env.example` to `.env` and set (adjust passwords to what you picked above):

```
DATABASE_URL="postgresql://ims_migrator:<migrator-password>@localhost:5432/ims_dev"
RUNTIME_DATABASE_URL="postgresql://ims_app:<app-password>@localhost:5432/ims_dev"
```

`DATABASE_URL` (migrator/owner) is used for `prisma migrate`/`prisma generate`. `RUNTIME_DATABASE_URL` (non-owner `ims_app`) is what the running app and `lib/server/tenant-prisma.ts` actually connect with — this split exists specifically so `FORCE ROW LEVEL SECURITY` policies actually apply to the app's own queries.

## 3. Run the migration

```bash
pnpm prisma migrate dev --name init_postgres
```

This is a fresh baseline (no Mongo data is being migrated — schema only).

## 4. Apply Row-Level Security

Prisma doesn't manage RLS policies, so this is a separate manual step:

```bash
psql "$DATABASE_URL" -f prisma/rls/001_enable_rls.sql
```

---

Tell me once step 1 (the interactive `sudo -u postgres psql` block) is done — I'll take it from there (steps 2–4, plus everything else in `out/auth-system-port-plan.md` and the Milestone 0 plan that doesn't need a live DB connection).
