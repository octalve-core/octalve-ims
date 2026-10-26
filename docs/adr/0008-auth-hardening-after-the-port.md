# 0008: Auth hardening after the port: a database limiter for credential routes, a refresh grace window, inherited session length

Status: Proposed
Decided by: not yet (drafted by an agent after comparing IMS with Proplity; acceptance by the maintainer needed) · Date: 2026-10-26
Recorded: 2026-10-26
Backfilled: no, written with the change (task 0004)

## Context

[ADR 0004](0004-auth-is-a-port-of-proplity-with-rotating-refresh-tokens.md) adopted Proplity's auth design in August. It says rate limiting is database-backed; in the code it was the Redis presets, which allow every request when Redis is absent or errors, check and record in separate calls, and keyed login by email alone. Proplity kept improving after the port (its September auth review and October security sweep): refresh rotation inherits the session's expiry and has a short grace window, logout works with an expired access token, login compares against a dummy hash, the limiter is in Postgres under an advisory lock. IMS had none of these (register ISS-0027, 0028, 0029, 0032, 0033).

## Decision

- The routes that guess credentials or send mail (login, refresh, register, forgot-password, reset-password, change-password) use `lib/auth/rate-limit-db.ts`: a sliding window in the existing `LoginAttempt` table under `pg_advisory_xact_lock`, failing closed because it is the database, handing a slot back on success. Ordinary API routes keep the Redis limiter (`lib/api/rate-limit.ts`), which now keys on the address only, never a client-sent header.
- The client address is the last `X-Forwarded-For` hop. This assumes exactly one trusted proxy (Vercel); behind more, it must be revisited.
- Refresh rotation keeps the old token's expiry and sets the cookie's lifetime to what is left; there is no sliding extension.
- A refresh token rotated under 5 seconds ago may be exchanged once more (atomic claim of its successor); later replays still revoke the whole family.
- Logout identifies the user from an expired but correctly signed access token. Nothing else may use that.
- Login and forgot-password do the same work and give the same answer whether or not the email has an account.

## Alternatives Considered

- **Make the Redis limiter fail closed on auth presets.** Rejected: local and test environments have no Redis, and a Redis outage would then lock everyone out of login.
- **Keep sliding expiry (a fresh 7 days on each refresh).** Rejected: "keep me signed in" off or on both ended at 7 days, and a stolen rotating token lived forever.
- **Per-IP login limit only.** Rejected: a shared office address would lock out its own staff; the per-account budget catches distributed guessing instead.

## Consequences

- Every login attempt writes a row to Postgres and takes a lock; `LoginAttempt` is pruned per identifier on each reservation. If this becomes a cost, move the auth limiter to Redis with an atomic script and fail closed only on those routes.
- A 5-second window in which a stolen, just-rotated token can be replayed once. Accepted, same as Proplity's ADR-0016.
- Access tokens still have no `jti`, so they work until they expire after logout or a password change (ISS-0033, second half).
- **Revisit if:** the app is put behind more than one trusted proxy; user suspension or email verification is added (the refresh and login checks Proplity has would then be ported).
