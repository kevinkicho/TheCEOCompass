// CEO Compass Ollama Agent
// Bridges Firebase RTDB → local Ollama (or cloud API key fallback) → Firebase RTDB
// Run: node index.js
// Requires: service account JSON from Firebase Console in this directory
// Optional: agent/.env with OLLAMA_API_KEY for cloud fallback when local Ollama is down

import admin from "firebase-admin"
import { readFileSync, readdirSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { generateWithFallback, loadOllamaEnv, probeLocalOllama } from "./ollama-client.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Minimal .env loader (no dependency). Does not override existing process.env. */
function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return
  const text = readFileSync(filePath, "utf8")
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadDotEnv(join(__dirname, ".env"))
loadDotEnv(join(__dirname, "..", ".env"))

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
const ollamaEnv = loadOllamaEnv()

console.log("✓ Agent connected to Firebase RTDB")
console.log(
  `  Watching /requests → local ${ollamaEnv.localUrl}` +
    (ollamaEnv.apiKey ? ` + cloud fallback (${ollamaEnv.apiBase})` : " (no OLLAMA_API_KEY cloud fallback)"),
)

const HEARTBEAT_PATH = "_meta/agent_heartbeat"
const HEARTBEAT_MS = 30_000

async function writeHeartbeat() {
  const localOk = await probeLocalOllama(ollamaEnv.localUrl, 5000)
  const cloudOk = Boolean(ollamaEnv.apiKey)
  const ollamaOk = localOk || cloudOk
  await db.ref(HEARTBEAT_PATH).set({
    status: ollamaOk ? "ok" : "degraded",
    updated_at: Date.now(),
    ollama_ok: ollamaOk,
    ollama_local_ok: localOk,
    ollama_cloud_fallback: cloudOk,
    ollama_checked_at: Date.now(),
    model_default: ollamaEnv.model,
    agent_version: "1.2.0",
  })
}

writeHeartbeat().catch((e) => console.warn("heartbeat failed", e.message))
setInterval(() => {
  writeHeartbeat().catch((e) => console.warn("heartbeat failed", e.message))
}, HEARTBEAT_MS)

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
  // Cloud Function processAIRequest owns provider === "cloud" requests
  if (data.provider === "cloud") return

  const requestRef = db.ref(`requests/${requestId}`)
  const responseRef = getResponseRef(requestId, data)

  console.log(`\n→ [${requestId}] Processing: ${data.type || "generate"}`)

  try {
    await requestRef.update({ status: "processing", started_at: Date.now() })

    const prompt = data.payload?.prompt
    if (!prompt || typeof prompt !== "string") {
      throw new Error("Request payload.prompt is required")
    }
    const temperature =
      typeof data.payload?.options?.temperature === "number"
        ? data.payload.options.temperature
        : 0.7
    const model = data.payload?.model || ollamaEnv.model

    const { text: result, model: usedModel, source } = await generateWithFallback(prompt, {
      model,
      temperature,
    })

    const responseData = {
      result,
      model: usedModel,
      prompt: data.payload.prompt || "",
      created_at: Date.now(),
      source,
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
    console.log(`  ✓ [${requestId}] Done via ${source} (${result.length} chars)`)
  } catch (err) {
    console.error(`  ✗ [${requestId}] ${err.message}`)
    await writeError(requestId, data, err.message)
  }
}
