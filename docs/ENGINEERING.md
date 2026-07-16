# Engineering Decisions

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

## Static Generation

Next.js 14 generates 360 pages at build time:
- 57 framework overview pages (`/frameworks/[slug]`)
- 282 concept detail pages (`/frameworks/[slug]/[conceptSlug]`)
- 6 scenario pages
- 15 static pages (home, frameworks browse, quiz, journal, pathway, quotes, review, calibration, profile, cheatsheet, simulator)

`generateStaticParams` reads from `slugs.json` which contains all framework slugs and their concept slugs. Build time ~20s.

## Firebase RTDB Structure

```
# Framework seed data
frameworks/{slug}
  → { id, title, description, category, difficulty, ... }
frameworks/{slug}/concepts/{id}
  → { id, name, definition, tags, example, ... }
_meta/framework_slugs
  → ["strategic-decision-making", "financial-mastery", ...]

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
