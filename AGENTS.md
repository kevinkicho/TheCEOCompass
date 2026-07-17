# Agent Instructions for CEO Compass

## CI Verification (MANDATORY)

Before committing/pushing, run the full pre-commit suite (same gates as GitHub Actions CI):

```bash
# Git Bash / WSL / macOS / Linux
bash scripts/pre-commit-check.sh

# Windows PowerShell
powershell -File scripts/pre-commit-check.ps1

# Faster loop (skip Next build)
bash scripts/pre-commit-check.sh --skip-build
```

Checks (all must pass — lint fails on warnings):
0. **UTF-8 encoding** — `node scripts/check-utf8.mjs` (prevents Linux CI webpack “invalid UTF-8”)
1. **Mastery seed** — `node scripts/validate-mastery-seed.mjs`
2. **TypeScript** — `tsc --noEmit`
3. **ESLint** — `next lint --max-warnings 0`
4. **Unit tests** — `vitest run`
5. **Next.js build** — `next build` (placeholder Firebase env if secrets missing)
6. **Functions tests** — `cd functions && npm test`

CI workflow (`.github/workflows/ci.yml`) runs the same gates. Deploy (`.github/workflows/deploy.yml`) also UTF-8-checks then static-exports.

Individual commands:
```bash
node scripts/check-utf8.mjs
node scripts/validate-mastery-seed.mjs
cd frontend && npx tsc --noEmit
cd frontend && npx next lint --max-warnings 0
cd frontend && npx vitest run
cd frontend && npx next build
cd functions && npm test
```

## Architecture

### Data sources (NO hardcoded mock data)
- All framework + concept data lives in **Firebase RTDB** at `frameworks/{slug}` and `frameworks/{slug}/concepts/{id}`
- Cached at module level via `rtdb-cache.ts` → `loadFrameworks()` / `getCachedFrameworks()`
- If Firebase is unavailable, the app shows clear error messages — no silent fallback to static data
- `staticData.ts` has been removed. A minimal `framework-meta.json` exists only for SSG build-time params/metadata

### Seeding data to RTDB
If RTDB needs to be reseeded with framework data:
```bash
# 1. Export framework data to JSON
cd frontend && npx tsx -e "import { getCachedFrameworks } from './src/lib/rtdb-cache'; import { writeFileSync } from 'fs'; ..."

# 2. Push to RTDB
cd agent && node seed-rtdb.mjs
```
The `agent/seed-rtdb.mjs` script reads `/tmp/frameworks.json` and pushes to `frameworks/{slug}`.

### RTDB paths
- `frameworks/{slug}` — Framework metadata (title, description, category, difficulty)
- `frameworks/{slug}/concepts/{id}` — Concept data (name, definition, tags, etc.)
- `_meta/framework_slugs` — Array of framework slugs for fast listing
- `comparisons/{frameworkSlug}/{slugA}/{slugB}/{mode}/{requestId}` — Saved comparison results with pagination
- All other paths: requests, framework/{slug}/{concept}/{category}/{id}, conceptChats, scenario-evaluations, quotes/generated, reviews, journal, progress, viewed, favoriteQuotes, quizResults, scenarioHistory

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
