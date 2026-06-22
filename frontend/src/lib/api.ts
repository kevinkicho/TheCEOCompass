import axios from "axios"
import { db, ref, get } from "./firebase"
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

async function rtdbGet<T>(path: string): Promise<T | null> {
  if (!db) return null
  try {
    const snap = await get(ref(db!, path))
    return snap.exists() ? (snap.val() as T) : null
  } catch { return null }
}

export async function getFrameworks(category?: string): Promise<FrameworkListItem[]> {
  if (!db) return []
  const slugs = await rtdbGet<string[]>("_meta/framework_slugs")
  if (!slugs) return []
  const frameworks: FrameworkListItem[] = []
  for (const slug of slugs) {
    const fw = await rtdbGet<FrameworkListItem>(`frameworks/${slug}`)
    if (fw) frameworks.push(fw)
  }
  if (category) return frameworks.filter((f) => f.category === category)
  return frameworks
}

export async function getFramework(id: string): Promise<Framework | null> {
  if (!db) return null
  let fw = await rtdbGet<Framework>(`frameworks/${id}`)
  if (fw) {
    const concepts = await rtdbGet<Record<string, any>>(`frameworks/${id}/concepts`)
    if (concepts) fw.concepts = Object.values(concepts)
    return fw
  }
  const slugs = await rtdbGet<string[]>("_meta/framework_slugs")
  if (!slugs) return null
  for (const slug of slugs) {
    const fwData = await rtdbGet<Framework>(`frameworks/${slug}`)
    if (fwData && (fwData.id === id || fwData.slug === id)) {
      const concepts = await rtdbGet<Record<string, any>>(`frameworks/${slug}/concepts`)
      if (concepts) fwData.concepts = Object.values(concepts)
      return fwData
    }
  }
  return null
}

export async function getFrameworkBySlug(slug: string): Promise<Framework | null> {
  if (!db) return null
  const fw = await rtdbGet<Framework>(`frameworks/${slug}`)
  if (fw) {
    const concepts = await rtdbGet<Record<string, any>>(`frameworks/${slug}/concepts`)
    if (concepts) fw.concepts = Object.values(concepts)
  }
  return fw
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
