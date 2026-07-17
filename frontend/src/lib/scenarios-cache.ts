/**
 * Scenario catalog architecture:
 * - List path: light metadata only (scenario_index or projected list) for home/filters
 * - Detail path: full scenario including stages (scenarios/{slug})
 *
 * Bundled scenarios.json remains seed + SSG fallback.
 */

import { db, ref, get } from "./firebase"
import type { Scenario, ScenarioListItem } from "./types"
import staticScenarioData from "@/data/scenarios.json"

let cachedList: ScenarioListItem[] | null = null
let listPromise: Promise<ScenarioListItem[]> | null = null
let listSource: "rtdb-index" | "rtdb-full" | "static" | null = null

/** Full scenarios by slug (detail cache). */
const detailCache = new Map<string, Scenario>()
let fullCatalog: Scenario[] | null = null
let fullPromise: Promise<Scenario[]> | null = null

const bundled = staticScenarioData as Scenario[]

function toListItem(s: Partial<Scenario> & { slug?: string; id?: string }, key?: string): ScenarioListItem | null {
  const slug = s.slug || key || s.id
  if (!slug || !s.title) return null
  return {
    id: s.id || slug,
    slug,
    title: s.title,
    description: s.description || "",
    framework_id: s.framework_id || "",
    difficulty: s.difficulty ?? 3,
    pack_id: s.pack_id ?? "core",
    pack_title: s.pack_title ?? "Core",
    concept_ids: s.concept_ids,
    framework_slugs: s.framework_slugs,
  }
}

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
    stages: Array.isArray(s.stages) ? s.stages : [],
    outcome_branches: s.outcome_branches || ({} as Scenario["outcome_branches"]),
    context: s.context || {
      company: "",
      situation: "",
      time_pressure: "",
      data_provided: [],
    },
  }
}

async function tryLoadIndexFromRtdb(): Promise<ScenarioListItem[] | null> {
  if (!db) return null
  try {
    const snap = await get(ref(db!, "scenario_index"))
    if (!snap.exists()) return null
    const val = snap.val() as Record<string, unknown>
    const list: ScenarioListItem[] = []
    for (const [key, raw] of Object.entries(val)) {
      const item = toListItem(raw as Scenario, key)
      if (item) list.push(item)
    }
    return list.length > 0 ? list : null
  } catch {
    return null
  }
}

async function tryLoadFullFromRtdb(): Promise<Scenario[] | null> {
  if (!db) return null
  try {
    const snap = await get(ref(db!, "scenarios"))
    if (!snap.exists()) return null
    const val = snap.val() as Record<string, unknown>
    const list: Scenario[] = []
    for (const [key, raw] of Object.entries(val)) {
      const s = normalizeScenario(raw, key)
      if (s) {
        list.push(s)
        detailCache.set(s.slug, s)
      }
    }
    return list.length > 0 ? list : null
  } catch {
    return null
  }
}

/** Lightweight list for browse/home (no stages in memory when index exists). */
export async function loadScenarioList(): Promise<ScenarioListItem[]> {
  if (cachedList) return cachedList
  if (listPromise) return listPromise

  listPromise = (async () => {
    const fromIndex = await tryLoadIndexFromRtdb()
    if (fromIndex) {
      cachedList = fromIndex
      listSource = "rtdb-index"
      return fromIndex
    }
    const full = await loadScenarios()
    cachedList = full.map((s) => toListItem(s)!)
    listSource = full.length && getScenariosSource() === "rtdb" ? "rtdb-full" : "static"
    return cachedList
  })().catch((err) => {
    listPromise = null
    throw err
  })

  return listPromise
}

/** Full catalog (includes stages). Prefer loadScenario(slug) for single-detail pages. */
export async function loadScenarios(): Promise<Scenario[]> {
  if (fullCatalog) return fullCatalog
  if (fullPromise) return fullPromise

  fullPromise = (async () => {
    const fromRtdb = await tryLoadFullFromRtdb()
    if (fromRtdb) {
      fullCatalog = fromRtdb
      if (!cachedList) {
        cachedList = fromRtdb.map((s) => toListItem(s)!)
        listSource = "rtdb-full"
      }
      return fromRtdb
    }
    fullCatalog = bundled.map((s) => normalizeScenario(s)!)
    for (const s of fullCatalog) detailCache.set(s.slug, s)
    if (!cachedList) {
      cachedList = fullCatalog.map((s) => toListItem(s)!)
      listSource = "static"
    }
    return fullCatalog
  })().catch((err) => {
    fullPromise = null
    throw err
  })

  return fullPromise
}

/** Single scenario detail — network-efficient when only one page needs stages. */
export async function loadScenarioBySlug(slug: string): Promise<Scenario | null> {
  if (detailCache.has(slug)) return detailCache.get(slug)!

  if (db) {
    try {
      const snap = await get(ref(db!, `scenarios/${slug}`))
      if (snap.exists()) {
        const s = normalizeScenario(snap.val(), slug)
        if (s) {
          detailCache.set(slug, s)
          return s
        }
      }
    } catch {
      /* fall through */
    }
  }

  const all = await loadScenarios()
  return all.find((s) => s.slug === slug || s.id === slug) || null
}

export function getCachedScenarios(): Scenario[] | null {
  return fullCatalog
}

export function getCachedScenarioList(): ScenarioListItem[] | null {
  return cachedList
}

/**
 * Where the last successful list load came from.
 * - rtdb-index: light scenario_index tree (preferred for browse)
 * - rtdb-full: projected from full scenarios/ tree
 * - static: bundled scenarios.json seed
 * - rtdb: alias of rtdb-full (compat for older callers/tests)
 */
export function getScenariosSource():
  | "rtdb"
  | "static"
  | "rtdb-index"
  | "rtdb-full"
  | null {
  if (listSource === "rtdb-full") return "rtdb-full"
  return listSource
}

/** True when list path used the light index (no stages over the wire for browse). */
export function isScenarioIndexActive(): boolean {
  return listSource === "rtdb-index"
}

export function clearScenariosCache(): void {
  cachedList = null
  listPromise = null
  listSource = null
  fullCatalog = null
  fullPromise = null
  detailCache.clear()
}

export function getBundledScenarios(): Scenario[] {
  return bundled.map((s) => normalizeScenario(s)!)
}
