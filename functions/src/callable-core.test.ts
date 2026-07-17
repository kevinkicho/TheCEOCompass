import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { runCallableGenerate } from "./callable-core"
import type { RateDbLike, RateState } from "./rate-limit"
import { RATE_LIMIT_ERROR_MESSAGE } from "./rate-limit"

function createRateDb(
  initial: Map<string, RateState> = new Map(),
): RateDbLike {
  return {
    ref: (path: string) => ({
      transaction: async (updateFn) => {
        const current = initial.get(path) ?? null
        const next = updateFn(current)
        if (next === undefined) {
          return { committed: false, snapshot: { val: () => current } }
        }
        initial.set(path, next)
        return { committed: true, snapshot: { val: () => next } }
      },
    }),
  }
}

describe("runCallableGenerate", () => {
  it("requires uid", async () => {
    await assert.rejects(
      () =>
        runCallableGenerate(
          { prompt: "hi", uid: "" },
          {
            db: createRateDb(),
            llmConfig: { apiKey: "k" },
            generateText: async () => ({ text: "x", model: "m" }),
          },
        ),
      /UNAUTHENTICATED/,
    )
  })

  it("requires prompt", async () => {
    await assert.rejects(
      () =>
        runCallableGenerate(
          { prompt: "  ", uid: "u1" },
          {
            db: createRateDb(),
            llmConfig: { apiKey: "k" },
            generateText: async () => ({ text: "x", model: "m" }),
          },
        ),
      /INVALID_ARGUMENT/,
    )
  })

  it("returns text on success and writes heartbeat", async () => {
    let hb: Record<string, unknown> | null = null
    const result = await runCallableGenerate(
      { prompt: "hello", uid: "u1", temperature: 0.1 },
      {
        db: createRateDb(),
        llmConfig: { apiKey: "k", model: "m0" },
        generateText: async (_c, o) => {
          assert.equal(o.prompt, "hello")
          return { text: "world", model: "m1" }
        },
        now: () => 1000,
        writeHeartbeat: async (d) => {
          hb = d
        },
      },
    )
    assert.equal(result.text, "world")
    assert.equal(result.source, "callable")
    assert.equal(result.model, "m1")
    assert.ok(hb)
    assert.equal(hb!.source, "callable")
    assert.equal(hb!.last_uid, "u1")
  })

  it("surfaces rate limit", async () => {
    const now = 50_000
    const timestamps = Array.from({ length: 20 }, (_, i) => now - i * 1000)
    const db = createRateDb(new Map([["_rate/u1", { timestamps }]]))
    await assert.rejects(
      () =>
        runCallableGenerate(
          { prompt: "hi", uid: "u1" },
          {
            db,
            llmConfig: { apiKey: "k" },
            generateText: async () => ({ text: "x", model: "m" }),
            now: () => now,
          },
        ),
      new RegExp(RATE_LIMIT_ERROR_MESSAGE.slice(0, 20)),
    )
  })
})
