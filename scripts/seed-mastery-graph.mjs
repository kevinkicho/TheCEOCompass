/**
 * Seed mastery graph into Firebase RTDB from frontend/src/data/mastery-edges.json.
 *
 * Writes:
 *   mastery/edges/{from}/{to} → { type, weight }
 *   mastery/concepts/{id} → { frameworkSlug, conceptSlug, difficulty?, tags? }
 *   _meta/mastery_graph → { version, edgeCount, conceptCount, seededAt }
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json node scripts/seed-mastery-graph.mjs
 * Or place a service account JSON in agent/ and:
 *   node scripts/seed-mastery-graph.mjs
 *
 * Optional flags:
 *   --dry-run   Validate and print plan without writing
 */
import { readFileSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const seedPath = join(root, "frontend", "src", "data", "mastery-edges.json")
const dryRun = process.argv.includes("--dry-run")

const EDGE_TYPES = new Set(["requires", "reinforces", "applied_in"])

function loadKey() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"))
  }
  const agentDir = join(root, "agent")
  const files = readdirSync(agentDir).filter(
    (f) => f.endsWith(".json") && f !== "package.json" && f !== "package-lock.json"
  )
  if (!files.length) {
    throw new Error(
      "No service account key. Set GOOGLE_APPLICATION_CREDENTIALS or place a key JSON in agent/."
    )
  }
  return JSON.parse(readFileSync(join(agentDir, files[0]), "utf8"))
}

function validateSeed(seed) {
  if (!seed || typeof seed !== "object") throw new Error("Seed must be a JSON object")
  if (!Array.isArray(seed.concepts) || seed.concepts.length === 0) {
    throw new Error("Seed must include a non-empty concepts array")
  }
  if (!Array.isArray(seed.edges) || seed.edges.length === 0) {
    throw new Error("Seed must include a non-empty edges array")
  }

  const conceptIds = new Set()
  for (const c of seed.concepts) {
    if (!c.id || !c.frameworkSlug || !c.conceptSlug) {
      throw new Error(`Invalid concept (need id, frameworkSlug, conceptSlug): ${JSON.stringify(c)}`)
    }
    if (conceptIds.has(c.id)) throw new Error(`Duplicate concept id: ${c.id}`)
    conceptIds.add(c.id)
  }

  const seenEdges = new Set()
  for (const e of seed.edges) {
    if (!e.from || !e.to || !e.type || typeof e.weight !== "number") {
      throw new Error(`Invalid edge (need from, to, type, weight): ${JSON.stringify(e)}`)
    }
    if (!EDGE_TYPES.has(e.type)) {
      throw new Error(`Invalid edge type "${e.type}" (expected requires|reinforces|applied_in)`)
    }
    if (e.weight < 0 || e.weight > 1) {
      throw new Error(`Edge weight out of range [0,1]: ${e.from} → ${e.to} (${e.weight})`)
    }
    if (!conceptIds.has(e.from)) {
      throw new Error(`Edge from unknown concept id: ${e.from}`)
    }
    if (!conceptIds.has(e.to)) {
      throw new Error(`Edge to unknown concept id: ${e.to}`)
    }
    if (e.from === e.to) {
      throw new Error(`Self-edge not allowed: ${e.from}`)
    }
    const key = `${e.from}/${e.to}`
    if (seenEdges.has(key)) throw new Error(`Duplicate edge path: ${key}`)
    seenEdges.add(key)
  }

  const frameworks = new Set(seed.concepts.map((c) => c.frameworkSlug))
  if (frameworks.size < 2) {
    throw new Error(`Seed should cover at least 2 frameworks (got ${frameworks.size})`)
  }
  if (seed.edges.length < 15) {
    console.warn(`Warning: only ${seed.edges.length} edges (target ~15–30 for minimal seed)`)
  }

  return { conceptIds, frameworks }
}

const seed = JSON.parse(readFileSync(seedPath, "utf8"))
const { frameworks } = validateSeed(seed)

console.log(`Loaded mastery seed v${seed.version ?? "?"} from ${seedPath}`)
console.log(`  concepts: ${seed.concepts.length}`)
console.log(`  edges:    ${seed.edges.length}`)
console.log(`  frameworks: ${[...frameworks].join(", ")}`)

if (dryRun) {
  console.log("--dry-run: validation OK, no RTDB writes")
  process.exit(0)
}

const require = createRequire(import.meta.url)
const key = loadKey()
const admin = require(join(root, "agent", "node_modules", "firebase-admin"))
const databaseURL =
  process.env.FIREBASE_DATABASE_URL ||
  `https://${key.project_id}-default-rtdb.firebaseio.com`

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(key),
    databaseURL,
  })
}
const db = admin.database()

// Build multi-path update for atomic write
const updates = {}

for (const c of seed.concepts) {
  const node = {
    frameworkSlug: c.frameworkSlug,
    conceptSlug: c.conceptSlug,
  }
  if (c.difficulty != null) node.difficulty = c.difficulty
  if (Array.isArray(c.tags)) node.tags = c.tags
  updates[`mastery/concepts/${c.id}`] = node
}

for (const e of seed.edges) {
  updates[`mastery/edges/${e.from}/${e.to}`] = {
    type: e.type,
    weight: e.weight,
  }
}

updates["_meta/mastery_graph"] = {
  version: seed.version ?? 1,
  edgeCount: seed.edges.length,
  conceptCount: seed.concepts.length,
  frameworks: [...frameworks],
  seededAt: Date.now(),
}

await db.ref().update(updates)

console.log(`✓ Seeded mastery graph:`)
console.log(`  mastery/concepts/*  (${seed.concepts.length})`)
console.log(`  mastery/edges/*/*   (${seed.edges.length})`)
console.log(`  _meta/mastery_graph`)
process.exit(0)
