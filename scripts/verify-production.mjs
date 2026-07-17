#!/usr/bin/env node
/**
 * Production readiness checks for CEO Compass (Phase 6).
 *
 * Usage (repo root):
 *   node scripts/verify-production.mjs
 *   node scripts/verify-production.mjs --strict   # non-zero exit on any fail
 *
 * Optional env:
 *   FIREBASE_DATABASE_URL
 *   GOOGLE_APPLICATION_CREDENTIALS or agent/*.json service account
 */

import { readFileSync, readdirSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const strict = process.argv.includes("--strict")
const require = createRequire(import.meta.url)

const results = []

function ok(name, detail = "") {
  results.push({ name, pass: true, detail })
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`)
}
function fail(name, detail = "") {
  results.push({ name, pass: false, detail })
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`)
}
function warn(name, detail = "") {
  results.push({ name, pass: true, warn: true, detail })
  console.log(`  ~ ${name}${detail ? ` — ${detail}` : ""}`)
}

console.log("\nCEO Compass — production verify\n")

// 1) Repo artifacts
console.log("Repo")
const mustExist = [
  "database.rules.json",
  "functions/src/index.ts",
  "frontend/src/data/mastery-edges.json",
  "frontend/src/data/scenarios.json",
  "docs/OPERATOR_RUNBOOK.md",
]
for (const p of mustExist) {
  if (existsSync(join(root, p))) ok(`exists ${p}`)
  else fail(`exists ${p}`, "missing")
}

// 2) Rules surface
console.log("\nRTDB rules (static parse)")
try {
  const rules = JSON.parse(readFileSync(join(root, "database.rules.json"), "utf8"))
  const r = rules.rules || rules
  if (r.users) ok("rules.users")
  else fail("rules.users")
  if (r._rate) ok("rules._rate denied to clients")
  else fail("rules._rate")
  if (r._config?.feature_flags) ok("rules._config.feature_flags")
  else fail("rules._config.feature_flags")
  if (r._meta?.agent_heartbeat && r._meta?.cloud_worker_heartbeat) {
    ok("rules._meta heartbeats")
  } else fail("rules._meta heartbeats")
  if (r.mastery || r._meta?.mastery_graph) ok("rules mastery paths")
  else warn("rules mastery", "check mastery + _meta/mastery_graph")
} catch (e) {
  fail("parse database.rules.json", e.message)
}

// 3) Scenarios / mastery seed
console.log("\nContent")
try {
  const scenarios = JSON.parse(
    readFileSync(join(root, "frontend/src/data/scenarios.json"), "utf8"),
  )
  ok(`scenarios count = ${scenarios.length}`, scenarios.length >= 12 ? "ok" : "low")
  const packs = new Set(scenarios.map((s) => s.pack_id || "core"))
  ok(`scenario packs = ${packs.size}`, [...packs].sort().join(", "))
} catch (e) {
  fail("scenarios.json", e.message)
}

try {
  const seed = JSON.parse(
    readFileSync(join(root, "frontend/src/data/mastery-edges.json"), "utf8"),
  )
  const concepts = seed.concepts || seed.nodes || {}
  const edges = seed.edges || []
  const nConcepts = Array.isArray(concepts)
    ? concepts.length
    : Object.keys(concepts).length
  const nEdges = Array.isArray(edges) ? edges.length : Object.keys(edges).length
  ok(`mastery seed concepts=${nConcepts} edges≈${nEdges}`)
} catch (e) {
  fail("mastery-edges.json", e.message)
}

// 4) Functions export surface
console.log("\nFunctions source")
try {
  const idx = readFileSync(join(root, "functions/src/index.ts"), "utf8")
  if (idx.includes("processAIRequest")) ok("export processAIRequest")
  else fail("export processAIRequest")
  if (idx.includes("generateAI")) ok("export generateAI (callable)")
  else fail("export generateAI")
} catch (e) {
  fail("functions/src/index.ts", e.message)
}

// 5) Optional live RTDB (Admin SDK)
console.log("\nLive RTDB (optional)")
let admin
try {
  admin = require("firebase-admin")
} catch {
  warn("firebase-admin", "not installed at repo root — skip live checks (use agent/ or functions/)")
}

function loadCred() {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (envPath && existsSync(envPath)) {
    return JSON.parse(readFileSync(envPath, "utf8"))
  }
  const agentDir = join(root, "agent")
  if (!existsSync(agentDir)) return null
  const files = readdirSync(agentDir).filter(
    (f) => f.endsWith(".json") && f !== "package.json" && f !== "package-lock.json",
  )
  if (files.length === 0) return null
  return JSON.parse(readFileSync(join(agentDir, files[0]), "utf8"))
}

if (admin) {
  const cred = loadCred()
  if (!cred) {
    warn("service account", "none found — skip live RTDB (place key in agent/)")
  } else {
    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(cred),
          databaseURL:
            process.env.FIREBASE_DATABASE_URL ||
            process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
            "https://theceocompass-default-rtdb.firebaseio.com",
        })
      }
      const db = admin.database()
      const flagsSnap = await db.ref("_config/feature_flags").once("value")
      if (flagsSnap.exists()) ok("live feature_flags", JSON.stringify(flagsSnap.val()).slice(0, 120))
      else warn("live feature_flags", "missing — client defaults apply")

      const agentHb = await db.ref("_meta/agent_heartbeat").once("value")
      if (agentHb.exists()) {
        const age = Date.now() - (agentHb.val()?.updated_at || 0)
        ok("live agent_heartbeat", `age ${Math.round(age / 1000)}s`)
      } else warn("live agent_heartbeat", "absent (ok if using cloud only)")

      const cloudHb = await db.ref("_meta/cloud_worker_heartbeat").once("value")
      if (cloudHb.exists()) {
        const age = Date.now() - (cloudHb.val()?.updated_at || 0)
        ok("live cloud_worker_heartbeat", `age ${Math.round(age / 1000)}s`)
      } else warn("live cloud_worker_heartbeat", "absent until first cloud AI call")

      const mastery = await db.ref("mastery/concepts").once("value")
      if (mastery.exists()) ok("live mastery/concepts seeded")
      else warn("live mastery/concepts", "empty — run scripts/seed-mastery-graph.mjs")
    } catch (e) {
      fail("live RTDB", e.message)
    }
  }
}

// Summary
const failed = results.filter((r) => !r.pass)
const warned = results.filter((r) => r.warn)
console.log(
  `\nSummary: ${results.length - failed.length} pass, ${warned.length} warn, ${failed.length} fail\n`,
)
if (failed.length && strict) process.exit(1)
if (failed.length) process.exitCode = 0 // non-strict: informational
