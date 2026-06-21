# Architecture Alternatives & Future Directions

## Current Architecture

```
GitHub Pages (static frontend)
    ↓ pushes request
Firebase RTDB /requests/{id}
    ↓ agent detects via child_added
Local agent (agent/index.js) → localhost:11434 (Ollama)
    ↓ writes result
Firebase RTDB /framework/{slug}/{concept}/{category}/{id}
    ↓ onValue listener
Browser receives result
```

**Downside:** Requires a long-running local Node.js agent process alongside Ollama.

## Alternative A — Firebase Functions + Ollama Cloud API

```
Firebase Hosting (frontend)
    ↓ calls
Firebase Cloud Function (https.onCall)
    ↓ POST api.ollama.com with API key
Ollama Cloud API
    ↓ returns result
Firebase Cloud Function → writes to RTDB
```

**Pros:**
- No local agent needed
- No local Ollama needed
- Works from anywhere

**Cons:**
- Requires Ollama account with credits
- API key management needed

**Implementation notes from VocabMaster:**
- `functions/src/server.ts` runs a local proxy that forwards to `api.ollama.com` with `OLLAMA_API_KEY`
- The proxy is a simple Express server
- Firebase Function calls the proxy (which could also be a cloud function calling the API directly)

## Alternative B — Firebase Functions + Local Ollama Tunnel

```
Firebase Hosting (frontend)
    ↓ calls
Firebase Cloud Function
    ↓ via cloudflared/ngrok tunnel
Local proxy → localhost:11434 (Ollama)
    ↓ returns result
Firebase Cloud Function → writes to RTDB
```

**Pros:**
- No local agent needed
- Keeps local Ollama (free, private)
- Firebase Functions handle retry, queueing, error handling

**Cons:**
- Tunnel process (cloudflared) still needs to run locally
- Tunnel URL changes on restart unless using a fixed subdomain
- Latency from cloud → local round trip

**Implementation sketch:**
```typescript
// Firebase Function (functions/src/index.ts)
import * as functions from "firebase-functions"
import * as https from "https"

export const processAIRequest = functions.database
  .ref("/requests/{requestId}")
  .onCreate(async (snap, ctx) => {
    const { model, prompt, framework_slug, concept_slug, category } = snap.val()
    const TUNNEL_URL = functions.config().ollama.tunnel_url // set via firebase functions:config:set

    const res = await fetch(`${TUNNEL_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false }),
    })
    const data = await res.json()

    const path = `framework/${framework_slug}/${concept_slug}/${category}/${ctx.params.requestId}`
    await admin.database().ref(path).set({
      result: data.response,
      created_at: Date.now(),
    })
    await snap.ref.update({ status: "done" })
  })
```

## Summary

| Aspect | Current Agent | Alt A (Cloud API) | Alt B (Tunnel) |
|--------|--------------|-------------------|----------------|
| Local processes | agent + ollama | nothing | tunnel + ollama |
| Cost | free (local) | Ollama credits | free (local) |
| Reliability | agent can crash | Google-managed | tunnel can drop |
| Setup complexity | medium | low (API key only) | medium (cloudflared) |
