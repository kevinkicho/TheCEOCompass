/**
 * Seed scenarios + quotes catalog into Firebase RTDB from frontend seed JSON.
 *
 * Writes:
 *   scenarios/{slug}              — full scenario objects
 *   _meta/scenario_slugs          — string[]
 *   quotes/catalog/{id}           — curated quotes
 *   quotes/categories/{id}        — category metadata
 *   _meta/quotes_catalog          — { version, quoteCount, categoryCount, seededAt }
 *
 * Does not touch quotes/generated (live AI content).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json node scripts/seed-catalog-rtdb.mjs
 *   node scripts/seed-catalog-rtdb.mjs --dry-run
 *   node scripts/seed-catalog-rtdb.mjs --scenarios-only
 *   node scripts/seed-catalog-rtdb.mjs --quotes-only
 */
import { readFileSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const scenariosPath = join(root, "frontend", "src", "data", "scenarios.json")
const quotesPath = join(root, "frontend", "src", "data", "quotes.json")
const dryRun = process.argv.includes("--dry-run")
const scenariosOnly = process.argv.includes("--scenarios-only")
const quotesOnly = process.argv.includes("--quotes-only")
const doScenarios = !quotesOnly
const doQuotes = !scenariosOnly

function loadKey() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"))
  }
  const agentDir = join(root, "agent")
  const allJson = readdirSync(agentDir).filter(
    (f) => f.endsWith(".json") && f !== "package.json" && f !== "package-lock.json"
  )
  if (!allJson.length) {
    throw new Error(
      "No service account key. Set GOOGLE_APPLICATION_CREDENTIALS or place a key JSON in agent/."
    )
  }
  const preferred = allJson.filter(
    (f) =>
      /firebase.*adminsdk/i.test(f) ||
      /service.?account/i.test(f) ||
      /theceocompass/i.test(f)
  )
  const file = preferred[0] || allJson[0]
  return JSON.parse(readFileSync(join(agentDir, file), "utf8"))
}

function buildScenarioUpdates(scenarios) {
  const updates = {}
  const slugs = []
  for (const s of scenarios) {
    if (!s?.slug) throw new Error("Scenario missing slug")
    slugs.push(s.slug)
    updates[`scenarios/${s.slug}`] = {
      ...s,
      id: s.id || s.slug,
      pack_id: s.pack_id ?? "core",
      pack_title: s.pack_title ?? "Core",
    }
  }
  updates["_meta/scenario_slugs"] = slugs
  return { updates, slugs }
}

function buildQuoteUpdates(quotesFile) {
  const updates = {}
  const categories = quotesFile.categories || []
  const quotes = quotesFile.quotes || []
  for (const c of categories) {
    if (!c?.id) throw new Error("Quote category missing id")
    updates[`quotes/categories/${c.id}`] = {
      id: c.id,
      name: c.name || c.id,
      icon: c.icon || "quote",
      color: c.color || "blue",
    }
  }
  for (const q of quotes) {
    if (!q?.id) throw new Error("Quote missing id")
    updates[`quotes/catalog/${q.id}`] = { ...q }
  }
  updates["_meta/quotes_catalog"] = {
    version: quotesFile.version || "1.0",
    quoteCount: quotes.length,
    categoryCount: categories.length,
    seededAt: Date.now(),
  }
  return { updates, quoteCount: quotes.length, categoryCount: categories.length }
}

async function main() {
  const scenarios = doScenarios
    ? JSON.parse(readFileSync(scenariosPath, "utf8"))
    : []
  const quotesFile = doQuotes
    ? JSON.parse(readFileSync(quotesPath, "utf8"))
    : { categories: [], quotes: [] }

  if (doScenarios && !Array.isArray(scenarios)) {
    throw new Error("scenarios.json must be an array")
  }

  let updates = {}
  if (doScenarios) {
    const { updates: u, slugs } = buildScenarioUpdates(scenarios)
    updates = { ...updates, ...u }
    console.log(`Scenarios: ${slugs.length} from ${scenariosPath}`)
  }
  if (doQuotes) {
    const { updates: u, quoteCount, categoryCount } = buildQuoteUpdates(quotesFile)
    updates = { ...updates, ...u }
    console.log(`Quotes: ${quoteCount} quotes, ${categoryCount} categories from ${quotesPath}`)
  }

  const keys = Object.keys(updates)
  console.log(`Update paths: ${keys.length}`)

  if (dryRun) {
    console.log("--dry-run: no write")
    console.log(keys.slice(0, 15).join("\n") + (keys.length > 15 ? `\n... +${keys.length - 15} more` : ""))
    return
  }

  const require = createRequire(import.meta.url)
  let admin
  try {
    admin = require("firebase-admin")
  } catch {
    try {
      admin = require(join(root, "agent", "node_modules", "firebase-admin"))
    } catch {
      admin = require(join(root, "functions", "node_modules", "firebase-admin"))
    }
  }

  const key = loadKey()
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(key),
      databaseURL:
        process.env.FIREBASE_DATABASE_URL ||
        "https://theceocompass-default-rtdb.firebaseio.com",
    })
  }
  const db = admin.database()
  await db.ref().update(updates)
  console.log("✓ Seeded catalog to RTDB")
  if (doScenarios) console.log("  scenarios/* + _meta/scenario_slugs")
  if (doQuotes) console.log("  quotes/catalog/* + quotes/categories/* + _meta/quotes_catalog")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
