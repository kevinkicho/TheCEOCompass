# Maintenance Guide

## Starting the App Locally

```bash
# Terminal 1 — Frontend
cd ceo-platform/frontend
cp .env.example .env   # fill in Firebase values
npm install
npm run dev            # → http://localhost:33221

# Terminal 2 — Ollama agent
cd ceo-platform/agent
npm install
# Place service account key in agent/ directory
node index.js
```

## Building for Production

```bash
cd frontend
npm run build          # generates static export in out/
npx next build         # validates build + types
npx vitest run         # runs tests
```

## CI Pipeline

`.github/workflows/ci.yml` runs on every push:
1. `backend-tests`: Python tests (FastAPI) — skipped if backend unchanged
2. `frontend-tests`: `vitest run` — 21 tests
3. `frontend-build`: `npx next build` — verifies compilation

`.github/workflows/deploy.yml` runs on master push:
1. Builds static export
2. Uploads to GitHub Pages

## Adding a New Framework

1. Add entry to `frontend/src/lib/staticData.ts` — full framework object with concepts
2. Run `node scripts/generate-slugs.mjs` to update `slugs.json` (or run the slug generation inline)
3. Rebuild: `npm run build`
4. New page auto-generated at `/frameworks/{slug}`

## Adding a New Concept to Existing Framework

1. Add concept object to framework's `concepts` array in `staticData.ts`
2. Regenerate slugs
3. Rebuild — concept page auto-generated at `/frameworks/{slug}/{conceptSlug}`

## Firebase RTDB

- Security rules are deployed via Firebase Admin SDK script
- Current rules: `requests` and `responses` are world-readable/writable
- `framework/{slug}/{concept}/responses` requires auth (admin email)
- `.indexOn` configured for `created_at` (responses) and `status` (requests)

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

- Runs on WSL, connects to Firebase RTDB via Admin SDK
- Stale request sweep on startup (resets "processing" >5min to "pending")
- Writes to both flat `/responses` and indexed `/framework/{slug}/{concept}/responses`
- Logs with timestamps to stdout

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| AI button shows error silently | Firebase not configured | Check `.env` has `NEXT_PUBLIC_FIREBASE_*` values |
| Spinner spins forever | Agent not running | `cd agent && node index.js` |
| "permission_denied" in console | RTDB rules blocking | Deploy rules via agent deploy script |
| Google Sign-In fails | Domain not authorized | Add `kevinkicho.github.io` to Firebase Auth → Authorized domains |
| Build fails with type error | StaticData type mismatch | Ensure `slugs.json` matches `staticData.ts` |
