import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

vi.mock("@/lib/capabilities", () => ({
  canUseFirebasePersistence: () => true,
}))

vi.mock("@/lib/firebase-crud", () => ({
  loadReviewRecord: vi.fn(async () => null),
  markConceptReviewed: vi.fn(async () => ({
    nextReviewAt: new Date(Date.now() + 86400000).toISOString(),
    reviewCount: 1,
    interval: 1,
    conceptId: "c1",
    frameworkSlug: "fw",
    conceptName: "Name",
    conceptSlug: "name",
    easeFactor: 2.5,
    lastReviewedAt: new Date().toISOString(),
  })),
}))

vi.mock("@/lib/spaced-repetition", () => ({
  getReviewStatus: vi.fn(() => "ok"),
  getDaysUntilReview: vi.fn(() => 1),
}))

import { SpacedReviewBar } from "@/components/concept/SpacedReviewBar"
import { markConceptReviewed } from "@/lib/firebase-crud"

describe("SpacedReviewBar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders Mark as Reviewed and submits a rating", async () => {
    render(
      <SpacedReviewBar
        frameworkSlug="fw"
        conceptId="c1"
        conceptName="Name"
        conceptSlug="name"
      />,
    )

    expect(screen.getByTestId("spaced-review-bar")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Mark as Reviewed"))
    fireEvent.click(screen.getByText("Good"))

    await waitFor(() => {
      expect(markConceptReviewed).toHaveBeenCalledWith("fw", "c1", "Name", "name", 4)
    })
  })
})
