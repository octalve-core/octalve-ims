# Phase 5 — Redis configuration review and hardening

**Status:** Complete and verified. **Date:** 2026-08-26.

## Why

Another agent had configured local TCP Redis (`ioredis`, `REDIS_URL`) alongside
the project's existing Upstash HTTP-REST Redis client, via a `UnifiedRedisClient`
adapter (`lib/cache/redis.ts`). The user asked for a review of that work for
bugs before trusting it.

## What was found (4 confirmed issues)

1. **No `.on('error', ...)` listener on the ioredis client** — Node kills the
   whole process when an EventEmitter's `'error'` event fires with no
   listener attached. Any Redis connection blip (restart, network hiccup)
   would crash the entire Next.js server, not just disable caching —
   directly contradicting the module's own "graceful degradation" design
   goal, and worse than the pre-existing Upstash-only behavior.
2. **`retryStrategy` gave up permanently after ~3 attempts**, and the
   module-level singleton then held onto that dead client forever — a
   transient Redis restart would silently and permanently disable caching
   and rate-limiting for the life of the process, recoverable only by an app
   restart.
3. **Type-corruption bug in the ioredis adapter**: `set()`/`setex()` stored
   plain strings raw (unstringified) while `get()` always attempted
   `JSON.parse` — a cached string that happened to itself be valid JSON
   (`"123"`, `"true"`, `"null"`) came back as a different type after a round
   trip. Didn't exist on the Upstash path — same call, different behavior
   depending on which env var was set.
4. **Eager TCP client is a Vercel-serverless anti-pattern**: `lazyConnect:
   false` opens a persistent connection per invocation, which exhausts a
   Redis server's connection limit under real serverless traffic — exactly
   the problem the existing Upstash HTTP client was originally chosen to
   avoid. Only a latent risk today (project runs Redis locally), but real if
   `REDIS_URL` were ever pointed at a hosted instance in a Vercel deployment.

## Fixes applied

- `ioClient.on("error", ...)` — logs instead of crashing.
- `retryStrategy` now backs off with a cap (200ms × attempt, capped at 5s)
  and never returns `null` — self-heals after an outage instead of
  permanently disabling itself.
- `IORedisAdapter.set`/`setex` always `JSON.stringify`, closing the
  type-corruption gap.
- `getRedisClient()` now checks `process.env.VERCEL` (set automatically in
  every Vercel environment) and skips the `REDIS_URL`/ioredis path entirely
  there, always preferring Upstash — verified by simulating `VERCEL=1`
  against a `.env` with only `REDIS_URL` set: correctly returned `null`
  (safe degradation) instead of attempting the TCP client.

## Verification

`tsc --noEmit`, `pnpm script:test-redis` (PING/GET/SET/SCAN round trip),
`pnpm test lib/cache/` (18/18), and a manual `VERCEL=1` simulation confirming
the serverless guard actually engages.

## Left deliberately unfixed (flagged, not silently ignored)

The Upstash adapter's `as any` casts on `scan`/`zrange`/`zadd` (introduced
when the other agent "fixed" TypeScript errors by casting rather than using
ioredis's real typed overloads) — cosmetic type-safety gap, not a functional
bug, and that path isn't in active use in this deployment.
