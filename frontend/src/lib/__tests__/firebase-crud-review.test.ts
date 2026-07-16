import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockRef, mockGet, mockSet } = vi.hoisted(() => {
  const mockRef = vi.fn((_db: any, path: string) => ({ key: path }))
  const mockGet = vi.fn()
  const mockSet = vi.fn(() => Promise.resolve())
  return { mockRef, mockGet, mockSet }
})

vi.mock("@/lib/firebase", () => ({
  db: { ref: mockRef, get: mockGet },
  auth: { currentUser: { uid: "test-uid", isAnonymous: true } },
  ref: (...args: any[]) => (mockRef as any)(args[0], args[1]),
  get: (...args: any[]) => (mockGet as any)(args[0], args[1]),
  set: (...args: any[]) => (mockSet as any)(args[0], args[1]),
}))

vi.mock("@/lib/spaced-repetition", () => ({
  sm2: vi.fn((prev: any, rating: number) => {
    if (rating < 3) {
      return { interval: 1, easeFactor: Math.max(1.3, (prev.easeFactor || 2.5) - 0.2), reviewCount: (prev.reviewCount || 0) + 1 }
    }
    const newEF = Math.max(1.3, (prev.easeFactor || 2.5) + 0.1)
    const newInterval = prev.reviewCount === 0 ? 1 : prev.reviewCount === 1 ? 6 : Math.round((prev.interval || 0) * newEF)
    return { interval: newInterval, easeFactor: newEF, reviewCount: (prev.reviewCount || 0) + 1 }
  }),
  getNextReviewDate: vi.fn((lastReviewedAt: string, interval: number) => {
    const ms = 86400000 * interval
    return new Date(new Date(lastReviewedAt).getTime() + ms).toISOString()
  }),
  getReviewStatus: vi.fn((nextReviewAt: string) => {
    const days = Math.ceil((new Date(nextReviewAt).getTime() - Date.now()) / 86400000)
    if (days < 0) return "overdue"
    if (days === 0) return "due"
    if (days <= 2) return "soon"
    return "ok"
  }),
  getDaysUntilReview: vi.fn((nextReviewAt: string) => {
    return Math.ceil((new Date(nextReviewAt).getTime() - Date.now()) / 86400000)
  }),
}))

import {
  markConceptReviewed,
  loadDueReviews,
  loadAllReviews,
  loadReviewRecord,
} from "../firebase-crud"

describe("markConceptReviewed", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("writes correct review record shape", async () => {
    mockGet.mockResolvedValueOnce({ exists: () => false, val: () => null })
    mockSet.mockResolvedValueOnce(undefined)

    const result = await markConceptReviewed("test-framework", "concept-123", "First Principles", "first-principles", 4)

    expect(result).toHaveProperty("conceptId", "concept-123")
    expect(result).toHaveProperty("frameworkSlug", "test-framework")
    expect(result).toHaveProperty("conceptName", "First Principles")
    expect(result).toHaveProperty("conceptSlug", "first-principles")
    expect(result).toHaveProperty("reviewCount")
    expect(result).toHaveProperty("interval")
    expect(result).toHaveProperty("easeFactor")
    expect(result).toHaveProperty("lastReviewedAt")
    expect(result).toHaveProperty("nextReviewAt")
  })

  it("calls set with users/{uid}/reviews/{conceptId} path", async () => {
    mockGet.mockResolvedValueOnce({ exists: () => false, val: () => null })

    await markConceptReviewed("fw", "c1", "Name", "name", 5)

    const mockSetAny = mockSet as any
    expect(mockSetAny.mock.calls[0][0].key).toBe("users/test-uid/reviews/c1")
  })

  it("handles rating 0 (Again) — interval resets to 1", async () => {
    mockGet.mockResolvedValueOnce({ exists: () => false, val: () => null })

    const result = await markConceptReviewed("fw", "c1", "Name", "name", 0)
    expect(result.interval).toBe(1)
    expect(result.reviewCount).toBe(1)
  })

  it("handles existing review record — loads previous state", async () => {
    const existingRecord = {
      interval: 6, easeFactor: 2.6, reviewCount: 2,
      lastReviewedAt: "2024-06-01T00:00:00.000Z",
      nextReviewAt: "2024-06-07T00:00:00.000Z",
    }
    mockGet.mockResolvedValueOnce({ exists: () => true, val: () => existingRecord })

    const result = await markConceptReviewed("fw", "c1", "Name", "name", 4)
    expect(result.reviewCount).toBe(3)
    // After 2nd review with rating >= 3, interval = 6 (prevCount===1 case)
    // But since prev reviewCount is 2, it uses prevInterval * newEF
    expect(result.interval).toBeGreaterThanOrEqual(1)
  })
})

