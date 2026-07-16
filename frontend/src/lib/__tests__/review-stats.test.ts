import { describe, it, expect } from "vitest"
import type { ReviewRecord } from "../spaced-repetition"
import {
  MATURE_INTERVAL_DAYS,
  computeReviewDayStreak,
  computeReviewStats,
  dayKeysFromLastReviewedAt,
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

describe("computeReviewDayStreak (activity day keys)", () => {
  it("returns 0 for empty activity", () => {
    expect(computeReviewDayStreak([], localNoon(2026, 7, 16))).toBe(0)
  })

  it("returns 0 when last activity was more than one day ago", () => {
    const now = localNoon(2026, 7, 16)
    expect(computeReviewDayStreak(["2026-07-10"], now)).toBe(0)
  })

  it("counts consecutive days ending today", () => {
    const now = localNoon(2026, 7, 16)
    expect(
      computeReviewDayStreak(["2026-07-16", "2026-07-15", "2026-07-14"], now),
    ).toBe(3)
  })

  it("allows streak ending yesterday if no review yet today", () => {
    const now = localNoon(2026, 7, 16)
    expect(computeReviewDayStreak(["2026-07-15", "2026-07-14"], now)).toBe(2)
  })

  it("breaks on gap in consecutive days", () => {
    const now = localNoon(2026, 7, 16)
    expect(
      computeReviewDayStreak(["2026-07-16", "2026-07-15", "2026-07-13"], now),
    ).toBe(2)
  })

  it("dedupes duplicate day keys", () => {
    const now = localNoon(2026, 7, 16)
    expect(
      computeReviewDayStreak(["2026-07-16", "2026-07-16", "2026-07-15"], now),
    ).toBe(2)
  })

  it("ignores invalid day keys", () => {
    const now = localNoon(2026, 7, 16)
    expect(computeReviewDayStreak(["nope", "2026-07-16"], now)).toBe(1)
  })
})

describe("re-review same cards across days", () => {
  /**
   * Models production: same conceptIds re-reviewed daily overwrites lastReviewedAt.
   * Activity day set keeps each calendar day; lastReviewedAt-only collapses to today.
   */
  it("activity store grows streak when same cards are re-reviewed daily", () => {
    const now = localNoon(2026, 7, 16)
    // Same two cards reviewed every day for 7 days — only today's lastReviewedAt remains
    const reviewsAfterWeek: ReviewRecord[] = [
      rec({
        conceptId: "c1",
        lastReviewedAt: localNoon(2026, 7, 16).toISOString(),
        nextReviewAt: localNoon(2026, 7, 17).toISOString(),
      }),
      rec({
        conceptId: "c2",
        lastReviewedAt: localNoon(2026, 7, 16).toISOString(),
        nextReviewAt: localNoon(2026, 7, 17).toISOString(),
      }),
    ]
    const activityDays = [
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
    ]

    // lastReviewedAt alone wrongly collapses to streak 1
    expect(computeReviewDayStreak(dayKeysFromLastReviewedAt(reviewsAfterWeek), now)).toBe(1)

    // Durable activity preserves the full week
    expect(computeReviewDayStreak(activityDays, now)).toBe(7)
    expect(computeReviewStats(reviewsAfterWeek, now, activityDays).streakDays).toBe(7)
  })

  it("documents why lastReviewedAt-only fails under re-review", () => {
    // Day 1: rate both cards
    let reviews = [
      rec({ conceptId: "a", lastReviewedAt: localNoon(2026, 7, 14).toISOString() }),
      rec({ conceptId: "b", lastReviewedAt: localNoon(2026, 7, 14).toISOString() }),
    ]
    expect(dayKeysFromLastReviewedAt(reviews)).toEqual(["2026-07-14"])

    // Day 2: re-rate both → overwrite lastReviewedAt (production markConceptReviewed)
    reviews = [
      rec({ conceptId: "a", lastReviewedAt: localNoon(2026, 7, 15).toISOString() }),
      rec({ conceptId: "b", lastReviewedAt: localNoon(2026, 7, 15).toISOString() }),
    ]
    expect(dayKeysFromLastReviewedAt(reviews)).toEqual(["2026-07-15"])
    // D1 gone — streak cannot recover from lastReviewedAt alone
    expect(computeReviewDayStreak(dayKeysFromLastReviewedAt(reviews), localNoon(2026, 7, 15))).toBe(1)

    // Activity path would still hold both days
    expect(
      computeReviewDayStreak(["2026-07-14", "2026-07-15"], localNoon(2026, 7, 15)),
    ).toBe(2)
  })
})

describe("computeReviewStats", () => {
  it("returns zeros for empty list and empty activity", () => {
    expect(computeReviewStats([], localNoon(2026, 7, 16), [])).toEqual({
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
      rec({
        conceptId: "due",
        interval: 3,
        nextReviewAt: now.toISOString(),
        lastReviewedAt: new Date(now.getTime() - 86400000).toISOString(),
      }),
      rec({
        conceptId: "over",
        interval: 5,
        nextReviewAt: new Date(now.getTime() - 2 * 86400000).toISOString(),
        lastReviewedAt: new Date(now.getTime() - 5 * 86400000).toISOString(),
      }),
      rec({
        conceptId: "learn",
        interval: 10,
        nextReviewAt: new Date(now.getTime() + 5 * 86400000).toISOString(),
        lastReviewedAt: new Date(now.getTime() - 86400000).toISOString(),
      }),
      rec({
        conceptId: "mat",
        interval: MATURE_INTERVAL_DAYS,
        nextReviewAt: new Date(now.getTime() + 10 * 86400000).toISOString(),
        lastReviewedAt: new Date(now.getTime() - 86400000).toISOString(),
      }),
      rec({
        conceptId: "mat2",
        interval: MATURE_INTERVAL_DAYS + 5,
        nextReviewAt: new Date(now.getTime() + 20 * 86400000).toISOString(),
        lastReviewedAt: new Date(now.getTime() - 2 * 86400000).toISOString(),
      }),
    ]

    const stats = computeReviewStats(reviews, now, [])
    expect(stats.total).toBe(5)
    expect(stats.due).toBe(1)
    expect(stats.overdue).toBe(1)
    expect(stats.learning).toBe(3)
    expect(stats.mature).toBe(2)
    expect(stats.streakDays).toBe(0)
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

  it("uses activityDays for streak, not lastReviewedAt", () => {
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
        lastReviewedAt: localNoon(2026, 7, 16).toISOString(),
        nextReviewAt: localNoon(2026, 8, 14).toISOString(),
      }),
    ]
    // Without activity: streak 0 even though lastReviewedAt is today
    expect(computeReviewStats(reviews, now, []).streakDays).toBe(0)
    // With activity spanning two days
    expect(
      computeReviewStats(reviews, now, ["2026-07-15", "2026-07-16"]).streakDays,
    ).toBe(2)
    expect(computeReviewStats(reviews, now, ["2026-07-15", "2026-07-16"]).mature).toBe(1)
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
