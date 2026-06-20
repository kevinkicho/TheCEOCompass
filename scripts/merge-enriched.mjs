// Merge enriched-concepts.json (from enrich-concepts.mjs) into staticData.ts
// Only fills concepts that don't already have why_it_matters
//
// Usage: node scripts/merge-enriched.mjs

import { readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENRICHED_PATH = join(__dirname, "enriched-concepts.json")
const FRONTEND_STATIC = join(__dirname, "..", "frontend", "src", "lib", "staticData.ts")
const ENRICHMENT_FIELDS = ["why_it_matters", "steps", "pitfalls", "related_concepts"]

function parseFrontend(content) {
  const startMarker = "export const staticFrameworks = ["
  const startIdx = content.indexOf(startMarker)
  if (startIdx === -1) throw new Error("Could not find export const staticFrameworks = [")
  const arrayOpen = startIdx + startMarker.length - 1
  let depth = 1
  let end = -1
  for (let i = arrayOpen + 1; i < content.length; i++) {
    if (content[i] === "[") depth++
    else if (content[i] === "]") {
      depth--
      if (depth === 0) { end = i; break }
    }
  }
  if (end === -1) throw new Error("Could not find closing bracket")
  const jsonStr = content.slice(arrayOpen, end + 1)
  return { frameworks: JSON.parse(jsonStr), header: content.slice(0, arrayOpen), footer: content.slice(end + 1) }
}

function main() {
  // Read enriched data
  const enriched = JSON.parse(readFileSync(ENRICHED_PATH, "utf8"))
  console.log(`Enriched entries: ${Object.keys(enriched).length}`)

  // Read frontend
  const content = readFileSync(FRONTEND_STATIC, "utf8")
  const { frameworks, header, footer } = parseFrontend(content)
  console.log(`Frontend frameworks: ${frameworks.length}`)

  // Build enrich lookup: frameworkSlug/conceptName -> enrichment
  const lookup = {}
  for (const [key, val] of Object.entries(enriched)) {
    const slug = val.frameworkSlug + "/" + val.conceptName
    lookup[slug] = val.enrichment
  }

  // Merge
  let merged = 0
  let skipped = 0
  for (const fw of frameworks) {
    for (const concept of fw.concepts || []) {
      if (concept.why_it_matters) {
        skipped++
        continue
      }
      const key = fw.slug + "/" + concept.name
      const enrichment = lookup[key]
      if (!enrichment) continue
      for (const field of ENRICHMENT_FIELDS) {
        if (enrichment[field] !== undefined && enrichment[field] !== null) {
          concept[field] = enrichment[field]
        }
      }
      merged++
    }
  }

  console.log(`Concepts already enriched: ${skipped}`)
  console.log(`Newly merged: ${merged}`)

  // Serialize back
  const newJson = JSON.stringify(frameworks, null, 2)
  writeFileSync(FRONTEND_STATIC, header + newJson + footer, "utf8")
  console.log(`Written to ${FRONTEND_STATIC}`)

  // Verify counts
  const reParsed = JSON.parse(newJson)
  let totalWhy = 0
  for (const fw of reParsed) {
    for (const c of fw.concepts || []) {
      if (c.why_it_matters) totalWhy++
    }
  }
  console.log(`Total with why_it_matters: ${totalWhy} / 282`)
}

main()
