import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  applyRateLimit,
  consumeRateLimit,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_ERROR_MESSAGE,
  type RateState,
  type RateDbLike,
} from "./rate-limit"

function createMockDb(initial: Map<string, Record<string, unknown>> = new Map()): {
  db: RateDbLike
  store: Map<string, Record<string, unknown>>
} {
  const store = initial
  const db: RateDbLike = {
    ref: (path: string) => ({
      transaction: async (updateFn) => {
        const current = (store.get(path) as RateState | undefined) ?? null
        const next = updateFn(current)
        if (next === undefined) {
          return { committed: false, snapshot: { val: () => current } }
        }
        store.set(path, next as Record<string, unknown>)
        return {
          committed: true,
          snapshot: { val: () => next },
        }
      },
    }),
  }
  return { db, store }
}

describe("applyRateLimit", () => {
  it("allows first request and records timestamp", () => {
    const r = applyRateLimit(null, 1_000_000)
    assert.equal(r.allowed, true)
    assert.equal(r.remaining, RATE_LIMIT_MAX_REQUESTS - 1)
    assert.deepEqual(r.next.timestamps, [1_000_000])
    assert.equal(r.retryAfterMs, 0)
  })

  it("drops expired timestamps outside the window", () => {
    const now = 1_000_000
    const state: RateState = {
      timestamps: [now - RATE_LIMIT_WINDOW_MS - 1, now - 1000],
    }
    const r = applyRateLimit(state, now)
    assert.equal(r.allowed, true)
    assert.deepEqual(r.next.timestamps, [now - 1000, now])
  })

  it("denies when at max within the window", () => {
    const now = 5_000_000
    const timestamps = Array.from({ length: RATE_LIMIT_MAX_REQUESTS }, (_, i) => now - i * 1000)
    const r = applyRateLimit({ timestamps }, now)
    assert.equal(r.allowed, false)
    assert.equal(r.remaining, 0)
    assert.ok(r.retryAfterMs > 0)
    assert.equal(r.next.timestamps?.length, RATE_LIMIT_MAX_REQUESTS)
  })

  it("allows exactly at max-1", () => {
    const now = 5_000_000
    const timestamps = Array.from(
      { length: RATE_LIMIT_MAX_REQUESTS - 1 },
      (_, i) => now - i * 1000,
    )
    const r = applyRateLimit({ timestamps }, now)
    assert.equal(r.allowed, true)
    assert.equal(r.remaining, 0)
    assert.equal(r.next.timestamps?.length, RATE_LIMIT_MAX_REQUESTS)
  })

  it("respects custom max and window", () => {
    const r = applyRateLimit({ timestamps: [100, 200] }, 250, 2, 1000)
    assert.equal(r.allowed, false)
    assert.equal(r.remaining, 0)
  })
})

describe("consumeRateLimit", () => {
  it("rejects missing uid", async () => {
    const { db } = createMockDb()
    const r = await consumeRateLimit(db, null, 1000)
    assert.equal(r.allowed, false)
    assert.match(r.message || "", /Missing uid/)
  })

  it("allows and writes _rate/{uid}", async () => {
    const { db, store } = createMockDb()
    const r = await consumeRateLimit(db, "uid-a", 42_000)
    assert.equal(r.allowed, true)
    assert.equal(r.remaining, RATE_LIMIT_MAX_REQUESTS - 1)
    const stored = store.get("_rate/uid-a") as RateState
    assert.deepEqual(stored.timestamps, [42_000])
  })

  it("denies after max requests with clear message", async () => {
    const now = 100_000
    const timestamps = Array.from({ length: RATE_LIMIT_MAX_REQUESTS }, (_, i) => now - i * 100)
    const { db } = createMockDb(
      new Map([["_rate/uid-b", { timestamps } as Record<string, unknown>]]),
    )
    const r = await consumeRateLimit(db, "uid-b", now)
    assert.equal(r.allowed, false)
    assert.equal(r.message, RATE_LIMIT_ERROR_MESSAGE)
    assert.match(RATE_LIMIT_ERROR_MESSAGE, /20/)
    assert.match(RATE_LIMIT_ERROR_MESSAGE, /10 minutes/)
  })

  it("serializes concurrent-style sequential consumes up to the limit", async () => {
    const { db } = createMockDb()
    let allowed = 0
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS + 3; i++) {
      const r = await consumeRateLimit(db, "uid-c", 10_000 + i)
      if (r.allowed) allowed++
    }
    assert.equal(allowed, RATE_LIMIT_MAX_REQUESTS)
  })
})
