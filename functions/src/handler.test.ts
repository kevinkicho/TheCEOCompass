import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  claimCloudRequest,
  handleCloudRequest,
  writeError,
  type DbLike,
  type DbRef,
} from "./handler"
import type { AiRequestData } from "./response-path"

type Store = Map<string, Record<string, unknown>>

function createMockDb(initial: Store = new Map()): {
  db: DbLike
  store: Store
  updates: Array<{ path: string; data: Record<string, unknown> }>
  sets: Array<{ path: string; data: Record<string, unknown> }>
} {
  const store = initial
  const updates: Array<{ path: string; data: Record<string, unknown> }> = []
  const sets: Array<{ path: string; data: Record<string, unknown> }> = []

  const db: DbLike = {
    ref: (path: string): DbRef => ({
      transaction: async (updateFn) => {
        const current = (store.get(path) as AiRequestData | undefined) ?? null
        const next = updateFn(current)
        if (next === undefined) {
          return {
            committed: false,
            snapshot: { val: () => current },
          }
        }
        store.set(path, next as Record<string, unknown>)
        return {
          committed: true,
          snapshot: { val: () => next as AiRequestData },
        }
      },
      update: async (data) => {
        updates.push({ path, data })
        const cur = store.get(path) || {}
        store.set(path, { ...cur, ...data })
      },
      set: async (data) => {
        sets.push({ path, data })
        store.set(path, { ...data })
      },
    }),
  }

  return { db, store, updates, sets }
}

function cloudPending(overrides: Partial<AiRequestData> = {}): AiRequestData {
  return {
    provider: "cloud",
    status: "pending",
    uid: "test-uid",
    type: "concept_chat",
    payload: { prompt: "hello", model: "gpt-test", options: { temperature: 0.1 } },
    ...overrides,
  }
}

describe("claimCloudRequest", () => {
  it("claims pending cloud requests", async () => {
    const { db, store } = createMockDb(
      new Map([["requests/r1", cloudPending() as Record<string, unknown>]]),
    )
    const claimed = await claimCloudRequest(db.ref("requests/r1"), 1000)
    assert.ok(claimed)
    assert.equal(claimed!.status, "processing")
    assert.equal(claimed!.started_at, 1000)
    assert.equal((store.get("requests/r1") as AiRequestData).status, "processing")
  })

  it("aborts when status is not pending", async () => {
    const { db } = createMockDb(
      new Map([
        [
          "requests/r1",
          { provider: "cloud", status: "processing" } as Record<string, unknown>,
        ],
      ]),
    )
    const claimed = await claimCloudRequest(db.ref("requests/r1"), 1000)
    assert.equal(claimed, null)
  })

  it("aborts when provider is not cloud", async () => {
    const { db } = createMockDb(
      new Map([
        [
          "requests/r1",
          { provider: "agent", status: "pending" } as Record<string, unknown>,
        ],
      ]),
    )
    const claimed = await claimCloudRequest(db.ref("requests/r1"), 1000)
    assert.equal(claimed, null)
  })
})

describe("writeError", () => {
  it("sets status error before response path", async () => {
    const { db, updates, sets } = createMockDb()
    const order: string[] = []
    const wrapped: DbLike = {
      ref: (path) => {
        const inner = db.ref(path)
        return {
          transaction: inner.transaction,
          update: async (data) => {
            order.push(`update:${path}`)
            return inner.update(data)
          },
          set: async (data) => {
            order.push(`set:${path}`)
            return inner.set(data)
          },
        }
      },
    }

    await writeError(
      wrapped,
      "r1",
      { type: "concept_chat", provider: "cloud" },
      "boom",
      42,
    )

    assert.deepEqual(order, [
      "update:requests/r1",
      "set:conceptChats/r1",
    ])
    assert.equal(updates[0].data.status, "error")
    assert.equal(updates[0].data.error, "boom")
    assert.equal(sets[0].data.error, "boom")
    assert.equal(sets[0].data.created_at, 42)
  })

  it("still writes status when response set throws", async () => {
    const updates: Array<Record<string, unknown>> = []
    const db: DbLike = {
      ref: (path) => ({
        transaction: async () => ({ committed: false, snapshot: { val: () => null } }),
        update: async (data) => {
          updates.push(data)
        },
        set: async () => {
          throw new Error("path write failed")
        },
      }),
    }

    await writeError(db, "r1", { type: "concept_chat" }, "llm failed")
    assert.equal(updates.length, 1)
    assert.equal(updates[0].status, "error")
    assert.equal(updates[0].error, "llm failed")
  })
})

