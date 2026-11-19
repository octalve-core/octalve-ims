# 0004 — Authentication is the Proplity design: short access JWT plus rotating opaque refresh token

Status: Proposed
Decided by: roji-tech (commit author; acceptance by the maintainer still needed) · Date: 2026-08-23
Recorded: 2026-10-21
Backfilled: commits `5f91970`, `4bd860e`, `9ec47ad`; plan in `docs/auth-system-port-plan.md`

## Context

The Stockly auth was one stateless JWT in a `session_id` cookie, looked up in the database on every request, with no refresh, no CSRF defence, no rate limiting and a free-text role. Proplity already had an audited design that fixes those gaps.

## Decision

- Authentication (who you are) is ported from Proplity wholesale; authorization (what you may do: `Role`, `Permission`, `can()`) is separate and unchanged.
- Access token: HS256 JWT signed with `jose`, 15 minutes, in the `access_token` cookie (`{ sub, role }`). Edge-compatible, so `proxy.ts` verifies it.
- Refresh token: opaque random value, SHA-256 hash stored in `RefreshToken`, rotated on every use, with reuse detection that revokes the whole `familyId`. Cookie path is `/api/auth/refresh`. `rememberMe` selects 30-day or 1-day lifetime.
- CSRF: Origin/Referer/Host comparison (`lib/auth/csrf.ts`), not tokens. Rate limiting is database-backed (`LoginAttempt`).
- Password reset has its own table (`PasswordResetToken`), not `VerificationToken`, so a reset never overwrites an invite link.
- `proxy.ts` only checks that the token is valid. It does not gate by role, because `/admin/*` is the shared shell for every role.
- Google OAuth had no Proplity equivalent; it mints the same cookie pair.

## Alternatives Considered

- **Keep the Stockly single-cookie session**: rejected in the plan's "Why" section for the missing refresh, CSRF and rate-limit protections.

## Consequences

- Proplity is the upstream: a fix there must be ported here by hand.
- Roughly 150 inline `role === "..."` checks remain in routes; the JWT role claim and the database role can disagree between refreshes.
- **Revisit if:** a second product needs the same auth, which would argue for a shared package instead of copies. AlEemaan ADR 0004 records the same "one canonical auth design, constants not shared" principle for that codebase.

## Enforced by

`review only`. Validation schemas have tests (`lib/validations/auth-api.test.ts`); there are no tests for refresh rotation, reuse detection, CSRF or rate limiting. The plan's verification checklist was manual.

## Binds

- `lib/auth/*`
- `app/api/auth/**`
- `proxy.ts`
- `utils/axiosInstance.ts`, `lib/api/client.ts`
- `contexts/auth-context.tsx`, `hooks/use-auth-refresh.ts`
- `prisma/schema/auth.prisma`
- `docs/auth-system-port-plan.md`
