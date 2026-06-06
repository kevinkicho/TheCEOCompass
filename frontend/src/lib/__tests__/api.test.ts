import { describe, it, expect, vi } from "vitest"

vi.mock("axios", () => {
  const mockAxios = {
    create: vi.fn(() => ({
      get: vi.fn((url: string) => {
        if (url.includes("/frameworks/")) {
          return Promise.resolve({
            data: {
              id: "11111111-1111-1111-1111-111111111111",
              slug: "test",
              title: "Test",
              description: "Test framework",
              category: "test",
              difficulty: 2,
              estimated_time_minutes: 30,
              key_concepts: ["A", "B"],
              use_cases: ["Use"],
              concepts: [],
            },
          })
        }
        if (url.includes("/scenarios/")) {
          return Promise.resolve({
            data: {
              id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
              slug: "test-scenario",
              title: "Test Scenario",
              description: "A test scenario",
              framework_id: "11111111-1111-1111-1111-111111111111",
              difficulty: 2,
              context: { company: "Co", situation: "Sit", time_pressure: "N", data_provided: [] },
              stages: [],
              outcome_branches: {},
            },
          })
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