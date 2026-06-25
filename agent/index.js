// CEO Compass Ollama Agent
// Bridges Firebase RTDB → local Ollama (streaming) → Firebase RTDB
// Run: node index.js
// Requires: service account JSON from Firebase Console in this directory

import admin from "firebase-admin"
import { readFileSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadServiceAccount() {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (fromEnv) {
    return JSON.parse(readFileSync(fromEnv, "utf8"))
  }
  const files = readdirSync(__dirname).filter((f) => f.endsWith(".json") && f !== "package.json" && f !== "package-lock.json")
  if (files.length > 0) {
    return JSON.parse(readFileSync(join(__dirname, files[0]), "utf8"))
  }
  throw new Error("No service account key found.")
}

const serviceAccount = loadServiceAccount()

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://theceocompass-default-rtdb.firebaseio.com",
})

const db = admin.database()
const requestsRef = db.ref("requests")
const ollamaUrl = "http://localhost:11434/api/generate"

console.log("✓ Agent connected to Firebase RTDB")
console.log(`  Watching /requests → ${ollamaUrl} (streaming)`)

// Stale request sweep on startup, then start listening
async function sweepStaleRequests() {
  const snap = await requestsRef.orderByChild("status").equalTo("processing").once("value")
  let count = 0
  snap.forEach((child) => {
    const data = child.val()
    if (data.started_at && Date.now() - data.started_at > 300000) {
      child.ref.update({ status: "pending" })
      count++
      console.log(`  ↻ Reset stale [${child.key}]`)
    }
  })
  if (count > 0) console.log(`  Swept ${count} stale requests`)
  // Start listening AFTER sweep so stale requests reset to "pending" are picked up
  requestsRef.on("child_added", handleRequest)
}
sweepStaleRequests()

function getResponseRef(requestId, data) {
  const { framework_slug, concept_slug, category } = data
  const responsePath = category && framework_slug && concept_slug
    ? `framework/${framework_slug}/${concept_slug}/${category}/${requestId}`
    : null
  if (responsePath) return db.ref(responsePath)
  if (data.compare_response_path) return db.ref(`${data.compare_response_path}/${requestId}`)
  if (data.type === "compare_concepts") return db.ref(`comparisons/${requestId}`)
  if (data.type === "concept_chat") return db.ref(`conceptChats/${requestId}`)
  if (category === "quote") return db.ref(`quotes/generated/${requestId}`)
  if (category === "scenario") return db.ref(`scenario-evaluations/${requestId}`)
  return null
}

async function writeError(requestId, data, errorMessage) {
  const errorData = { error: errorMessage, created_at: Date.now() }
  const ref = getResponseRef(requestId, data)
  if (ref) await ref.set(errorData)
  await db.ref(`requests/${requestId}`).update({ status: "error" })
}

async function handleRequest(snapshot) {
  const requestId = snapshot.key
  const data = snapshot.val()

  if (!data || data.status !== "pending") return

  const requestRef = db.ref(`requests/${requestId}`)
  const responseRef = getResponseRef(requestId, data)

  console.log(`\n→ [${requestId}] Processing: ${data.type || "generate"}`)

  try {
    await requestRef.update({ status: "processing", started_at: Date.now() })

    // Stream from Ollama (ndjson) — no stream:false, let Ollama stream naturally
    const ollamaRes = await fetch(ollamaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data.payload),
    })

    if (!ollamaRes.ok) {
      const text = await ollamaRes.text()
      throw new Error(`Ollama error (${ollamaRes.status}): ${text.substring(0, 200)}`)
    }

    // Read streaming ndjson response
    const reader = ollamaRes.body.getReader()
    const decoder = new TextDecoder()
    let fullResponse = ""
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const chunk = JSON.parse(line)
          if (chunk.response) fullResponse += chunk.response
        } catch {
          // skip malformed lines
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      try {
        const chunk = JSON.parse(buffer)
        if (chunk.response) fullResponse += chunk.response
      } catch {}
    }

    let result = fullResponse.trim()

    // Strip markdown code fences if present
    if (result.startsWith("```")) {
      result = result.split("\n").slice(1).join("\n")
    }
    if (result.endsWith("```")) {
      result = result.slice(0, -3).trim()
    }

    const responseData = {
      result,
      model: data.payload.model || "gemma4:latest",
      prompt: data.payload.prompt || "",
      created_at: Date.now(),
    }

    if (responseRef) {
      if (data.category === "quote") {
        await responseRef.set({ ...responseData, category: data.category || "" })
      } else if (data.category === "scenario") {
        await responseRef.set({ ...responseData, stage_id: data.stage_id || "" })
      } else {
        await responseRef.set(responseData)
      }
    }

    await requestRef.update({ status: "done" })
    console.log(`  ✓ [${requestId}] Done (${result.length} chars)`)
  } catch (err) {
    console.error(`  ✗ [${requestId}] ${err.message}`)
    await writeError(requestId, data, err.message)
  }
}
