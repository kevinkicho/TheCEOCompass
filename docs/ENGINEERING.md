# Engineering Decisions

## Architecture Overview

CEO Compass is a **monorepo full-stack application** with a Python/FastAPI backend and Next.js/TypeScript frontend, deployed as a static site on GitHub Pages with SPA-like interactivity.

```
Browser → GitHub Pages (static HTML/CSS/JS)
              ↓ (on localhost only)
         FastAPI Backend (port 50128)
              ↓
         SQLite Database
```

On the static demo, all interactive features that require a backend (scenarios, quizzes, journal) show `BackendGuard` modals pointing users to the local setup.

---

## Technology Choices

### Why Next.js 14 App Router (not Pages Router)?
- Server Components for static content (nav, footer, metadata)
- Client Components for interactive features (scenario engine, quiz, forms)
- `generateStaticParams` for static export with dynamic routes (`[slug]`)
- Built-in CSS modules and Tailwind integration

### Why FastAPI (not Django/Flask)?
- Native async support (`async def` endpoints)
- Automatic OpenAPI docs (`/docs` endpoint)
- Pydantic validation for request/response schemas
- Lower overhead for a focused API (11 endpoints)

### Why SQLite for Development (not PostgreSQL)?
- No need to install/configure `asyncpg` in WSL
- Zero-config: single file database
- SQLAlchemy async compatibility via `aiosqlite`
- Tests use in-memory SQLite for speed
- Production can swap to PostgreSQL via `DATABASE_URL` env var only

### Why CSS Class-Based Dark Mode (not CSS Variables)?
- **Tailwind `darkMode: "class"`**: All `dark:` variants are co-located with their light-mode counterparts in JSX
- Single source of truth: each element declares both states inline
- Tailwind JIT generates only the CSS used, keeping bundle small
- CSS variables (`:root`/`.dark`) were considered but:
  - Would require refactoring all `text-dark-900` to `text-[var(--foreground)]`
  - Co-location makes it obvious when dark variants are missing

---

## Dark Mode Implementation

### Three-Layer Strategy

**Layer 1: Global CSS defaults** (`globals.css`)
```css
body { @apply bg-white dark:bg-dark-950 text-dark-900 dark:text-dark-100; }
* { @apply border-dark-200 dark:border-dark-700; }
.dark input, .dark select, .dark textarea { background: rgb(15 23 42); }
```

**Layer 2: Component-level `dark:` variants**
Every component declares dark variants inline:
```tsx
<div className="bg-white dark:bg-dark-900 text-dark-900 dark:text-dark-100">
```

**Layer 3: Template literal handling**
Conditional class strings inside `${...}` get their own dark variants:
```tsx
className={`${active ? "bg-primary-600 text-white" : "bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-300"}`}
```

### Theme Persistence
- `localStorage.getItem("theme")` on mount → `useState("light" | "dark")`
- If no stored preference, checks `window.matchMedia("(prefers-color-scheme: dark)")`
- `useEffect` adds/removes `dark` class on `document.documentElement`
- `<html suppressHydrationWarning>` prevents React hydration mismatch

---

## Static Export Strategy

### Dual Config Approach
| File | Purpose | Used For |
|------|---------|----------|
| `next.config.js` | Dev config (default) | Local development |
| `next.config.export.js` | Static export config | GitHub Pages build |

The deploy workflow copies `next.config.export.js` → `next.config.js` before building, then restores it.

### Export Config
```js
{
  output: "export",          // Static HTML output
  basePath: "/TheCEOCompass", // GitHub project site path
  assetPrefix: "/TheCEOCompass",
  trailingSlash: true,       // Prevents Next.js RSC prefetch 404s
  images: { unoptimized: true } // Next Image needs server
}
```

### Static Data Strategy
- The static export uses a live backend; all content is served via API
- On static hosting (GitHub Pages), API calls return empty data and `BackendGuard`/`StaticModeBanner` components show "Run locally" modals
- No mock or fallback data is served — if the backend is unavailable, the UI shows empty states with setup instructions

### Route Prerendering
Dynamic routes (`[slug]`) require `generateStaticParams` in a server layout file:
```tsx
// src/app/frameworks/[slug]/layout.tsx
export async function generateStaticParams() {
  return slugs.frameworks.map((slug) => ({ slug }))
}
```

---

## API Client Design (`api.ts`)

### Dual Mode Operation
```typescript
const isStaticHosting = typeof window !== "undefined"
  && !window.location.hostname.includes("localhost")
  && !window.location.hostname.includes("127.0.0.1")

export async function getFrameworks() {
  if (isStaticHosting) return staticFrameworks  // No API call
  return axios.get(`${API}/frameworks`).then(r => r.data)
}
```

### Backend URL Detection
- Default: `http://localhost:50128/api`
- Override: `NEXT_PUBLIC_API_URL` environment variable
- CORS auto-detection in backend config scans WSL IPs (172.x, 192.168.x)

---

## Scenario Engine Architecture

