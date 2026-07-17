# Engineering Decisions

**Ops / deploy:** [`docs/OPERATOR_RUNBOOK.md`](./OPERATOR_RUNBOOK.md) — Anonymous auth, RTDB rules, admins, Cloud Functions secrets, feature flags, mastery seed, legacy purge, AI status modes.  
**Cloud AI:** [`docs/AI_CLOUD_SETUP.md`](./AI_CLOUD_SETUP.md) · **Local AI:** [`docs/AI_LOCAL_SETUP.md`](./AI_LOCAL_SETUP.md)

## Architecture

```
GitHub Pages (static)      Firebase RTDB         Local Agent (WSL)
     │                         │                       │
     ├── push /requests/ ────► │                       │
     │                         ├── onChildAdded ──────► │
     │                         │                       ├── POST localhost:11434
     │                         │◄─── /responses/ ──────┤
     │◄─── /framework/*/responses                       │
```

**Key principle**: the browser never calls localhost directly. All AI requests go through Firebase RTDB, eliminating CORS issues entirely.

## Why Firebase RTDB instead of a proxy?

The original approach used a CORS proxy (Node.js) and a second Ollama instance on port 11435. This added complexity — two extra processes to manage. Firebase RTDB acts as a durable message queue: the browser writes a request, the agent picks it up, calls Ollama, and writes the response. The browser subscribes to the response path via real-time listener.

## Why no Python backend?

The original FastAPI backend handled scenarios, journal, progress, and quiz endpoints. Framework data, journal, progress, reviews, and AI now use Firebase RTDB (+ local agent for Ollama). The Python package under `backend/` is **legacy** (see `backend/LEGACY.md`); CI does not require it for the main product path.

## Identity & persistence (Phase 0–1)

- Capability flags: `frontend/src/lib/capabilities.ts` (`canUseFirebasePersistence` = `db != null`, not hostname)
- Auth: anonymous session on load via `AuthSessionProvider`; Google link for cross-device
- User data paths: `users/{uid}/journal|reviews|progress|viewed|quizResults|scenarioHistory|favoriteQuotes`
- Legacy device trees remain readable for migration, then purge (`scripts/purge-legacy-device-data.mjs`)
- Design: `docs/DESIGN_PHASE_0_1.md`

## Testing

| Suite | Command | CI |
|-------|---------|-----|
| Unit / component (Vitest) | `cd frontend && npx vitest run` | **Yes** — required green |
| Typecheck | `cd frontend && npx tsc --noEmit` | **Yes** |
| E2E smoke (Playwright) | `cd frontend && npm run test:e2e` | **Optional job** — `.github/workflows/e2e.yml` (`continue-on-error`) |

### Playwright e2e

- Config: `frontend/playwright.config.ts` (dev server on port **33221**)
- Specs: `frontend/e2e/` — includes `learning-loop.spec.ts` (home next-actions / review / session entry)
- Specs tolerate missing Firebase env (assert hero/review shells and optional `data-testid` regions)
- With `NEXT_PUBLIC_FIREBASE_*` set (e.g. `.env.local`), next-actions and SR panels appear when RTDB is reachable
- First run may need: `npx playwright install chromium`

Do **not** add Playwright to the default GitHub Actions job unless a dedicated optional workflow is added later — keep vitest CI stable and fast.

## Static Generation

Next.js 14 generates 360 pages at build time:
- 57 framework overview pages (`/frameworks/[slug]`)
- 282 concept detail pages (`/frameworks/[slug]/[conceptSlug]`)
- 6 scenario pages
- 15 static pages (home, frameworks browse, quiz, journal, pathway, quotes, review, calibration, profile, cheatsheet, simulator)

`generateStaticParams` reads from `slugs.json` which contains all framework slugs and their concept slugs. Build time ~20s.

## Cloud AI rate limiting

Per-uid sliding window enforced in the Cloud Function **before** the LLM call:

