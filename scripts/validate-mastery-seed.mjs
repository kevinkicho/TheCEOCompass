#!/usr/bin/env node
/**
 * Validate mastery-edges.json against framework-meta / optional RTDB-shaped catalog.
 * Ensures every edge endpoint has a concept node; reports orphan slugs.
 *
 *   node scripts/validate-mastery-seed.mjs
 *   node scripts/validate-mastery-seed.mjs --strict
 */

import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const strict = process.argv.includes("--strict")

const seedPath = join(root, "frontend/src/data/mastery-edges.json")
const metaPath = join(root, "frontend/src/data/framework-meta.json")

const seed = JSON.parse(readFileSync(seedPath, "utf8"))
const concepts = seed.concepts || {}
const conceptIds = new Set(
  Array.isArray(concepts)
    ? concepts.map((c) => c.id || c.conceptId)
    : Object.keys(concepts),
)

const edges = seed.edges || []
const edgeList = Array.isArray(edges)
  ? edges
  : Object.entries(edges).flatMap(([from, tos]) =>
      Object.keys(tos || {}).map((to) => ({ from, to, ...(tos[to] || {}) })),
    )

let missing = []
for (const e of edgeList) {
  const from = e.from || e.source
  const to = e.to || e.target
  if (from && !conceptIds.has(from)) missing.push(`edge from missing concept: ${from}`)
  if (to && !conceptIds.has(to)) missing.push(`edge to missing concept: ${to}`)
}

// Catalog slug coverage (optional)
let catalogSlugs = new Set()
if (existsSync(metaPath)) {
  try {
    const meta = JSON.parse(readFileSync(metaPath, "utf8"))
    const list = Array.isArray(meta) ? meta : meta.frameworks || Object.values(meta)
    for (const fw of list) {
      if (fw?.slug) catalogSlugs.add(fw.slug)
      for (const c of fw?.concepts || []) {
        if (c?.slug) catalogSlugs.add(c.slug)
        if (c?.id) catalogSlugs.add(c.id)
      }
    }
  } catch {
    /* ignore */
  }
}

const conceptRecords = Array.isArray(concepts)
  ? concepts
  : Object.entries(concepts).map(([id, v]) => ({ id, ...v }))

const unknownFrameworks = []
for (const c of conceptRecords) {
  const fw = c.frameworkSlug || c.framework_slug
  if (fw && catalogSlugs.size && !catalogSlugs.has(fw)) {
    unknownFrameworks.push(`${c.id || c.conceptSlug}: framework ${fw}`)
  }
}

console.log(`Mastery seed: ${conceptIds.size} concepts, ${edgeList.length} edges`)
if (missing.length === 0) console.log("  ✓ all edge endpoints resolve to concepts")
else {
  console.log(`  ✗ ${missing.length} edge endpoint issues:`)
  missing.slice(0, 20).forEach((m) => console.log("   -", m))
}
if (catalogSlugs.size) {
  if (unknownFrameworks.length === 0) console.log("  ✓ concept frameworkSlug values match catalog (where present)")
  else {
    console.log(`  ~ ${unknownFrameworks.length} concepts with frameworkSlug not in framework-meta:`)
    unknownFrameworks.slice(0, 15).forEach((m) => console.log("   -", m))
  }
} else {
  console.log("  ~ framework-meta.json empty/missing — skipped catalog check")
}

const bad = missing.length > 0
if (bad && strict) process.exit(1)
process.exit(0)
