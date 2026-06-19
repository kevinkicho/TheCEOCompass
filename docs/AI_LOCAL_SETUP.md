# Using Local AI (Ollama) with the GitHub Pages App

## Architecture

```
Browser (GitHub Pages) ──HTTP──> Local Backend (port 50128) ──HTTP──> Ollama (port 11434)
        │                          │                                │
        │ https://kevinkicho       │ http://localhost:50128         │ http://localhost:11434
        │   .github.io             │                                │
        │   /TheCEOCompass/        │ backend/app/services/          │ POST /api/generate
        │                          │   llm_service.py               │ model: gemma4cloud
```

The GitHub Pages frontend cannot call Ollama directly (browsers block cross-origin `localhost` requests from `github.io`). The FastAPI backend bridges the gap — it runs on your machine, receives requests from the browser, and proxies them to Ollama.

## Prerequisites

- [x] Ollama installed and running → `ollama serve`
- [x] Model pulled → `ollama pull gemma4cloud`
- [x] Backend `.env` already set to `LLM_PROVIDER=ollama`

## Step 1 — Start the Backend

```bash
cd ceo-platform
source venv/bin/activate
cd backend
uvicorn app.main:app --port 50128 --host 0.0.0.0
```

## Step 2 — Configure Frontend Connection

The frontend at `https://kevinkicho.github.io/TheCEOCompass/` needs to know where your backend lives. Since you're running locally, the frontend's `api.ts` already detects localhost vs static hosting.

**Detection logic** (`api.ts:8`):
```ts
const isStaticHosting = !window.location.hostname.includes("localhost")
                     && !window.location.hostname.includes("127.0.0.1")
```

On GitHub Pages, `isStaticHosting = true`. The framework API calls use static data (no backend needed). The AI-dependent calls (`generateQuiz`, etc.) try to hit `http://localhost:50128/api` — which fails because the browser on a `github.io` page can't reach `localhost`.

**Solution**: The quiz page needs to call the backend regardless of `isStaticHosting`. Since the user explicitly wants AI and has the backend running, we should allow the quiz and other AI endpoints to attempt the API call even on static hosting.

## Step 3 — Code Changes Needed

### 3a. Update `api.ts` — Allow AI calls on static hosting

Currently `generateQuiz` doesn't check `isStaticHosting` — it always calls the API. That's already correct. But `evaluateChoice` for scenarios needs to work too.

### 3b. Add scenario evaluation LLM integration

The scenario `evaluate_choice` endpoint in the backend doesn't currently call the LLM. It returns scoring from the `ScenarioEngine` but skips the AI coaching feedback. We need to wire it up:

```python
# backend/app/routers/scenarios.py — after engine.evaluate_stage()
if result.next_stage_id is None and result.is_complete:
    # Generate AI coaching feedback
    try:
        feedback = await llm_service.evaluate_scenario_response(...)
        result.feedback = feedback
    except:
        pass
```

### 3c. Forward Ollama headers from frontend to all AI endpoints

The scenario evaluate endpoint should also accept `X-Ollama-Url` and `X-Ollama-Model` headers, similar to the quiz endpoint.

## Step 4 — Test the Flow

1. Start backend → `uvicorn app.main:app --port 50128 --host 0.0.0.0`
2. Visit GitHub Pages → https://kevinkicho.github.io/TheCEOCompass/
3. Go to Quiz → Select a framework → Click "Generate Quiz"
4. Browser calls `localhost:50128/api/quiz/generate` → Backend calls Ollama → Returns questions

## Step 5 — Verify Ollama is working

```bash
# Test Ollama directly
curl http://localhost:11434/api/generate \
  -d '{"model":"gemma4cloud","prompt":"Say hello","stream":false}'
```

```bash
# Test the backend → Ollama connection
curl -X POST http://localhost:50128/api/quiz/generate \
  -H "Content-Type: application/json" \
  -d '{"framework_id":"11111111-1111-1111-1111-111111111111","num_questions":3,"difficulty":"medium"}'
```

## What AI Features Will Work

| Feature | Status | Notes |
|---------|--------|-------|
| **Quiz generation** | ✅ Works now | Backend → Ollama via `llm_service._call_ollama()` |
| **Scenario coaching** | ⚠️ Needs wiring | `evaluate_choice` doesn't call LLM yet |
| **Scenario generation** | ⚠️ Needs wiring | `generate_scenario` endpoint not exposed to frontend |
| **Journal AI analysis** | ❌ Not implemented | No AI feature planned for journal |

## Remaining Work

1. [ ] Wire scenario evaluation to call LLM for coaching feedback
2. [ ] Add Ollama header forwarding to scenario endpoints
3. [ ] Allow AI endpoints to attempt API call even on `isStaticHosting`
4. [ ] Test quiz generation end-to-end from GitHub Pages to local Ollama
