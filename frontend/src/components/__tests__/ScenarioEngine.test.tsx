import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ScenarioEngine, resolveOutcomeBranch } from "../ScenarioEngine"
import type { Scenario } from "@/lib/types"

const mockSeed = vi.fn()
const mockResolve = vi.fn()
const mockRating = vi.fn()
const mockShouldOffer = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/lib/capabilities", () => ({
  canUseFirebasePersistence: () => true,
}))

vi.mock("@/lib/rtdb-cache", () => ({
  getCachedFrameworks: () => null,
  loadFrameworks: vi.fn().mockResolvedValue([]),
  slugify: (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
}))

vi.mock("@/lib/ollama", () => ({
  evaluateScenarioStage: vi.fn().mockResolvedValue({
    parsed: {
      feedback: "Good strategic thinking! Your choice of Porter's Five Forces demonstrates systematic competitive analysis.",
      score: 9,
      key_insights: ["Systematic approach", "Data-driven decision making"],
      next_framework_suggestion: "Financial Mastery",
    },
    prompt: "You are a CEO coach...",
  }),
}))

vi.mock("@/lib/firebase-crud", () => ({
  saveScenarioAttempt: vi.fn(),
  loadScenarioHistory: vi.fn().mockResolvedValue([]),
  shouldOfferConceptReview: (...args: unknown[]) => mockShouldOffer(...args),
  ratingForWeakStages: (...args: unknown[]) => mockRating(...args),
  resolveConceptsForReview: (...args: unknown[]) => mockResolve(...args),
  seedConceptsToReview: (...args: unknown[]) => mockSeed(...args),
}))

import { evaluateScenarioStage } from "@/lib/ollama"

const mockScenario: Scenario = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  slug: "test-scenario",
  title: "Test Scenario",
  description: "A test",
  framework_id: "11111111-1111-1111-1111-111111111111",
  difficulty: 2,
  concept_ids: ["unit-economics", "free-cash-flow"],
  framework_slugs: ["financial-mastery"],
  context: {
    company: "TestCo, $5M ARR",
    situation: "Competitor launching free tier",
    time_pressure: "2 weeks",
    data_provided: ["P&L", "Customer segments"],
  },
  stages: [
    {
      id: "stage-1",
      type: "diagnosis",
      prompt: "Choose a framework:",
      options: [
        { id: "a", label: "Porter's Five Forces", score: 0.9, rationale: "Best for competitive analysis" },
        { id: "b", label: "SWOT", score: 0.3, rationale: "Too general for this case" },
      ],
      free_response: false,
      feedback_prompt_template: "User chose {option}",
    },
    {
      id: "stage-2",
      type: "analysis",
      prompt: "Estimate revenue impact:",
      options: [],
      free_response: true,
      feedback_prompt_template: "User: {response}",
    },
  ],
  outcome_branches: {
    optimal: { title: "Success", description: "Won" },
    acceptable: { title: "OK", description: "Survived" },
    failure: { title: "Failed", description: "Lost" },
  },
}

describe("resolveOutcomeBranch", () => {
  it("maps 0–1 catalog option scores to optimal/acceptable/failure", () => {
    expect(resolveOutcomeBranch(0.95, 0)).toBe("optimal")
    expect(resolveOutcomeBranch(0.8, 0)).toBe("optimal")
    expect(resolveOutcomeBranch(0.5, 0)).toBe("acceptable")
    expect(resolveOutcomeBranch(0.49, 0)).toBe("failure")
    expect(resolveOutcomeBranch(0.1, 9)).toBe("failure")
  })

  it("accepts legacy 0–10 option scores", () => {
    expect(resolveOutcomeBranch(9, 0)).toBe("optimal")
    expect(resolveOutcomeBranch(5, 0)).toBe("acceptable")
    expect(resolveOutcomeBranch(3, 0)).toBe("failure")
  })

  it("uses AI 0–10 score for free-response finals (no option)", () => {
    expect(resolveOutcomeBranch(undefined, 9)).toBe("optimal")
    expect(resolveOutcomeBranch(undefined, 8)).toBe("optimal")
    expect(resolveOutcomeBranch(undefined, 5)).toBe("acceptable")
    expect(resolveOutcomeBranch(undefined, 4)).toBe("failure")
  })
})

