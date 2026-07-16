import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import type { FeatureFlags } from "@/lib/feature-flags"

const useFeatureFlags = vi.fn()

vi.mock("@/components/FeatureFlagsProvider", () => ({
  useFeatureFlags: () => useFeatureFlags(),
}))

vi.mock("@/lib/capabilities", () => ({
  canUseFirebasePersistence: () => true,
}))

vi.mock("@/components/RequiresBackend", () => ({
  PersistenceUnavailableBanner: () => null,
}))

vi.mock("@/components/review/ReviewSession", () => ({
  ReviewSession: () => <div data-testid="review-session-mock">Session body</div>,
}))

import ReviewSessionPage from "@/app/review/session/page"

const baseFlags: FeatureFlags = {
  ai_provider_default: "agent",
  cloud_ai_enabled: false,
  app_check_enforced: false,
  mastery_graph_enabled: false,
  sr_session_enabled: false,
}

describe("ReviewSessionPage flag gating", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows disabled UI when sr_session_enabled is false", () => {
    useFeatureFlags.mockReturnValue({
      flags: { ...baseFlags, sr_session_enabled: false },
      ready: true,
    })
    render(<ReviewSessionPage />)
    expect(screen.getByTestId("review-session-disabled")).toBeInTheDocument()
    expect(screen.queryByTestId("review-session-mock")).not.toBeInTheDocument()
    expect(screen.getByText(/sr_session_enabled/)).toBeInTheDocument()
  })

  it("mounts ReviewSession when sr_session_enabled is true", () => {
    useFeatureFlags.mockReturnValue({
      flags: { ...baseFlags, sr_session_enabled: true },
      ready: true,
    })
    render(<ReviewSessionPage />)
    expect(screen.queryByTestId("review-session-disabled")).not.toBeInTheDocument()
    expect(screen.getByTestId("review-session-mock")).toBeInTheDocument()
  })

  it("shows flags loading skeleton before ready", () => {
    useFeatureFlags.mockReturnValue({
      flags: baseFlags,
      ready: false,
    })
    render(<ReviewSessionPage />)
    expect(screen.getByTestId("review-session-flags-loading")).toBeInTheDocument()
    expect(screen.queryByTestId("review-session-disabled")).not.toBeInTheDocument()
    expect(screen.queryByTestId("review-session-mock")).not.toBeInTheDocument()
  })
})