### State Machine
```
IDLE → ACTIVE (stage 1) → FEEDBACK → ACTIVE (stage 2) → ... → COMPLETED
```

### Component: `ScenarioEngine.tsx`
- **DecisionPrompt**: Renders stage prompt + options/free-response input
- **FeedbackPanel**: Shows AI feedback, hint toggle, model answer toggle
- **ScoreDisplay**: Shows final score + next framework recommendation
- All coaching feedback uses mock data when LLM API key is not set

### Backend: `scenario_service.py`
- Branching logic based on user choices
- Scoring: weights per choice × stage type
- Outcome determination: optimal/suboptimal/failure paths
- 6 scenarios with 3-4 stages each

---

## Data Flow

### Framework Detail Page
```
User navigates to /frameworks/[slug]
  → getFrameworkBySlug(slug) [API call or static data]
  → Framework object: { title, concepts[], key_concepts[], use_cases[], scenarios[] }
  → conceptMap: normalized name → concept (strips spaces/slashes/hyphens)
  → Render concept grid (matched concepts = clickable, unmatched = disabled)
  → Click concept → modal: definition + formula + 3 examples + tags
```

### Quiz Flow
```
User selects framework → Generate Quiz
  → POST /api/quiz/generate { framework_id, num_questions: 5 }
  → [Static: load from seed JSON]
  → Render question 1 → User answers → Submit
  → Local evaluation (compare answer to correct_answer)
  → Show result + explanation → Next → ... → Results screen
```

### Journal Flow
```
User creates entry → POST /api/journal
  → Entry stored with: title, context, decision, rationale, confidence, review_date
  → Entry appears in list with "Review by {date}" badge
  → At review date → Record Outcome
  → POST /api/journal/{id}/outcome { what_happened, was_right, updated_confidence, lesson }
  → Calibration tracking: accuracy vs confidence over time
```

---

## Testing Strategy

### Backend (pytest)
- **Unit tests** (`tests/unit/`): Scenario engine logic (8 tests), LLM service mocks (7 tests)
- **Integration tests** (`tests/integration/`): API contract tests (10 tests)
- **Test DB**: SQLite in-memory (`sqlite+aiosqlite:///./test.db`)
- **Coverage**: 60% minimum (enforced in CI)

### Frontend (Vitest)
- **Component tests**: ScenarioEngine rendering (5 tests)
- **Import tests**: All 10 pages import without errors (10 tests, 1 skipped)
- **API client tests**: Static/backend mode detection (7 tests)
- **Environment**: `jsdom` for DOM simulation

### CI Pipeline
```
Push to master
  ├── backend-tests (ubuntu-latest, python 3.12)
  │     ├── pip install
  │     └── pytest --cov --cov-fail-under=60
  ├── frontend-tests (ubuntu-latest, node 20)
  │     ├── npm install --legacy-peer-deps
  │     └── npx vitest run
  └── frontend-build (ubuntu-latest, node 20)
        ├── npm install --legacy-peer-deps
        └── npx next build
```

---

## Key Architectural Decisions

### 1. `@ts-nocheck` on Static Data
The auto-generated `staticData.ts` (271KB) has type mismatches with strict TypeScript. Rather than maintaining type compatibility for generated code, we bypass checking on that file only. All hand-written code is fully typed.

### 2. Slug-Based Routing
All frameworks and scenarios use human-readable slugs (`/frameworks/cause-analysis-methods`) instead of UUIDs. Slugs are defined in the seed JSON and must be unique. Backend routes are ordered: `/slug/{slug}` before `/{id}` to prevent conflict.

### 3. Concept Name Normalization
Frontend strips `[ /-]+` from concept names before matching `key_concepts` with `concepts[]`. This handles display variants: `Fishbone/Ishikawa` matches `Fishbone / Ishikawa` in the concepts array.

### 4. DynamicRoute Layout Files
Static export with `[slug]` requires `generateStaticParams` in a layout file at the same level. Created `layout.tsx` in `frameworks/[slug]/` and `scenarios/[slug]/` even though the pages are `"use client"`.

### 5. BackendGuard Pattern
`BackendGuard` wraps interactive buttons and shows a modal with setup instructions when clicked on static hosting. `StaticModeBanner` shows an amber warning banner on pages that need the backend. This provides a smooth static demo experience while encouraging local installation.

### 6. LLM Service with Mock Fallbacks
`llm_service.py` returns scaffolded coaching feedback when no API key is set. Quiz questions use curated seed data instead of LLM generation in static mode. This keeps the app functional without requiring paid API keys.

---

## Performance Considerations

- **Static export**: Zero server cost, instant CDN delivery via GitHub Pages
- **Client-side data**: Static data file (271KB) loaded on demand, not in initial bundle
- **Code splitting**: Next.js automatic route-based splitting (~85KB shared, ~200KB per page)
- **Tailwind JIT**: Only used classes are included in CSS (~15KB compressed)
- **No runtime dependencies**: No analytics, no tracking, no external CDNs except Google Fonts
