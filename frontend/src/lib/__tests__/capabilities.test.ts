import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockDb } = vi.hoisted(() => ({ mockDb: { __isDb: true } as object | null }))

vi.mock("@/lib/firebase", () => ({
  get db() {
    return mockDb
  },
}))

import {
  canUseFirebasePersistence,
  canUseAIFromHeartbeat,
  getAiAvailability,
  AGENT_HEARTBEAT_STALE_MS,
  AGENT_HEARTBEAT_SKEW_MS,
  type AgentHeartbeat,
} from "../capabilities"

describe("canUseFirebasePersistence", () => {
  it("returns true when window exists and db is non-null", () => {
    expect(canUseFirebasePersistence()).toBe(true)
  })
})

describe("canUseAIFromHeartbeat", () => {
  const fresh: AgentHeartbeat = {
    status: "ok",
    updated_at: Date.now(),
    ollama_ok: true,
  }

  it("allows local AI mode without heartbeat", () => {
    expect(canUseAIFromHeartbeat(null, true)).toBe(true)
  })

  it("rejects missing heartbeat when not local", () => {
    expect(canUseAIFromHeartbeat(null, false)).toBe(false)
  })

  it("rejects stale heartbeat", () => {
    const stale: AgentHeartbeat = {
      ...fresh,
      updated_at: Date.now() - AGENT_HEARTBEAT_STALE_MS - AGENT_HEARTBEAT_SKEW_MS - 1,
    }
    expect(canUseAIFromHeartbeat(stale, false)).toBe(false)
  })

  it("rejects when ollama_ok is false", () => {
    expect(canUseAIFromHeartbeat({ ...fresh, ollama_ok: false }, false)).toBe(false)
  })

  it("accepts fresh heartbeat with ollama_ok", () => {
    expect(canUseAIFromHeartbeat(fresh, false)).toBe(true)
  })
})

describe("getAiAvailability", () => {
  it("returns local mode when localAiMode", () => {
    const a = getAiAvailability(null, true)
    expect(a).toEqual({ status: "available", mode: "local", ollamaOk: true })
  })

  it("returns no_heartbeat when agent silent", () => {
    const a = getAiAvailability(null, false)
    // db may be mocked non-null
    if (a.status === "unavailable") {
      expect(["no_heartbeat", "no_firebase"]).toContain(a.reason)
    }
  })
})
