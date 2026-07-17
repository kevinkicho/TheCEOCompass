import axios from "axios"
import { getCachedFrameworks } from "./rtdb-cache"
import { loadScenarios, getCachedScenarios, getBundledScenarios } from "./scenarios-cache"
import type {
  Framework, FrameworkListItem, Scenario, ScenarioAttempt, ScenarioListItem,
  StageResult, JournalEntry, Progress, CalibrationSummary,
} from "./types"
import { useFastApiScenarios } from "@/lib/constants"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:50128/api"

const api = axios.create({ baseURL: API_BASE, headers: { "Content-Type": "application/json" } })

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

function toScenarioListItem(s: Scenario): ScenarioListItem {
  return {
    id: s.id,
    slug: s.slug,
    title: s.title,
    description: s.description,
    framework_id: s.framework_id,
    difficulty: s.difficulty,
    pack_id: s.pack_id ?? "core",
    pack_title: s.pack_title ?? "Core",
    concept_ids: s.concept_ids,
    framework_slugs: s.framework_slugs,
  }
}

function matchesFramework(s: Scenario, frameworkIdOrSlug: string): boolean {
  if (s.framework_id === frameworkIdOrSlug) return true
  if (s.framework_slugs?.includes(frameworkIdOrSlug)) return true
  return false
}

/** frameworkIdOrSlug: RTDB/framework id or slug. Prefer slug — pack scenarios join via framework_slugs. */
export async function getScenarios(frameworkIdOrSlug?: string): Promise<ScenarioListItem[]> {
  if (useFastApiScenarios) {
    try {
      const { data } = await api.get("/scenarios", {
        params: frameworkIdOrSlug ? { framework_id: frameworkIdOrSlug } : {},
      })
      const rows = (data as ScenarioListItem[]) || []
      return rows.map((s) => ({
        ...s,
        pack_id: s.pack_id ?? "core",
        pack_title: s.pack_title ?? "Core",
      }))
    } catch {
      return []
    }
  }

  let list = await loadScenarios()
  if (frameworkIdOrSlug) list = list.filter((s) => matchesFramework(s, frameworkIdOrSlug))
  return list.map(toScenarioListItem)
}

export async function getScenario(id: string): Promise<Scenario | null> {
  if (useFastApiScenarios) {
    try {
      const { data } = await api.get(`/scenarios/slug/${id}`)
      return data
    } catch {
      return null
    }
  }

  const list = getCachedScenarios() || (await loadScenarios())
  return list.find((s) => s.slug === id || s.id === id) || null
}

/** Bundled seed only — for offline unit tests that skip Firebase. */
export function getBundledScenarioCatalog(): Scenario[] {
  return getBundledScenarios()
}

export async function startScenario(id: string): Promise<ScenarioAttempt> {
  const { data } = await api.post(`/scenarios/${id}/start`); return data
}

export async function evaluateChoice(scenarioId: string, stageId: string, choiceId?: string, freeResponse?: string): Promise<StageResult> {
  const { data } = await api.post(`/scenarios/${scenarioId}/evaluate`, { stage_id: stageId, choice_id: choiceId, free_response: freeResponse }); return data
}

export async function getAttempt(scenarioId: string): Promise<ScenarioAttempt> {
  const { data } = await api.get(`/scenarios/${scenarioId}/attempt`); return data
}

/** @deprecated Use firebase-crud / user-data journal APIs */
export async function getJournalEntries(): Promise<JournalEntry[]> {
  return []
}

export async function getJournalEntry(id: string): Promise<JournalEntry> {
  const { data } = await api.get(`/journal/${id}`); return data
}

export async function createJournalEntry(entry: Partial<JournalEntry>): Promise<JournalEntry> {
  const { data } = await api.post("/journal", entry); return data
}

export async function updateJournalEntry(id: string, updates: Partial<JournalEntry>): Promise<JournalEntry> {
  const { data } = await api.patch(`/journal/${id}`, updates); return data
}

export async function createJournalOutcome(entryId: string, outcome: { what_happened: string; was_right: string; updated_confidence: number; lesson: string }): Promise<void> {
  await api.post(`/journal/${entryId}/outcome`, outcome)
}

/** @deprecated Use firebase-crud pathway APIs */
export async function getProgress(): Promise<Progress | null> {
  return null
}

/** @deprecated Use lib/calibration */
export async function getCalibration(): Promise<CalibrationSummary | null> {
  return null
}

export async function searchFrameworks(query: string) {
  const { data } = await api.get(`/search?q=${encodeURIComponent(query)}`); return data
}
