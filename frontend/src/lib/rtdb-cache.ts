import { db, ref, get } from "./firebase"
import type { Framework } from "./types"

let cachedFrameworks: Framework[] | null = null
let loadPromise: Promise<Framework[]> | null = null

export async function loadFrameworks(): Promise<Framework[]> {
  if (cachedFrameworks) return cachedFrameworks
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    if (!db) throw new Error("Firebase not configured")

    // Single read — fetch all frameworks + concepts at once
    const snap = await get(ref(db!, "frameworks"))
    if (!snap.exists()) throw new Error("No frameworks found in RTDB")

    const all = snap.val() as Record<string, any>
    const slugs = Object.keys(all)
    const frameworks: Framework[] = []

    for (const slug of slugs) {
      const fwData = all[slug]
      if (!fwData || typeof fwData !== "object" || fwData.error) continue
      const { concepts: conceptsRaw, ...fwRest } = fwData as any
      const fw = fwRest as Framework
      // RTDB often stores under frameworks/{slug} without an id field
      fw.slug = fw.slug || slug
      fw.id = fw.id || fw.slug || slug
      if (conceptsRaw && typeof conceptsRaw === "object") {
        fw.concepts = Object.values(conceptsRaw)
        fw.concepts.forEach((c: any, i: number) => {
          if (c.order_index === undefined) c.order_index = i
          if (!c.id && c.slug) c.id = c.slug
        })
      }
      frameworks.push(fw)
    }

    cachedFrameworks = frameworks
    return frameworks
  })().catch((err) => {
    loadPromise = null
    throw err
  })

  return loadPromise
}

export function getCachedFrameworks(): Framework[] | null {
  return cachedFrameworks
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}