describe("handleCloudRequest", () => {
  it("no-ops for non-cloud provider without claiming", async () => {
    const { db, store } = createMockDb(
      new Map([
        [
          "requests/r1",
          { provider: "agent", status: "pending" } as Record<string, unknown>,
        ],
      ]),
    )
    let genCalls = 0
    const result = await handleCloudRequest(
      "r1",
      { provider: "agent", status: "pending" },
      {
        db,
        llmConfig: { apiKey: "k" },
        generateText: async () => {
          genCalls++
          return { text: "x", model: "m" }
        },
      },
    )
    assert.equal(result.outcome, "skipped")
    assert.equal(genCalls, 0)
    assert.equal((store.get("requests/r1") as AiRequestData).status, "pending")
  })

  it("errors on missing prompt", async () => {
    const data = cloudPending({ payload: {} })
    const { db, updates, sets } = createMockDb(
      new Map([["requests/r1", data as Record<string, unknown>]]),
    )
    const result = await handleCloudRequest("r1", data, {
      db,
      llmConfig: { apiKey: "k" },
      generateText: async () => ({ text: "x", model: "m" }),
      now: () => 99,
    })
    assert.equal(result.outcome, "error")
    if (result.outcome === "error") {
      assert.match(result.message, /payload\.prompt/)
    }
    assert.ok(updates.some((u) => u.data.status === "error"))
    assert.ok(sets.some((s) => s.path === "conceptChats/r1" && s.data.error))
  })

  it("writes error when LLM throws", async () => {
    const data = cloudPending()
    const { db, updates, sets } = createMockDb(
      new Map([["requests/r1", data as Record<string, unknown>]]),
    )
    const result = await handleCloudRequest("r1", data, {
      db,
      llmConfig: { apiKey: "k" },
      generateText: async () => {
        throw new Error("Cloud LLM error (500): nope")
      },
    })
    assert.equal(result.outcome, "error")
    assert.ok(updates.some((u) => u.data.status === "error"))
    assert.ok(sets.some((s) => String(s.data.error).includes("500")))
  })

  it("success writes response path and status done", async () => {
    const data = cloudPending({
      category: "explain_further",
      framework_slug: "okr",
      concept_slug: "objectives",
      type: "explain_further",
    })
    const { db, updates, sets } = createMockDb(
      new Map([["requests/r1", data as Record<string, unknown>]]),
    )
    const result = await handleCloudRequest("r1", data, {
      db,
      llmConfig: { apiKey: "k", model: "default" },
      generateText: async (_cfg, opts) => {
        assert.equal(opts.prompt, "hello")
        assert.equal(opts.timeoutMs, 50_000)
        return { text: "result text", model: "echo" }
      },
      llmTimeoutMs: 50_000,
      now: () => 1234,
    })
    assert.equal(result.outcome, "done")
    if (result.outcome === "done") {
      assert.equal(
        result.responsePath,
        "framework/okr/objectives/explain_further/r1",
      )
      assert.equal(result.chars, "result text".length)
    }
    const responseSet = sets.find(
      (s) => s.path === "framework/okr/objectives/explain_further/r1",
    )
    assert.ok(responseSet)
    assert.equal(responseSet!.data.result, "result text")
    assert.equal(responseSet!.data.model, "echo")
    assert.equal(responseSet!.data.created_at, 1234)
    assert.ok(updates.some((u) => u.data.status === "done"))
  })

  it("errors when no response path applies", async () => {
    const data = cloudPending({ type: "unknown", payload: { prompt: "x" } })
    // clear type that maps to a path
    delete data.type
    const { db, updates } = createMockDb(
      new Map([["requests/r1", data as Record<string, unknown>]]),
    )
    const result = await handleCloudRequest("r1", data, {
      db,
      llmConfig: { apiKey: "k" },
      generateText: async () => ({ text: "x", model: "m" }),
    })
    assert.equal(result.outcome, "error")
    if (result.outcome === "error") {
      assert.match(result.message, /No response path/)
    }
    assert.ok(updates.some((u) => u.data.status === "error"))
  })

  it("skips when claim fails (re-delivery after processing)", async () => {
    const eventData = cloudPending()
    const { db } = createMockDb(
      new Map([
        [
          "requests/r1",
          { ...eventData, status: "done" } as Record<string, unknown>,
        ],
      ]),
    )
    let genCalls = 0
    const result = await handleCloudRequest("r1", eventData, {
      db,
      llmConfig: { apiKey: "k" },
      generateText: async () => {
        genCalls++
        return { text: "x", model: "m" }
      },
    })
    assert.equal(result.outcome, "skipped")
    if (result.outcome === "skipped") {
      assert.equal(result.reason, "claim_failed")
    }
    assert.equal(genCalls, 0)
  })

  it("rate-limits without calling LLM and sets clear error", async () => {
    const { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_ERROR_MESSAGE } = await import(
      "./rate-limit"
    )
    const now = 50_000
    const timestamps = Array.from(
      { length: RATE_LIMIT_MAX_REQUESTS },
      (_, i) => now - i * 100,
    )
    const data = cloudPending({ uid: "rate-user" })
    const { db, updates, sets } = createMockDb(
      new Map([
        ["requests/r1", data as Record<string, unknown>],
        ["_rate/rate-user", { timestamps } as Record<string, unknown>],
      ]),
    )
    let genCalls = 0
    const result = await handleCloudRequest("r1", data, {
      db,
      llmConfig: { apiKey: "k" },
      generateText: async () => {
        genCalls++
        return { text: "x", model: "m" }
      },
      now: () => now,
    })
    assert.equal(result.outcome, "error")
    if (result.outcome === "error") {
      assert.equal(result.message, RATE_LIMIT_ERROR_MESSAGE)
    }
    assert.equal(genCalls, 0)
    assert.ok(updates.some((u) => u.data.status === "error"))
    assert.ok(
      updates.some(
        (u) =>
          u.path === "requests/r1" &&
          u.data.error === RATE_LIMIT_ERROR_MESSAGE,
      ),
    )
    assert.ok(
      sets.some(
        (s) =>
          s.path === "conceptChats/r1" &&
          s.data.error === RATE_LIMIT_ERROR_MESSAGE,
      ),
    )
  })

  it("errors when cloud request has no uid (rate-limit fail-closed)", async () => {
    const data = cloudPending({ uid: undefined })
    delete data.uid
    const { db, updates } = createMockDb(
      new Map([["requests/r1", data as Record<string, unknown>]]),
    )
    let genCalls = 0
    const result = await handleCloudRequest("r1", data, {
      db,
      llmConfig: { apiKey: "k" },
      generateText: async () => {
        genCalls++
        return { text: "x", model: "m" }
      },
    })
    assert.equal(result.outcome, "error")
    if (result.outcome === "error") {
      assert.match(result.message, /Missing uid|rate limit/i)
    }
    assert.equal(genCalls, 0)
    assert.ok(updates.some((u) => u.data.status === "error"))
  })
})
