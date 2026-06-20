// CEO Compass Ollama Agent
// Bridges Firebase RTDB → local Ollama → Firebase RTDB
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
console.log(`  Watching /requests → ${ollamaUrl}`)

// Stale request sweep on startup
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
}
sweepStaleRequests()

requestsRef.on("child_added", async (snapshot) => {
  const requestId = snapshot.key
  const data = snapshot.val()

  if (!data || data.status !== "pending") return

  const requestRef = db.ref(`requests/${requestId}`)
  const responseRef = db.ref(`responses/${requestId}`)

  console.log(`\n→ [${requestId}] Processing: ${data.type || "generate"}`)

  try {
    await requestRef.update({ status: "processing", started_at: Date.now() })

    const ollamaRes = await fetch(ollamaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data.payload),
    })

    if (!ollamaRes.ok) {
      const text = await ollamaRes.text()
      throw new Error(`Ollama error (${ollamaRes.status}): ${text.substring(0, 200)}`)
    }

    const ollamaData = await ollamaRes.json()
    let result = (ollamaData.response || "").trim()

    if (result.startsWith("```")) {
      result = result.split("\n").slice(1).join("\n")
    }
    if (result.endsWith("```")) {
      result = result.slice(0, -3).trim()
    }

    const responseData = {
      result,
      model: data.payload.model || "gemma4:latest",
      created_at: Date.now(),
    }

    const indexedData = {
      ...responseData,
      prompt: data.payload.prompt || "",
    }

    // Write to flat path
    await responseRef.set(responseData)

    // Write to indexed path for caching
    const { framework_slug, concept_slug, type } = data
    if (type === "quote") {
      const quotePath = `quotes/generated/${requestId}`
      await db.ref(quotePath).set({
        ...indexedData,
        category: data.category || "",
      })
    } else if (framework_slug) {
      const indexPath = concept_slug
        ? `framework/${framework_slug}/${concept_slug}/responses/${requestId}`
        : `framework/${framework_slug}/quiz/responses/${requestId}`
      await db.ref(indexPath).set(indexedData)
    }

    await requestRef.update({ status: "done" })
    console.log(`  ✓ [${requestId}] Done (${result.length} chars)`)
  } catch (err) {
    console.error(`  ✗ [${requestId}] ${err.message}`)
    await responseRef.set({
      error: err.message,
      created_at: Date.now(),
    })
    await requestRef.update({ status: "error" })
  }
})
