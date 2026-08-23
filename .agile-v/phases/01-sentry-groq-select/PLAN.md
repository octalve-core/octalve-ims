# Phase 01 — Sentry, Groq, Select gates, Notifications

**Cycle:** C1 | **REQs:** REQ-0001 … REQ-0009

## Waves

| Wave | Tasks | REQ-IDs | Status |
|------|-------|---------|--------|
| W1 | Sentry P1–P4 (removeChild, 402, OAuth, hydration) | 0001–0004 | done |
| W2 | Groq orchestrator + env | 0005 | verify |
| W3 | DeferredSelectGate all surfaces | 0001, 0006 | verify |
| W4 | Notification portal fix | 0007 | verify |
| W5 | Agile V bootstrap | 0008 | done |
| W6 | Post-deploy Sentry 24h | 0009 | planned |

## Architecture constraints

- SSR: `force-dynamic`, server in `page.tsx`
- TanStack: `invalidateAllRelatedQueries` on CRUD
- No new summary `.md` at repo root (use `.agile-v/`)
