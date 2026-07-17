/**
 * Best-effort AI usage metrics under `_meta/ai_metrics/{YYYY-MM-DD}`.
 * Admin SDK only (client write denied on _meta except public reads on heartbeats).
 */

import { utcDayKey } from "./rate-limit"

export type MetricsDbLike = {
  ref: (path: string) => {
    transaction: (
      updateFn: (
        current: Record<string, number> | null,
      ) => Record<string, number> | undefined | null,
    ) => Promise<unknown>
  }
}

/**
 * Increment counters for observability (non-blocking callers should catch).
 */
export async function recordAiMetric(
  db: MetricsDbLike,
  event: "callable_ok" | "callable_err" | "rtdb_ok" | "rtdb_err" | "rate_limited",
  nowMs: number = Date.now(),
): Promise<void> {
  const day = utcDayKey(nowMs)
  const path = `_meta/ai_metrics/${day}`
  await db.ref(path).transaction((cur) => {
    const next = { ...(cur || {}) }
    next[event] = (typeof next[event] === "number" ? next[event] : 0) + 1
    next.total = (typeof next.total === "number" ? next.total : 0) + 1
    return next
  })
}
