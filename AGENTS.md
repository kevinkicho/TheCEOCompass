# Agent Instructions for CEO Compass

## CI Verification (MANDATORY)

**Full requirements, failure patterns, and checklists:** [`docs/CI.md`](docs/CI.md)

Before every commit/push, run the same gates as GitHub Actions:

```bash
# Cross-platform (recommended)
npm run ci
# or: node scripts/run-ci-local.mjs
# skip build while iterating: node scripts/run-ci-local.mjs --skip-build

# Git Bash / WSL / macOS / Linux
bash scripts/pre-commit-check.sh

# Windows PowerShell
powershell -File scripts/pre-commit-check.ps1
```

**If `npm run ci` / pre-commit passes, GitHub CI will pass.**

Required CI jobs (`CI` workflow only):

| Job | Gates |
|-----|--------|
| `frontend-tests` | UTF-8, mastery seed, scenario slugs, `tsc`, eslint max-warnings 0, vitest |
| `functions-tests` | `npm test` in `functions/` |
| `frontend-build` | `next build` (demo Firebase env if secrets empty) |

**Not required for CI green:** E2E Playwright (`continue-on-error: true`).  
**Deploy** is separate and needs real `FIREBASE_*` GitHub secrets.

### Top failure causes
1. **TypeScript** — bad imports, implicit `any`, rename leftovers → `cd frontend && npx tsc --noEmit`
2. **UTF-8** — Windows/PowerShell corrupted files → `node scripts/check-utf8.mjs`
3. **ESLint warnings** — treated as failures → `npx next lint --max-warnings 0`
4. **Scenario slugs** — edit `scenarios.json` without sync → `node scripts/sync-scenario-slugs.mjs`
5. **Vitest mocks** — missing `vi.mock("@/lib/firebase")`

### Agent CLI (workflows, not CI)
See [`docs/AGENT_CLI.md`](docs/AGENT_CLI.md). Example:

```bash
npm run agent:cli -- help
npm run agent:cli -- pipeline daily --uid <UID> --json
```

## Architecture

### Data sources (NO hardcoded mock data)
- **Frameworks + concepts** — RTDB `frameworks/{slug}` via `rtdb-cache.ts` (error if missing; no silent mock)
- **Scenarios** — RTDB `scenarios/{slug}` via `scenarios-cache.ts`; bundled `scenarios.json` is seed + SSG fallback only
- **Quotes catalog** — RTDB `quotes/catalog` + `quotes/categories` via `quotes-catalog.ts`; `quotes.json` is seed; AI quotes at `quotes/generated`
- **Mastery graph** — RTDB `mastery/*` only when Firebase is configured (empty until seeded); bundled `mastery-edges.json` for tests / `seed-mastery-graph.mjs`
- **SSG only** — `framework-meta.json`, `slugs.json` (build-time params/metadata)
- `staticData.ts` has been removed

### Seeding data to RTDB
```bash
# Frameworks (existing)
cd agent && node seed-rtdb.mjs   # reads /tmp/frameworks.json

# Scenarios + quotes catalog
node scripts/seed-catalog-rtdb.mjs
# optional: --dry-run | --scenarios-only | --quotes-only

# Mastery graph
node scripts/seed-mastery-graph.mjs
```
Requires `GOOGLE_APPLICATION_CREDENTIALS` or a service-account JSON in `agent/`.

### RTDB paths
- `frameworks/{slug}` — Framework metadata (title, description, category, difficulty)
- `frameworks/{slug}/concepts/{id}` — Concept data (name, definition, tags, etc.)
- `scenarios/{slug}` — Full scenario objects (curriculum)
- `_meta/scenario_slugs` — Scenario slug list
- `quotes/catalog/{id}`, `quotes/categories/{id}` — Curated quotes
- `quotes/generated/{id}` — AI-generated quotes
- `mastery/concepts`, `mastery/edges`, `_meta/mastery_graph`
- `_meta/framework_slugs` — Array of framework slugs for fast listing
- `comparisons/{frameworkSlug}/{slugA}/{slugB}/{mode}/{requestId}` — Saved comparison results with pagination
- All other paths: requests, framework/{slug}/{concept}/{category}/{id}, conceptChats, scenario-evaluations, reviews, journal, progress, viewed, favoriteQuotes, quizResults, scenarioHistory

### Common CI failure patterns to watch for:
- **Missing `import React from "react"`** in files with JSX — vitest/jsdom needs explicit React import for JSX transform when `esbuild: { jsx: "automatic" }` doesn't apply
- **Playwright e2e files picked up by vitest** — ensure `e2e/` is excluded in `vitest.config.ts`  
- **Firebase imports without mock** in tests — add `vi.mock("@/lib/firebase", ...)` to test files
- **New RTDB path not in `database.rules.json`** — every new RTDB path needs security rules AND must be redeployed via `scripts/update-rtdb-rules.cjs`
- **RTDB rules missing `.read` at parent levels** — parent paths need `.read: true` if the frontend queries them (Firebase requires explicit read permission at the path being read, not at child paths)
- **Early returns before hooks** — React hooks MUST be called in the same order on every render; loading states should use conditional JSX, not early returns
- **Module-level cache in rtdb-cache.ts** — `loadPromise` is reset on error so subsequent calls retry. If the initial RTDB read fails, `cachedFrameworks` stays null until page reload.

## Agent Race Conditions (fixed)

### Stale request loss on restart
`sweepStaleRequests()` runs before `on("child_added", handleRequest)` is registered. This ensures stale "processing" requests are reset to "pending" before the listener starts, so they get picked up.

### `waitForFirebaseResponse` const-before-init
`unsubStatus` and `unsubResp` are declared with `let` before `onValue` calls, then assigned. This prevents crashes if Firebase delivers callbacks synchronously.

### `loadFrameworks` permanent failure
`loadPromise` is reset to `null` in the `.catch()` handler so subsequent calls retry instead of returning the same rejected promise forever.

### `handleNewEntry` dedup
Uses `snap.key` (unique Firebase requestId) instead of `created_at` for dedup. Two requests in the same millisecond no longer collide.

## Testing

101 unit tests across 9 files:
- `spaced-repetition.test.ts` — SM-2 algorithm (25 tests)
- `firebase-crud-review.test.ts` — Review CRUD (12 tests)
- `api.test.ts` — API client (7 tests)
- `pages.test.tsx` — Page import validation (34 tests)
- `rtdb-cache.test.ts` — Framework cache (8 tests)
- `ollama.test.ts` — waitForFirebaseResponse (5 tests)
- `smoke.test.ts` — Vitest sanity (1 test)
- `ScenarioEngine.test.tsx` — Scenario flow (4 tests)
- `ChatPanel.test.tsx` — Chat panel (6 tests)

## TypeScript

- `db` from `firebase.ts` is typed as `Database | null`. After a `if (!db) throw` guard, use `db!` to assert non-null for TypeScript.
- `waitForFirebaseResponse` is exported from `ollama.ts` for testability.
