/**
 * Public catalog API for UI pages.
 *
 * Frameworks: module cache via rtdb-cache (loaded at app init).
 * Scenarios: dual-path architecture —
 *   - getScenarios() → light list (scenario_index or projected)
 *   - getScenario(slug) → full detail with stages (scenarios/{slug})
 *
 * User data (journal, progress, reviews) lives in @/lib/user-data and firebase-crud — not here.
 */

import { getCachedFrameworks } from "./rtdb-cache"
import {
  loadScenarioList,
  loadScenarioBySlug,
  getBundledScenarios,
} from "./scenarios-cache"
import type {
  Framework,
  FrameworkListItem,
  Scenario,
  ScenarioListItem,
} from "./types"

export async function getFrameworks(category?: string): Promise<FrameworkListItem[]> {
  const fws = getCachedFrameworks()
  if (!fws) return []
  let list = fws as FrameworkListItem[]
  if (category) list = list.filter((f) => f.category === category)
  return list
}

export async function getFramework(id: string): Promise<Framework | null> {
  const fws = getCachedFrameworks()
  if (!fws) return null
  return fws.find((f) => f.id === id || f.slug === id) || null
}

export async function getFrameworkBySlug(slug: string): Promise<Framework | null> {
  const fws = getCachedFrameworks()
  if (!fws) return null
  return fws.find((f) => f.slug === slug) || null
}

function matchesFramework(s: ScenarioListItem, frameworkIdOrSlug: string): boolean {
  if (s.framework_id === frameworkIdOrSlug) return true
  if (s.framework_slugs?.includes(frameworkIdOrSlug)) return true
  return false
}

/** Lightweight scenario list (no stages). Prefer this for home / browse / filters. */
export async function getScenarios(frameworkIdOrSlug?: string): Promise<ScenarioListItem[]> {
  let list = await loadScenarioList()
  if (frameworkIdOrSlug) list = list.filter((s) => matchesFramework(s, frameworkIdOrSlug))
  return list
}

/** Full scenario detail including stages. Prefer this for runner pages. */
export async function getScenario(id: string): Promise<Scenario | null> {
  return loadScenarioBySlug(id)
}

/** Bundled seed only — offline unit tests / SSG fallback without Firebase. */
export function getBundledScenarioCatalog(): Scenario[] {
  return getBundledScenarios()
}
