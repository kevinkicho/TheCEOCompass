// Sync enriched concept data from backend seed JSON into frontend staticData.ts
// Merges: why_it_matters, steps, pitfalls, related_concepts, case_study, exercise, order_index
// Matching is by concept name (282 names match 1:1 between backend and frontend)
//
// Usage: node scripts/sync-backend-seed.mjs

import { readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const BACKEND_SEED = join(__dirname, "..", "backend", "seed", "frameworks.json")
const FRONTEND_STATIC = join(__dirname, "..", "frontend", "src", "lib", "staticData.ts")

// Fields to merge from backend into frontend
const ENRICHMENT_FIELDS = [
  "why_it_matters",
  "steps",
  "pitfalls",
  "related_concepts",
  "case_study",
  "exercise",
  "order_index",
]

function main() {
  // 1. Read backend seed
  const backend = JSON.parse(readFileSync(BACKEND_SEED, "utf8"))
  console.log(`Backend: ${backend.length} frameworks`)

  // Build backend lookup: framework slug → concept name → concept data
  const backLookup = {}
  for (const fw of backend) {
    backLookup[fw.slug] = {}
    for (const concept of fw.concepts || []) {
      backLookup[fw.slug][concept.name] = concept
    }
  }

  // 2. Read frontend staticData.ts
  const content = readFileSync(FRONTEND_STATIC, "utf8")

  // Parse the frameworks array from the TS file
  const startMarker = "export const staticFrameworks = ["
  const startIdx = content.indexOf(startMarker)
  if (startIdx === -1) throw new Error("Could not find export const staticFrameworks = [")

  const arrayStart = startIdx + startMarker.length
  // Find matching closing bracket
  let depth = 1
  let arrayEnd = -1
  for (let i = arrayStart; i < content.length; i++) {
    if (content[i] === "[") depth++
    else if (content[i] === "]") {
      depth--
      if (depth === 0) { arrayEnd = i; break }
    }
  }
  if (arrayEnd === -1) throw new Error("Could not find closing bracket of frameworks array")

  const jsonStr = content.slice(arrayStart - 1, arrayEnd + 1)
  const frontend = JSON.parse(jsonStr)
  console.log(`Frontend: ${frontend.length} frameworks`)

  // 3. Merge enrichment data
  let matched = 0
  let enriched = 0

  for (const fw of frontend) {
    const backFw = backLookup[fw.slug]
    if (!backFw) continue

    for (const concept of fw.concepts || []) {
      matched++
      const backConcept = backFw[concept.name]
      if (!backConcept) continue

      let hadEnrichment = false
      for (const field of ENRICHMENT_FIELDS) {
        if (backConcept[field] !== undefined && backConcept[field] !== null) {
          concept[field] = backConcept[field]
          hadEnrichment = true
        }
      }
      if (hadEnrichment) enriched++
    }
  }

  console.log(`Matched concepts: ${matched}`)
  console.log(`Enriched concepts: ${enriched}`)

  // 4. Serialize back to TS file
  const header = content.slice(0, arrayStart - 1)
  const footer = content.slice(arrayEnd + 1)

  const newJson = JSON.stringify(frontend, null, 2)
  const newContent = header + newJson + footer

  writeFileSync(FRONTEND_STATIC, newContent, "utf8")
  console.log(`\nWritten to ${FRONTEND_STATIC}`)

  // Count enriched fields in result
  const reParsed = JSON.parse(newJson)
  let totalWhy = 0, totalSteps = 0, totalPitfalls = 0, totalRelated = 0, totalCase = 0, totalExercise = 0, totalOrder = 0
  for (const fw of reParsed) {
    for (const c of fw.concepts || []) {
      if (c.why_it_matters) totalWhy++
      if (c.steps && c.steps.length) totalSteps++
      if (c.pitfalls && c.pitfalls.length) totalPitfalls++
      if (c.related_concepts && c.related_concepts.length) totalRelated++
      if (c.case_study) totalCase++
      if (c.exercise) totalExercise++
      if (c.order_index !== undefined) totalOrder++
    }
  }
  console.log(`\nFinal counts in frontend:`)
  console.log(`  why_it_matters: ${totalWhy}`)
  console.log(`  steps: ${totalSteps}`)
  console.log(`  pitfalls: ${totalPitfalls}`)
  console.log(`  related_concepts: ${totalRelated}`)
  console.log(`  case_study: ${totalCase}`)
  console.log(`  exercise: ${totalExercise}`)
  console.log(`  order_index: ${totalOrder}`)
}

main()
