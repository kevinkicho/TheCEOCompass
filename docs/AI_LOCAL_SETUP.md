# Using Local AI (Ollama) with the GitHub Pages App

## Architecture (New — No Backend Needed!)

```
Browser (GitHub Pages) ──HTTP──> Ollama (port 11434)
        │                          │
        │ https://kevinkicho       │ http://localhost:11434
        │   .github.io             │ POST /api/generate
        │   /TheCEOCompass/        │ model: gemma4:latest
```

The frontend now calls **Ollama directly** from the browser. No FastAPI backend needed.

## Prerequisites

- [x] Ollama installed
- [ ] Ollama restarted with CORS enabled (see Step 1)
- [x] Model pulled → `ollama pull gemma4:latest`

## Step 1 — Restart Ollama with CORS

Ollama blocks cross-origin requests by default. To allow the GitHub Pages site to call it:

```bash
# Stop Ollama, then restart with:
OLLAMA_ORIGINS=* ollama serve
```

Or set it permanently (Linux/macOS):
```bash
export OLLAMA_ORIGINS=*
ollama serve
```

Or on Windows (PowerShell):
```powershell
$env:OLLAMA_ORIGINS="*"
ollama serve
```

## Step 2 — Verify

```bash
# Test Ollama is responding
curl http://localhost:11434/api/generate \
  -d '{"model":"gemma4:latest","prompt":"Say hello","stream":false}'
```

## Step 3 — Refresh the GitHub Pages Site

Go to https://kevinkicho.github.io/TheCEOCompass/quiz/ and click **Generate Quiz**. The browser calls Ollama directly from your local machine.

## What AI Features Will Work (No Backend Needed)

| Feature | How it calls Ollama |
|---------|-------------------|
| **Quiz generation** | Frontend builds prompt → calls `localhost:11434/api/generate` → parses JSON |
| **Concept explanation** | Frontend builds prompt → calls `localhost:11434/api/generate` → parses JSON |
| **Scenario coaching** | Requires backend (not yet wired to direct Ollama) |

## Settings

On the Profile page, you can override the Ollama model name in the Settings section. The URL always points to `http://localhost:11434`.
