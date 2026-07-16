import type { ReviewRecord } from "../spaced-repetition"

/** Anki-style threshold: interval ≥ this many days counts as mature. */
export const MATURE_INTERVAL_DAYS = 21

const MS_PER_DAY = 86400000

/** YYYY-MM-DD local day keys written under `users/{uid}/reviewActivity`. */
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export type ReviewRetentionStats = {
  /** Total review records. */
  total: number
  /**
   * Due in the ceil-day window used by `getDaysUntilReview` (not calendar-local midnight).
   * Matches `getReviewStatus === "due"` (daysUntil === 0).
   */
  due: number
  /** Past due date (`daysUntil < 0`). */
  overdue: number
  /** Interval shorter than {@link MATURE_INTERVAL_DAYS}. */
  learning: number
  /** Interval ≥ {@link MATURE_INTERVAL_DAYS}. */
  mature: number
  /**
   * Consecutive calendar days with review activity from durable day keys
   * (`users/{uid}/reviewActivity/{YYYY-MM-DD}`), ending today or yesterday
   * (if no review yet today). Not derived from per-card `lastReviewedAt`
   * (that field is overwritten on re-review and loses history).
   */
  streakDays: number
}

/** Local calendar day key `YYYY-MM-DD` for activity / streak math. */
export function toLocalDayKey(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input
  if (Number.isNaN(d.getTime())) return ""
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function shiftDayKey(dayKey: string, deltaDays: number): string {
  const [y, m, d] = dayKey.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + deltaDays)
  return toLocalDayKey(dt)
}

/**
 * Days until review relative to `now`, matching `getDaysUntilReview` semantics
 * (ceil of ms delta / day) but with an injectable clock for tests.
 */
export function daysUntilReviewAt(nextReviewAt: string, now: Date = new Date()): number {
  return Math.ceil((new Date(nextReviewAt).getTime() - now.getTime()) / MS_PER_DAY)
}

function toDayKeySet(activityDays: Iterable<string>): Set<string> {
  const days = new Set<string>()
  for (const key of activityDays) {
    if (typeof key === "string" && DAY_KEY_RE.test(key)) days.add(key)
  }
  return days
}

/**
 * Review-day streak from durable activity day keys (`YYYY-MM-DD`).
 * - If activity today: count consecutive days ending today.
 * - Else if activity yesterday: count consecutive days ending yesterday.
 * - Else: 0.
 */
export function computeReviewDayStreak(
  activityDays: Iterable<string>,
  now: Date = new Date(),
): number {
  const days = toDayKeySet(activityDays)
  if (days.size === 0) return 0

  const todayKey = toLocalDayKey(now)
  const yesterdayKey = shiftDayKey(todayKey, -1)

  let cursor: string
  if (days.has(todayKey)) {
    cursor = todayKey
  } else if (days.has(yesterdayKey)) {
    cursor = yesterdayKey
  } else {
    return 0
  }

  let streak = 0
  while (days.has(cursor)) {
    streak++
    cursor = shiftDayKey(cursor, -1)
  }
  return streak
}

/**
 * Legacy / incorrect approach: unique local days from current `lastReviewedAt`.
 * Documented for tests — do not use for product streak (re-review overwrites history).
 */
export function dayKeysFromLastReviewedAt(reviews: ReviewRecord[]): string[] {
  const days = new Set<string>()
  for (const r of reviews) {
    if (!r?.lastReviewedAt) continue
    const key = toLocalDayKey(r.lastReviewedAt)
    if (key) days.add(key)
  }
  return [...days]
}

/**
 * Pure retention / queue stats from `loadAllReviews()` + optional activity days.
 * Pass `now` and `activityDays` in tests for deterministic due/overdue and streak.
 */
export function computeReviewStats(
  reviews: ReviewRecord[],
  now: Date = new Date(),
  activityDays: Iterable<string> = [],
): ReviewRetentionStats {
  const list = Array.isArray(reviews) ? reviews : []
  let due = 0
  let overdue = 0
  let learning = 0
  let mature = 0

  for (const r of list) {
    const interval = typeof r.interval === "number" && !Number.isNaN(r.interval) ? r.interval : 0
    if (interval >= MATURE_INTERVAL_DAYS) mature++
    else learning++

    if (!r.nextReviewAt) continue
    const daysUntil = daysUntilReviewAt(r.nextReviewAt, now)
    if (daysUntil < 0) overdue++
    else if (daysUntil === 0) due++
  }

  return {
    total: list.length,
    due,
    overdue,
    learning,
    mature,
    streakDays: computeReviewDayStreak(activityDays, now),
  }
}
