import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import type { FeatureFlags } from "@/lib/feature-flags"

const useFeatureFlags = vi.fn()

vi.mock("@/components/FeatureFlagsProvider", () => ({
  useFeatureFlags: () => useFeatureFlags(),
}))

vi.mock("@/lib/capabilities", () => ({
  canUseFirebasePersistence: () => true,
}))

vi.mock("@/lib/AuthSessionProvider", () => ({
  useAuthSession: () => ({
    user: { uid: "test", isAnonymous: true },
    ready: true,
    isAdmin: false,
    isAnonymous: true,
  }),
}))

vi.mock("@/lib/firebase", () => ({
  db: { ref: vi.fn() },
  ref: vi.fn(() => ({ key: "mock" })),
  get: vi.fn(() => Promise.resolve({ exists: () => false, val: () => null })),
}))

vi.mock("@/lib/firebase-crud", () => ({
  loadPathwayProgress: vi.fn().mockResolvedValue({ completedIds: [], inProgressId: null }),
  buildPathway: vi.fn().mockReturnValue([]),
  loadDueReviews: vi.fn().mockResolvedValue([
    {
      conceptId: "c1",
      frameworkSlug: "fw",
      conceptName: "Concept",
      conceptSlug: "concept",
      reviewCount: 1,
      interval: 1,
      easeFactor: 2.5,
      lastReviewedAt: new Date().toISOString(),
      nextReviewAt: new Date(Date.now() - 1000).toISOString(),
    },
  ]),
  loadAllReviews: vi.fn().mockResolvedValue([
    {
      conceptId: "c1",
      frameworkSlug: "fw",
      conceptName: "Concept",
      conceptSlug: "concept",
      reviewCount: 1,
      interval: 1,
      easeFactor: 2.5,
      lastReviewedAt: new Date().toISOString(),
      nextReviewAt: new Date(Date.now() - 1000).toISOString(),
    },
  ]),
  loadReviewActivityDays: vi.fn().mockResolvedValue([]),
  tryUid: vi.fn().mockReturnValue("test"),
  userPath: vi.fn((...parts: string[]) => parts.join("/")),
}))

vi.mock("@/lib/rtdb-cache", () => ({
  loadFrameworks: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/lib/spaced-repetition", () => ({
  getReviewStatus: vi.fn(() => "due"),
  getDaysUntilReview: vi.fn(() => 0),
}))

vi.mock("@/components/RequiresBackend", () => ({
  PersistenceUnavailableBanner: () => null,
}))

vi.mock("@/lib/ollama", () => ({
  generateLearningBrief: vi.fn(),
}))

import WeeklyReviewPage from "@/app/review/page"

const baseFlags: FeatureFlags = {
  ai_provider_default: "agent",
  cloud_ai_enabled: false,
  app_check_enforced: false,
  mastery_graph_enabled: false,
  sr_session_enabled: false,
}

describe("Weekly Review session CTA flag gating", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("hides start-review-session when flag is off", async () => {
    useFeatureFlags.mockReturnValue({
      flags: { ...baseFlags, sr_session_enabled: false },
      ready: true,
    })
    render(<WeeklyReviewPage />)
    await waitFor(() => {
      expect(screen.getByText(/Concepts Due for Review/i)).toBeInTheDocument()
    })
    expect(screen.queryByTestId("start-review-session")).not.toBeInTheDocument()
    expect(screen.queryByText("Review session")).not.toBeInTheDocument()
  })

  it("shows start-review-session when flag is on", async () => {
    useFeatureFlags.mockReturnValue({
      flags: { ...baseFlags, sr_session_enabled: true },
      ready: true,
    })
    render(<WeeklyReviewPage />)
    expect(await screen.findByTestId("start-review-session")).toBeInTheDocument()
    expect(screen.getByText("Review session")).toBeInTheDocument()
  })
})
