import axios from "axios"
import type {
  Framework,
  FrameworkListItem,
  Scenario,
  ScenarioAttempt,
  ScenarioListItem,
  StageResult,
  JournalEntry,
  Progress,
  CalibrationSummary,
} from "./types"
import { staticFrameworks, staticScenarios } from "./staticData"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:50128/api"

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
})

// Demo mode: return static data when backend is unavailable
let isStaticDemo = false

// Frameworks
export async function getFrameworks(category?: string): Promise<FrameworkListItem[]> {
  try {
    const params = category ? { category } : {}
    const { data } = await api.get("/frameworks", { params })
    return data
  } catch {
    isStaticDemo = true
    return category
      ? staticFrameworks.filter((f) => f.category === category)
      : staticFrameworks
  }
}

export async function getFramework(id: string): Promise<Framework> {
  try {
    const { data } = await api.get(`/frameworks/${id}`)
    return data
  } catch {
    const fw = staticFrameworks.find((f) => f.id === id || f.slug === id)
    if (fw) return { ...fw, key_concepts: [], use_cases: [], content: "", slug: fw.slug, concepts: [] } as Framework
    throw new Error("Framework not found")
  }
}

export async function getFrameworkBySlug(slug: string): Promise<Framework> {
  return getFramework(`/frameworks/slug/${slug}`)
}

// Scenarios
export async function getScenarios(frameworkId?: string): Promise<ScenarioListItem[]> {
  try {
    const params = frameworkId ? { framework_id: frameworkId } : {}
    const { data } = await api.get("/scenarios", { params })
    return data
  } catch {
    isStaticDemo = true
    return frameworkId
      ? staticScenarios.filter((s) => s.framework_id === frameworkId)
      : staticScenarios
  }
}

export async function getScenario(id: string): Promise<Scenario> {
  try {
    const { data } = await api.get(`/scenarios/slug/${id}`)
    return data
  } catch {
    const sc = staticScenarios.find((s) => s.id === id || s.slug === id)
    if (sc) {
      return {
        ...sc,
        context: { company: "Demo mode", situation: "Backend not available in static demo", time_pressure: "N/A", data_provided: [] },
        stages: [],
        outcome_branches: {},
      } as Scenario
    }
    throw new Error("Scenario not found")
  }
}

export async function startScenario(id: string): Promise<ScenarioAttempt> {
  const { data } = await api.post(`/scenarios/${id}/start`)
  return data
}

export async function evaluateChoice(
  scenarioId: string,
  stageId: string,
  choiceId?: string,
  freeResponse?: string,
): Promise<StageResult> {
  const { data } = await api.post(`/scenarios/${scenarioId}/evaluate`, {
    stage_id: stageId,
    choice_id: choiceId,
    free_response: freeResponse,
  })
  return data
}

export async function getAttempt(scenarioId: string): Promise<ScenarioAttempt> {
  const { data } = await api.get(`/scenarios/${scenarioId}/attempt`)
  return data
}

// Journal
export async function getJournalEntries(): Promise<JournalEntry[]> {
  try {
    const { data } = await api.get("/journal")
    return data
  } catch {
    return []
  }
}

export async function getJournalEntry(id: string): Promise<JournalEntry> {
  const { data } = await api.get(`/journal/${id}`)
  return data
}

export async function createJournalEntry(entry: Partial<JournalEntry>): Promise<JournalEntry> {
  try {
    const { data } = await api.post("/journal", entry)
    return data
  } catch {
    return { id: "demo", user_id: "demo", title: entry.title || "", context: entry.context || "", decision: entry.decision || "", rationale: entry.rationale || "", confidence: entry.confidence || 8, outcome_captured: false, review_date: "", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), alternatives_considered: [], key_assumptions: [], success_metrics: [] } as JournalEntry
  }
}

export async function updateJournalEntry(id: string, updates: Partial<JournalEntry>): Promise<JournalEntry> {
  const { data } = await api.patch(`/journal/${id}`, updates)
  return data
}

export async function createJournalOutcome(
  entryId: string,
  outcome: {
    what_happened: string
    was_right: string
    updated_confidence: number
    lesson: string
  },
): Promise<void> {
  try {
    await api.post(`/journal/${entryId}/outcome`, outcome)
  } catch { /* demo mode */ }
}

// Progress
export async function getProgress(): Promise<Progress> {
  try {
    const { data } = await api.get("/progress")
    return data
  } catch {
    return { user_id: "demo", scenarios_completed: 0, scenarios_in_progress: 0, total_scenario_score: 0, average_scenario_score: 0, framework_mastery: {}, current_streak_days: 0, longest_streak_days: 0, current_module_id: null, modules_completed: [] }
  }
}

export async function getCalibration(): Promise<CalibrationSummary> {
  try {
    const { data } = await api.get("/progress/calibration")
    return data
  } catch {
    return { total_predictions: 0, average_confidence: 0, accuracy: 0, average_brier_score: 0, calibration_by_confidence: {}, calibration_by_domain: {}, trend: [] }
  }
}

// Search
export async function searchFrameworks(query: string) {
  const { data } = await api.get(`/search?q=${encodeURIComponent(query)}`)
  return data
}