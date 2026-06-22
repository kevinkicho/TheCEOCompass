import { db, ref, get } from "./firebase"
import type { Framework } from "./types"

let cachedFrameworks: Framework[] | null = null
let loadPromise: Promise<Framework[]> | null = null

export async function loadFrameworks(): Promise<Framework[]> {
  if (cachedFrameworks) return cachedFrameworks
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    if (!db) throw new Error("Firebase not configured")
    const slugsSnap = await get(ref(db!, "_meta/framework_slugs"))
    if (!slugsSnap.exists()) throw new Error("No frameworks found in RTDB")
    const slugs: string[] = slugsSnap.val()
    const frameworks: Framework[] = []
    for (const slug of slugs) {
      const fwSnap = await get(ref(db!, `frameworks/${slug}`))
      if (!fwSnap.exists()) continue
      const fw = fwSnap.val() as Framework
      const conceptsSnap = await get(ref(db!, `frameworks/${slug}/concepts`))
      if (conceptsSnap.exists()) {
        fw.concepts = Object.values(conceptsSnap.val() || {})
        // Restore order_index from static ordering via slug position
        if (fw.concepts) {
          fw.concepts.forEach((c, i) => { if (c.order_index === undefined) c.order_index = i })
        }
      }
      frameworks.push(fw)
    }
    cachedFrameworks = frameworks
    return frameworks
  })()

  return loadPromise
}

export function getCachedFrameworks(): Framework[] | null {
  return cachedFrameworks
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}
