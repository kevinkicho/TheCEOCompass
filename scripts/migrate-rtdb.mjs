// Migrate RTDB: old paths → new per-category structure.
// Detects type from result JSON keys rather than the path name.
// Usage: node scripts/migrate-rtdb.mjs

import { readFileSync, writeFileSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import admin from "../agent/node_modules/firebase-admin/lib/index.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

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

function safeParse(s) { try { return JSON.parse(s) } catch { return {} } }

const ENRICH_FIELDS = ["why_it_matters", "steps", "pitfalls", "related_concepts"]
const ENRICH_CATS = ["why_it_matters_for_ceos", "how_to_apply", "common_pitfalls", "connected_concepts"]
const EXPLAIN_FIELDS = ["real_world_example", "ceo_insight", "common_mistake", "related_tip"]

async function main() {
  console.log("Reading /framework...")
  const root = (await db.ref("framework").once("value")).val()
  if (!root) { console.log("No data"); return }

  // Backup
  writeFileSync("/tmp/theceocompass-default-rtdb-export.json", JSON.stringify({ framework: root }, null, 2))
  console.log("Backup at /tmp/theceocompass-default-rtdb-export.json")

  let migrated = 0, errors = 0

  for (const [fslug, concepts] of Object.entries(root)) {
    if (!concepts || typeof concepts !== "object") continue
    for (const [cslug, cats] of Object.entries(concepts)) {
      if (!cats || typeof cats !== "object") continue
      for (const [level, data] of Object.entries(cats)) {
        if (!data || typeof data !== "object") continue

        // Three possible formats:
        // 1. { responses: { id: entry } }  → legacy, detect type from keys
        // 2. { id: entry }                  → already per-category or per-type
        // 3. { id: { responses: ... } }      → nested

        const entries = []
        if (data.responses) {
          // Old format: responses/{id} or {type}/responses/{id}
          for (const [id, entry] of Object.entries(data.responses)) {
            if (entry && typeof entry === "object") entries.push({ id, entry })
          }
        } else {
          // Already per-entry format
          for (const [id, entry] of Object.entries(data)) {
            if (entry && typeof entry === "object" && entry.result) entries.push({ id, entry })
          }
        }

        for (const { id, entry } of entries) {
          if (!entry.result) continue
          const parsed = safeParse(entry.result)
          const keys = Object.keys(parsed)

          try {
            if (ENRICH_FIELDS.every((f) => keys.includes(f))) {
              // Enrich batch → split into 4 categories
              for (let i = 0; i < ENRICH_FIELDS.length; i++) {
                const val = parsed[ENRICH_FIELDS[i]]
                if (val) {
                  const wrapped = JSON.stringify({ [ENRICH_FIELDS[i]]: val })
                  await db.ref(`framework/${fslug}/${cslug}/${ENRICH_CATS[i]}/${id}`).set({
                    ...entry, result: wrapped,
                  })
                  migrated++
                }
              }
            } else if (EXPLAIN_FIELDS.every((f) => keys.includes(f))) {
              // Explain batch → explain_further (keep all fields together)
              await db.ref(`framework/${fslug}/${cslug}/explain_further/${id}`).set(entry)
              migrated++
            } else {
              console.log(`  ? Unknown type at ${fslug}/${cslug}/${level}/${id}: keys=${keys.join(",")}`)
            }
          } catch (err) {
            console.error(`  ERR ${fslug}/${cslug}/${level}/${id}: ${err.message}`)
            errors++
          }
        }
      }
    }
  }

  console.log(`\nDone. Migrated: ${migrated}, Errors: ${errors}`)
  process.exit(0)
}

main()
