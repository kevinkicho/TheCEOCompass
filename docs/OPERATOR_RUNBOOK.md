# Operator Runbook — CEO Compass (Phase 0–6 ops)

Copy-pasteable steps for production setup after Phase 0–1 identity work and Phase 2–6
platform pieces (remote flags, Cloud Functions skeleton, mastery seed).

| Related docs | Path |
|--------------|------|
| Cloud AI deploy details | [`docs/AI_CLOUD_SETUP.md`](./AI_CLOUD_SETUP.md) |
| Local agent + Ollama | [`docs/AI_LOCAL_SETUP.md`](./AI_LOCAL_SETUP.md) |
| Engineering notes / RTDB map | [`docs/ENGINEERING.md`](./ENGINEERING.md) |
| Phase 0–1 design | [`docs/DESIGN_PHASE_0_1.md`](./DESIGN_PHASE_0_1.md) |
| Phase 2–3 design | [`docs/DESIGN_PHASE_2_3.md`](./DESIGN_PHASE_2_3.md) |
| Phase 6 Learning OS | [`docs/DESIGN_PHASE_6.md`](./DESIGN_PHASE_6.md) |

**Quick verify (from repo root):**

```bash
node scripts/verify-production.mjs
node scripts/validate-mastery-seed.mjs
```

**Never commit secrets.** Service account JSON, `OPENAI_API_KEY`, and `functions/.env` stay out of git (see root `.gitignore`).

**Shells:** Each ops step shows **bash** and **Windows PowerShell** where env vars differ. Run all commands from the **repo root** unless noted.

**Credentials convention used by scripts:**

| Mechanism | Scripts |
|-----------|---------|
| `GOOGLE_APPLICATION_CREDENTIALS` env → key file | `bootstrap-admins.mjs`, `purge-legacy-device-data.mjs`, `seed-mastery-graph.mjs` |
| First `*.json` in `agent/` (not `package*.json`) | Same scripts as fallback; **`update-rtdb-rules.cjs` only uses `agent/`** |
| Prefer a single `*firebase*adminsdk*.json` or `serviceAccount*.json` in `agent/` | `seed-mastery-graph.mjs` (errors if multiple candidates) |

Place one Firebase **service account** key in `agent/` (gitignored) for local ops, or set `GOOGLE_APPLICATION_CREDENTIALS` to an absolute path.

```bash
# bash — example
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/serviceAccount.json"
```

```powershell
# PowerShell — example
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\serviceAccount.json"
```

Also ensure `agent` deps are installed once (Admin SDK lives there):

```bash
cd agent && npm install && cd ..
```

```powershell
cd agent; npm install; cd ..
```

---

## Checklist (order)

