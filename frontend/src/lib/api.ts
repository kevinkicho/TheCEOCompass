import axios from "axios"
import { loadFrameworks, getCachedFrameworks } from "./rtdb-cache"
import type {
  Framework, FrameworkListItem, Scenario, ScenarioAttempt, ScenarioListItem,
  StageResult, JournalEntry, Progress, CalibrationSummary,
} from "./types"
import staticScenarioData from "@/data/scenarios.json"

import { isStaticHosting } from "@/lib/constants"
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:50128/api"

const api = axios.create({ baseURL: API_BASE, headers: { "Content-Type": "application/json" } })

// Cast static scenarios to match expected types
const staticScenarios = staticScenarioData as any[]

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
  return fws.find((f: any) => f.id === id || f.slug === id) || null
}

export async function getFrameworkBySlug(slug: string): Promise<Framework | null> {
  const fws = getCachedFrameworks()
  if (!fws) return null
  return fws.find((f: any) => f.slug === slug) || null
}

export async function getScenarios(frameworkId?: string): Promise<ScenarioListItem[]> {
  if (isStaticHosting) {
    let list = staticScenarios
    if (frameworkId) list = list.filter((s: any) => s.framework_id === frameworkId)
    return list.map((s: any) => ({
      id: s.id, slug: s.slug, title: s.title,
      description: s.description, framework_id: s.framework_id, difficulty: s.difficulty,
    }))
  }
  try { const { data } = await api.get("/scenarios", { params: frameworkId ? { framework_id: frameworkId } : {} }); return data } catch { return [] }
}

export async function getScenario(id: string): Promise<Scenario | null> {
  if (isStaticHosting) {
    const found = staticScenarios.find((s: any) => s.slug === id || s.id === id)
    return found || null
  }
  try { const { data } = await api.get(`/scenarios/slug/${id}`); return data } catch { return null }
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

export async function getJournalEntries(): Promise<JournalEntry[]> {
  if (isStaticHosting) return []
  try { const { data } = await api.get("/journal"); return data } catch { return [] }
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

export async function getProgress(): Promise<Progress | null> {
  if (isStaticHosting) return null
  try { const { data } = await api.get("/progress"); return data } catch { return null }
}

export async function getCalibration(): Promise<CalibrationSummary | null> {
  if (isStaticHosting) return null
  try { const { data } = await api.get("/progress/calibration"); return data } catch { return null }
}

export async function searchFrameworks(query: string) {
  const { data } = await api.get(`/search?q=${encodeURIComponent(query)}`); return data
}

export { isStaticHosting }
