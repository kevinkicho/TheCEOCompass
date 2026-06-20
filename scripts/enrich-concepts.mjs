// CEO Compass Concept Enrichment Script
// Iterates all 282 concepts and generates missing fields via Ollama.
// Run: node scripts/enrich-concepts.mjs
// Requires: Ollama running on localhost:11434 with gemma4:latest
//
// Output: scripts/enriched-concepts.json — merge this back into staticData.ts

import { readFileSync, writeFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const STATIC_DATA_PATH = join(__dirname, "..", "frontend", "src", "lib", "staticData.ts")
const OUTPUT_PATH = join(__dirname, "enriched-concepts.json")
const CHECKPOINT_PATH = join(__dirname, "enrich-checkpoint.json")
const OLLAMA_URL = "http://localhost:11434/api/generate"
const MODEL = "gemma4:latest"

// Parse the staticData.ts to extract frameworks and concepts
function extractConcepts(filePath) {
  const content = readFileSync(filePath, "utf8")
  const startMarker = "export const staticFrameworks = ["
  const startIdx = content.indexOf(startMarker)
  if (startIdx === -1) throw new Error("Could not find export const staticFrameworks = [")

  // Position of the `[` that opens the frameworks array
  const arrayOpen = startIdx + startMarker.length - 1

  // Find matching closing bracket using depth tracking
  let depth = 1
  let end = -1
  for (let i = arrayOpen + 1; i < content.length; i++) {
    if (content[i] === "[") depth++
    else if (content[i] === "]") {
      depth--
      if (depth === 0) { end = i; break }
    }
  }
  if (end === -1) throw new Error("Could not find closing bracket of frameworks array")

  const jsonStr = content.slice(arrayOpen, end + 1)
  return JSON.parse(jsonStr)
}

async function callOllama(prompt) {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: 0.3 } }),
  })
  if (!res.ok) throw new Error(`Ollama error (${res.status})`)
  const data = await res.json()
  let text = (data.response || "").trim()
  if (text.startsWith("```")) text = text.split("\n").slice(1).join("\n")
  if (text.endsWith("```")) text = text.slice(0, -3).trim()
  return text
}

function buildPrompt(frameworkTitle, conceptName, definition, tags) {
  return `You are a CEO coach and business educator. Given a framework and one of its concepts, generate enrichment fields that make the concept actionable for a CEO.

Framework: ${frameworkTitle}
Concept: ${conceptName}
Definition: ${definition}
Tags: ${(tags || []).join(", ")}

Generate the following fields. Return ONLY valid JSON:

{
  "why_it_matters": "Why this concept matters specifically to a CEO (1-2 sentences)",
  "steps": [
    { "title": "Step 1 title", "description": "Brief description of what to do (1 sentence)" },
    { "title": "Step 2 title", "description": "..." },
    { "title": "Step 3 title", "description": "..." }
  ],
  "pitfalls": [
    { "title": "Pitfall name", "description": "What to watch out for (1-2 sentences)" },
    { "title": "Pitfall name", "description": "..." }
  ],
  "related_concepts": [
    { "name": "Related concept name", "relationship": "How it relates to ${conceptName} (1 sentence)" },
    { "name": "Another concept", "relationship": "..." }
  ]
}

Make each field concise, specific, and immediately useful. 3 steps, 2 pitfalls, 2 related concepts.`
}

async function main() {
  console.log("Reading staticData.ts...")
  const frameworks = extractConcepts(STATIC_DATA_PATH)
  console.log(`Found ${frameworks.length} frameworks`)

  // Collect all concepts needing enrichment
  const todo = []
  for (const fw of frameworks) {
    for (const concept of (fw.concepts || [])) {
      const needsEnrichment = !concept.why_it_matters
      todo.push({
        frameworkTitle: fw.title,
        frameworkSlug: fw.slug,
        conceptName: concept.name,
        conceptSlug: (concept.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        definition: concept.definition || "",
        tags: concept.tags || [],
        existing: {
          why_it_matters: concept.why_it_matters,
          steps: concept.steps,
          pitfalls: concept.pitfalls,
          related_concepts: concept.related_concepts,
        },
      })
    }
  }

  console.log(`Total concepts: ${todo.length}`)
  const needsEnrichment = todo.filter((t) => !t.existing.why_it_matters)
  console.log(`Concepts needing enrichment: ${needsEnrichment.length}`)

  if (needsEnrichment.length === 0) {
    console.log("All concepts already enriched!")
    return
  }

  // Load checkpoint if exists
  let enriched = {}
  if (existsSync(CHECKPOINT_PATH)) {
    const cp = JSON.parse(readFileSync(CHECKPOINT_PATH, "utf8"))
    enriched = cp.enriched || {}
    console.log(`Resuming from checkpoint with ${Object.keys(enriched).length} already done`)
  }

  // Process each concept
  let done = Object.keys(enriched).length
  let errors = 0

  for (const item of needsEnrichment) {
    const key = `${item.frameworkSlug}/${item.conceptSlug}`
    if (enriched[key]) {
      done++
      continue
    }

    const prompt = buildPrompt(item.frameworkTitle, item.conceptName, item.definition, item.tags)
    console.log(`[${done + 1}/${needsEnrichment.length}] ${item.frameworkTitle} → ${item.conceptName}`)

    try {
      const raw = await callOllama(prompt)
      const parsed = JSON.parse(raw)
      enriched[key] = {
        frameworkSlug: item.frameworkSlug,
        conceptSlug: item.conceptSlug,
        conceptName: item.conceptName,
        enrichment: parsed,
      }
      done++

      // Checkpoint every 10
      if (done % 10 === 0) {
        writeFileSync(CHECKPOINT_PATH, JSON.stringify({ enriched }, null, 2))
        console.log(`  → Checkpoint saved (${done} done, ${errors} errors)`)
      }
    } catch (err) {
      errors++
      console.error(`  ✗ Error: ${err.message}`)
      // Still checkpoint on error to skip it next time
      done++
    }
  }

  // Write final output
  writeFileSync(OUTPUT_PATH, JSON.stringify(enriched, null, 2))
  console.log(`\nDone! ${Object.keys(enriched).length} concepts enriched.`)
  console.log(`Output: ${OUTPUT_PATH}`)
  console.log(`Errors: ${errors}`)

  // Clean up checkpoint
  if (existsSync(CHECKPOINT_PATH)) {
    const cp = JSON.parse(readFileSync(CHECKPOINT_PATH, "utf8"))
    if (Object.keys(cp.enriched).length === Object.keys(enriched).length) {
      // Keep checkpoint for reference but note completion
      console.log("Checkpoint retained at " + CHECKPOINT_PATH)
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
