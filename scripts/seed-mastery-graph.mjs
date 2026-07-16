/**
 * Seed mastery graph into Firebase RTDB from frontend/src/data/mastery-edges.json.
 *
 * Writes (replace policy — not merge):
 *   mastery/edges/{from}/{to} → { type, weight }
 *   mastery/concepts/{id} → { frameworkSlug, conceptSlug, difficulty?, tags? }
 *   _meta/mastery_graph → { version, edgeCount, conceptCount, seededAt }
 *
 * Stale edges/concepts removed from the seed JSON are deleted on re-seed
 * (null paths in the same atomic update as the new graph).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json node scripts/seed-mastery-graph.mjs
 * Or place a single service-account JSON in agent/ and:
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
const metaPath = join(root, "frontend", "src", "data", "framework-meta.json")
const dryRun = process.argv.includes("--dry-run")

const EDGE_TYPES = new Set(["requires", "reinforces", "applied_in"])
/** RTDB path keys cannot contain . # $ [ ] / */
const UNSAFE_KEY = /[.#$[\]/]/

export function loadKey() {
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
      /^serviceAccount/i.test(f) ||
      /service.?account/i.test(f)
  )
  const candidates = preferred.length > 0 ? preferred : allJson
  if (candidates.length > 1) {
    throw new Error(
      `Multiple service account candidates in agent/: ${candidates.join(", ")}. ` +
        "Set GOOGLE_APPLICATION_CREDENTIALS to the key path explicitly."
    )
  }
  return JSON.parse(readFileSync(join(agentDir, candidates[0]), "utf8"))
}

function assertSafeKey(id, label) {
  if (typeof id !== "string" || !id) {
    throw new Error(`${label} must be a non-empty string`)
  }
  if (UNSAFE_KEY.test(id)) {
    throw new Error(`${label} has RTDB-unsafe characters (.# $ [ ] /): ${id}`)
  }
}

/**
 * Validate seed shape, referential integrity, path-safe ids, and optional
 * membership in framework-meta.json.
 * @param {object} seed
 * @param {{ frameworksMeta?: Array }} [opts]
 */
export function validateSeed(seed, opts = {}) {
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
    assertSafeKey(c.id, "concept id")
    assertSafeKey(c.frameworkSlug, "frameworkSlug")
    assertSafeKey(c.conceptSlug, "conceptSlug")
    if (conceptIds.has(c.id)) throw new Error(`Duplicate concept id: ${c.id}`)
    conceptIds.add(c.id)
  }

  const seenEdges = new Set()
  for (const e of seed.edges) {
    if (!e.from || !e.to || !e.type || typeof e.weight !== "number") {
      throw new Error(`Invalid edge (need from, to, type, weight): ${JSON.stringify(e)}`)
    }
    assertSafeKey(e.from, "edge.from")
    assertSafeKey(e.to, "edge.to")
    if (!EDGE_TYPES.has(e.type)) {
      throw new Error(`Invalid edge type "${e.type}" (expected requires|reinforces|applied_in)`)
    }
    if (!Number.isFinite(e.weight) || e.weight < 0 || e.weight > 1) {
      throw new Error(`Edge weight out of range [0,1] (finite): ${e.from} → ${e.to} (${e.weight})`)
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

  // reinforces must be stored both directions (same weight) so directed walkers see mutual links
  for (const e of seed.edges) {
    if (e.type !== "reinforces") continue
    const reverse = seed.edges.find((x) => x.from === e.to && x.to === e.from && x.type === "reinforces")
    if (!reverse) {
      throw new Error(
        `reinforces edge missing reverse: ${e.from} ↔ ${e.to}. Materialize both directions in seed.`
      )
    }
  }

  const frameworks = new Set(seed.concepts.map((c) => c.frameworkSlug))
  if (frameworks.size < 2) {
    throw new Error(`Seed should cover at least 2 frameworks (got ${frameworks.size})`)
  }
  if (seed.edges.length < 15) {
    console.warn(`Warning: only ${seed.edges.length} edges (target ~15–30 for minimal seed)`)
  }

  // Optional cross-check against framework-meta.json
  const meta = opts.frameworksMeta
  if (Array.isArray(meta) && meta.length > 0) {
    const known = new Map()
    for (const fw of meta) {
      const slugs = new Set((fw.concepts || []).map((c) => c.slug))
      known.set(fw.slug, slugs)
    }
    for (const c of seed.concepts) {
      const slugs = known.get(c.frameworkSlug)
      if (!slugs) {
        throw new Error(`Unknown frameworkSlug (not in framework-meta): ${c.frameworkSlug}`)
      }
      if (!slugs.has(c.conceptSlug)) {
        throw new Error(
          `Unknown conceptSlug for ${c.frameworkSlug}: ${c.conceptSlug} (not in framework-meta)`
        )
      }
      if (c.id !== c.conceptSlug) {
        throw new Error(`concept id must equal conceptSlug (got id=${c.id}, slug=${c.conceptSlug})`)
      }
    }
  }

  return { conceptIds, frameworks, seenEdges }
}

function loadFrameworksMeta() {
  try {
    return JSON.parse(readFileSync(metaPath, "utf8"))
  } catch {
    console.warn(`Warning: could not load ${metaPath}; skipping membership check`)
    return null
  }
}

async function main() {
  const seed = JSON.parse(readFileSync(seedPath, "utf8"))
  const frameworksMeta = loadFrameworksMeta()
  const { frameworks, conceptIds, seenEdges } = validateSeed(seed, {
    frameworksMeta: frameworksMeta || undefined,
  })

  console.log(`Loaded mastery seed v${seed.version ?? "?"} from ${seedPath}`)
  console.log(`  concepts: ${seed.concepts.length}`)
  console.log(`  edges:    ${seed.edges.length}`)
  console.log(`  frameworks: ${[...frameworks].join(", ")}`)
  console.log(`  policy:   replace (stale edges/concepts nullified)`)

  if (dryRun) {
    console.log("--dry-run: validation OK, no RTDB writes")
    return
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

  // Atomic replace: null out keys present in RTDB but absent from seed, then write seed.
  const [edgesSnap, conceptsSnap] = await Promise.all([
    db.ref("mastery/edges").once("value"),
    db.ref("mastery/concepts").once("value"),
  ])

  const updates = {}

  const existingEdges = edgesSnap.val() || {}
  for (const from of Object.keys(existingEdges)) {
    const tos = existingEdges[from] || {}
    for (const to of Object.keys(tos)) {
      const key = `${from}/${to}`
      if (!seenEdges.has(key)) {
        updates[`mastery/edges/${from}/${to}`] = null
      }
    }
  }

  const existingConcepts = conceptsSnap.val() || {}
  for (const id of Object.keys(existingConcepts)) {
    if (!conceptIds.has(id)) {
      updates[`mastery/concepts/${id}`] = null
    }
  }

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
    policy: "replace",
  }

  await db.ref().update(updates)

  const deleted =
    Object.values(updates).filter((v) => v === null).length
  console.log(`✓ Seeded mastery graph (replace policy):`)
  console.log(`  mastery/concepts/*  (${seed.concepts.length})`)
  console.log(`  mastery/edges/*/*   (${seed.edges.length})`)
  if (deleted > 0) console.log(`  removed stale paths: ${deleted}`)
  console.log(`  _meta/mastery_graph`)
}

// Run CLI when executed directly (not when imported for unit tests)
const invokedAsCli =
  typeof process.argv[1] === "string" &&
  process.argv[1].replace(/\\/g, "/").includes("seed-mastery-graph")

if (invokedAsCli) {
  main()
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
    .then(() => process.exit(0))
}
