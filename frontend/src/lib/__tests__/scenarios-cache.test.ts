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

describe("scenarios-cache dual-path", () => {
  beforeEach(async () => {
    state.db = { __isDb: true }
    state.mockGet.mockReset()
    vi.resetModules()
  })

  it("loadScenarioList prefers scenario_index (light path)", async () => {
    state.mockGet.mockImplementation(async (r: { _path?: string }) => {
      if (r?._path === "scenario_index") {
        return makeSnap({
          "pricing-war-response": {
            id: "pricing-war-response",
            slug: "pricing-war-response",
            title: "Pricing War",
            description: "d",
            framework_id: "x",
            difficulty: 2,
            pack_id: "core",
            pack_title: "Core",
          },
        })
      }
      return makeSnap(null, false)
    })
    const {
      loadScenarioList,
      getScenariosSource,
      isScenarioIndexActive,
      clearScenariosCache,
    } = await import("../scenarios-cache")
    clearScenariosCache()
    const list = await loadScenarioList()
    expect(list).toHaveLength(1)
    expect(list[0].slug).toBe("pricing-war-response")
    expect(list[0]).not.toHaveProperty("stages")
    expect(getScenariosSource()).toBe("rtdb-index")
    expect(isScenarioIndexActive()).toBe(true)
    // Must not have fetched full scenarios tree
    const paths = state.mockGet.mock.calls.map((c) => (c[0] as { _path?: string })?._path)
    expect(paths).toContain("scenario_index")
    expect(paths).not.toContain("scenarios")
  })

  it("loadScenarioBySlug fetches single detail path", async () => {
    state.mockGet.mockImplementation(async (r: { _path?: string }) => {
      if (r?._path === "scenarios/pricing-war-response") {
        return makeSnap({
          id: "pricing-war-response",
          slug: "pricing-war-response",
          title: "Pricing War",
          description: "d",
          framework_id: "x",
          difficulty: 2,
          context: { company: "c", situation: "s", time_pressure: "t", data_provided: [] },
          stages: [{ id: "1", title: "Stage 1", prompt: "p", options: [] }],
          outcome_branches: {},
          pack_id: "core",
        })
      }
      return makeSnap(null, false)
    })
    const { loadScenarioBySlug, clearScenariosCache } = await import("../scenarios-cache")
    clearScenariosCache()
    const s = await loadScenarioBySlug("pricing-war-response")
    expect(s).not.toBeNull()
    expect(s!.stages).toHaveLength(1)
    expect(state.mockGet).toHaveBeenCalled()
  })

  it("loadScenarios loads full RTDB tree when present", async () => {
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
    expect(getScenariosSource()).toBe("rtdb-full")
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

  it("loadScenarioList falls back to full/static when index missing", async () => {
    state.mockGet.mockResolvedValue(makeSnap(null, false))
    const { loadScenarioList, getScenariosSource, clearScenariosCache } = await import(
      "../scenarios-cache"
    )
    clearScenariosCache()
    const list = await loadScenarioList()
    expect(list.length).toBeGreaterThanOrEqual(12)
    expect(getScenariosSource()).toBe("static")
  })
})
