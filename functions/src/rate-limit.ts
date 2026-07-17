/**
 * Per-uid cloud AI rate limiting (sliding window).
 *
 * State lives at RTDB `_rate/{uid}` and is read/written only via Admin SDK
 * (client rules deny all access). Checked after claim, before the LLM call.
 */

/** Max cloud AI requests per uid within the window. */
export const RATE_LIMIT_MAX_REQUESTS = 20

/** Sliding window length (10 minutes). */
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000

/** Soft daily cap per uid (UTC day) — cost control. */
export const RATE_LIMIT_DAILY_MAX = 200

/**
 * Clear, user-facing message when the limit is hit.
 * Keep in sync with frontend `AI_RATE_LIMIT_ERROR_MESSAGE` in transport.ts.
 */
export const RATE_LIMIT_ERROR_MESSAGE =
  "AI rate limit exceeded: maximum 20 cloud requests per 10 minutes. Please wait and try again."

export const RATE_LIMIT_DAILY_ERROR_MESSAGE =
  "AI daily limit exceeded: maximum 200 cloud requests per day. Try again tomorrow."

/** RTDB shape at `_rate/{uid}`. */
export type RateState = {
  /** Request timestamps (ms since epoch) still inside the window. */
  timestamps?: number[]
  /** UTC calendar day key YYYY-MM-DD for daily quota. */
  dayKey?: string
  /** Count of cloud requests on dayKey. */
  dayCount?: number
}

export function utcDayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10)
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  /** Ms until the oldest in-window request expires (0 if allowed). */
  retryAfterMs: number
  message?: string
}

/** Minimal DB surface for rate-limit transactions (compatible with handler.DbLike). */
export type RateDbLike = {
  ref: (path: string) => {
    transaction: (
      updateFn: (current: RateState | null) => RateState | undefined | null,
    ) => Promise<{ committed: boolean; snapshot: { val: () => RateState | null } }>
  }
}

/**
 * Pure sliding-window check + consume.
 * Filters expired timestamps, then allows if count < max and appends `now`.
 */
export function applyRateLimit(
  state: RateState | null | undefined,
  now: number,
  maxRequests: number = RATE_LIMIT_MAX_REQUESTS,
  windowMs: number = RATE_LIMIT_WINDOW_MS,
  dailyMax: number = RATE_LIMIT_DAILY_MAX,
): {
  allowed: boolean
  next: RateState
  remaining: number
  retryAfterMs: number
  reason?: "window" | "daily"
} {
  const cutoff = now - windowMs
  const recent = (state?.timestamps ?? []).filter(
    (t) => typeof t === "number" && Number.isFinite(t) && t > cutoff,
  )
  const day = utcDayKey(now)
  const dayCount =
    state?.dayKey === day && typeof state.dayCount === "number" ? state.dayCount : 0

  if (dayCount >= dailyMax) {
    return {
      allowed: false,
      next: {
        timestamps: recent,
        dayKey: day,
        dayCount,
      },
      remaining: 0,
      retryAfterMs: 0,
      reason: "daily",
    }
  }

  if (recent.length >= maxRequests) {
    const oldest = Math.min(...recent)
    const retryAfterMs = Math.max(0, oldest + windowMs - now)
    return {
      allowed: false,
      next: { timestamps: recent, dayKey: day, dayCount },
      remaining: 0,
      retryAfterMs,
      reason: "window",
    }
  }

  const nextTimestamps = [...recent, now]
  return {
    allowed: true,
    next: {
      timestamps: nextTimestamps,
      dayKey: day,
      dayCount: dayCount + 1,
    },
    remaining: maxRequests - nextTimestamps.length,
    retryAfterMs: 0,
  }
}

/**
 * Atomically consume one rate-limit slot for `uid` under `_rate/{uid}`.
 * Fail-closed if the transaction does not commit or uid is missing.
 */
export async function consumeRateLimit(
  db: RateDbLike,
  uid: string | null | undefined,
  now: number,
): Promise<RateLimitResult> {
  if (!uid || typeof uid !== "string") {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: 0,
      message: "Missing uid — cannot rate-limit cloud AI request",
    }
  }

  let applied: RateLimitResult = {
    allowed: false,
    remaining: 0,
    retryAfterMs: RATE_LIMIT_WINDOW_MS,
    message: RATE_LIMIT_ERROR_MESSAGE,
  }

  const rateRef = db.ref(`_rate/${uid}`)
  const tx = await rateRef.transaction((current) => {
    const result = applyRateLimit(current, now)
    applied = {
      allowed: result.allowed,
      remaining: result.remaining,
      retryAfterMs: result.retryAfterMs,
      message: result.allowed
        ? undefined
        : result.reason === "daily"
          ? RATE_LIMIT_DAILY_ERROR_MESSAGE
          : RATE_LIMIT_ERROR_MESSAGE,
    }
    // Always write cleaned (+ maybe new) timestamps so the window slides
    return result.next
  })

  if (!tx.committed) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: RATE_LIMIT_WINDOW_MS,
      message: RATE_LIMIT_ERROR_MESSAGE,
    }
  }

  return applied
}
