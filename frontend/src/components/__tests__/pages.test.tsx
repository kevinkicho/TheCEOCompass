import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({ slug: "strategic-decision-making" }),
  usePathname: () => "/frameworks/strategic-decision-making",
}))

// Mock the API
vi.mock("@/lib/api", () => ({
  getFrameworks: vi.fn().mockResolvedValue([
    {
      id: "11111111-1111-1111-1111-111111111111",
      slug: "strategic-decision-making",
      title: "Strategic Decision-Making",
      description: "Core frameworks for making high-stakes decisions",
      category: "decision-making",
      difficulty: 2,
      estimated_time_minutes: 45,
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      slug: "financial-mastery",
      title: "Financial Mastery",
      description: "Read financial statements, value companies",
      category: "financial",
      difficulty: 3,
      estimated_time_minutes: 60,
    },
  ]),
  getFrameworkBySlug: vi.fn().mockResolvedValue({
    id: "11111111-1111-1111-1111-111111111111",
    slug: "strategic-decision-making",
    title: "Strategic Decision-Making",
    description: "Core frameworks for making high-stakes decisions",
    category: "decision-making",
    difficulty: 2,
    estimated_time_minutes: 45,
    key_concepts: ["First Principles Thinking", "Inversion", "OODA Loop"],
    use_cases: ["Major strategic bets", "M&A decisions"],
    concepts: [
      {
        id: "c1",
        name: "First Principles Thinking",
        definition: "Decompose problems to fundamental truths",
        example: "SpaceX example | Elon Musk example | Airbnb example",
        tags: ["decision-making", "innovation"],
      },
      {
        id: "c2",
        name: "Inversion",
        definition: "Solve problems by thinking backward",
        example: "Charlie Munger example | Investment example | Product launch example",
        tags: ["decision-making", "risk"],
      },
      {
        id: "c3",
        name: "OODA Loop",
        definition: "Observe, Orient, Decide, Act",
        example: "Air Force example | Startup example | COVID example",
        tags: ["decision-making", "speed"],
      },
    ],
  }),
  getScenarios: vi.fn().mockResolvedValue([]),
  getProgress: vi.fn().mockResolvedValue({
    user_id: "u1",
    scenarios_completed: 3,
    scenarios_in_progress: 1,
    total_scenario_score: 2.5,
    average_scenario_score: 0.8,
    framework_mastery: {},
    current_streak_days: 5,
    longest_streak_days: 12,
    modules_completed: [],
    current_module_id: null,
  }),
  getCalibration: vi.fn().mockResolvedValue({
    total_predictions: 5,
    average_confidence: 0.7,
    accuracy: 0.6,
    average_brier_score: 0.18,
    calibration_by_confidence: {},
    calibration_by_domain: {},
    trend: [],
  }),
  getJournalEntries: vi.fn().mockResolvedValue([]),
}))

// Test that imports work for all page components
describe("Page imports are valid", () => {
  it("imports frameworks page without error", async () => {
    const mod = await import("@/app/frameworks/page")
    expect(mod.default).toBeDefined()
  })

  it("imports framework detail page without error", async () => {
    const mod = await import("@/app/frameworks/[slug]/page")
    expect(mod.default).toBeDefined()
  })

  it("imports scenarios page without error", async () => {
    const mod = await import("@/app/scenarios/page")
    expect(mod.default).toBeDefined()
  })

  it("imports scenario detail page without error", async () => {
    const mod = await import("@/app/scenarios/[slug]/page")
    expect(mod.default).toBeDefined()
  })

  it("imports quiz page without error", async () => {
    const mod = await import("@/app/quiz/page")
    expect(mod.default).toBeDefined()
  })

  it("imports journal page without error", async () => {
    const mod = await import("@/app/journal/page")
    expect(mod.default).toBeDefined()
  })

  it("imports pathway page without error", async () => {
    const mod = await import("@/app/pathway/page")
    expect(mod.default).toBeDefined()
  })

  it("imports profile page without error", async () => {
    const mod = await import("@/app/profile/page")
    expect(mod.default).toBeDefined()
  })

  it("imports cheatsheet page without error", async () => {
    const mod = await import("@/app/cheatsheet/page")
    expect(mod.default).toBeDefined()
  })

  it("imports layout without error", async () => {
    const mod = await import("@/app/layout")
    expect(mod.default).toBeDefined()
  })
})