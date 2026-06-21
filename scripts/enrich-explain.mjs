// Batch-generate "explain further" content for all concepts that lack it.
// Calls Ollama directly (not via Firebase/agent), writes results to RTDB.
//
// Usage: node scripts/enrich-explain.mjs
// Requires: Ollama on localhost:11434, service account key in agent/

import { readFileSync, writeFileSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import admin from "../agent/node_modules/firebase-admin/lib/index.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OLLAMA_URL = "http://localhost:11434/api/generate"
const MODEL = "gemma4:latest"
const STATIC_DATA_PATH = join(__dirname, "..", "frontend", "src", "lib", "staticData.ts")

// ── Firebase Admin ──
function loadSA() {
  const agentDir = join(__dirname, "..", "agent")
  const files = readdirSync(agentDir).filter((f) => f.endsWith(".json") && !f.includes("package"))
  return JSON.parse(readFileSync(join(agentDir, files[0]), "utf8"))
}
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(loadSA()),
    databaseURL: "https://theceocompass-default-rtdb.firebaseio.com",
  })
}
const db = admin.database()

// ── Parse staticData.ts ──
function parseFrameworks(filePath) {
  const content = readFileSync(filePath, "utf8")
  const startMarker = "export const staticFrameworks = ["
  const startIdx = content.indexOf(startMarker)
  if (startIdx === -1) throw new Error("Could not find export const staticFrameworks = [")
  const arrayOpen = startIdx + startMarker.length - 1
  let depth = 1
  let end = -1
  for (let i = arrayOpen + 1; i < content.length; i++) {
    if (content[i] === "[") depth++
    else if (content[i] === "]") { depth--; if (depth === 0) { end = i; break } }
  }
  if (end === -1) throw new Error("Could not find closing bracket")
  return JSON.parse(content.slice(arrayOpen, end + 1))
}

// ── Ollama call ──
async function callOllama(prompt) {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: 0.4 } }),
  })
  if (!res.ok) throw new Error(`Ollama error (${res.status})`)
  let text = (await res.json()).response || ""
  text = text.trim()
  if (text.startsWith("```")) text = text.split("\n").slice(1).join("\n")
  if (text.endsWith("```")) text = text.slice(0, -3).trim()
  return text
}

// ── Prompt ──
function buildPrompt(conceptName, definition, frameworkTitle, tags) {
  return `You are a CEO coach explaining a specific framework concept to a busy executive. Be concise and actionable.

Framework: ${frameworkTitle}
Concept: ${conceptName}
Definition: ${definition}
Tags: ${(tags || []).join(", ")}

Return ONLY valid JSON:
{
  "real_world_example": "A brief real-world CEO example of this concept in action (2-3 sentences)",
  "ceo_insight": "Why this matters specifically to a CEO (1-2 sentences)",
  "common_mistake": "One common mistake CEOs make with this concept (1-2 sentences)",
  "related_tip": "A quick actionable tip for applying this (1 sentence)"
}`
}

// ── Main ──
async function main() {
  console.log("Reading concepts...")
  const frameworks = parseFrameworks(STATIC_DATA_PATH)
  const all = []
  for (const fw of frameworks) {
    for (const c of (fw.concepts || [])) {
      all.push({
        frameworkSlug: fw.slug,
        conceptSlug: c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        conceptName: c.name,
        definition: c.definition || "",
        frameworkTitle: fw.title,
        tags: c.tags || [],
      })
    }
  }
  console.log(`Total concepts: ${all.length}`)

  // Check which already have explain_further in RTDB
  console.log("Checking existing explain_further entries...")
  const todo = []
  for (const item of all) {
    const snap = await db.ref(`framework/${item.frameworkSlug}/${item.conceptSlug}/explain_further`).once("value")
    if (!snap.exists() || !Object.values(snap.val()).some((e) => e?.result)) {
      todo.push(item)
    }
  }
  console.log(`Concepts needing explain_further: ${todo.length}`)

  if (todo.length === 0) { console.log("All done!"); return }

  // Process each
  let done = 0, errors = 0
  for (const item of todo) {
    const prompt = buildPrompt(item.conceptName, item.definition, item.frameworkTitle, item.tags)
    console.log(`[${done + 1}/${todo.length}] ${item.frameworkTitle} → ${item.conceptName}`)
    try {
      const raw = await callOllama(prompt)
      const parsed = JSON.parse(raw)
      const requestId = crypto.randomUUID()
      await db.ref(`framework/${item.frameworkSlug}/${item.conceptSlug}/explain_further/${requestId}`).set({
        result: raw,
        model: MODEL,
        prompt,
        created_at: Date.now(),
      })
      done++
    } catch (err) {
      errors++
      console.error(`  ✗ ${err.message}`)
    }
    if (done % 10 === 0) console.log(`  Checkpoint: ${done} done, ${errors} errors`)
  }

  console.log(`\nDone! ${done} enriched, ${errors} errors`)
  process.exit(0)
}

main()