| Setting | Value |
|---------|--------|
| Limit | **20** cloud AI requests per uid |
| Window | **10 minutes** (sliding) |
| RTDB path | `_rate/{uid}` → `{ timestamps: number[] }` |
| Access | **Admin SDK only** — client rules deny all read/write on `_rate` |
| Scope | `provider === "cloud"` requests only (agent / local are not rate-limited here) |

**Behavior on limit:**
1. Function claims the request (`pending` → `processing`)
2. Transaction on `_rate/{uid}` rejects the new timestamp
3. Request set to `status: "error"` with `error` message on the request **and** response path
4. Frontend `waitForFirebaseResponse` rejects with that message (surfaces in UI)

Canonical message (keep Functions + frontend in sync):

> AI rate limit exceeded: maximum 20 cloud requests per 10 minutes. Please wait and try again.

Implementation: `functions/src/rate-limit.ts`, wired in `functions/src/handler.ts`. Frontend helpers: `AI_RATE_LIMIT_ERROR_MESSAGE`, `isRateLimitError` in `frontend/src/lib/ai/transport.ts`.

Client-side pre-check is intentionally **not** used: clients cannot read `_rate`. Debounce / max-concurrent UI controls remain a separate soft layer.

Redeploy RTDB rules after pulling this change (`scripts/update-rtdb-rules.cjs` or `firebase deploy --only database`).

## Remote feature flags

Path: `_config/feature_flags` (public read, admin write). Parent `_config` is deny-read so future siblings are not world-readable by default.

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `ai_provider_default` | `"agent"` \| `"local"` \| `"cloud"` | `"agent"` | Default AI provider when no Profile override |
| `cloud_ai_enabled` | boolean | `false` | Allow selecting / routing to cloud AI |
| `app_check_enforced` | boolean | `false` | Signal that App Check should be treated as enforced (see App Check below) |
| `mastery_graph_enabled` | boolean | `false` | Gate mastery graph / next-action engine (Phase 3) |
| `sr_session_enabled` | boolean | `false` | Gate spaced-repetition session UX (Phase 3) |

Frontend:
- `frontend/src/lib/feature-flags.ts` — `getFlag(key)`, `getFeatureFlags()`, `parseFeatureFlags`
- `frontend/src/components/FeatureFlagsProvider.tsx` — `useFeatureFlags()`; subscribes via `onValue`
- Wired in `app/layout.tsx` under `AuthSessionProvider`

Missing RTDB node or offline → safe defaults above. **No product behavior changes** until consumers gate on flags and ops set values in RTDB.

Ops steps to write flags in production: [`docs/OPERATOR_RUNBOOK.md`](./OPERATOR_RUNBOOK.md) §6.

Example seed (admin / console):
```json
{
  "ai_provider_default": "agent",
  "cloud_ai_enabled": false,
  "app_check_enforced": false,
  "mastery_graph_enabled": false,
  "sr_session_enabled": false
}
```

## Firebase App Check (scaffold)

Client scaffold lives in `frontend/src/lib/app-check.ts`.

**Init order (important for Console enforce):** `firebase.ts` calls `initAppCheckIfConfigured(app)` immediately after creating the Firebase app on the client, **before** `getAuth` / RTDB consumers run their effects. That way Auth and feature-flag listeners start after App Check is registered. `FeatureFlagsProvider` re-calls the same function only so the missing-key + `app_check_enforced` warning can fire after remote flags load (idempotent; no second SDK init).

| Piece | Behavior |
|-------|----------|
| `NEXT_PUBLIC_APPCHECK_SITE_KEY` | reCAPTCHA v3 **site** key. When set, client initializes App Check and auto-refreshes tokens. When **unset**, init is a no-op — local dev keeps working. |
| `NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN` | Optional. `true` (browser prompt) or a Console-registered **UUID** debug token for localhost. Other values are ignored with a console warn. Set only for dev when Console enforce is on. |
| RTDB flag `app_check_enforced` | Ops/UX signal that enforcement is intended. Default `false`. Does **not** by itself block traffic or gate client init. |
| Firebase Console → App Check → **Enforce** | **Actual blocking** for RTDB / Functions. Console Enforce alone is sufficient to reject token-less clients; enable only after clients ship tokens and debug tokens cover local/CI. |
| Failed init retry | After a failed `initializeAppCheck`, the client does **not** retry until full page reload (avoids thrash). |