describe("ScenarioEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockShouldOffer.mockReturnValue(false)
    mockRating.mockReturnValue(3)
    mockResolve.mockReturnValue([
      {
        conceptId: "c-ue",
        frameworkSlug: "financial-mastery",
        conceptName: "Unit Economics",
        conceptSlug: "unit-economics",
      },
    ])
    mockSeed.mockResolvedValue({ seeded: 1, failed: 0 })
    vi.mocked(evaluateScenarioStage).mockResolvedValue({
      parsed: {
        feedback: "Good strategic thinking! Your choice of Porter's Five Forces demonstrates systematic competitive analysis.",
        score: 9,
        key_insights: ["Systematic approach", "Data-driven decision making"],
        next_framework_suggestion: "Financial Mastery",
      },
      prompt: "You are a CEO coach...",
    } as any)
  })

  it("shows progress bar and stage info", () => {
    render(<ScenarioEngine scenario={mockScenario} />)
    expect(screen.getByText("Stage 1 of 2")).toBeInTheDocument()
    expect(screen.getByText("diagnosis")).toBeInTheDocument()
  })

  it("displays the stage prompt", () => {
    render(<ScenarioEngine scenario={mockScenario} />)
    expect(screen.getByText("Choose a framework:")).toBeInTheDocument()
  })

  it("displays multiple choice options", () => {
    render(<ScenarioEngine scenario={mockScenario} />)
    expect(screen.getByText("Porter's Five Forces")).toBeInTheDocument()
    expect(screen.getByText("SWOT")).toBeInTheDocument()
  })

  it("shows feedback after submitting choice", async () => {
    render(<ScenarioEngine scenario={mockScenario} />)

    fireEvent.click(screen.getByText("Porter's Five Forces"))
    fireEvent.click(screen.getByText("Submit"))

    await waitFor(() => {
      expect(screen.getByText(/Good strategic thinking/)).toBeInTheDocument()
    })
    expect(screen.getByText("90%")).toBeInTheDocument()
    expect(screen.getByText("Systematic approach")).toBeInTheDocument()
    expect(screen.getByText("Financial Mastery")).toBeInTheDocument()
  })

  it("shows optimal outcome_branches when free-response final scores high", async () => {
    const freeFinal: Scenario = {
      ...mockScenario,
      stages: [
        {
          id: "stage-1",
          type: "communication",
          prompt: "Write the board note:",
          options: [],
          free_response: true,
          feedback_prompt_template: "User: {response}",
        },
      ],
    }
    render(<ScenarioEngine scenario={freeFinal} />)
    fireEvent.change(screen.getByPlaceholderText(/Type your analysis/), {
      target: { value: "Cash first, then ops, then growth." },
    })
    fireEvent.click(screen.getByText("Submit for Feedback"))
    await waitFor(() => {
      expect(screen.getByText("Success")).toBeInTheDocument()
    })
    expect(screen.getByText("Won")).toBeInTheDocument()
  })

  it("offers add-to-review when weak stages and concept_ids", async () => {
    mockShouldOffer.mockReturnValue(true)
    vi.mocked(evaluateScenarioStage).mockResolvedValue({
      parsed: {
        feedback: "Needs work on unit economics.",
        score: 3,
        key_insights: ["Review cash runway"],
        next_framework_suggestion: undefined,
      },
      prompt: "...",
    } as any)

    const freeFinal: Scenario = {
      ...mockScenario,
      stages: [
        {
          id: "stage-1",
          type: "analysis",
          prompt: "Estimate impact:",
          options: [],
          free_response: true,
          feedback_prompt_template: "User: {response}",
        },
      ],
    }
    render(<ScenarioEngine scenario={freeFinal} />)
    fireEvent.change(screen.getByPlaceholderText(/Type your analysis/), {
      target: { value: "I am not sure." },
    })
    fireEvent.click(screen.getByText("Submit for Feedback"))

    await waitFor(() => {
      expect(screen.getByTestId("scenario-review-offer")).toBeInTheDocument()
    })
    expect(screen.getByTestId("add-concepts-to-review")).toBeInTheDocument()
    expect(screen.getByText("Unit Economics")).toBeInTheDocument()
    expect(screen.getByText("Free Cash Flow")).toBeInTheDocument()
  })

  it("does not offer review when shouldOfferConceptReview is false", async () => {
    mockShouldOffer.mockReturnValue(false)
    const freeFinal: Scenario = {
      ...mockScenario,
      stages: [
        {
          id: "stage-1",
          type: "communication",
          prompt: "Write the board note:",
          options: [],
          free_response: true,
          feedback_prompt_template: "User: {response}",
        },
      ],
    }
    render(<ScenarioEngine scenario={freeFinal} />)
    fireEvent.change(screen.getByPlaceholderText(/Type your analysis/), {
      target: { value: "Strong plan." },
    })
    fireEvent.click(screen.getByText("Submit for Feedback"))
    await waitFor(() => {
      expect(screen.getByText("Success")).toBeInTheDocument()
    })
    expect(screen.queryByTestId("scenario-review-offer")).not.toBeInTheDocument()
  })

  it("seeds reviews with Hard/Again rating when user accepts offer", async () => {
    mockShouldOffer.mockReturnValue(true)
    mockRating.mockReturnValue(0)
    vi.mocked(evaluateScenarioStage).mockResolvedValue({
      parsed: {
        feedback: "Weak.",
        score: 2,
        key_insights: [],
      },
      prompt: "...",
    } as any)

    const freeFinal: Scenario = {
      ...mockScenario,
      stages: [
        {
          id: "stage-1",
          type: "analysis",
          prompt: "Estimate impact:",
          options: [],
          free_response: true,
          feedback_prompt_template: "User: {response}",
        },
      ],
    }
    render(<ScenarioEngine scenario={freeFinal} />)
    fireEvent.change(screen.getByPlaceholderText(/Type your analysis/), {
      target: { value: "guess" },
    })
    fireEvent.click(screen.getByText("Submit for Feedback"))

    await waitFor(() => {
      expect(screen.getByTestId("add-concepts-to-review")).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId("add-concepts-to-review"))

    await waitFor(() => {
      expect(screen.getByTestId("scenario-review-done")).toBeInTheDocument()
    })
    expect(mockSeed).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ conceptSlug: "unit-economics" }),
      ]),
      0,
    )
    expect(screen.getByText(/Added 1 concept/)).toBeInTheDocument()
  })
})
