import axios from "axios"
import type {
  Framework, FrameworkListItem, Scenario, ScenarioAttempt, ScenarioListItem,
  StageResult, JournalEntry, Progress, CalibrationSummary,
} from "./types"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:50128/api"
const isStaticHosting = typeof window !== "undefined" && !window.location.hostname.includes("localhost") && !window.location.hostname.includes("127.0.0.1")

function ollamaHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem("ceocompass_settings")
    if (!raw) return {}
    const s = JSON.parse(raw)
    const h: Record<string, string> = {}
    if (s.ollamaUrl && s.ollamaUrl !== "http://localhost:11434") h["X-Ollama-Url"] = s.ollamaUrl
    if (s.ollamaModel && s.ollamaModel !== "gemma4cloud") h["X-Ollama-Model"] = s.ollamaModel
    return h
  } catch { return {} }
}

const api = axios.create({ baseURL: API_BASE, headers: { "Content-Type": "application/json" } })

export async function getFrameworks(category?: string): Promise<FrameworkListItem[]> {
  if (isStaticHosting) return []
  try { const { data } = await api.get("/frameworks", { params: category ? { category } : {} }); return data } catch { return [] }
}

export async function getFramework(id: string): Promise<Framework | null> {
  if (isStaticHosting) return null
  try { const { data } = await api.get(`/frameworks/${id}`); return data } catch { return null }
}

export async function getFrameworkBySlug(slug: string): Promise<Framework | null> {
  if (isStaticHosting) return null
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

export async function generateQuiz(frameworkId: string, numQuestions: number, difficulty: string) {
  const { data } = await api.post("/quiz/generate", { framework_id: frameworkId, num_questions: numQuestions, difficulty }, { headers: ollamaHeaders() }); return data
}

export { isStaticHosting }