**Safe rollout**

1. Register reCAPTCHA v3 in Firebase Console App Check; put the site key in `frontend/.env` (see `.env.example`).
2. Deploy the app so browsers attach tokens (eager init in `firebase.ts`).
3. Keep Console **enforce off** and `app_check_enforced: false` until traffic looks healthy (no token-less failure spike).
4. Register debug tokens for localhost / automation if needed (`true` or UUID only).
5. Turn on Console enforce for RTDB (and Functions when present), then set `_config/feature_flags.app_check_enforced` to `true` as the ops signal.

`firebase.ts` exports `app` (`FirebaseApp | null`) for App Check and other SDK init. Without Firebase env config or without the site key, nothing App Check-related runs.

## Firebase RTDB Structure

```
# Framework seed data
frameworks/{slug}
  → { id, title, description, category, difficulty, ... }
frameworks/{slug}/concepts/{id}
  → { id, name, definition, tags, example, ... }
_meta/framework_slugs
  → ["strategic-decision-making", "financial-mastery", ...]

# Runtime config (public read, admin write)
_config/feature_flags
  → { ai_provider_default, cloud_ai_enabled, app_check_enforced, mastery_graph_enabled, sr_session_enabled }

# Per-uid cloud AI rate limit (Admin SDK only; clients denied)
_rate/{uid}
  → { timestamps: number[] }  # sliding window (20 / 10 min)

# AI enrichment (per concept, per category)
framework/{slug}/{concept}/{category}/{requestId}
  → { result, model, prompt, created_at }

# AI request/response
requests/{requestId}
  → { type, category, payload, status, created_at }
  Agent writes response to the appropriate path based on request type:
  - framework/{slug}/{concept}/{category}/{id} (enrichment)
  - conceptChats/{id} (chat/tutor/socratic/teachback/analogy/simulator/blindspot/brief)
  - comparisons/{frameworkSlug}/{slugA}/{slugB}/{mode}/{id} (comparison/cross-pollination)
  - scenario-evaluations/{id} (scenario feedback)
  - quotes/generated/{id} (quote generation)

# Concept comparison (saved with pagination)
comparisons/{frameworkSlug}/{conceptA}/{conceptB}/{mode}/{requestId}
  → { result, model, prompt, created_at }

# Mastery graph (Phase 3 — public read, admin write)
mastery/edges/{fromConceptId}/{toConceptId}
  → { type: "requires"|"reinforces"|"applied_in", weight: number ∈ [0,1] }
  # requires: from depends on to (learn `to` before `from`) — directed
  # reinforces: soft mutual link — seed stores BOTH directions (same weight)
  # applied_in: from is practiced when learning to (often cross-framework)
  # Edges are curated pedagogical heuristics, not strict curriculum order
mastery/concepts/{conceptId}
  → { frameworkSlug, conceptSlug, difficulty?, tags? }
  # conceptId = slugify(concept name), same as URL conceptSlug
_meta/mastery_graph
  → { version, edgeCount, conceptCount, frameworks[], seededAt, policy: "replace" }

# Per-device data
journal/{deviceId}/entries/{id}
progress/{deviceId}
viewed/{deviceId}/{frameworkSlug}/{conceptId}
quizResults/{deviceId}/{resultId}
reviews/{deviceId}/{conceptId}
  → { nextReviewAt, reviewCount, interval, easeFactor, ... }
favoriteQuotes/{deviceId}/{quoteId}
scenarioHistory/{deviceId}/{slug}/{attemptId}
```

Note: `framework/` (no 's') holds AI enrichment data. `frameworks/` (with 's') holds seed data. Both need separate RTDB rules.

### Seeding the mastery graph

Source of truth for the minimal seed is `frontend/src/data/mastery-edges.json` (types in `frontend/src/lib/mastery/types.ts`). Covers at least two frameworks (~15–30 edges).

