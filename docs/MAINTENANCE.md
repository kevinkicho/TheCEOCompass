# Maintenance Guide

## Starting the App Locally

```bash
# Terminal 1 — Frontend
cd frontend
cp .env.example .env   # fill in Firebase values
npm install
npm run dev            # → http://localhost:33221

# Terminal 2 — Ollama agent (optional; cloud Functions can serve AI instead)
cd agent
npm install
# Place service account key in agent/ directory
node index.js
```

## Building for Production

```bash
cd frontend
npx tsc --noEmit
npx next lint --max-warnings 0
npx vitest run
npx next build
```

Or run the full pre-commit suite from the repo root:

```bash
bash scripts/pre-commit-check.sh
# Windows: powershell -File scripts/pre-commit-check.ps1
```

## CI Pipeline

`.github/workflows/ci.yml` runs on every push:
1. `frontend-tests`: UTF-8 check, mastery seed validation, scenario slug sync, `tsc`, ESLint, vitest
2. `functions-tests`: Cloud Functions unit tests
3. `frontend-build`: `npx next build` — verifies compilation

`.github/workflows/deploy.yml` runs on master push:
1. Builds static export (`next.config.export.js`)
2. Uploads to GitHub Pages

## Data sources (no hardcoded mock product data)

| Content | Source |
|---------|--------|
| Frameworks + concepts | **Firebase RTDB** `frameworks/{slug}` (via `rtdb-cache.ts`) |
| Scenarios | Static catalog `frontend/src/data/scenarios.json` (curriculum) |
| Quotes catalog | Static `frontend/src/data/quotes.json` + RTDB `quotes/generated` for AI quotes |
| Mastery graph | RTDB `mastery/*` with seed fallback `mastery-edges.json` |
| User progress | RTDB under the signed-in (or anonymous) uid |
| SSG params only | `framework-meta.json`, `slugs.json` — build-time metadata, not runtime mock data |

`staticData.ts` has been **removed**. If RTDB frameworks are unavailable, the app surfaces an error — it does not silently inject fake frameworks or progress.

## Adding a New Framework

1. Seed / write the full framework object (with concepts) to RTDB at `frameworks/{slug}`
2. Update `frontend/src/data/framework-meta.json` (slug, title, concept name/slug/short definition) for SSG
3. Run `node scripts/sync-scenario-slugs.mjs` if scenarios reference it; regenerate `slugs.json` as needed
4. Rebuild — pages at `/frameworks/{slug}` and concept routes are generated from meta + RTDB at runtime

## Adding a New Concept to an Existing Framework

1. Add the concept under `frameworks/{slug}/concepts/{id}` in RTDB
2. Update `framework-meta.json` concept list for SSG params
3. Rebuild — concept page at `/frameworks/{slug}/{conceptSlug}`

## Firebase RTDB

- Security rules: `database.rules.json` (deploy with `scripts/update-rtdb-rules.cjs` or Firebase CLI)
- Parent paths need explicit `.read` when the client queries them
- New paths need rules **and** a redeploy

## GitHub Secrets

Set these in repo → Settings → Secrets and variables → Actions:
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_DATABASE_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

## Agent

- Connects to Firebase RTDB via Admin SDK
- Stale request sweep on startup (resets "processing" >5min to "pending")
- Optional local Ollama; cloud path uses Firebase Functions + Secret Manager

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Frameworks empty / load error | RTDB not seeded or Firebase env missing | Check `NEXT_PUBLIC_FIREBASE_*`; seed `frameworks/*` |
| AI button shows error | No agent, local Ollama, or cloud Function | Start agent, enable Local AI Mode, or deploy Functions |
| Spinner spins forever | Provider offline / request stuck | Check agent logs or Functions logs; reset stale requests |
| "permission_denied" in console | RTDB rules blocking | Redeploy rules; confirm auth path |
| Google Sign-In fails | Domain not authorized | Add `kevinkicho.github.io` to Firebase Auth authorized domains |
| Build fails on scenario SSG | Slug list out of sync | `node scripts/sync-scenario-slugs.mjs --check` |
