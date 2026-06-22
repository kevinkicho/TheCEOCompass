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

All 4 must pass. If any fails, fix before pushing.

To run individual checks:
```bash
cd frontend && npx tsc --noEmit        # type check
cd frontend && npx next lint            # lint
cd frontend && npx vitest run           # tests
cd frontend && npx next build           # build
```

### Common CI failure patterns to watch for:
- **Missing `import React from "react"`** in test files with JSX — vitest/jsdom needs explicit React import for JSX transform
- **Playwright e2e files picked up by vitest** — ensure `e2e/` is excluded in `vitest.config.ts`
- **Firebase imports without mock** in tests — add `vi.mock("@/lib/firebase", ...)` to test files
- **`if (!db) return` instead of `if (!db) throw`** — CRUD functions should throw, not silently return, when Firebase is missing
- **New RTDB path not in `database.rules.json`** — every new RTDB path needs security rules

## TypeScript

- `db` from `firebase.ts` is typed as `Database | null`. After a `if (!db) throw` guard, use `db!` to assert non-null for TypeScript.
- The `EXPORT` name in staticData.ts has a `@ts-nocheck` — do not remove it.
