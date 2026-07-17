# CI / Build Pass Requirements (CEO Compass)

**Goal:** every push to `master` (and every PR) must leave **CI green** without rework.  
If the local pre-commit suite passes, GitHub Actions CI will pass.

| Workflow | Blocks merge / “CI run”? | Purpose |
|----------|---------------------------|---------|
| **CI** (`.github/workflows/ci.yml`) | **Yes — required** | Types, lint, unit tests, Next build, functions tests |
| **Deploy to GitHub Pages** | Yes on `master` only | Static export + Pages publish (needs Firebase secrets) |
| **E2E (Playwright)** | **No** (`continue-on-error: true`) | Optional smoke; failures do not fail the required CI check |

---

## 1. Golden rule (do this before every push)

From the **repo root**:

```bash
# Linux / macOS / Git Bash / WSL
bash scripts/pre-commit-check.sh

# Windows PowerShell
powershell -File scripts/pre-commit-check.ps1
```

Or via npm (repo root, after this doc’s package.json update):

```bash
npm run ci
```

**Do not push until this exits 0.**  
Faster loop while iterating (skips `next build`):

```bash
bash scripts/pre-commit-check.sh --skip-build
# PowerShell: powershell -File scripts/pre-commit-check.ps1 -SkipBuild
```

Always run the **full** suite (with build) at least once before pushing.

---

## 2. Environment requirements

| Requirement | Value | Notes |
|-------------|--------|--------|
| **Node.js** | **22** (CI uses `actions/setup-node` with `"22"`) | Local: Node 20–22 usually OK; prefer 22 to match CI |
| **npm** | Ships with Node | Frontend install: `npm ci --legacy-peer-deps` |
| **OS for CI** | `ubuntu-latest` | Encoding bugs often only show on Linux |
| **Shell for scripts** | Bash or PowerShell | Prefer `pre-commit-check.ps1` on Windows |

### Frontend install

```bash
cd frontend
npm ci --legacy-peer-deps   # same as CI
# or first time: npm install --legacy-peer-deps
```

### Functions install

```bash
cd functions
npm ci   # or npm install
```

### Secrets

| Context | Firebase env needed? |
|---------|----------------------|
| **Local `next build` / pre-commit** | No — placeholders are injected |
| **CI `frontend-build` job** | Optional — falls back to `ci-demo-key` / demo project if secrets empty |
| **Deploy to GitHub Pages** | **Required** — real `FIREBASE_*` GitHub secrets |

GitHub repo secrets (Settings → Secrets and variables → Actions):

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_DATABASE_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

These map to `NEXT_PUBLIC_FIREBASE_*` in workflows.

Local app runtime (not CI): put the same keys in `frontend/.env.local` (gitignored).

---

## 3. Required CI jobs (must all pass)

### Job A — `frontend-tests`

Order matches `scripts/pre-commit-check.sh`:

| Step | Command | What fails it |
|------|---------|----------------|
| Install | `cd frontend && npm ci --legacy-peer-deps` | Lockfile out of sync, bad deps |
| UTF-8 | `node scripts/check-utf8.mjs frontend/src functions/src agent scripts` | Non-UTF-8 / UTF-16 / corrupted files (common on Windows) |
| Mastery seed | `node scripts/validate-mastery-seed.mjs` | Invalid `mastery-edges.json` |
| Scenario slugs | `node scripts/sync-scenario-slugs.mjs --check` | `slugs.json` out of sync with `scenarios.json` |
| TypeScript | `cd frontend && npx tsc --noEmit` | Type errors, bad imports, implicit `any` |
| ESLint | `cd frontend && npx next lint --max-warnings 0` | Any lint **error or warning** |
| Unit tests | `cd frontend && npx vitest run` | Failing/ skipped-as-fail tests, bad mocks |

### Job B — `functions-tests`

| Step | Command |
|------|---------|
| Install | `cd functions && npm ci` |
| Tests | `cd functions && npm test` |

### Job C — `frontend-build` (needs A + B)

| Step | Command |
|------|---------|
| Install | `cd frontend && npm ci --legacy-peer-deps` |
| Build | `npx next build` with Firebase env (or demo placeholders) |

Also validates SSG / webpack compile of app routes.

---

## 4. Command cheat sheet (individual gates)

Run from **repo root** unless noted:

```bash
# Encoding (run on every Windows edit session)
node scripts/check-utf8.mjs
node scripts/check-utf8.mjs frontend/src functions/src agent scripts

# Content integrity
node scripts/validate-mastery-seed.mjs
node scripts/sync-scenario-slugs.mjs --check
# If slugs fail, fix then: node scripts/sync-scenario-slugs.mjs

# Frontend quality
cd frontend
npx tsc --noEmit
npx next lint --max-warnings 0
npx vitest run
npx next build   # with demo env if needed (see pre-commit script)

# Functions
cd functions
npm test
```

---

## 5. Common CI failure patterns (and fixes)

### A. TypeScript (`tsc --noEmit`)

| Symptom | Fix |
|---------|-----|
| `Cannot find module './foo'` | Wrong import path; rename or move file; re-export from barrel |
| `implicitly has type 'any[]'` | Annotate: `const x: SomeType[] = []` |
| `Cannot find name 'X'` | Rename leftover after refactor (e.g. `extractJsonObject` → `extractJsonValue`) |
| JSX / React types | Ensure React types installed; avoid illegal hook order |
| `Property does not exist on type 'never'` | Control-flow narrowing; restructure `if`s |

**Always run `npx tsc --noEmit` in `frontend/` before push.**

