import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ScenarioEngine } from "../ScenarioEngine"
import type { Scenario } from "@/lib/types"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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
        { id: "a", label: "Porter's Five Forces", score: 0.9, rationale: "Best" },
        { id: "b", label: "SWOT", score: 0.3, rationale: "Too general" },
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

vi.mock("@/lib/api", () => ({
  startScenario: vi.fn().mockResolvedValue({
    id: "attempt-1",
    user_id: "user-1",
    scenario_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    current_stage_id: "stage-1",
    choices_made: {},
    score: null,
    outcome_branch: null,
    completed_at: null,
  }),
  evaluateChoice: vi.fn().mockResolvedValue({
    next_stage_id: "stage-2",
    feedback: {
      feedback: "Good choice!",
      score: 0.9,
      next_framework_suggestion: "Financial Mastery",
      key_insights: ["Systematic approach", "Data-driven"],
    },
    is_complete: false,
  }),
}))

describe("ScenarioEngine", () => {
  it("renders context before starting", () => {
    render(<ScenarioEngine scenario={mockScenario} />)
    
    expect(screen.getByText("Context")).toBeInTheDocument()
    expect(screen.getByText(/TestCo, \$5M ARR/)).toBeInTheDocument()
    expect(screen.getByText("Start Scenario")).toBeInTheDocument()
  })

  it("shows data provided section", () => {
    render(<ScenarioEngine scenario={mockScenario} />)
    
    expect(screen.getByText("P&L")).toBeInTheDocument()
    expect(screen.getByText("Customer segments")).toBeInTheDocument()
  })

  it("shows progress bar and stage info after starting", async () => {
    render(<ScenarioEngine scenario={mockScenario} />)
    
    fireEvent.click(screen.getByText("Start Scenario"))
    
    await waitFor(() => {
      expect(screen.getByText("Stage 1 of 2")).toBeInTheDocument()
    })
  })

  it("displays multiple choice options", async () => {
    render(<ScenarioEngine scenario={mockScenario} />)
    
    fireEvent.click(screen.getByText("Start Scenario"))
    
    await waitFor(() => {
      expect(screen.getByText("Porter's Five Forces")).toBeInTheDocument()
      expect(screen.getByText("SWOT")).toBeInTheDocument()
    })
  })

  it("shows feedback after submitting choice", async () => {
    render(<ScenarioEngine scenario={mockScenario} />)
    
    fireEvent.click(screen.getByText("Start Scenario"))
    
    await waitFor(() => {
      fireEvent.click(screen.getByText("Porter's Five Forces"))
    })
    
    fireEvent.click(screen.getByText("Submit"))
    
    await waitFor(() => {
      expect(screen.getByText("AI Coach Feedback")).toBeInTheDocument()
    })
  })
})