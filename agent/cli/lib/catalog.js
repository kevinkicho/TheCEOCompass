/**
 * Public catalog reads (frameworks + scenarios) via Admin SDK.
 */
import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { getDb, rootDir } from "./firebase.js"

export async function listFrameworks() {
  const db = getDb()
  const snap = await db.ref("frameworks").get()
  if (!snap.exists()) return []
  const all = snap.val() || {}
  return Object.keys(all)
    .filter((slug) => all[slug] && typeof all[slug] === "object" && !all[slug].error)
    .map((slug) => {
      const fw = all[slug]
      const concepts =
        fw.concepts && typeof fw.concepts === "object"
          ? Object.values(fw.concepts)
          : []
      return {
        slug: fw.slug || slug,
        id: fw.id || slug,
        title: fw.title || slug,
        category: fw.category || null,
        difficulty: fw.difficulty ?? null,
        conceptCount: concepts.length,
      }
    })
    .sort((a, b) => String(a.title).localeCompare(String(b.title)))
}

export async function getFramework(slug) {
  const db = getDb()
  const snap = await db.ref(`frameworks/${slug}`).get()
  if (!snap.exists()) return null
  const fw = snap.val()
  const concepts =
    fw.concepts && typeof fw.concepts === "object" ? Object.values(fw.concepts) : []
  return {
    slug: fw.slug || slug,
    id: fw.id || slug,
    title: fw.title,
    category: fw.category,
    description: fw.description,
    difficulty: fw.difficulty,
    concepts: concepts.map((c) => ({
      id: c.id || c.slug,
      name: c.name,
      slug: c.slug,
      definition: c.definition,
    })),
  }
}

export async function listScenarios() {
  const db = getDb()
  const snap = await db.ref("scenarios").get()
  if (snap.exists()) {
    const all = snap.val() || {}
    return Object.keys(all).map((slug) => {
      const s = all[slug] || {}
      return {
        slug: s.slug || slug,
        id: s.id || slug,
        title: s.title || slug,
        difficulty: s.difficulty ?? null,
        pack_id: s.pack_id || "core",
        pack_title: s.pack_title || "Core",
        framework_slugs: s.framework_slugs || [],
        concept_ids: s.concept_ids || [],
        stageCount: Array.isArray(s.stages) ? s.stages.length : 0,
      }
    })
  }
  // Fallback: bundled seed
  const seedPath = join(rootDir, "frontend", "src", "data", "scenarios.json")
  if (!existsSync(seedPath)) return []
  const seed = JSON.parse(readFileSync(seedPath, "utf8"))
  return (Array.isArray(seed) ? seed : []).map((s) => ({
    slug: s.slug,
    id: s.id || s.slug,
    title: s.title,
    difficulty: s.difficulty ?? null,
    pack_id: s.pack_id || "core",
    pack_title: s.pack_title || "Core",
    framework_slugs: s.framework_slugs || [],
    concept_ids: s.concept_ids || [],
    stageCount: Array.isArray(s.stages) ? s.stages.length : 0,
    source: "bundled-seed",
  }))
}

export async function getScenario(slug) {
  const db = getDb()
  const snap = await db.ref(`scenarios/${slug}`).get()
  if (snap.exists()) return snap.val()
  const list = await listScenarios()
  const meta = list.find((s) => s.slug === slug)
  if (!meta) return null
  const seedPath = join(rootDir, "frontend", "src", "data", "scenarios.json")
  if (!existsSync(seedPath)) return meta
  const seed = JSON.parse(readFileSync(seedPath, "utf8"))
  return (Array.isArray(seed) ? seed : []).find((s) => s.slug === slug) || meta
}