1. [Enable Anonymous Auth](#1-enable-anonymous-auth)
2. [Authorized domains](#2-authorized-domains)
3. [Deploy RTDB security rules](#3-deploy-rtdb-security-rules)
4. [Bootstrap admins](#4-bootstrap-admins)
5. [Deploy Cloud Functions + secrets](#5-deploy-cloud-functions--secrets)
6. [Set feature flags in RTDB](#6-set-feature-flags-in-rtdb)
7. [Seed mastery graph](#7-seed-mastery-graph)
8. [Purge legacy device data](#8-purge-legacy-device-data-optional--destructive)
9. [Verify AI status indicator modes](#9-verify-ai-status-indicator-modes)
10. [Smoke tests](#10-smoke-tests)

---

## 1. Enable Anonymous Auth

Required so GitHub Pages users get `auth.uid` for `users/{uid}/…` trees and create-only `/requests`.

1. Open [Firebase Console](https://console.firebase.google.com/) → your project (e.g. **theceocompass**).
2. **Authentication** → **Sign-in method**.
3. Enable **Anonymous**.
4. Confirm **Google** remains enabled (admin / cross-device link).

No CLI required. Without Anonymous, learning writes and AI request ownership fail for first-time visitors.

---

## 2. Authorized domains

**Authentication** → **Settings** → **Authorized domains**. Ensure at least:

| Domain | Why |
|--------|-----|
| `localhost` | Local `next dev` |
| `kevinkicho.github.io` | Production GitHub Pages host |

Add any custom domain if you host elsewhere.

---

## 3. Deploy RTDB security rules

Source of truth: `database.rules.json` at repo root.

`scripts/update-rtdb-rules.cjs` reads a service account JSON from **`agent/`** (first `*.json` that is not package files), backs up remote rules to `database.rules.backup.json`, then PUTs local rules.

```bash
# bash — service account JSON must be in agent/
cd agent && npm install && cd ..
node scripts/update-rtdb-rules.cjs --dry-run   # validate path + backup fetch only
node scripts/update-rtdb-rules.cjs             # deploy
```

```powershell
# PowerShell
cd agent; npm install; cd ..
node scripts/update-rtdb-rules.cjs --dry-run
node scripts/update-rtdb-rules.cjs
```

**Rollback:** copy `database.rules.backup.json` → `database.rules.json` and re-run the script (or restore from git and re-deploy).

### Optional: Firebase CLI

```bash
firebase use theceocompass   # or your project id
firebase deploy --only database
```

```powershell
firebase use theceocompass
firebase deploy --only database
```

(`firebase.json` maps `"database.rules": "database.rules.json"`.)

---

## 4. Bootstrap admins

Rules grant admin write on enrichment, feature flags, mastery, etc. via `admins/{uid} === true`.

1. Sign in to the app (or Firebase Console Auth) with the operator Google account.
2. Copy the Firebase Auth **UID** (Console → Authentication → Users, or browser DevTools → Application → IndexedDB / Auth, or Network token claims).
3. Run:

```bash
# bash
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/serviceAccount.json"
# Or rely on a single service-account JSON in agent/
node scripts/bootstrap-admins.mjs "<FIREBASE_AUTH_UID>"
# → ✓ admins/<uid> = true
```

```powershell
# PowerShell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\serviceAccount.json"
node scripts/bootstrap-admins.mjs "<FIREBASE_AUTH_UID>"
```

Verify in RTDB: `admins/<uid>` = `true`.

Do this **before** relying on admin-only writes (flags, prompt edits, mastery seed via client).

---

## 5. Deploy Cloud Functions + secrets

Full detail: [`docs/AI_CLOUD_SETUP.md`](./AI_CLOUD_SETUP.md). Summary:

### Prerequisites

- Firebase project on **Blaze** (outbound HTTPS from Functions)
- Firebase CLI: `npm i -g firebase-tools` then `firebase login`
- Node **20** for `functions/` builds

### Set secret (never commit)

```bash
# bash — interactive
firebase functions:secrets:set OPENAI_API_KEY

# or pipe (do not echo/log the key)
echo -n "$OPENAI_API_KEY" | firebase functions:secrets:set OPENAI_API_KEY --data-file=-
```

```powershell
# PowerShell — prefer interactive (safe on all PS versions)
firebase functions:secrets:set OPENAI_API_KEY

# Non-interactive: temp file (do not log/print the key; avoid piping strings to native EXE)
# PowerShell 5.x pipe → --data-file=- is unreliable (encoding/newlines).
Set-Content -NoNewline -Path .\_openai_key.tmp -Value $env:OPENAI_API_KEY
firebase functions:secrets:set OPENAI_API_KEY --data-file=.\_openai_key.tmp
Remove-Item .\_openai_key.tmp -Force
```

Optional params (defaults in code): `OPENAI_API_BASE` (`https://api.openai.com/v1`), `CLOUD_AI_MODEL` (`gpt-4o-mini`). Local template only: `functions/.env.example` → copy to gitignored `functions/.env` for emulator / deploy prompts.

### Install, test, deploy

```bash
cd functions
npm install
npm test
npm run build
cd ..
firebase use theceocompass   # or your project id
firebase deploy --only functions
# or: firebase deploy --only functions:processAIRequest
```

```powershell
cd functions
npm install
npm test
npm run build
cd ..
firebase use theceocompass
firebase deploy --only functions
```

Confirm region **us-central1** and RTDB instance `theceocompass-default-rtdb` (see `functions/src/index.ts`).

**Frontend note:** Cloud Function is live once deployed; the client still treats cloud as “not configured” until the frontend cloud wiring PR lands. You can smoke-test by writing `provider: "cloud"` requests with Admin SDK (see AI_CLOUD_SETUP).

---

## 6. Set feature flags in RTDB

Path: **`_config/feature_flags`**  
Rules: public **read**, **admin** write (parent `_config` is deny-read by default).

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `ai_provider_default` | `"agent"` \| `"local"` \| `"cloud"` | `"agent"` | Default when no Profile override |
| `cloud_ai_enabled` | boolean | `false` | Allow selecting / routing to cloud |
| `app_check_enforced` | boolean | `false` | App Check enforce (when scaffold lands) |
| `mastery_graph_enabled` | boolean | `false` | Mastery graph / next-action consumers |
| `sr_session_enabled` | boolean | `false` | SR session UX consumers |

Frontend: `frontend/src/lib/feature-flags.ts` + `FeatureFlagsProvider` — missing node → safe defaults above.

### Firebase Console

1. RTDB → create / edit node `_config/feature_flags`.
2. Paste JSON (example — leave most flags off until ready):

```json
{
  "ai_provider_default": "agent",
  "cloud_ai_enabled": false,
  "app_check_enforced": false,
  "mastery_graph_enabled": false,
  "sr_session_enabled": false
}
```

### Admin SDK one-shot (same credentials as other scripts)

```bash
# bash — from repo root; requires agent/node_modules and a key
node --input-type=module -e "
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const root = process.cwd();
const agentDir = join(root, 'agent');
const require = createRequire(import.meta.url);
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const key = keyPath
  ? JSON.parse(readFileSync(keyPath, 'utf8'))
  : JSON.parse(readFileSync(join(agentDir, readdirSync(agentDir).find(f => f.endsWith('.json') && !f.startsWith('package'))), 'utf8'));
const admin = require(join(agentDir, 'node_modules', 'firebase-admin'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(key), databaseURL: \`https://\${key.project_id}-default-rtdb.firebaseio.com\` });
await admin.database().ref('_config/feature_flags').set({
  ai_provider_default: 'agent',
  cloud_ai_enabled: false,
  app_check_enforced: false,
  mastery_graph_enabled: false,
  sr_session_enabled: false,
});
console.log('✓ _config/feature_flags written');
process.exit(0);
"
```

```powershell
# PowerShell — easiest: Firebase Console (RTDB → _config/feature_flags).
# Or write a one-off set-flags.mjs (do not commit secrets), e.g.:
@'
import { readFileSync, readdirSync } from "fs"
import { join } from "path"
import { createRequire } from "module"
const root = process.cwd()
const agentDir = join(root, "agent")
const require = createRequire(import.meta.url)
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
const key = keyPath
  ? JSON.parse(readFileSync(keyPath, "utf8"))
  : JSON.parse(readFileSync(join(agentDir, readdirSync(agentDir).find(f => f.endsWith(".json") && !f.startsWith("package"))), "utf8"))
const admin = require(join(agentDir, "node_modules", "firebase-admin"))
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(key),
    databaseURL: `https://${key.project_id}-default-rtdb.firebaseio.com`,
  })
}
await admin.database().ref("_config/feature_flags").set({
  ai_provider_default: "agent",
  cloud_ai_enabled: false,
  app_check_enforced: false,
  mastery_graph_enabled: false,
  sr_session_enabled: false,
})
console.log("✓ _config/feature_flags written")
process.exit(0)
'@ | Set-Content -Encoding utf8 .\set-flags.mjs
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\serviceAccount.json"
node .\set-flags.mjs
Remove-Item .\set-flags.mjs   # do not leave ops scratch scripts around
```

**Rollout guidance:** keep `cloud_ai_enabled` / `mastery_graph_enabled` / `sr_session_enabled` **false** until the corresponding frontend consumers are deployed and you are ready to expose them. Flipping flags does not require a frontend rebuild once consumers exist.

---

## 7. Seed mastery graph

Source: `frontend/src/data/mastery-edges.json`  
Writes (replace policy, not merge):

- `mastery/edges/{from}/{to}` → `{ type, weight }`
- `mastery/concepts/{id}` → metadata
- `_meta/mastery_graph` → version counts / `seededAt`

```bash
# bash — validate only (no credentials)
node scripts/seed-mastery-graph.mjs --dry-run

# push to RTDB
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/serviceAccount.json"
node scripts/seed-mastery-graph.mjs
```

```powershell
# PowerShell
node scripts/seed-mastery-graph.mjs --dry-run

$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\serviceAccount.json"
node scripts/seed-mastery-graph.mjs
```

Rules must allow public read + admin write on `mastery` (deployed in step 3). Re-seed after editing the JSON; stale edges not in the seed are removed.

Details: [`docs/ENGINEERING.md`](./ENGINEERING.md) → “Seeding the mastery graph”.

---

## 8. Purge legacy device data (optional — destructive)

After migration to `users/{uid}/…`, top-level device trees are legacy and rules deny new client writes. For cleanliness, delete them with Admin SDK:

| Root purged |
|-------------|
| `journal` |
| `reviews` |
| `progress` |
| `viewed` |
| `quizResults` |
| `scenarioHistory` |
| `favoriteQuotes` |

**Irreversible.** Ensure users have migrated / exported data first.

```bash
# bash — requires explicit --yes
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/serviceAccount.json"
node scripts/purge-legacy-device-data.mjs --yes
# → ✓ purged /journal … Done.
```

```powershell
# PowerShell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\serviceAccount.json"
node scripts/purge-legacy-device-data.mjs --yes
```

Without `--yes` the script refuses to run.

---

## 9. Verify AI status indicator modes

Navbar chip (`AiStatusIndicator` in `AiStatusProvider.tsx`, `data-testid="ai-status-indicator"`).

| Label | Dot color | When |
|-------|-----------|------|
| **AI online** | emerald | Provider `agent`; fresh `_meta/agent_heartbeat` with `ollama_ok` |
| **AI local** | emerald | Local AI Mode (Profile) / provider `local` |
| **AI cloud** | emerald | Provider `cloud` selected, Firebase configured, and Functions path available |
| **AI degraded** | amber | Agent heartbeat present but `ollama_ok` false |
| **AI stale** | amber | Agent heartbeat older than ~90s + skew buffer |
| **AI offline** | gray | No Firebase / no agent heartbeat / agent down (agent mode) |

### How to exercise each mode

1. **AI offline**  
   Stop the local agent. Profile: Local AI Mode **off**. Reload. Expect gray **AI offline**.

2. **AI online**  
   ```bash
   # Terminal A
   ollama run gemma4:latest
   # Terminal B
   cd agent && node index.js
   ```
   ```powershell
   # Terminal A: ollama run gemma4:latest
   # Terminal B:
   cd agent; node index.js
   ```
   Expect emerald **AI online** (tooltip may include default model).

3. **AI local**  
   Profile → enable **Local AI Mode** (browser → Ollama). Expect **AI local**. Agent can be stopped.

4. **AI degraded**  
   Agent running but Ollama stopped/unreachable so heartbeat has `ollama_ok: false`. Expect **AI degraded**.

5. **AI stale**  
   Kill the agent after a healthy heartbeat; wait past stale window (~3+ minutes with skew). Expect **AI stale** or **AI offline**.

6. **AI cloud**  
   1. Deploy Functions + secrets (`docs/AI_CLOUD_SETUP.md`).
   2. Set RTDB `_config/feature_flags.cloud_ai_enabled = true`.
   3. Profile → AI provider → **Cloud** (or `aiProvider: "cloud"` in `ceocompass_settings` / `NEXT_PUBLIC_AI_PROVIDER=cloud` rebuild).
   4. Expect emerald **AI cloud**. Run a sparkle/tutor action → Function processes `provider: "cloud"` requests.
   5. Optional: confirm `_meta/cloud_worker_heartbeat` updates after a successful cloud request (public read; Admin write).

Heartbeat paths:
- `_meta/agent_heartbeat` — local agent (public read; agent Admin write)
- `_meta/cloud_worker_heartbeat` — Cloud Function after successful AI (public read; Admin write)

---

## 10. Smoke tests

### Auth + persistence

1. Open production or local site with Firebase `.env` configured.
2. Confirm an anonymous session exists (Auth state in console / Network).
3. Write a journal entry or mark a concept reviewed → appears under `users/{uid}/…` in RTDB.

### Rules

1. Unauthenticated write to `users/...` should fail.
2. `/requests` create requires auth + matching `uid`.
3. Non-admin write to `_config/feature_flags` should fail.

### Feature flags

1. With flags node missing → app uses defaults (agent, flags false).
2. Set `mastery_graph_enabled: true` (when UI consumers exist) → behavior changes without rebuild.

### Cloud AI (function only)

See [`docs/AI_CLOUD_SETUP.md`](./AI_CLOUD_SETUP.md) → Manual smoke test (`provider: "cloud"` request → `conceptChats/{id}`).

```bash
firebase functions:log --only processAIRequest
```

### Mastery seed

```bash
node scripts/seed-mastery-graph.mjs --dry-run
# After seed: RTDB mastery/edges + _meta/mastery_graph.edgeCount match seed
```

### Frontend CI (local)

Docs-only changes do not require this; if you touch `frontend/`:

```bash
bash scripts/pre-commit-check.sh
```

```powershell
# Git Bash or WSL preferred for the shell script; or run checks individually:
cd frontend
npx tsc --noEmit
npx next lint
npx vitest run
npx next build
```

---

## Quick reference — scripts

| Script | Purpose |
|--------|---------|
| `scripts/update-rtdb-rules.cjs` | Deploy `database.rules.json` (key in `agent/`) |
| `scripts/bootstrap-admins.mjs <uid>` | `admins/{uid} = true` |
| `scripts/seed-mastery-graph.mjs` | Push mastery graph (`--dry-run` supported) |
| `scripts/purge-legacy-device-data.mjs --yes` | Delete legacy device roots |
| `agent/index.js` | Local agent (Ollama bridge + heartbeat) |
| `functions/` + `firebase deploy --only functions` | Cloud AI `processAIRequest` |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Learning data never saves on Pages | Anonymous auth off / Firebase not init | Enable Anonymous; check `NEXT_PUBLIC_FIREBASE_*` |
| `permission_denied` on user trees | Rules not deployed / wrong uid | Re-deploy rules; confirm `auth.uid` |
| Admin edits / flag writes fail | `admins/{uid}` missing | Run `bootstrap-admins.mjs` |
| Rules script “No service account key” | Empty `agent/` JSON | Place service account in `agent/` |
| Seed script “Multiple service account candidates” | Several JSON keys in `agent/` | Set `GOOGLE_APPLICATION_CREDENTIALS` explicitly |
| Cloud function never processes | Missing `provider: "cloud"` or secret | See AI_CLOUD_SETUP troubleshooting |
| Indicator always offline | Agent not running / wrong RTDB project | Start agent; verify `_meta/agent_heartbeat` |
| Google link fails on Pages | Domain not authorized | Add `kevinkicho.github.io` |

---

## Security reminders

- Do not paste API keys or service account JSON into issues, commits, or this repo.
- Prefer owner-only cloud enablement (`cloud_ai_enabled`) until App Check + rate limits ship.
- After `purge-legacy-device-data`, recovery is only from backups you made outside this script.

---

*Ops not automated by execute-plan: Console Anonymous auth, authorized domains, Function secrets, production rules deploy, paid LLM usage.*
