# CEO Compass

**[Live Site →](https://kevinkicho.github.io/TheCEOCompass/)**

57 leadership frameworks, 282 concepts. AI-powered concept enrichment, Socratic tutor, spaced repetition, decision simulator, and interactive scenarios. Static GitHub Pages site with Firebase RTDB bridging to local Ollama, plus PWA service worker for offline support.

---

## Architecture

```
Browser (GitHub Pages / Local)    Firebase RTDB           Local Agent (WSL)         Ollama
        │                              │                        │                      │
        ├── push /requests/ ─────────► │                        │                      │
        │                              ├── onChildAdded ──────► │                      │
        │                              │                        ├── POST ────────────► │
        │                              │◄─── write result ──────┤                      │
        │◄─── onValue on               │                        │                      │
        │    framework/{s}/{c}/{cat}/{id}                       │                      │
        │                              │                        │                      │
        ├── SW cache (static + Firebase reads)                  │                      │
        └── Real-time WebSocket (onChildAdded) ─────────────────┘                      │
```

| Layer | Tech | Purpose |
|-------|------|---------|
| Frontend | Next.js 14.2 (static export) + TypeScript + Tailwind | 360 SSG pages |
| PWA | Service Worker (`sw.js`) | Cache-first static, SWR Firebase, offline fallback |
| Data | Firebase RTDB | Frameworks + AI bus + **user learning data** |
| AI bridge | Firebase RTDB → local agent → Ollama | Browser → Firebase → agent → Ollama → Firebase → browser |
| Local agent | Node.js + firebase-admin | Watches `/requests`, writes heartbeat + results |
| Auth | Firebase Auth (anonymous + Google link) | Private `users/{uid}/…` trees; admin via `admins/{uid}` |
| Nav | Learn / Practice / Reflect | Stable URLs; home “Next actions” dashboard |
| Cache | `rtdb-cache.ts` (single-read, in-memory) | All 57 frameworks loaded in 1 RTDB read, cached for session |

### Identity & persistence (production)

- **Anonymous session** on first visit (enable Anonymous in Firebase Console).
- Learning data at `users/{auth.uid}/journal|reviews|progress|viewed|…` (not device-only).
- Link Google for cross-device continuity; export/import JSON on Profile.
- AI requests include `uid`; RTDB rules require owner create-only on `/requests`.
- Design (done): [`docs/DESIGN_PHASE_0_1.md`](docs/DESIGN_PHASE_0_1.md)
- Design (next): [`docs/DESIGN_PHASE_2_3.md`](docs/DESIGN_PHASE_2_3.md) — Phase 2 cloud AI + Phase 3 mastery/scenarios/SR; run with `/execute-plan docs/DESIGN_PHASE_2_3.md`

### Docs & operator runbook

| Doc | Purpose |
|-----|---------|
| [`docs/OPERATOR_RUNBOOK.md`](docs/OPERATOR_RUNBOOK.md) | **Production ops:** Anonymous auth, deploy RTDB rules, bootstrap admins, Cloud Functions + secrets, feature flags, mastery seed, legacy purge, AI status modes |
| [`docs/AI_CLOUD_SETUP.md`](docs/AI_CLOUD_SETUP.md) | Deploy / configure cloud AI (`processAIRequest`) |
| [`docs/AI_LOCAL_SETUP.md`](docs/AI_LOCAL_SETUP.md) | Local agent + Ollama |
| [`docs/ENGINEERING.md`](docs/ENGINEERING.md) | Architecture decisions, RTDB map, flags, mastery seed notes |

### No hardcoded data

All framework and concept data lives in Firebase RTDB at `frameworks/{slug}`. A minimal `framework-meta.json` exists only for SSG build-time `generateStaticParams()`. When Firebase is unavailable, the app shows clear error messages — no silent fallback to mock data.

---

## Run Locally (Full Experience)

The live GitHub Pages site serves the static UI with Firebase data, but AI-powered features require the local Node.js agent + Ollama.

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Node.js](https://nodejs.org/) | ≥ 18 (≤ 22 recommended) | Frontend + agent |
| [Ollama](https://ollama.ai/) | Latest | Local LLM |
| Ollama model | `gemma4:latest` (or any chat model) | AI inference |
| Firebase service account | From [Firebase Console](https://console.firebase.google.com/) | RTDB access |
| `.env` file | `frontend/.env` | Firebase config vars |

### Step-by-step

```bash
# 1. Clone and enter
git clone https://github.com/kevinkicho/TheCEOCompass.git
cd TheCEOCompass

# 2. Start Ollama (Terminal 1)
ollama run gemma4:latest
# Keeps model loaded on port 11434

# 3. Start the agent (Terminal 2)
cd agent
npm install
# Place serviceAccountKey.json (from Firebase Console → Project Settings → Service Accounts) in agent/
node index.js
# Watches Firebase RTDB /requests, calls Ollama, writes results + agent heartbeat

# 4. Start the frontend (Terminal 3)
cd frontend
cp .env.example .env   # fill in NEXT_PUBLIC_FIREBASE_* values
npm install --legacy-peer-deps
npm run dev            # → http://localhost:33221
```

### Verify everything is running

```bash
# Ollama responds
curl http://localhost:11434/api/tags
# → {"models": [{"name": "gemma4:latest", ...}]}

# Agent is listening (logs show)
# → ✓ Agent connected to Firebase RTDB

# Frontend loads
# → Open http://localhost:33221 in browser
```

### Pre-commit validation

Before pushing, run the full validation suite:

```bash
bash scripts/pre-commit-check.sh
```

This runs 4 checks: TypeScript, ESLint, vitest (101 tests), Next.js build. All must pass.

### Seeding data to RTDB

If RTDB needs framework/concept data:

```bash
# 1. Export framework data to JSON
cd frontend && npx tsx -e "import { getCachedFrameworks } from './src/lib/rtdb-cache'; import { writeFileSync } from 'fs'; ..."

# 2. Push to RTDB
cd ../agent && node seed-rtdb.mjs
# → Done! 57 frameworks with concepts pushed to RTDB.
```

### Deploying RTDB security rules

```bash
# Place service account JSON in agent/ (update-rtdb-rules does not use GOOGLE_APPLICATION_CREDENTIALS)
node scripts/update-rtdb-rules.cjs
```

Full ops sequence (auth, rules, admins, functions, flags, mastery seed): [`docs/OPERATOR_RUNBOOK.md`](docs/OPERATOR_RUNBOOK.md) §3.

---

## Routes

| Route | Content | Type |
|-------|---------|------|
| `/` | Landing page | Static |
| `/frameworks` | Browse 57 frameworks | Static |
| `/frameworks/[slug]` | Framework overview | SSG (57 pages) |
| `/frameworks/[slug]/[conceptSlug]` | Concept detail + 8 AI enrichment sections | SSG (282 pages) |
| `/scenarios` | Browse 6 scenarios | Static |
| `/scenarios/[slug]` | Scenario engine (AI coaching) | SSG (6 pages) |
| `/simulator` | AI Decision Simulator | Static |
| `/quiz` | AI-generated quiz | Static |
| `/journal` | Decision journal (Firebase CRUD) | Static |
| `/pathway` | Learning pathway (Firebase progress) | Static |
| `/quotes` | Flip-card quotes + AI generation | Static |
| `/review` | Weekly review + AI Learning Brief + spaced repetition due | Static |
| `/calibration` | Confidence-vs-accuracy chart | Static |
| `/profile` | Settings + Google Sign-In + Blind Spot Analysis | Static |
| `/cheatsheet` | Quick reference modal | Static |

360 pages statically generated at build time.

---

## Key Features

### AI Learning Tools (7 modes)

| Feature | Location | Input | Output |
|---------|----------|-------|--------|
| **Concept Tutor** | Concept page → "Ask AI" tab | Chat | Plain text |
| **Socratic Tutor** | Concept page → "Socratic Tutor" tab | Chat (AI asks you) | Plain text |
| **Teach Back** | Concept page → "Teach Back" tab | Textarea explanation | JSON (clarity/depth/gaps/improvement) |
| **Analogy Engine** | Concept page → "Analogy" tab | Domain picker (chef/general/musician...) | 3 creative analogies |
| **Cross-Pollination** | Concept page → Compare toggle | Concept selector | Synthetic insight + blind spots + combined heuristic |
| **Decision Simulator** | `/simulator` | Business challenge description | Framework analysis + action memo |
| **Blind Spot Detector** | `/profile` → "Run Analysis" | Firebase learning data | Gaps (by severity) + strengths + next focus |
| **Weekly Learning Brief** | `/review` → "Generate Brief" | Week's learning data | Personalized coaching brief |

### Spaced Repetition (SM-2)

- "Mark as Reviewed" button on each concept page
- 4-button rating: Again / Hard / Good / Easy
- SM-2 algorithm computes next review interval
- "Concepts Due for Review" section on `/review` page

### Per-Category AI Enrichment (8 sections)

Each concept has 8 independently-generated AI content sections with sparkle buttons, pagination, and real-time updates:

- **Explain Further** — 4-field cards (Real-World Example, CEO Insight, Common Mistake, Quick Tip) with pagination
- **Why It Matters** — Strategic relevance to CEOs
- **How To Apply** — 3 actionable steps
- **Common Pitfalls** — 2 mistakes to avoid
- **Connected Concepts** — 2 related concepts with relationships
- **Case Study** — Real company application
- **Test Yourself** — Interactive exercise with explanation
- **Real-World Examples** — 3 company-specific examples

### Other Features

- **PWA Service Worker** — Cache-first static assets, stale-while-revalidate Firebase data, offline fallback
- **File-tree sidebar** — 57 frameworks with collapsible concept lists, mobile drawer
- **Per-category pagination** — `< 1/4 >` controls to flip through multiple AI responses
- **Real-time updates** — `onChildAdded` listeners pick up new AI responses without refresh
- **Prompt tooltip** — View exact prompt sent to Ollama (admin can edit)
- **Concept comparison** — Compare any 2 concepts side-by-side with saved history and pagination
- **Cross-Pollination** — Find hidden connections between concepts from different frameworks
- **Decision journal** — Full CRUD via Firebase RTDB with outcomes and calibration
- **Learning pathway** — Data-driven ordering, Firebase progress tracking
- **Quotes** — 20 static + AI-generated, favorites, admin edit/delete
- **Quiz** — Per-framework, AI-generated multiple-choice
- **Scenario engine** — Multi-stage branching with AI coaching feedback
- **Calibration dashboard** — Confidence-vs-accuracy chart from journal outcomes
- **Google Sign-In** — Popup with redirect fallback, admin prompt editing
- **Dark mode** — Class-based with localStorage persistence
- **Error handling** — All AI features show visible red error banners

---

## RTDB Structure

```
# Framework seed data
frameworks/{slug}                    → { id, title, description, category, difficulty, ... }
frameworks/{slug}/concepts/{id}      → { id, name, definition, tags, example, ... }
_meta/framework_slugs                → ["strategic-decision-making", "financial-mastery", ...]

# AI enrichment (per concept, per category)
framework/{slug}/{concept}/
  explain_further/{id}               → { result, model, prompt, created_at }
  why_it_matters_for_ceos/{id}
  how_to_apply/{id}
  common_pitfalls/{id}
  connected_concepts/{id}
  case_study/{id}
  test_yourself/{id}
  real_world_examples/{id}

# AI request/response
requests/{requestId}                 → { type, category, payload, status, created_at }
conceptChats/{requestId}             → { result, model, prompt, created_at }
scenario-evaluations/{requestId}
quotes/generated/{id}

# Concept comparison (saved with pagination)
comparisons/{frameworkSlug}/{conceptA}/{conceptB}/{mode}/{requestId}
  → { result, model, prompt, created_at }

# Per-device data
journal/{deviceId}/entries/{id}
progress/{deviceId}
viewed/{deviceId}/{frameworkSlug}/{conceptId}
quizResults/{deviceId}/{resultId}
reviews/{deviceId}/{conceptId}       → { nextReviewAt, reviewCount, interval, easeFactor, ... }
favoriteQuotes/{deviceId}/{quoteId}
scenarioHistory/{deviceId}/{slug}/{attemptId}
```

Note: `framework/` (no 's') holds AI enrichment data. `frameworks/` (with 's') holds seed data. Both need separate RTDB rules.

---

## PWA Service Worker

| Request type | Strategy | Effect |
|---|---|---|
| Static assets (`_next/static/*`) | Cache-first | Instant load on repeat visits |
| HTML pages | Network-first | Fresh HTML, cache fallback for offline |
| Firebase RTDB reads | Stale-while-revalidate | Cached data instantly, fresh in background |
| Firebase Auth | Network-only | Never cache auth tokens |
| Real-time (`onChildAdded`) | SW can't intercept (WebSocket) | Works as-is |

The SW registers only on production (skips localhost). Auto-updates every 60 seconds.

---

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/pre-commit-check.sh` | Full validation: tsc + lint + vitest + build |
| `scripts/update-rtdb-rules.cjs` | Deploy `database.rules.json` to Firebase RTDB |
| `agent/seed-rtdb.mjs` | Push framework/concept data to RTDB from `/tmp/frameworks.json` |
| `scripts/enrich-concepts.mjs` | Batch-generate enrichment fields via Ollama (282 concepts) |
| `scripts/enrich-explain.mjs` | Batch-generate explain_further content via Ollama |
| `scripts/push-enrichments-to-rtdb.mjs` | Push enrichment JSON to RTDB |

---

## File Structure

```
ceo-platform/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── frameworks/[slug]/[conceptSlug]/page.tsx   # Concept detail + 8 AI sections + 4 learning modes
│   │   │   ├── simulator/page.tsx                          # AI Decision Simulator
│   │   │   ├── review/page.tsx                             # Weekly review + spaced repetition + AI brief
│   │   │   ├── profile/page.tsx                            # Settings + auth + blind spot analysis
│   │   │   └── ...
│   │   ├── components/
│   │   │   ├── ChatPanel.tsx                               # Shared chat UI (tutor, socratic, simulator)
│   │   │   ├── AppSidebar.tsx                              # File-tree sidebar
│   │   │   ├── sw.js / sw-register.js (in public/)         # PWA service worker
│   │   │   └── __tests__/                                  # Vitest test suites (101 tests)
│   │   ├── lib/
│   │   │   ├── rtdb-cache.ts                               # Single-read framework cache
│   │   │   ├── ollama.ts                                   # AI: 8 generators + 7 learning tools + quiz
│   │   │   ├── spaced-repetition.ts                        # SM-2 algorithm
│   │   │   ├── firebase-crud.ts                            # Journal, reviews, pathway, quiz CRUD
│   │   │   ├── firebase.ts                                 # Firebase init (RTDB + Auth)
│   │   │   ├── useAuth.ts                                  # Google Sign-In (popup + redirect fallback)
│   │   │   └── api.ts                                      # Framework list/detail (from cache)
│   │   └── data/
│   │       ├── framework-meta.json                         # Minimal slugs for SSG build-time only
│   │       └── quotes.json                                 # 20 static quotes
│   ├── public/
│   │   ├── sw.js                                           # Service worker
│   │   ├── sw-register.js                                  # SW registration
│   │   ├── manifest.json                                   # PWA manifest
│   │   └── icon-*.svg                                      # PWA icons
│   └── vitest.config.ts                                    # Vitest + esbuild JSX config
├── agent/
│   ├── index.js                                            # Firebase watcher → Ollama → per-category write
│   ├── seed-rtdb.mjs                                       # Push framework data to RTDB
│   └── theceocompass-*.json                                # Service account key (gitignored)
├── database.rules.json                                     # RTDB security rules (16+ paths)
├── scripts/
│   ├── pre-commit-check.sh                                 # CI validation script
│   ├── update-rtdb-rules.cjs                               # Deploy rules via admin SDK
│   └── ...
├── .github/workflows/
│   ├── ci.yml                                              # tsc + vitest + build
│   └── deploy.yml                                          # Static export to GitHub Pages
└── AGENTS.md                                               # AI agent dev instructions
```

---

## GitHub Secrets

| Secret | Required for |
|--------|-------------|
| `FIREBASE_API_KEY` | CI build + deploy |
| `FIREBASE_AUTH_DOMAIN` | CI build + deploy |
| `FIREBASE_DATABASE_URL` | CI build + deploy |
| `FIREBASE_PROJECT_ID` | CI build + deploy |
| `FIREBASE_STORAGE_BUCKET` | CI build + deploy |
| `FIREBASE_MESSAGING_SENDER_ID` | CI build + deploy |
| `FIREBASE_APP_ID` | CI build + deploy |

---

## CI Pipeline

Main CI (`.github/workflows/ci.yml`) runs **2 jobs**:

1. **frontend-tests** — `tsc --noEmit` + `vitest run`
2. **frontend-build** — `next build` (static export pages; needs Firebase secrets)

Legacy FastAPI tests live in path-filtered `.github/workflows/backend-legacy.yml` (only when `backend/` changes). Optional Playwright: `cd frontend && npm run test:e2e` (not required for merge).

The deploy workflow runs on push to master:
1. Builds static export with `next.config.export.js` (basePath, trailingSlash, output: export)
2. Uploads `out/` as GitHub Pages artifact
3. Deploys to GitHub Pages

Pre-commit script (`scripts/pre-commit-check.sh`) runs the same checks locally before pushing.

---

## Known Issues

- **Node.js v25** — `next dev` hangs on Node v25 due to compatibility issues. Use `next build && next start` or CI (Node 20).
- **npm install hangs on WSL** — Network issues can cause `npm install` to hang. Use a stable network connection.
- **Dev server vs production** — The dev server (`next dev`) and production build (`next build && next start`) may behave differently. Always run pre-commit checks before pushing.

---

Built with **OpenCode Go** + **GLM-5.2**.