### B. Invalid UTF-8 / webpack “stream did not contain valid UTF-8”

| Cause | Fix |
|-------|-----|
| PowerShell `Out-File` / UTF-16 saves | Rewrite file as UTF-8 (Node `writeFileSync(path, content, 'utf8')`) |
| Smart quotes / BOM from Word/editors | Use ASCII `'` `"` `-` `...` in hot-path code |
| Linux CI fails, Windows “works” | Encoding only fails on Linux — always run `check-utf8.mjs` |

```bash
node scripts/check-utf8.mjs frontend/src
# Repair helpers (if present):
# node scripts/scrub-ascii-hotpath.mjs
# node scripts/fix-utf8-home.mjs
```

### C. ESLint (`--max-warnings 0`)

| Cause | Fix |
|-------|-----|
| Unused vars / hooks deps | Fix or intentional `eslint-disable-next-line` with comment |
| Missing deps in `useEffect` | Correct dependency array or justify disable |
| Warnings count as failures | Zero warnings required |

```bash
cd frontend && npx next lint --max-warnings 0
```

### D. Vitest

| Cause | Fix |
|-------|-----|
| Firebase not mocked | `vi.mock("@/lib/firebase", ...)` |
| Missing `import React from "react"` in some test setups | Add explicit React import if JSX fails |
| Playwright specs under vitest | Keep `e2e/` excluded in `vitest.config.ts` |
| Snapshot / async races | Prefer fake timers / flush promises |

```bash
cd frontend && npx vitest run
```

### E. Next.js build

| Cause | Fix |
|-------|-----|
| Type / import errors | Same as tsc |
| SSG / generateStaticParams mismatch | Update `framework-meta.json` / `slugs.json` / scenarios |
| Missing env at build | CI injects placeholders; deploy needs real secrets |
| `next.config.js` left as export config locally | Dev config is plain; deploy copies `next.config.export.js` |

### F. Scenario slug sync

```text
slugs.json scenarios[] out of date vs scenarios.json
```

```bash
node scripts/sync-scenario-slugs.mjs          # write fix
node scripts/sync-scenario-slugs.mjs --check  # verify
```

### G. Mastery seed validation

```bash
node scripts/validate-mastery-seed.mjs
```

Fix `frontend/src/data/mastery-edges.json` (edge types, weights, reverse `reinforces`, path-safe ids).

### H. Deploy-only failures (CI green, Deploy red)

| Cause | Fix |
|-------|-----|
| Missing GitHub `FIREBASE_*` secrets | Add all 7 secrets |
| Export build / basePath issues | Check `next.config.export.js`, `basePath: /TheCEOCompass` |
| Empty `out/` | Ensure `output: "export"` and pages generate |

### I. E2E (optional — does not fail required CI)

Playwright job is `continue-on-error: true`. Fix when convenient:

```bash
cd frontend
npx playwright install --with-deps chromium
npx playwright test e2e/learning-loop.spec.ts --project=chromium
```

---

## 6. What each push should look like (checklist)

Copy/paste before `git push`:

```
[ ] bash scripts/pre-commit-check.sh   OR   powershell -File scripts/pre-commit-check.ps1
[ ] No uncommitted debug / .env.local / service-account JSON
[ ] New RTDB paths have rules in database.rules.json (if applicable)
[ ] New frontend features have types clean under tsc
[ ] If scenarios.json changed → slug sync OK
[ ] If mastery-edges.json changed → validate-mastery-seed OK
[ ] Windows: ran check-utf8.mjs after any PowerShell file rewrite
```

---

## 7. CI matrix (what GitHub runs)

```
push / pull_request
│
├── CI workflow (required)
│   ├── frontend-tests   (UTF-8, seed, slugs, tsc, lint, vitest)
│   ├── functions-tests  (npm test)
│   └── frontend-build   (needs both above; next build)
│
├── Deploy (master only; needs secrets)
│   └── build + upload Pages + deploy
│
└── E2E Playwright (optional; continue-on-error)
    └── learning-loop smoke
```

---

## 8. Agent / automation rules

Coding agents **must** run the pre-commit suite before declaring work done:

```bash
bash scripts/pre-commit-check.sh
# or: npm run ci
```

If only types changed, minimum:

```bash
cd frontend && npx tsc --noEmit && npx vitest run
node scripts/check-utf8.mjs frontend/src
```

Never push “hope CI passes” after known tsc/lint failures.

---

## 9. Fixing a red CI run quickly

1. Open the failed run → **frontend-tests** or **frontend-build** log.
2. Reproduce the **exact** command from the failed step locally.
3. Fix → re-run full pre-commit → push.
4. Confirm latest run on `master` is green:

```bash
gh run list --workflow=ci.yml --limit 3
```

---

## 10. Related docs

| Doc | Topic |
|-----|--------|
| `Agents.md` | Agent architecture + short CI mandate |
| `docs/MAINTENANCE.md` | Local run, seeding, troubleshooting |
| `docs/AGENT_CLI.md` | Agent CLI for workflows (when present) |
| `docs/AI_LOCAL_SETUP.md` | Local agent + Ollama |
| `docs/AI_CLOUD_SETUP.md` | Cloud Functions AI |

---

## 11. Definition of “CI pass”

**CI pass** means workflow **CI** on the commit is `success`:

- `frontend-tests` green  
- `functions-tests` green  
- `frontend-build` green  

**Deploy pass** (separate): Pages deploy workflow green after master push.  
**E2E** may be red without blocking the required CI check.

When in doubt: green check on the latest commit under **Actions → CI**.
