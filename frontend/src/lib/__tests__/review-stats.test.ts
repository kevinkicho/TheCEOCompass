import { describe, it, expect } from "vitest"
import type { ReviewRecord } from "../spaced-repetition"
import {
  MATURE_INTERVAL_DAYS,
  computeReviewDayStreak,
  computeReviewStats,
  daysUntilReviewAt,
  toLocalDayKey,
} from "../user-data/review-stats"

function rec(partial: Partial<ReviewRecord> & Pick<ReviewRecord, "conceptId">): ReviewRecord {
  return {
    frameworkSlug: "fw",
    conceptName: partial.conceptId,
    conceptSlug: partial.conceptId,
    reviewCount: 1,
    interval: 1,
    easeFactor: 2.5,
    lastReviewedAt: "2026-07-01T12:00:00.000Z",
    nextReviewAt: "2026-07-02T12:00:00.000Z",
    ...partial,
  }
}

/** Local noon on a Y-M-D to avoid DST edge noise in day-key tests. */
function localNoon(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

describe("toLocalDayKey", () => {
  it("formats local calendar date as YYYY-MM-DD", () => {
    const d = localNoon(2026, 7, 16)
    expect(toLocalDayKey(d)).toBe("2026-07-16")
  })

  it("returns empty string for invalid dates", () => {
    expect(toLocalDayKey("not-a-date")).toBe("")
  })
})

describe("daysUntilReviewAt", () => {
  it("returns 0 when due within the same ceil-day window as production helper", () => {
    const now = new Date("2026-07-16T12:00:00.000Z")
    // Slightly in the past still ceil-rounds depending on ms; use exact now
    expect(daysUntilReviewAt(now.toISOString(), now)).toBe(0)
  })

  it("returns negative for past due", () => {
    const now = new Date("2026-07-16T12:00:00.000Z")
    const past = new Date(now.getTime() - 2 * 86400000).toISOString()
    expect(daysUntilReviewAt(past, now)).toBeLessThan(0)
  })

  it("returns positive for future", () => {
    const now = new Date("2026-07-16T12:00:00.000Z")
    const future = new Date(now.getTime() + 3 * 86400000).toISOString()
    expect(daysUntilReviewAt(future, now)).toBeGreaterThan(0)
  })
})

describe("computeReviewDayStreak", () => {
  it("returns 0 for empty reviews", () => {
    expect(computeReviewDayStreak([], localNoon(2026, 7, 16))).toBe(0)
  })

  it("returns 0 when last review was more than one day ago", () => {
    const now = localNoon(2026, 7, 16)
    const reviews = [
      rec({
        conceptId: "a",
        lastReviewedAt: localNoon(2026, 7, 10).toISOString(),
      }),
    ]
    expect(computeReviewDayStreak(reviews, now)).toBe(0)
  })

  it("counts consecutive days ending today", () => {
    const now = localNoon(2026, 7, 16)
    const reviews = [
      rec({ conceptId: "a", lastReviewedAt: localNoon(2026, 7, 16).toISOString() }),
      rec({ conceptId: "b", lastReviewedAt: localNoon(2026, 7, 15).toISOString() }),
      rec({ conceptId: "c", lastReviewedAt: localNoon(2026, 7, 14).toISOString() }),
    ]
    expect(computeReviewDayStreak(reviews, now)).toBe(3)
  })

  it("allows streak ending yesterday if no review yet today", () => {
    const now = localNoon(2026, 7, 16)
    const reviews = [
      rec({ conceptId: "a", lastReviewedAt: localNoon(2026, 7, 15).toISOString() }),
      rec({ conceptId: "b", lastReviewedAt: localNoon(2026, 7, 14).toISOString() }),
    ]
    expect(computeReviewDayStreak(reviews, now)).toBe(2)
  })

  it("breaks on gap in consecutive days", () => {
    const now = localNoon(2026, 7, 16)
    const reviews = [
      rec({ conceptId: "a", lastReviewedAt: localNoon(2026, 7, 16).toISOString() }),
      rec({ conceptId: "b", lastReviewedAt: localNoon(2026, 7, 15).toISOString() }),
      // gap on 14
      rec({ conceptId: "c", lastReviewedAt: localNoon(2026, 7, 13).toISOString() }),
    ]
    expect(computeReviewDayStreak(reviews, now)).toBe(2)
  })

  it("dedupes multiple reviews on the same calendar day", () => {
    const now = localNoon(2026, 7, 16)
    const reviews = [
      rec({ conceptId: "a", lastReviewedAt: localNoon(2026, 7, 16).toISOString() }),
      rec({ conceptId: "b", lastReviewedAt: new Date(2026, 6, 16, 8, 0, 0).toISOString() }),
      rec({ conceptId: "c", lastReviewedAt: localNoon(2026, 7, 15).toISOString() }),
    ]
    expect(computeReviewDayStreak(reviews, now)).toBe(2)
  })
})

describe("computeReviewStats", () => {
  it("returns zeros for empty list", () => {
    expect(computeReviewStats([], localNoon(2026, 7, 16))).toEqual({
      total: 0,
      due: 0,
      overdue: 0,
      learning: 0,
      mature: 0,
      streakDays: 0,
    })
  })

  it("classifies due, overdue, learning, and mature", () => {
    const now = new Date("2026-07-16T12:00:00.000Z")
    const reviews = [
      // due today
      rec({
        conceptId: "due",
        interval: 3,
        nextReviewAt: now.toISOString(),
        lastReviewedAt: new Date(now.getTime() - 86400000).toISOString(),
      }),
      // overdue
      rec({
        conceptId: "over",
        interval: 5,
        nextReviewAt: new Date(now.getTime() - 2 * 86400000).toISOString(),
        lastReviewedAt: new Date(now.getTime() - 5 * 86400000).toISOString(),
      }),
      // future, still learning
      rec({
        conceptId: "learn",
        interval: 10,
        nextReviewAt: new Date(now.getTime() + 5 * 86400000).toISOString(),
        lastReviewedAt: new Date(now.getTime() - 86400000).toISOString(),
      }),
      // mature + future
      rec({
        conceptId: "mat",
        interval: MATURE_INTERVAL_DAYS,
        nextReviewAt: new Date(now.getTime() + 10 * 86400000).toISOString(),
        lastReviewedAt: new Date(now.getTime() - 86400000).toISOString(),
      }),
      // mature threshold boundary +1
      rec({
        conceptId: "mat2",
        interval: MATURE_INTERVAL_DAYS + 5,
        nextReviewAt: new Date(now.getTime() + 20 * 86400000).toISOString(),
        lastReviewedAt: new Date(now.getTime() - 2 * 86400000).toISOString(),
      }),
    ]

    const stats = computeReviewStats(reviews, now)
    expect(stats.total).toBe(5)
    expect(stats.due).toBe(1)
    expect(stats.overdue).toBe(1)
    expect(stats.learning).toBe(3) // due, over, learn
    expect(stats.mature).toBe(2)
  })

  it("treats missing/invalid interval as learning (0)", () => {
    const now = new Date("2026-07-16T12:00:00.000Z")
    const reviews = [
      rec({ conceptId: "x", interval: undefined as unknown as number, nextReviewAt: now.toISOString() }),
    ]
    const stats = computeReviewStats(reviews, now)
    expect(stats.learning).toBe(1)
    expect(stats.mature).toBe(0)
  })

  it("includes streakDays from lastReviewedAt", () => {
    const now = localNoon(2026, 7, 16)
    const reviews = [
      rec({
        conceptId: "a",
        interval: 1,
        lastReviewedAt: localNoon(2026, 7, 16).toISOString(),
        nextReviewAt: localNoon(2026, 7, 17).toISOString(),
      }),
      rec({
        conceptId: "b",
        interval: 30,
        lastReviewedAt: localNoon(2026, 7, 15).toISOString(),
        nextReviewAt: localNoon(2026, 8, 14).toISOString(),
      }),
    ]
    const stats = computeReviewStats(reviews, now)
    expect(stats.streakDays).toBe(2)
    expect(stats.mature).toBe(1)
    expect(stats.learning).toBe(1)
  })

  it("learning + mature partition total", () => {
    const now = new Date("2026-07-16T12:00:00.000Z")
    const reviews = [
      rec({ conceptId: "1", interval: 0 }),
      rec({ conceptId: "2", interval: 20 }),
      rec({ conceptId: "3", interval: 21 }),
      rec({ conceptId: "4", interval: 100 }),
    ]
    const stats = computeReviewStats(reviews, now)
    expect(stats.learning + stats.mature).toBe(stats.total)
  })
})
