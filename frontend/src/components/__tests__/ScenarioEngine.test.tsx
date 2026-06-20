import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ScenarioEngine } from "../ScenarioEngine"
import type { Scenario } from "@/lib/types"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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

const mockScenario: Scenario = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  slug: "test-scenario",
  title: "Test Scenario",
  description: "A test",
  framework_id: "11111111-1111-1111-1111-111111111111",
  difficulty: 2,
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

describe("ScenarioEngine", () => {
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
})
