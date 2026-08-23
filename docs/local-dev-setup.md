# Local dev Postgres setup

Postgres 16 is running natively on this machine (systemd, port 5432).

## What's actually configured

Using the existing `roji` role (already set up for another project on this machine) rather than creating dedicated `ims_migrator`/`ims_app` roles — confirmed via `select rolsuper, rolbypassrls from pg_roles where rolname = 'roji'` that `roji` is **not** a superuser and does **not** have `BYPASSRLS`. That matters: Postgres skips Row-Level Security policies for the table owner by default, but `ALTER TABLE ... FORCE ROW LEVEL SECURITY` overrides that for any non-superuser, non-BYPASSRLS role — including the owner. Since `roji` is neither, one role is enough; the originally-planned two-role split (`ims_migrator` owns tables, `ims_app` runs queries) turned out to be unnecessary complexity for this setup specifically.

Database: `octalve_ims`, created via `createdb -h localhost -U roji octalve_ims`.

`.env`:
```
DATABASE_URL="postgresql://roji:roji@localhost:5432/octalve_ims"
JWT_SECRET="dev_octalve_ims_jwt_secret_change_in_production"
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

Migration already applied: `prisma/migrations/20260823151908_init_postgres/`.

## Row-Level Security

Applied manually via `psql` (Prisma doesn't manage RLS policies):
```bash
PGPASSWORD=roji psql -h localhost -U roji -d octalve_ims -f prisma/rls/001_enable_rls.sql
```
Proven on `Product` only in Milestone 0, not rolled out to all tenant-scoped tables yet — see `prisma/rls/001_enable_rls.sql` for the policy and `lib/server/tenant-prisma.ts` for the session-variable injection mechanism.

## If this role ever needs replacing

If `roji` stops being available (e.g. a machine reset, or wanting real isolation from the other project sharing this role), recreate with:
```sql
CREATE ROLE ims_app WITH LOGIN PASSWORD '<pick>' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE octalve_ims OWNER ims_app;
```
and update `DATABASE_URL` accordingly — everything else in this doc stays the same, since `FORCE ROW LEVEL SECURITY` doesn't care whether the connecting role is the owner or not.
