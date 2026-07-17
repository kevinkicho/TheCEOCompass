# CEO Compass — Phase 5: Callable Cloud AI, Pack Expansion, E2E CI

| Field | Value |
|-------|-------|
| **Date** | 2026-07-16 |
| **Status** | Implemented on `master` |
| **Prerequisite** | Phases 0–4 |

## Goals

1. **Callable HTTPS AI** — authenticated `generateAI` Cloud Function (no RTDB wait for cloud path).
2. **More scenario packs** — expand coverage beyond core/finance/negotiation/ops/innovation/people/strategy.
3. **Playwright CI job** — optional workflow; does not block main vitest CI.

## Design

### Callable AI

```
Browser (provider=cloud)
  → httpsCallable("generateAI")  [auth.uid required]
  → rate limit `_rate/{uid}`
  → OpenAI-compatible LLM (secrets)
  → { text, model, source: "callable" }
```

RTDB `processAIRequest` remains for agent/cloud dual-write clients and offline resilience.  
Cloud provider prefers callable; falls back to RTDB trigger on callable failure.

### Scenario packs

Add packs: `marketing`, `governance`, `culture` (3 multi-stage scenarios).

### Playwright

`.github/workflows/e2e.yml` — install browsers, `npm run test:e2e` for `learning-loop.spec.ts`.  
`continue-on-error: true` so main `ci.yml` stays the merge gate.

## Non-goals

- Billing, multi-tenant SaaS
- Replacing RTDB agent bus entirely
