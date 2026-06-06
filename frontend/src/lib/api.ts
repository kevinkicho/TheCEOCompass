import axios from "axios"
import type {
  Framework, FrameworkListItem, Scenario, ScenarioAttempt, ScenarioListItem,
  StageResult, JournalEntry, Progress, CalibrationSummary,
} from "./types"
import { staticFrameworks, staticScenarios } from "./staticData"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:50128/api"
const isStaticHosting = typeof window !== "undefined" && !window.location.hostname.includes("localhost") && !window.location.hostname.includes("127.0.0.1")

const api = axios.create({ baseURL: API_BASE, headers: { "Content-Type": "application/json" } })

export async function getFrameworks(category?: string): Promise<FrameworkListItem[]> {
  if (isStaticHosting) return category ? staticFrameworks.filter(f => f.category === category) : staticFrameworks
  try { const { data } = await api.get("/frameworks", { params: category ? { category } : {} }); return data } catch { return [] }
}

export async function getFramework(id: string): Promise<Framework> {
  if (isStaticHosting) {
    const fw = staticFrameworks.find(f => f.id === id || f.slug === id)
    if (fw) return { ...fw, key_concepts: [], use_cases: [], content: "", slug: fw.slug, concepts: [] } as Framework
    throw new Error("Not found")
  }
  try { const { data } = await api.get(`/frameworks/${id}`); return data } catch { throw new Error("Not found") }
}

export async function getFrameworkBySlug(slug: string): Promise<Framework> {
  if (isStaticHosting) return getFramework(slug)
  try { const { data } = await api.get(`/frameworks/slug/${slug}`); return data } catch { throw new Error("Not found") }
}

export async function getScenarios(frameworkId?: string): Promise<ScenarioListItem[]> {
  if (isStaticHosting) return frameworkId ? staticScenarios.filter(s => s.framework_id === frameworkId) : staticScenarios
  try { const { data } = await api.get("/scenarios", { params: frameworkId ? { framework_id: frameworkId } : {} }); return data } catch { return [] }
}

export async function getScenario(id: string): Promise<Scenario> {
  if (isStaticHosting) {
    const sc = staticScenarios.find(s => s.id === id || s.slug === id)
    if (sc) return { ...sc, context: { company: "Demo", situation: "Static demo — run locally for full experience", time_pressure: "N/A", data_provided: [] }, stages: [], outcome_branches: {} } as Scenario
    throw new Error("Not found")
  }
  try { const { data } = await api.get(`/scenarios/slug/${id}`); return data } catch { throw new Error("Not found") }
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
  if (isStaticHosting) return { id: "demo", user_id: "demo", title: entry.title || "", context: "", decision: "", rationale: "", confidence: 8, outcome_captured: false, review_date: "", created_at: "", updated_at: "", alternatives_considered: [], key_assumptions: [], success_metrics: [] } as JournalEntry
  try { const { data } = await api.post("/journal", entry); return data } catch { return { id: "demo", user_id: "demo", title: entry.title || "", context: "", decision: "", rationale: "", confidence: 8, outcome_captured: false, review_date: "", created_at: "", updated_at: "", alternatives_considered: [], key_assumptions: [], success_metrics: [] } as JournalEntry }
}

export async function updateJournalEntry(id: string, updates: Partial<JournalEntry>): Promise<JournalEntry> {
  const { data } = await api.patch(`/journal/${id}`, updates); return data
}

export async function createJournalOutcome(entryId: string, outcome: { what_happened: string; was_right: string; updated_confidence: number; lesson: string }): Promise<void> {
  if (isStaticHosting) return
  try { await api.post(`/journal/${entryId}/outcome`, outcome) } catch { /* ok */ }
}

export async function getProgress(): Promise<Progress> {
  if (isStaticHosting) return { user_id: "demo", scenarios_completed: 0, scenarios_in_progress: 0, total_scenario_score: 0, average_scenario_score: 0, framework_mastery: {}, current_streak_days: 0, longest_streak_days: 0, current_module_id: null, modules_completed: [] }
  try { const { data } = await api.get("/progress"); return data } catch { return { user_id: "demo", scenarios_completed: 0, scenarios_in_progress: 0, total_scenario_score: 0, average_scenario_score: 0, framework_mastery: {}, current_streak_days: 0, longest_streak_days: 0, current_module_id: null, modules_completed: [] } }
}

export async function getCalibration(): Promise<CalibrationSummary> {
  if (isStaticHosting) return { total_predictions: 0, average_confidence: 0, accuracy: 0, average_brier_score: 0, calibration_by_confidence: {}, trend: [] }
  try { const { data } = await api.get("/progress/calibration"); return data } catch { return { total_predictions: 0, average_confidence: 0, accuracy: 0, average_brier_score: 0, calibration_by_confidence: {}, trend: [] } }
}

export async function searchFrameworks(query: string) {
  const { data } = await api.get(`/search?q=${encodeURIComponent(query)}`); return data
}