import axios from "axios"
import type {
  Framework, FrameworkListItem, Scenario, ScenarioAttempt, ScenarioListItem,
  StageResult, JournalEntry, Progress, CalibrationSummary,
} from "./types"
import { staticFrameworks } from "./staticData"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:50128/api"
const isStaticHosting = typeof window !== "undefined" && !window.location.hostname.includes("localhost") && !window.location.hostname.includes("127.0.0.1")

const api = axios.create({ baseURL: API_BASE, headers: { "Content-Type": "application/json" } })

export async function getFrameworks(category?: string): Promise<FrameworkListItem[]> {
  if (isStaticHosting) {
    let list = staticFrameworks as any
    if (category) list = list.filter((f: any) => f.category === category)
    return list
  }
  try { const { data } = await api.get("/frameworks", { params: category ? { category } : {} }); return data } catch { return [] }
}

export async function getFramework(id: string): Promise<Framework | null> {
  if (isStaticHosting) {
    const fw = (staticFrameworks as any).find((f: any) => f.id === id || f.slug === id)
    return fw || null
  }
  try { const { data } = await api.get(`/frameworks/${id}`); return data } catch { return null }
}

export async function getFrameworkBySlug(slug: string): Promise<Framework | null> {
  if (isStaticHosting) {
    const fw = (staticFrameworks as any).find((f: any) => f.slug === slug || f.id === slug)
    return fw || null
  }
  try { const { data } = await api.get(`/frameworks/slug/${slug}`); return data } catch { return null }
}

export async function getScenarios(frameworkId?: string): Promise<ScenarioListItem[]> {
  if (isStaticHosting) return []
  try { const { data } = await api.get("/scenarios", { params: frameworkId ? { framework_id: frameworkId } : {} }); return data } catch { return [] }
}

export async function getScenario(id: string): Promise<Scenario | null> {
  if (isStaticHosting) return null
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
