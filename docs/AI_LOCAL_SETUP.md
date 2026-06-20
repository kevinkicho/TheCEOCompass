# AI Local Setup

## How AI Features Work

1. Browser writes request to Firebase RTDB at `/requests/$uuid`
2. Local agent detects new request via `child_added` listener
3. Agent calls Ollama at `localhost:11434/api/generate`
4. Agent writes response to `/responses/$uuid` (flat) and `/framework/{slug}/{concept}/responses/$uuid` (indexed)
5. Browser receives response via real-time subscription

## Requirements

- Ollama running on `localhost:11434` with `gemma4:latest`
- Firebase project with RTDB enabled
- Service account key in `agent/` directory
- `frontend/.env` with Firebase config values

## Starting the Agent

```bash
cd agent
npm install
# Place the service account JSON in this directory
node index.js
```

The agent logs each request:
```
✓ Agent connected to Firebase RTDB
  Watching /requests → http://localhost:11434/api/generate

→ [uuid] Processing: explain
  ✓ [uuid] Done (1234 chars)
```

## Caching

AI responses are cached for 24 hours at `/framework/{slug}/{concept}/responses/`.
When a concept page loads, it checks cache first. If found, the cached explanation
appears immediately with a "Cached" badge. Clicking "Re-generate" bypasses cache.
