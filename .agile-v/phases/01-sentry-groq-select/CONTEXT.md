# Phase 01 Context

## Stack

Next.js 16 App Router, Prisma/MongoDB, TanStack Query, shadcn/Radix, Sentry, OpenRouter+Groq.

## Key paths

| Area | Path |
|------|------|
| AI | `lib/ai/` |
| Select gate | `components/shared/DeferredSelectGate.tsx` |
| Notifications | `components/shared/NotificationBell.tsx` |
| Invalidation | `lib/react-query/invalidate-all.ts` |
| Sentry issues | `docs/SENTRY_ERRORS.md` |

## Do not

- Skip REQ-XXXX on new work
- Add route Suspense on `/`
- Commit `.env` secrets
