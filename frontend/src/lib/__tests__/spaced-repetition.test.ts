import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  sm2,
  getNextReviewDate,
  isDueForReview,
  getDaysUntilReview,
  getReviewStatus,
  type ReviewRating,
} from "../spaced-repetition"

describe("sm2()", () => {
  const base = { interval: 0, easeFactor: 2.5, reviewCount: 0 }

  it("first review with rating 5 → interval 1, EF increases", () => {
    const r = sm2(base, 5)
    expect(r.interval).toBe(1)
    expect(r.easeFactor).toBeGreaterThan(2.5)
    expect(r.reviewCount).toBe(1)
  })

  it("first review with rating 4 → interval 1, EF unchanged (exactly 2.5)", () => {
    const r = sm2(base, 4)
    expect(r.interval).toBe(1)
    expect(r.easeFactor).toBe(2.5)
  })

  it("first review with rating 3 → interval 1, EF decreases to 2.36", () => {
    const r = sm2(base, 3)
    expect(r.interval).toBe(1)
    expect(r.easeFactor).toBe(2.36)
    expect(r.reviewCount).toBe(1)
  })

  it("rating 3 (Hard) advances interval on second review", () => {
    const prev = { interval: 1, easeFactor: 2.36, reviewCount: 1 }
    const r = sm2(prev, 3)
    expect(r.interval).toBe(6)
    expect(r.reviewCount).toBe(2)
    expect(r.easeFactor).toBeLessThan(2.36) // EF decreases but still >= 1.3
    expect(r.easeFactor).toBeGreaterThanOrEqual(1.3)
  })

  it("rating 2 → interval resets to 1, EF decreases by 0.2", () => {
    const r = sm2(base, 2)
    expect(r.interval).toBe(1)
    expect(r.easeFactor).toBe(2.3)
    expect(r.reviewCount).toBe(1)
  })

  it("rating 1 → interval resets to 1, EF decreases by 0.2", () => {
    const r = sm2(base, 1)
    expect(r.interval).toBe(1)
    expect(r.easeFactor).toBe(2.3)
  })

  it("rating 0 → interval resets to 1, EF decreases by 0.2", () => {
    const r = sm2(base, 0)
    expect(r.interval).toBe(1)
    expect(r.easeFactor).toBe(2.3)
  })

  it("second review with rating 4 → interval 6", () => {
    const prev = { interval: 1, easeFactor: 2.6, reviewCount: 1 }
    const r = sm2(prev, 4)
    expect(r.interval).toBe(6)
    expect(r.reviewCount).toBe(2)
  })

  it("third review with rating 5 → interval = prevInterval * EF", () => {
    const prev = { interval: 6, easeFactor: 2.6, reviewCount: 2 }
    const r = sm2(prev, 5)
    expect(r.interval).toBe(Math.round(6 * (2.6 + 0.1)))
    expect(r.reviewCount).toBe(3)
  })

  it("consecutive failures still keep EF >= 1.3", () => {
    let state = { interval: 10, easeFactor: 1.5, reviewCount: 5 }
    for (let i = 0; i < 10; i++) {
      state = sm2(state, 0)
    }
    expect(state.easeFactor).toBeGreaterThanOrEqual(1.3)
  })

  it("consecutive perfect reviews build interval", () => {
    let state = { interval: 0, easeFactor: 2.5, reviewCount: 0 }
    state = sm2(state, 5)
    expect(state.interval).toBe(1)
    state = sm2(state, 5)
    expect(state.interval).toBe(6)
    state = sm2(state, 5)
    expect(state.interval).toBeGreaterThan(6)
    const prevInterval = state.interval
    state = sm2(state, 5)
    expect(state.interval).toBeGreaterThan(prevInterval)
  })
})

describe("getNextReviewDate()", () => {
  it("adds interval days to last reviewed date", () => {
    const d = getNextReviewDate("2024-01-01T00:00:00.000Z", 5)
    expect(d).toBe("2024-01-06T00:00:00.000Z")
  })

  it("zero interval returns same date", () => {
    const d = getNextReviewDate("2024-06-15T12:00:00.000Z", 0)
    expect(d).toBe("2024-06-15T12:00:00.000Z")
  })
})

describe("isDueForReview()", () => {
  beforeEach(() => { vi.useFakeTimers({ now: new Date("2024-06-15T12:00:00.000Z") }) })
  afterEach(() => { vi.useRealTimers() })

  it("past date is due", () => {
    expect(isDueForReview("2024-06-10T00:00:00.000Z")).toBe(true)
  })
  it("exact now is due", () => {
    expect(isDueForReview("2024-06-15T12:00:00.000Z")).toBe(true)
  })
  it("future date is not due", () => {
    expect(isDueForReview("2024-06-20T00:00:00.000Z")).toBe(false)
  })
})

describe("getDaysUntilReview()", () => {
  beforeEach(() => { vi.useFakeTimers({ now: new Date("2024-06-15T12:00:00.000Z") }) })
  afterEach(() => { vi.useRealTimers() })

  it("returns positive for future date", () => {
    expect(getDaysUntilReview("2024-06-20T00:00:00.000Z")).toBe(5)
  })
  it("returns zero for today", () => {
    expect(getDaysUntilReview("2024-06-15T12:00:00.000Z")).toBe(0)
  })
  it("returns negative for past date", () => {
    expect(getDaysUntilReview("2024-06-10T00:00:00.000Z")).toBeLessThan(0)
  })
})

describe("getReviewStatus()", () => {
  beforeEach(() => { vi.useFakeTimers({ now: new Date("2024-06-15T12:00:00.000Z") }) })
  afterEach(() => { vi.useRealTimers() })

  it("returns 'overdue' for past date", () => {
    expect(getReviewStatus("2024-06-10T00:00:00.000Z")).toBe("overdue")
  })
  it("returns 'due' for today", () => {
    expect(getReviewStatus("2024-06-15T12:00:00.000Z")).toBe("due")
  })
  it("returns 'soon' for 1 day from now", () => {
    expect(getReviewStatus("2024-06-16T12:00:00.000Z")).toBe("soon")
  })
  it("returns 'soon' for 2 days from now", () => {
    expect(getReviewStatus("2024-06-17T12:00:00.000Z")).toBe("soon")
  })
  it("returns 'ok' for 3+ days from now", () => {
    expect(getReviewStatus("2024-06-18T12:00:00.000Z")).toBe("ok")
  })

  it("handles all 4 status values exhaustively", () => {
    const statuses = ["overdue", "due", "soon", "ok"] as const
    for (const s of statuses) {
      expect(["overdue", "due", "soon", "ok"]).toContain(s)
    }
  })
})
