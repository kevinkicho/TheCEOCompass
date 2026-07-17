import { describe, it, expect, vi, beforeEach } from "vitest"

const state = vi.hoisted(() => ({
  mockGet: vi.fn(),
  db: { __isDb: true } as object | null,
}))

vi.mock("@/lib/firebase", () => ({
  get db() {
    return state.db
  },
  ref: (_db: unknown, path: string) => ({ _path: path }),
  get: (...args: unknown[]) => state.mockGet(...args),
}))

function makeSnap(data: unknown, exists = true) {
  return {
    exists: () => exists,
    val: () => data,
  }
}

describe("scenarios-cache", () => {
  beforeEach(async () => {
    state.db = { __isDb: true }
    state.mockGet.mockReset()
    vi.resetModules()
  })

  it("loads from RTDB when scenarios exist", async () => {
    state.mockGet.mockResolvedValue(
      makeSnap({
        "pricing-war-response": {
          id: "pricing-war-response",
          slug: "pricing-war-response",
          title: "Pricing War",
          description: "d",
          framework_id: "x",
          difficulty: 2,
          context: { company: "c", situation: "s", time_pressure: "t", data_provided: [] },
          stages: [],
          outcome_branches: {},
          pack_id: "core",
        },
      }),
    )
    const { loadScenarios, getScenariosSource, clearScenariosCache } = await import(
      "../scenarios-cache"
    )
    clearScenariosCache()
    const list = await loadScenarios()
    expect(list).toHaveLength(1)
    expect(list[0].slug).toBe("pricing-war-response")
    expect(getScenariosSource()).toBe("rtdb")
  })

  it("falls back to bundled seed when RTDB empty", async () => {
    state.mockGet.mockResolvedValue(makeSnap(null, false))
    const { loadScenarios, getScenariosSource, clearScenariosCache } = await import(
      "../scenarios-cache"
    )
    clearScenariosCache()
    const list = await loadScenarios()
    expect(list.length).toBeGreaterThanOrEqual(12)
    expect(getScenariosSource()).toBe("static")
  })
})
