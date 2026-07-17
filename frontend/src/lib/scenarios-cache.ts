/**
 * Scenario catalog: prefer RTDB `scenarios/{slug}`, fall back to bundled seed JSON
 * (same content used by scripts/seed-catalog-rtdb.mjs). SSG layouts still import
 * scenarios.json for generateStaticParams only.
 */

import { db, ref, get } from "./firebase"
import type { Scenario } from "./types"
import staticScenarioData from "@/data/scenarios.json"

let cached: Scenario[] | null = null
let loadPromise: Promise<Scenario[]> | null = null
let source: "rtdb" | "static" | null = null

const bundled = staticScenarioData as Scenario[]

function normalizeScenario(raw: unknown, key?: string): Scenario | null {
  if (!raw || typeof raw !== "object") return null
  const s = raw as Scenario
  const slug = s.slug || key
  if (!slug || !s.title) return null
  return {
    ...s,
    id: s.id || slug,
    slug,
    pack_id: s.pack_id ?? "core",
    pack_title: s.pack_title ?? "Core",
  }
}

async function tryLoadFromRtdb(): Promise<Scenario[] | null> {
  if (!db) return null
  try {
    const snap = await get(ref(db!, "scenarios"))
    if (!snap.exists()) return null
    const val = snap.val() as Record<string, unknown>
    const list: Scenario[] = []
    for (const [key, raw] of Object.entries(val)) {
      const s = normalizeScenario(raw, key)
      if (s) list.push(s)
    }
    return list.length > 0 ? list : null
  } catch {
    return null
  }
}

/** Load all scenarios (cached). RTDB first when available and non-empty. */
export async function loadScenarios(): Promise<Scenario[]> {
  if (cached) return cached
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const fromRtdb = await tryLoadFromRtdb()
    if (fromRtdb) {
      cached = fromRtdb
      source = "rtdb"
      return fromRtdb
    }
    cached = bundled.map((s) => normalizeScenario(s)!)
    source = "static"
    return cached
  })().catch((err) => {
    loadPromise = null
    throw err
  })

  return loadPromise
}

export function getCachedScenarios(): Scenario[] | null {
  return cached
}

export function getScenariosSource(): "rtdb" | "static" | null {
  return source
}

/** Test helper */
export function clearScenariosCache(): void {
  cached = null
  loadPromise = null
  source = null
}

/** Sync access to bundled seed (SSG / tests that avoid network). */
export function getBundledScenarios(): Scenario[] {
  return bundled.map((s) => normalizeScenario(s)!)
}
