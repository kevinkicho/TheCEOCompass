# AI Cloud Setup

Cloud AI lets CEO Compass fulfill `/requests/{id}` entries via a Firebase Cloud Function
and an **OpenAI-compatible** Chat Completions API. No local agent or Ollama process is required
when the client sets `provider: "cloud"` on the request.

The local agent (`agent/index.js`) continues to handle requests without `provider: "cloud"`.

## Architecture

```
Browser  →  RTDB /requests/{id}  (status: pending, provider: "cloud")
                ↓
     Cloud Function processAIRequest  (onValueCreated)
                ↓
     OpenAI-compatible POST {apiBase}/chat/completions
                ↓
     RTDB response path (same as agent) + requests/{id}.status = done|error
```

Response path routing matches `agent/index.js` `getResponseRef`:

| Request shape | Response path |
|---------------|---------------|
| `category` + `framework_slug` + `concept_slug` | `framework/{fw}/{concept}/{category}/{id}` |
| `compare_response_path` | `{compare_response_path}/{id}` |
| `type === "compare_concepts"` | `comparisons/{id}` |
| `type === "concept_chat"` | `conceptChats/{id}` |
| `category === "quote"` | `quotes/generated/{id}` |
| `category === "scenario"` | `scenario-evaluations/{id}` |

## Prerequisites

- Firebase project with Realtime Database and Cloud Functions (Blaze plan for outbound HTTPS)
- Node 20+ for local `functions/` builds
- An API key for an OpenAI-compatible provider (OpenAI, Groq, Google Gemini OpenAI-compat, etc.)
- Firebase CLI: `npm i -g firebase-tools` and `firebase login`

## Secrets and parameters (never commit keys)

| Name | Type | Required | Default | Purpose |
|------|------|----------|---------|---------|
| `OPENAI_API_KEY` | Secret | Yes | — | Bearer token |
| `OPENAI_API_BASE` | String param | No | `https://api.openai.com/v1` | API root |
| `CLOUD_AI_MODEL` | String param | No | `gpt-4o-mini` | Default model |

Template for local reference only: `functions/.env.example` (do not put production keys there).

### Set the API key secret

```bash
# Interactive (recommended)
firebase functions:secrets:set OPENAI_API_KEY

# Or pipe from env (CI / local shell — do not log the value)
echo -n "$OPENAI_API_KEY" | firebase functions:secrets:set OPENAI_API_KEY --data-file=-
```

### Optional non-secret params (deploy-time)

```bash
# Example: Groq
firebase functions:config:set is deprecated for v2 params.
# Prefer .env files for the Functions runtime or set params at deploy:

# Create functions/.env (gitignored) for emulator / deploy params:
# OPENAI_API_BASE=https://api.groq.com/openai/v1
# CLOUD_AI_MODEL=llama-3.3-70b-versatile
```

Firebase Functions v2 `defineString` params can also be set via:

```bash
firebase deploy --only functions
# CLI prompts for unset params on first deploy, or use:
# firebase functions:params:set OPENAI_API_BASE=https://api.openai.com/v1
```

## Install, test, build

```bash
cd functions
npm install
npm test          # node:test + mock HTTP for llm helper
npm run build     # emits lib/
```

## Deploy

From the repo root (where `firebase.json` lives):

```bash
# First-time: select project
firebase use theceocompass   # or your project id

# Deploy only functions (runs predeploy: npm run build)
firebase deploy --only functions

# Or a single function
firebase deploy --only functions:processAIRequest
```

Confirm the function region is **us-central1** (matches default RTDB for `*.firebaseio.com`).

## Manual smoke test

1. Ensure the secret is set and the function is deployed.
2. Authenticate a test client (or use Admin SDK) and write:

```json
{
  "uid": "<your-auth-uid>",
  "status": "pending",
  "provider": "cloud",
  "type": "concept_chat",
  "created_at": 0,
  "payload": {
    "model": "gpt-4o-mini",
    "prompt": "Reply with exactly: pong",
    "stream": false,
    "options": { "temperature": 0 }
  }
}
```

