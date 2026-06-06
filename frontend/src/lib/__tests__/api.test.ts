import { describe, it, expect, vi } from "vitest"

vi.mock("axios", () => {
  const mockAxios = {
    create: vi.fn(() => ({
      get: vi.fn((url: string) => {
        if (url.includes("progress/calibration")) {
          return Promise.resolve({
            data: { total_predictions: 5, average_confidence: 0.7, accuracy: 0.6, average_brier_score: 0.18, calibration_by_confidence: {}, calibration_by_domain: {}, trend: [] },
          })
        }
        if (url.includes("progress")) {
          return Promise.resolve({
            data: { user_id: "u1", scenarios_completed: 3, scenarios_in_progress: 1, total_scenario_score: 2.5, average_scenario_score: 0.8, framework_mastery: {}, current_streak_days: 5, longest_streak_days: 12, modules_completed: [], current_module_id: null },
          })
        }
        if (url.includes("journal")) {
          return Promise.resolve({ data: [] })
        }
        if (url.includes("/frameworks/")) {
          return Promise.resolve({
            data: {
              id: "11111111-1111-1111-1111-111111111111", slug: "test", title: "Test", description: "Test framework",
              category: "test", difficulty: 2, estimated_time_minutes: 30, key_concepts: ["A", "B"], use_cases: ["Use"], concepts: [],
            },
          })
        }
        if (url.includes("frameworks")) {
          return Promise.resolve({ data: [{ id: "1", slug: "s1", title: "T1", description: "D", category: "c", difficulty: 1, estimated_time_minutes: 30 }] })
        }
        if (url.includes("/scenarios/")) {
          return Promise.resolve({
            data: { id: "aaa", slug: "test-scenario", title: "Test Scenario", description: "A test", framework_id: "111", difficulty: 2,
              context: { company: "Co", situation: "Sit", time_pressure: "N", data_provided: [] }, stages: [], outcome_branches: {} },
          })
        }
        if (url.includes("scenarios")) {
          return Promise.resolve({ data: [{ id: "1", slug: "s1", title: "S1", description: "D", framework_id: "1", difficulty: 2 }] })
        }
        return Promise.resolve({ data: [] })
      }),
      post: vi.fn(() => Promise.resolve({ data: { id: "new-id", status: "ok" } })),
      patch: vi.fn(() => Promise.resolve({ data: { status: "updated" } })),
    })),
  }
  return { default: mockAxios }
})

import {
  getFrameworks,
  getFrameworkBySlug,
  getScenarios,
  getScenario,
  getJournalEntries,
  createJournalEntry,
  getProgress,
} from "../api"

describe("API Client", () => {
  it("getFrameworks returns an array", async () => {
    const result = await getFrameworks()
    expect(Array.isArray(result)).toBe(true)
  })

  it("getFrameworkBySlug returns a framework", async () => {
    const result = await getFrameworkBySlug("test")
    expect(result).toHaveProperty("title")
    expect(result).toHaveProperty("slug")
  })

  it("getScenarios returns an array", async () => {
    const result = await getScenarios()
    expect(Array.isArray(result)).toBe(true)
  })

  it("getScenario returns a scenario with slug", async () => {
    const result = await getScenario("test-scenario")
    expect(result).toHaveProperty("title")
    expect(result).toHaveProperty("slug")
  })

  it("getJournalEntries returns an array", async () => {
    const result = await getJournalEntries()
    expect(Array.isArray(result)).toBe(true)
  })

  it("createJournalEntry returns new entry", async () => {
    const result = await createJournalEntry({
      title: "Test",
      context: "ctx",
      decision: "d",
      rationale: "r",
      confidence: 8,
      review_date: "2025-12-31",
    })
    expect(result).toHaveProperty("id")
  })

  it("getProgress returns progress object", async () => {
    const result = await getProgress()
    expect(result).toHaveProperty("scenarios_completed")
    expect(result).toHaveProperty("current_streak_days")
  })
})