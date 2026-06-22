# Agent Instructions for CEO Compass

## CI Verification (MANDATORY)

Before committing any code changes, you MUST run the full pre-commit validation suite:

```bash
bash scripts/pre-commit-check.sh
```

This runs 4 checks in sequence:
1. **TypeScript type check** — `tsc --noEmit` catches type errors the build wouldn't
2. **ESLint** — `next lint` catches code quality issues
3. **Unit tests** — `vitest run` catches logic bugs, missing imports, broken mocks
4. **Next.js build** — `next build` catches SSG/page errors, Firebase env issues

All 4 must pass. If any fails, fix before pushing. If the pre-commit script passes locally, it WILL pass on CI.

To run individual checks:
```bash
cd frontend && npx tsc --noEmit        # type check
cd frontend && npx next lint            # lint
cd frontend && npx vitest run           # tests
cd frontend && npx next build           # build
```

## Architecture

### Data sources (NO hardcoded mock data)
- All framework + concept data lives in **Firebase RTDB** at `frameworks/{slug}` and `frameworks/{slug}/concepts/{id}`
- Cached at module level via `rtdb-cache.ts` → `loadFrameworks()` / `getCachedFrameworks()`
- If Firebase is unavailable, the app shows clear error messages — no silent fallback to static data
- No `staticData.ts` imports — it's been removed. A minimal `framework-meta.json` exists only for SSG build-time params/metadata

### Seeding data to RTDB
If RTDB needs to be reseeded with framework data:
```bash
# 1. Export static data to JSON (requires staticData.ts temporarily)
cd frontend && npx tsx -e "import { staticFrameworks } from './src/lib/staticData'; ... write JSON ..."

# 2. Push to RTDB
cd agent && node seed-rtdb.mjs
```
The `agent/seed-rtdb.mjs` script reads `/tmp/frameworks.json` and pushes to `frameworks/{slug}`.

### RTDB paths
- `frameworks/{slug}` — Framework metadata (title, description, category, difficulty)
- `frameworks/{slug}/concepts/{id}` — Concept data (name, definition, tags, etc.)
- `_meta/framework_slugs` — Array of framework slugs for fast listing
- All other paths unchanged (requests, framework/{slug}/{concept}/{category}/{id}, reviews, journal, etc.)

### Common CI failure patterns to watch for:
- **Missing `import React from "react"`** in files with JSX — vitest/jsdom needs explicit React import for JSX transform when `esbuild: { jsx: "automatic" }` doesn't apply
- **Playwright e2e files picked up by vitest** — ensure `e2e/` is excluded in `vitest.config.ts`  
- **Firebase imports without mock** in tests — add `vi.mock("@/lib/firebase", ...)` to test files
- **New RTDB path not in `database.rules.json`** — every new RTDB path needs security rules AND must be redeployed via `scripts/update-rtdb-rules.cjs`
- **RTDB rules missing `.read` at parent levels** — parent paths need `.read: true` if the frontend queries them (Firebase requires explicit read permission at the path being read, not at child paths)
- **Early returns before hooks** — React hooks MUST be called in the same order on every render; loading states should use conditional JSX, not early returns

## TypeScript

- `db` from `firebase.ts` is typed as `Database | null`. After a `if (!db) throw` guard, use `db!` to assert non-null for TypeScript.
- The `EXPORT` name in staticData.ts has a `@ts-nocheck` — do not remove it.