to `requests/{some-uuid}`.

3. Watch:

```bash
firebase functions:log --only processAIRequest
```

4. Expect `requests/{id}/status` → `processing` → `done`, and a result at `conceptChats/{id}`:

```json
{
  "result": "pong",
  "model": "...",
  "prompt": "Reply with exactly: pong",
  "created_at": 1234567890
}
```

## Frontend wiring

This PR only deploys the function skeleton. Frontend sets `provider: "cloud"` in a later PR
(see Phase 2 PR 4 in `docs/DESIGN_PHASE_2_3.md`). Until then you can smoke-test with Admin SDK
or a temporary client write.

Feature flag (planned): `cloud_ai_enabled` under `_config/feature_flags`.

## Local agent coexistence

| `provider` field | Handler |
|------------------|---------|
| missing / `"agent"` | Local `agent/index.js` (Ollama) |
| `"cloud"` | `processAIRequest` Cloud Function |
| `"local"` | Browser → Ollama (no RTDB request) |

The local agent **skips** `provider === "cloud"` (`agent/index.js`: early return before claim).
The Cloud Function **skips** non-cloud rows and only claims via RTDB transaction when
`status === "pending"` and `provider === "cloud"`. Safe to run agent + function together.

## Reliability notes

- **Claim transaction:** Before calling the LLM, the handler transactions the live row to
  `status: "processing"`. Re-delivery after `done`/`error`/`processing` is a no-op (no double LLM spend).
- **LLM timeout:** `generateText` uses `AbortSignal.timeout(100_000)` so hung providers throw
  and `writeError` can set `status: "error"` before the function’s 120s hard timeout.
- **Error ordering:** `status: "error"` is written first; the response-path error payload is best-effort.
- **Missing response path:** Treated as an error (not a silent `done`).
- **Function `retry: false`:** Avoids automatic Eventarc re-invocation after failure; operator can reset stuck rows manually if needed.

## Invocation cost (billing)

RTDB `onValueCreated` **cannot filter** on `provider`. Every create under `/requests/{id}`
invokes `processAIRequest`, including pure agent traffic. Non-cloud invocations return
immediately after reading the snapshot (no LLM call, no secret needed for the skip path —
but cold starts and per-invocation billing still apply at scale).

If agent volume is high and cloud volume is low, consider later:

- A dedicated path such as `requests_cloud/{id}`, or
- An HTTPS callable / task queue for cloud-only traffic

For the skeleton phase this trade-off is accepted.

## Merge / branch note

Design lists PR3 dependency on PR1 (provider router). Rebase or merge this branch onto
PR1 tip before landing so git ancestry matches the execute-plan graph. This PR does not
change frontend behavior beyond coexistence; keep `frontend` `tsc` + vitest green on the
combined tree.

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Function never runs | `provider` must be `"cloud"`; status must be `"pending"` on create |
| Function runs but skips | Non-cloud provider, claim lost race, or already processing/done |
| `OPENAI_API_KEY is not set` | Secret not bound — redeploy after `functions:secrets:set` |
| 401/403 from LLM | Wrong key or base URL |
| 429 | Rate limits — backoff or lower concurrency |
| Permission denied writing RTDB | Function uses Admin SDK (bypasses rules); confirm Admin init + `databaseURL` |
| Timeout / stuck `processing` | LLM abort at 100s should set `error`; if runtime killed earlier, reset status manually |
| Wrong database | Set `FIREBASE_DATABASE_URL` or rely on default `theceocompass-default-rtdb` |

## Security notes

- **Never** commit `OPENAI_API_KEY`, `functions/.env`, or service account JSON.
- `.gitignore` excludes `functions/.env`, `functions/.secret.local`, and `functions/*.local`.
- Keys live only in Firebase Secret Manager (or your secret store for CI).
- Prefer App Check + per-uid rate limits (later PRs) before enabling cloud for all users.
