import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { ReviewRecord } from "@/lib/spaced-repetition"

const dueRecords: ReviewRecord[] = [
  {
    conceptId: "c1",
    frameworkSlug: "strategic-decision-making",
    conceptName: "First Principles",
    conceptSlug: "first-principles",
    reviewCount: 2,
    interval: 6,
    easeFactor: 2.5,
    lastReviewedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    nextReviewAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    conceptId: "c2",
    frameworkSlug: "financial-mastery",
    conceptName: "Unit Economics",
    conceptSlug: "unit-economics",
    reviewCount: 1,
    interval: 1,
    easeFactor: 2.4,
    lastReviewedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    nextReviewAt: new Date(Date.now() - 3600000).toISOString(),
  },
]

const loadDueReviews = vi.fn()
const markConceptReviewed = vi.fn()

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

vi.mock("@/lib/firebase-crud", () => ({
  loadDueReviews: (...args: unknown[]) => loadDueReviews(...args),
  markConceptReviewed: (...args: unknown[]) => markConceptReviewed(...args),
}))

import { ReviewSession } from "@/components/review/ReviewSession"

describe("ReviewSession", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadDueReviews.mockResolvedValue([...dueRecords])
    markConceptReviewed.mockImplementation(
      async (
        frameworkSlug: string,
        conceptId: string,
        conceptName: string,
        conceptSlug: string,
        _rating: number,
      ) => ({
        conceptId,
        frameworkSlug,
        conceptName,
        conceptSlug,
        reviewCount: 3,
        interval: 1,
        easeFactor: 2.5,
        lastReviewedAt: new Date().toISOString(),
        nextReviewAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    )
  })

  it("loads due reviews and shows the first card", async () => {
    render(<ReviewSession />)
    expect(await screen.findByTestId("review-session-card")).toBeInTheDocument()
    expect(screen.getByText("First Principles")).toBeInTheDocument()
    expect(screen.getByText("Card 1 of 2")).toBeInTheDocument()
    expect(screen.getByTestId("rate-again")).toBeInTheDocument()
    expect(screen.getByTestId("rate-hard")).toBeInTheDocument()
    expect(screen.getByTestId("rate-good")).toBeInTheDocument()
    expect(screen.getByTestId("rate-easy")).toBeInTheDocument()
  })

  it("shows empty state when no due reviews", async () => {
    loadDueReviews.mockResolvedValue([])
    render(<ReviewSession />)
    expect(await screen.findByTestId("review-session-empty")).toBeInTheDocument()
    expect(screen.getByText(/No concepts due/i)).toBeInTheDocument()
  })

  it("rates with button and advances to next card", async () => {
    render(<ReviewSession />)
    await screen.findByText("First Principles")
    fireEvent.click(screen.getByTestId("rate-good"))

    await waitFor(() => {
      expect(markConceptReviewed).toHaveBeenCalledWith(
        "strategic-decision-making",
        "c1",
        "First Principles",
        "first-principles",
        4,
      )
    })
    expect(await screen.findByText("Unit Economics")).toBeInTheDocument()
    expect(screen.getByText("Card 2 of 2")).toBeInTheDocument()
  })

  it("rates Hard with SM-2 rating 3", async () => {
    render(<ReviewSession />)
    await screen.findByText("First Principles")
    fireEvent.click(screen.getByTestId("rate-hard"))
    await waitFor(() => {
      expect(markConceptReviewed).toHaveBeenCalledWith(
        "strategic-decision-making",
        "c1",
        "First Principles",
        "first-principles",
        3,
      )
    })
  })

  it("rates with keyboard 1–4", async () => {
    render(<ReviewSession />)
    await screen.findByText("First Principles")

    fireEvent.keyDown(window, { key: "1" })
    await waitFor(() => {
      expect(markConceptReviewed).toHaveBeenCalledWith(
        "strategic-decision-making",
        "c1",
        "First Principles",
        "first-principles",
        0,
      )
    })
    expect(await screen.findByText("Unit Economics")).toBeInTheDocument()

    fireEvent.keyDown(window, { key: "4" })
    await waitFor(() => {
      expect(markConceptReviewed).toHaveBeenCalledWith(
        "financial-mastery",
        "c2",
        "Unit Economics",
        "unit-economics",
        5,
      )
    })
    expect(await screen.findByTestId("review-session-summary")).toBeInTheDocument()
  })

  it("ignores rating keys while typing in an input", async () => {
    render(
      <>
        <input data-testid="other-input" />
        <ReviewSession />
      </>,
    )
    await screen.findByText("First Principles")
    const input = screen.getByTestId("other-input")
    input.focus()
    fireEvent.keyDown(input, { key: "1" })
    await new Promise((r) => setTimeout(r, 50))
    expect(markConceptReviewed).not.toHaveBeenCalled()
    expect(screen.getByText("First Principles")).toBeInTheDocument()
  })

  it("ignores rating keys while a select is focused", async () => {
    render(
      <>
        <select data-testid="other-select">
          <option value="a">A</option>
        </select>
        <ReviewSession />
      </>,
    )
    await screen.findByText("First Principles")
    const select = screen.getByTestId("other-select")
    select.focus()
    fireEvent.keyDown(select, { key: "2" })
    await new Promise((r) => setTimeout(r, 50))
    expect(markConceptReviewed).not.toHaveBeenCalled()
  })

  it("ignores key-repeat events", async () => {
    render(<ReviewSession />)
    await screen.findByText("First Principles")
    fireEvent.keyDown(window, { key: "3", repeat: true })
    await new Promise((r) => setTimeout(r, 50))
    expect(markConceptReviewed).not.toHaveBeenCalled()
  })

  it("double-rate is locked: only one markConceptReviewed and advances to next card", async () => {
    let resolveFirst: (v: unknown) => void
    const pending = new Promise((resolve) => {
      resolveFirst = resolve
    })
    markConceptReviewed.mockImplementationOnce(
      () =>
        pending.then(() => ({
          conceptId: "c1",
          frameworkSlug: "strategic-decision-making",
          conceptName: "First Principles",
          conceptSlug: "first-principles",
          reviewCount: 3,
          interval: 1,
          easeFactor: 2.5,
          lastReviewedAt: new Date().toISOString(),
          nextReviewAt: new Date(Date.now() + 86400000).toISOString(),
        })),
    )

    render(<ReviewSession />)
    await screen.findByText("First Principles")

    fireEvent.click(screen.getByTestId("rate-good"))
    fireEvent.click(screen.getByTestId("rate-easy"))
    fireEvent.keyDown(window, { key: "1" })

    expect(markConceptReviewed).toHaveBeenCalledTimes(1)

    resolveFirst!(null)

    expect(await screen.findByText("Unit Economics")).toBeInTheDocument()
    expect(screen.getByText("Card 2 of 2")).toBeInTheDocument()
    expect(markConceptReviewed).toHaveBeenCalledTimes(1)
    expect(markConceptReviewed).toHaveBeenCalledWith(
      "strategic-decision-making",
      "c1",
      "First Principles",
      "first-principles",
      4,
    )
  })

  it("shows session summary with rating counts after last card", async () => {
    render(<ReviewSession />)
    await screen.findByText("First Principles")
    fireEvent.click(screen.getByTestId("rate-again"))
    await screen.findByText("Unit Economics")
    fireEvent.click(screen.getByTestId("rate-easy"))

    expect(await screen.findByTestId("review-session-summary")).toBeInTheDocument()
    expect(screen.getByText(/You reviewed 2 concepts/i)).toBeInTheDocument()
    expect(screen.getByTestId("summary-count-again")).toHaveTextContent("1")
    expect(screen.getByTestId("summary-count-easy")).toHaveTextContent("1")
    expect(screen.getByTestId("summary-count-hard")).toHaveTextContent("0")
    expect(screen.getByTestId("summary-count-good")).toHaveTextContent("0")
  })

  it("shows error state when load fails", async () => {
    loadDueReviews.mockRejectedValue(new Error("network down"))
    render(<ReviewSession />)
    expect(await screen.findByTestId("review-session-error")).toBeInTheDocument()
    expect(screen.getByText("network down")).toBeInTheDocument()
  })
})