describe("loadDueReviews", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns empty array when no reviews exist", async () => {
    mockGet.mockResolvedValueOnce({ exists: () => false, val: () => null })
    const result = await loadDueReviews()
    expect(result).toEqual([])
  })

  it("filters out reviews with future nextReviewAt", async () => {
    const futureDate = new Date(Date.now() + 86400000 * 10).toISOString()
    const pastDate = new Date(Date.now() - 86400000 * 1).toISOString()

    mockGet.mockResolvedValueOnce({
      exists: () => true,
      val: () => ({
        "c1": { conceptId: "c1", nextReviewAt: pastDate, frameworkSlug: "fw", conceptName: "N1", conceptSlug: "n1", reviewCount: 1, interval: 1, easeFactor: 2.5, lastReviewedAt: pastDate },
        "c2": { conceptId: "c2", nextReviewAt: futureDate, frameworkSlug: "fw", conceptName: "N2", conceptSlug: "n2", reviewCount: 1, interval: 10, easeFactor: 2.5, lastReviewedAt: futureDate },
      }),
    })

    const result = await loadDueReviews()
    expect(result).toHaveLength(1)
    expect(result[0].conceptId).toBe("c1")
  })

  it("returns all reviews when all are due", async () => {
    const pastDate = new Date(Date.now() - 86400000 * 5).toISOString()
    mockGet.mockResolvedValueOnce({
      exists: () => true,
      val: () => ({
        "c1": { conceptId: "c1", nextReviewAt: pastDate, frameworkSlug: "fw", conceptName: "N1", conceptSlug: "n1", reviewCount: 2, interval: 6, easeFactor: 2.6, lastReviewedAt: pastDate },
        "c2": { conceptId: "c2", nextReviewAt: pastDate, frameworkSlug: "fw", conceptName: "N2", conceptSlug: "n2", reviewCount: 1, interval: 1, easeFactor: 2.5, lastReviewedAt: pastDate },
      }),
    })

    const result = await loadDueReviews()
    expect(result).toHaveLength(2)
  })

  it("skips entries without nextReviewAt", async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString()
    mockGet.mockResolvedValueOnce({
      exists: () => true,
      val: () => ({
        "c1": { conceptId: "c1", nextReviewAt: pastDate, frameworkSlug: "fw", conceptName: "N1", conceptSlug: "n1", reviewCount: 1, interval: 1, easeFactor: 2.5, lastReviewedAt: pastDate },
        "c2": { conceptId: "c2", frameworkSlug: "fw", conceptName: "N2", conceptSlug: "n2", reviewCount: 0, interval: 0, easeFactor: 2.5, lastReviewedAt: pastDate },
      }),
    })

    const result = await loadDueReviews()
    expect(result).toHaveLength(1)
  })
})

describe("loadAllReviews", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns empty array when no reviews exist", async () => {
    mockGet.mockResolvedValueOnce({ exists: () => false, val: () => null })
    const result = await loadAllReviews()
    expect(result).toEqual([])
  })

  it("returns all reviews regardless of due date", async () => {
    const futureDate = new Date(Date.now() + 86400000 * 10).toISOString()
    const pastDate = new Date(Date.now() - 86400000 * 1).toISOString()

    mockGet.mockResolvedValueOnce({
      exists: () => true,
      val: () => ({
        "c1": { conceptId: "c1", nextReviewAt: pastDate, frameworkSlug: "fw", conceptName: "N1", conceptSlug: "n1", reviewCount: 1, interval: 1, easeFactor: 2.5, lastReviewedAt: pastDate },
        "c2": { conceptId: "c2", nextReviewAt: futureDate, frameworkSlug: "fw", conceptName: "N2", conceptSlug: "n2", reviewCount: 1, interval: 10, easeFactor: 2.5, lastReviewedAt: futureDate },
      }),
    })

    const result = await loadAllReviews()
    expect(result).toHaveLength(2)
  })
})

describe("loadReviewRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null when record does not exist", async () => {
    mockGet.mockResolvedValueOnce({ exists: () => false, val: () => null })
    const result = await loadReviewRecord("nonexistent-concept")
    expect(result).toBeNull()
  })

  it("returns the review record for existing concept", async () => {
    const record = {
      conceptId: "c1", nextReviewAt: new Date().toISOString(),
      frameworkSlug: "fw", conceptName: "N1", conceptSlug: "n1",
      reviewCount: 3, interval: 15, easeFactor: 2.8, lastReviewedAt: new Date().toISOString(),
    }
    mockGet.mockResolvedValueOnce({ exists: () => true, val: () => record })
    const result = await loadReviewRecord("c1")
    expect(result).not.toBeNull()
    expect(result!.conceptId).toBe("c1")
    expect(result!.reviewCount).toBe(3)
  })
})
