# Agent Instructions for CEO Compass

## CI Verification (MANDATORY)

Before committing any code changes, you MUST run these two commands and verify they both pass:

```bash
# 1. Run all frontend tests
cd frontend && npx vitest run

# 2. Verify the Next.js build compiles
cd frontend && npx next build
```

Both must complete without errors. If either fails, fix the issue before pushing.

## TypeScript

- `db` from `firebase.ts` is typed as `Database | null`. After a `if (!db) throw` guard, use `db!` to assert non-null for TypeScript.
- The `EXPORT` name in staticData.ts has a `@ts-nocheck` — do not remove it.
