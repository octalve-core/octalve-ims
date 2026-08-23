# Test Specification — Cycle C1

| TC-ID | REQ-ID | Type | Description | Command / path |
|-------|--------|------|-------------|------------------|
| TC-0001 | REQ-0002 | unit | OpenRouter 402 typed failure | `lib/ai/openrouter.test.ts` |
| TC-0002 | REQ-0005 | unit | Groq success + model resolution | `lib/ai/groq.test.ts` |
| TC-0003 | REQ-0005 | unit | Orchestrator 402→Groq fallback | `lib/ai/create-chat-completion.test.ts` |
| TC-0004 | REQ-0003 | unit | Unique username generation | `lib/auth/unique-username.test.ts` |
| TC-0005 | ALL | audit | TanStack invalidation coverage | `npm run test:invalidate` |
| TC-0006 | REQ-0001 | manual | Nav with open Select, no removeChild | browser console |
| TC-0007 | REQ-0007 | manual | Bell dropdown visible, no double scrollbar | browser |
| TC-0008 | REQ-0005 | integration | POST `/api/ai/insights` 200 + provider | production |
