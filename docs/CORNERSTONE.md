# Cornerstone Architecture — CEO Compass

This document describes **foundation** choices (not short-fixes). Prefer these patterns for new work.

## 1. Auth: redirect-first Google

| Piece | Location |
|-------|----------|
| Session + Google | `frontend/src/lib/AuthSessionProvider.tsx` |
| Resume path stash | `frontend/src/lib/auth-resume.ts` |
| Product gate | `frontend/src/components/auth/AppShellGate.tsx` + `FlashLogin.tsx` |

**Rules**

1. **Full-page redirect is the default** for Google sign-in / link (`preferRedirect !== false`).
2. Popups are opt-out only — they fail under Cross-Origin-Opener-Policy and create `window.closed` noise.
3. Before redirect: `stashAuthResumePath()` + `prepareAnonMerge()` when still anonymous.
4. After return: `getRedirectResult` → merge pending anon tree → `consumeAuthResumePath()` for deep-link restore.
5. Flash login blocks the main shell until a non-anonymous Google user is present.

## 2. Catalog: list vs detail (scenarios)

| Path | RTDB | Use |
|------|------|-----|
| List / home / filters | `scenario_index/{slug}` (light meta, **no stages**) | `getScenarios()` → `loadScenarioList()` |
| Runner / detail | `scenarios/{slug}` (full stages + branches) | `getScenario(slug)` → `loadScenarioBySlug()` |
| Fallback | bundled `scenarios.json` | Offline / empty RTDB / unit tests |

Seed both trees together:

```bash
node scripts/seed-catalog-rtdb.mjs
```

Rules: `database.rules.json` → `scenario_index` public read, admin write.

**Do not** pull the full `scenarios/` tree just to render home cards.

## 3. Journal: RTDB learner context pipeline

| Piece | Location |
|-------|----------|
| Context loader | `frontend/src/lib/user-data/learner-context.ts` |
| AI multi-entry | `structureJournalFromThoughts` in `frontend/src/lib/ai/generators.ts` |
| UI preview | Journal page `data-testid="journal-context-preview"` |

Context sources (already written by the app — no browser CLI required):

- `users/{uid}/viewed`
- `users/{uid}/scenarioHistory`
- `users/{uid}/quizResults`
- pathway progress + due reviews

AI prompts must describe **concrete activities**, not meta “I am recording a journal entry”.

## 4. App Check + Service Worker + Functions ops

### App Check

- Client: `frontend/src/lib/app-check.ts` (eager from `firebase.ts`)
- Env: `NEXT_PUBLIC_APPCHECK_SITE_KEY`, optional `NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN`
- Flag: `_config/feature_flags.app_check_enforced` (signal only)
- **Blocking** requires Firebase Console → App Check → Enforce

Rollout order is documented in `docs/ENGINEERING.md` § App Check.

### Service Worker versioning

- `frontend/public/sw.js` — `CACHE_VERSION` (bump on deploy-impacting changes)
- `frontend/public/sw-register.js` — `SW_VERSION` query string (keep in sync) + `controllerchange` soft reload

### Cloud Functions artifacts

After deploy, set max artifact retention so Container Registry / Artifact Registry does not grow unbounded:

```bash
# Google Cloud — keep last N images for Cloud Functions (adjust project/region)
gcloud artifacts repositories set-cleanup-policies \
  gcf-artifacts \
  --project=YOUR_PROJECT \
  --location=us-central1 \
  --policy='[{"name":"keep-minimum-versions","keepCount":5,"action":{"type":"Keep"}},{"name":"delete-old","condition":{"olderThan":"30d"},"action":{"type":"Delete"}}]'
```

If the repo name differs, list with:

```bash
gcloud artifacts repositories list --project=YOUR_PROJECT
```

Also see [Firebase: manage build images](https://firebase.google.com/docs/functions/manage-functions#clean_up_build_images).

Redeploy functions with tests green:

```bash
cd functions && npm test && npm run build && cd ..
firebase deploy --only functions
```

## 5. API surface (catalog only)

`frontend/src/lib/api.ts` is **catalog only** (frameworks + scenarios).

User data lives in:

- `@/lib/user-data/*`
- `@/lib/firebase-crud` (re-exports for pages)

Do not reintroduce FastAPI-shaped stubs into `api.ts`.

## 6. E2E under the auth gate

Playwright specs must tolerate **flash-login** without OAuth secrets:

- `e2e/flash-login.spec.ts` — gate presence
- `e2e/learning-loop.spec.ts` — gate **or** signed-in shells
- `e2e/scenario-flow.spec.ts` — gate **or** product pages

Optional CI job remains `continue-on-error` until a stable headless Google path exists.

## 7. Agent CLI (no browser)

Operators and agents read/write RTDB via Admin SDK:

```bash
npm run agent:cli -- help
```

See `docs/AGENT_CLI.md`. Journal context for AI comes from RTDB activity, not DOM automation.
