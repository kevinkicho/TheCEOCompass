# Agent CLI

Machine-friendly CLI for coding agents and ops pipelines.  
**Does not control a browser** — it reads/writes Firebase RTDB and suggests app routes.

## Setup

1. Firebase Admin service account JSON in `agent/` (or `GOOGLE_APPLICATION_CREDENTIALS`).
2. Optional AI for journal drafts: local Ollama **or** `OLLAMA_API_KEY` in `agent/.env`.
3. From **repo root**:

```bash
node agent/cli/index.js help
# or
npm run agent:cli -- help
```

## Commands

| Command | Purpose |
|---------|---------|
| `users list` | List user uids under `users/` |
| `context --uid <UID>` | Recent viewed, scenarios, quizzes, pathway, due reviews, journal |
| `catalog frameworks` | List frameworks from RTDB |
| `catalog framework --slug <s>` | Framework detail + concepts |
| `catalog scenarios` | List scenarios (RTDB or seed fallback) |
| `catalog scenario --slug <s>` | Scenario detail |
| `journal list --uid <UID>` | List journal entries |
| `journal draft-from-context --uid <UID>` | AI drafts from RTDB activity (`--apply` to write) |
| `navigate plan --uid <UID>` | Ordered next steps: routes + follow-up CLI |
| `pipeline daily --uid <UID>` | Full daily workflow snapshot (+ optional journal apply) |

Always pass `--json` for structured output.

## Example pipeline

```bash
# 1) Inspect learner
npm run agent:cli -- context --uid "$UID" --json

# 2) What should we do next?
npm run agent:cli -- navigate plan --uid "$UID" --json

# 3) Dry-run journal entries from recent activity
npm run agent:cli -- journal draft-from-context --uid "$UID" --limit 3 --json

# 4) Write them
npm run agent:cli -- journal draft-from-context --uid "$UID" --limit 3 --apply --json

# 5) One-shot daily workflow
npm run agent:cli -- pipeline daily --uid "$UID" --json
npm run agent:cli -- pipeline daily --uid "$UID" --apply-journal --json
```

## How this relates to the web app

| Path | Behavior |
|------|----------|
| **Browser journal** | Loads learner context client-side from RTDB, then AI structures entries |
| **Agent CLI** | Same signals via Admin SDK; can draft/apply without the UI |
| **Ollama agent (`agent/index.js`)** | Separate process: watches `/requests` for in-app AI features |

There is still no Playwright-based “click around the UI” driver. Prefer RTDB context + route suggestions for agent workflows.

## CI

CLI is **not** part of required GitHub Actions CI.  
For CI pass rules, see **[docs/CI.md](./CI.md)**.
