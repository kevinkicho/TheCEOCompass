// Push all concept enrichment data from staticData.ts into Firebase RTDB.
// Writes to: framework/{slug}/{concept}/{category}/{uuid}
// Categories: why_it_matters_for_ceos, how_to_apply, common_pitfalls,
//             connected_concepts, case_study, test_yourself, real_world_examples
//
// Usage: node scripts/push-enrichments-to-rtdb.mjs

import { readFileSync, readdirSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import crypto from "crypto"
import admin from "../agent/node_modules/firebase-admin/lib/index.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
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

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

// ── Category mapping ──
const CAT_MAP = [
  { field: "why_it_matters",       category: "why_it_matters_for_ceos",  transform: (v) => ({ why_it_matters: v }) },
  { field: "steps",                category: "how_to_apply",             transform: (v) => ({ steps: v }) },
  { field: "pitfalls",             category: "common_pitfalls",          transform: (v) => ({ pitfalls: v }) },
  { field: "related_concepts",     category: "connected_concepts",       transform: (v) => ({ related_concepts: v }) },
  { field: "case_study",           category: "case_study",               transform: (v) => v },
  { field: "exercise",             category: "test_yourself",            transform: (v) => v },
  { field: "example",              category: "real_world_examples",      transform: (v) => ({ examples: v.split(" | ").filter(Boolean) }) },
]

async function main() {
  console.log("Reading static data...")
  const frameworks = parseFrameworks(STATIC_DATA_PATH)

  let pushed = 0, skipped = 0, errors = 0

  for (const fw of frameworks) {
    for (const c of (fw.concepts || [])) {
      const cslug = slugify(c.name)
      for (const { field, category, transform } of CAT_MAP) {
        const val = c[field]
        if (!val || (Array.isArray(val) && val.length === 0)) {
          skipped++
          continue
        }
        // Check if this category already has data in RTDB
        const snap = await db.ref(`framework/${fw.slug}/${cslug}/${category}`).once("value")
        if (snap.exists() && Object.values(snap.val()).some((e) => e?.result)) {
          skipped++
          continue
        }
        try {
          const id = crypto.randomUUID()
          const wrapped = JSON.stringify(transform(val))
          await db.ref(`framework/${fw.slug}/${cslug}/${category}/${id}`).set({
            result: wrapped,
            model: "static-data",
            prompt: "",
            created_at: Date.now(),
          })
          pushed++
          if (pushed % 50 === 0) console.log(`  ${pushed} entries pushed...`)
        } catch (err) {
          errors++
          console.error(`  ERR ${fw.slug}/${cslug}/${category}: ${err.message}`)
        }
      }
    }
  }

  console.log(`\nDone! Pushed: ${pushed}, Skipped (already exists): ${skipped}, Errors: ${errors}`)
  process.exit(0)
}

main()