**Replace policy (not merge):** re-seeding nulls out RTDB edges/concepts that are no longer in the seed JSON, then writes the current graph in one atomic `update()`. `_meta/mastery_graph.edgeCount` / `conceptCount` always match live graph size after a successful seed.

Prefer an explicit service-account path:

```bash
# Validate only (no credentials needed)
node scripts/seed-mastery-graph.mjs --dry-run

# Push to RTDB (Admin SDK)
# Preferred: explicit key path
GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccount.json node scripts/seed-mastery-graph.mjs

# Fallback: single *firebase*adminsdk*.json or serviceAccount*.json in agent/
# (fails if multiple candidates — set GOOGLE_APPLICATION_CREDENTIALS instead)
node scripts/seed-mastery-graph.mjs
```

After changing `database.rules.json`, redeploy rules:

```bash
node scripts/update-rtdb-rules.cjs
```

Full operator sequence (rules + admins + flags + seed + purge): [`docs/OPERATOR_RUNBOOK.md`](./OPERATOR_RUNBOOK.md).

## Cache Strategy

- **Framework cache** (`rtdb-cache.ts`): Single RTDB read fetches all 57 frameworks + concepts. Cached at module level, eager-loaded in ThemeProvider on app mount. `loadPromise` is reset on error so subsequent calls retry.
- **AI response cache** (`ollama.ts`): Frontend checks `/framework/{slug}/{concept}/{category}` before pushing new request. TTL: 24 hours. Full prompt stored alongside result for admin editing. "Re-generate" always bypasses cache via `skipCache` flag.
- **Comparison cache**: Saved to `comparisons/{frameworkSlug}/{slugA}/{slugB}/{mode}/{requestId}`. Pagination via `CatPageNav` component. Entries loaded on page mount.

## Agent Startup

The agent uses `setsid` to fully detach from the shell:
```bash
setsid node index.js
```

On startup, it sweeps stale "processing" requests (older than 5 minutes) back to "pending", then registers the `on("child_added")` listener. This ensures stale requests get processed after restart.

## Auth

- Firebase Auth with Google provider
- Admin determined by email `kevinkicho@gmail.com`
- Admin can edit cached prompts (inline textarea → write to RTDB)
- RTDB rules restrict `framework/*/responses` writes to authenticated admin
- Popup sign-in with redirect fallback (handles `auth/popup-blocked`)

## Sidebar

File-tree panel showing all 57 frameworks with collapsible concept lists:
- Expand/collapse fully independent from main view
- Real-time search filters across 282 concepts
- Mobile: slide-in drawer via FAB button
- Desktop: sticky sidebar, w-72

## AI Prompts

Each prompt includes framework context:
- Domain, difficulty, use cases, related concepts
- System prompt specialized per task: `explain` vs `quiz`
- Stored in indexed response for review/editing

## AI Pipeline

All AI requests follow the same flow:
1. Frontend writes request to `requests/{requestId}` in RTDB
2. Agent's `on("child_added")` picks it up
3. Agent calls Ollama at `localhost:11434/api/generate` (streaming ndjson)
4. Agent writes result to the appropriate response path
5. Frontend's `onValue` listener picks up the response
6. Frontend parses JSON and updates UI

The agent routes responses based on request data:
- `category` + `framework_slug` + `concept_slug` → `framework/{s}/{c}/{cat}/{id}`
- `compare_response_path` → `comparisons/{...}/{id}`
- `type === "concept_chat"` → `conceptChats/{id}`
- `category === "quote"` → `quotes/generated/{id}`
- `category === "scenario"` → `scenario-evaluations/{id}`

## Testing

101 unit tests across 9 files:
- SM-2 spaced repetition algorithm
- Firebase CRUD operations (reviews, journal, progress)
- API client (framework loading, scenarios, quiz)
- Page import validation (all 15+ pages)
- Framework cache (loadFrameworks, getCachedFrameworks, slugify)
- waitForFirebaseResponse (resolve, timeout, progress)
- ScenarioEngine component
- ChatPanel component

Test setup mocks: `crypto.randomUUID`, `localStorage`, Firebase module, axios.
