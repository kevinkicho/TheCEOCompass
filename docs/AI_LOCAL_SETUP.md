# Using Local AI (Ollama) with the GitHub Pages App

## Architecture

```
Browser (GitHub Pages) ──HTTP──> CORS Proxy (port 8080) ──HTTP──> Ollama (port 11434)
```

The frontend tries to call Ollama directly first. If CORS blocks it, it falls back to the proxy.

## Quick Start

### 1. Run the CORS proxy (required if Ollama blocks cross-origin)

```bash
cd ceo-platform
node proxy.js
```

The proxy listens on **port 8080** and adds CORS headers to every response. Run it alongside Ollama in a separate terminal.

### 2. Verify

```bash
# Test Ollama is responding
curl http://localhost:11434/api/generate \
  -d '{"model":"gemma4:latest","prompt":"Say hello","stream":false}'

# Test the proxy is running
curl http://localhost:8080/api/tags
```

### 3. Refresh the GitHub Pages Site

Go to https://kevinkicho.github.io/TheCEOCompass/quiz/ and click **Generate Quiz**.

## Without a Proxy (if you can restart Ollama)

If you have access to restart Ollama with CORS enabled:

```bash
OLLAMA_ORIGINS=* ollama serve
```

Then no proxy is needed — the frontend calls port 11434 directly.
