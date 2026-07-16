import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ReviewRecord } from "../spaced-repetition"
import type { MasteryGraph, MasterySeedFile } from "../mastery/types"
import {
  graphFromSeed,
  graphFromRtdb,
  computeCentrality,
  getPrerequisites,
  getDependents,
  conceptsInFramework,
} from "../mastery/graph"
import {
  pickNextActions,
  emptyLearnerState,
  WEAK_QUIZ_THRESHOLD,
  type LearnerState,
  type NextAction,
} from "../mastery/next-action"
import staticSeed from "@/data/mastery-edges.json"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Tiny graph for isolated priority tests (not the full seed). */
const fixtureSeed: MasterySeedFile = {
  version: 1,
  concepts: [
    {
      id: "alpha",
      frameworkSlug: "fw-a",
      conceptSlug: "alpha",
      difficulty: 1,
    },
    {
      id: "beta",
      frameworkSlug: "fw-a",
      conceptSlug: "beta",
      difficulty: 2,
    },
    {
      id: "gamma",
      frameworkSlug: "fw-a",
      conceptSlug: "gamma",
      difficulty: 3,
    },
    {
      id: "delta",
      frameworkSlug: "fw-b",
      conceptSlug: "delta",
      difficulty: 2,
    },
    {
      id: "epsilon",
      frameworkSlug: "fw-b",
      conceptSlug: "epsilon",
      difficulty: 1,
    },
  ],
  edges: [
    // gamma requires beta requires alpha  (chain)
    { from: "beta", to: "alpha", type: "requires", weight: 0.9 },
    { from: "gamma", to: "beta", type: "requires", weight: 0.8 },
    // delta requires alpha (cross-ish)
    { from: "delta", to: "alpha", type: "requires", weight: 0.7 },
    // reinforces between epsilon and alpha
    { from: "epsilon", to: "alpha", type: "reinforces", weight: 0.5 },
    { from: "alpha", to: "epsilon", type: "reinforces", weight: 0.5 },
  ],
}

function fixtureGraph(): MasteryGraph {
  return graphFromSeed(fixtureSeed)
}

function review(
  conceptId: string,
  overrides: Partial<ReviewRecord> = {},
): ReviewRecord {
  return {
    conceptId,
    frameworkSlug: "fw-a",
    conceptName: conceptId,
    conceptSlug: conceptId,
    reviewCount: 1,
    interval: 1,
    easeFactor: 2.5,
    lastReviewedAt: "2026-01-01T00:00:00.000Z",
    nextReviewAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  }
}

const NOW = new Date("2026-06-01T12:00:00.000Z").getTime()

function kinds(actions: NextAction[]): NextAction["kind"][] {
  return actions.map((a) => a.kind)
}

function ids(actions: NextAction[]): string[] {
  return actions.map((a) => a.conceptId)
}

// ---------------------------------------------------------------------------
// graph helpers
// ---------------------------------------------------------------------------

describe("mastery graph helpers", () => {
  it("graphFromSeed indexes concepts and copies edges", () => {
    const g = fixtureGraph()
    expect(Object.keys(g.concepts)).toHaveLength(5)
    expect(g.concepts.alpha.frameworkSlug).toBe("fw-a")
    expect(g.edges).toHaveLength(5)
    // immutable-ish: seed mutation should not affect returned graph edges identity
    expect(g.edges[0]).not.toBe(fixtureSeed.edges[0])
  })

  it("graphFromRtdb flattens nested edge map", () => {
    const g = graphFromRtdb(
      {
        a: { frameworkSlug: "fw", conceptSlug: "a" },
        b: { frameworkSlug: "fw", conceptSlug: "b" },
      },
      {
        a: { b: { type: "requires", weight: 0.5 } },
      },
    )
    expect(g.concepts.a.id).toBe("a")
    expect(g.edges).toEqual([{ from: "a", to: "b", type: "requires", weight: 0.5 }])
  })

  it("graphFromRtdb handles null / empty inputs", () => {
    expect(graphFromRtdb(null, null)).toEqual({ concepts: {}, edges: [] })
    expect(graphFromRtdb(undefined, undefined)).toEqual({ concepts: {}, edges: [] })
  })

  it("getPrerequisites / getDependents respect requires edges only", () => {
    const g = fixtureGraph()
    const prereqs = getPrerequisites(g, "beta")
    expect(prereqs.map((e) => e.to)).toEqual(["alpha"])
    const deps = getDependents(g, "alpha")
    expect(deps.map((e) => e.from).sort()).toEqual(["beta", "delta"])
    // reinforces should not appear
    expect(getPrerequisites(g, "epsilon")).toEqual([])
  })

  it("computeCentrality sums endpoint weights", () => {
    const g = fixtureGraph()
    const c = computeCentrality(g)
    // alpha is endpoint of: beta→alpha 0.9, delta→alpha 0.7, epsilon↔alpha 0.5+0.5
    expect(c.get("alpha")).toBeCloseTo(0.9 + 0.7 + 0.5 + 0.5)
    expect(c.get("gamma")).toBeCloseTo(0.8) // only gamma→beta
  })

  it("conceptsInFramework filters by slug", () => {
    const g = fixtureGraph()
    expect(conceptsInFramework(g, "fw-b").sort()).toEqual(["delta", "epsilon"])
  })

  it("real seed JSON loads via graphFromSeed", () => {
    const g = graphFromSeed(staticSeed as MasterySeedFile)
    expect(Object.keys(g.concepts).length).toBeGreaterThanOrEqual(10)
    expect(g.edges.length).toBeGreaterThanOrEqual(15)
    const frameworks = new Set(Object.values(g.concepts).map((c) => c.frameworkSlug))
    expect(frameworks.size).toBeGreaterThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// pickNextActions prioritization
// ---------------------------------------------------------------------------

describe("pickNextActions", () => {
  it("returns empty when limit <= 0", () => {
    const g = fixtureGraph()
    expect(pickNextActions(emptyLearnerState(), g, 0, NOW)).toEqual([])
    expect(pickNextActions(emptyLearnerState(), g, -1, NOW)).toEqual([])
  })

  it("prioritizes due reviews above everything else", () => {
    const g = fixtureGraph()
    const state: LearnerState = {
      ...emptyLearnerState(),
      viewed: new Set(["gamma"]), // would also surface prereqs
      reviewed: new Map([
        [
          "epsilon",
          review("epsilon", {
            frameworkSlug: "fw-b",
            conceptSlug: "epsilon",
            nextReviewAt: "2026-05-01T00:00:00.000Z", // overdue
          }),
        ],
      ]),
      quizPctByFramework: new Map([["fw-a", 20]]), // weak quiz noise
    }

    const actions = pickNextActions(state, g, 5, NOW)
    expect(actions[0].kind).toBe("due_review")
    expect(actions[0].conceptId).toBe("epsilon")
    expect(actions[0].score).toBeGreaterThan(1000)
  })

  it("does not surface future (not-due) reviews as due_review", () => {
    const g = fixtureGraph()
    const state: LearnerState = {
      ...emptyLearnerState(),
      reviewed: new Map([
        [
          "alpha",
          review("alpha", { nextReviewAt: "2027-01-01T00:00:00.000Z" }),
        ],
      ]),
    }
    const actions = pickNextActions(state, g, 10, NOW)
    expect(actions.filter((a) => a.kind === "due_review")).toHaveLength(0)
  })

  it("recommends missing prerequisites for known concepts", () => {
    const g = fixtureGraph()
    const state: LearnerState = {
      ...emptyLearnerState(),
      viewed: new Set(["gamma"]), // gamma requires beta; beta requires alpha
    }
    const actions = pickNextActions(state, g, 10, NOW)
    const prereqs = actions.filter((a) => a.kind === "prerequisite")
    expect(ids(prereqs)).toContain("beta")
    // beta should rank high among prereqs (direct missing prereq of gamma)
    expect(prereqs[0].conceptId).toBe("beta")
  })

  it("recommends high-leverage blockers even when dependent is unknown", () => {
    const g = fixtureGraph()
    // cold start: alpha unlocks beta + delta
    const actions = pickNextActions(emptyLearnerState(), g, 10, NOW)
    const prereqAlpha = actions.find(
      (a) => a.kind === "prerequisite" && a.conceptId === "alpha",
    )
    expect(prereqAlpha).toBeDefined()
    expect(prereqAlpha!.reason.toLowerCase()).toMatch(/unlock/)
  })

  it("surfaces weak-quiz framework concepts", () => {
    const g = fixtureGraph()
    const state: LearnerState = {
      ...emptyLearnerState(),
      // Mark everything viewed so explore is suppressed; leave reviews empty
      viewed: new Set(["alpha", "beta", "gamma", "delta", "epsilon"]),
      quizPctByFramework: new Map([["fw-b", 40]]),
    }
    const actions = pickNextActions(state, g, 10, NOW)
    const weak = actions.filter((a) => a.kind === "weak_quiz")
    expect(weak.length).toBeGreaterThan(0)
    expect(weak.every((a) => a.frameworkSlug === "fw-b")).toBe(true)
    expect(weak[0].reason).toContain("40")
  })

  it("ignores frameworks at or above weak quiz threshold", () => {
    const g = fixtureGraph()
    const state: LearnerState = {
      ...emptyLearnerState(),
      viewed: new Set(["alpha", "beta", "gamma", "delta", "epsilon"]),
      quizPctByFramework: new Map([["fw-b", WEAK_QUIZ_THRESHOLD]]),
    }
    const actions = pickNextActions(state, g, 10, NOW)
    expect(actions.filter((a) => a.kind === "weak_quiz")).toHaveLength(0)
  })

  it("recommends unseen high-centrality concepts as explore", () => {
    const g = fixtureGraph()
    const actions = pickNextActions(emptyLearnerState(), g, 10, NOW)
    const explore = actions.filter((a) => a.kind === "explore")
    expect(explore.length).toBeGreaterThan(0)
    // alpha is most central — if it appears as explore (or was promoted to prereq),
    // centrality still ranks it high overall
    const topIds = ids(actions).slice(0, 3)
    expect(topIds).toContain("alpha")
  })

  it("dedupes by conceptId keeping the higher-priority kind", () => {
    const g = fixtureGraph()
    const state: LearnerState = {
      ...emptyLearnerState(),
      viewed: new Set(["beta"]),
      reviewed: new Map([
        [
          "alpha",
          review("alpha", { nextReviewAt: "2026-01-01T00:00:00.000Z" }),
        ],
      ]),
      quizPctByFramework: new Map([["fw-a", 10]]),
    }
    const actions = pickNextActions(state, g, 20, NOW)
    const alphaHits = actions.filter((a) => a.conceptId === "alpha")
    expect(alphaHits).toHaveLength(1)
    expect(alphaHits[0].kind).toBe("due_review")
  })

  it("respects limit", () => {
    const g = fixtureGraph()
    const actions = pickNextActions(emptyLearnerState(), g, 2, NOW)
    expect(actions).toHaveLength(2)
  })

  it("emptyLearnerState starts with empty collections", () => {
    const s = emptyLearnerState()
    expect(s.viewed.size).toBe(0)
    expect(s.reviewed.size).toBe(0)
    expect(s.quizPctByFramework.size).toBe(0)
    expect(s.scenarioScores.size).toBe(0)
  })

  it("works on the real seed graph with mixed state", () => {
    const g = graphFromSeed(staticSeed as MasterySeedFile)
    const state: LearnerState = {
      ...emptyLearnerState(),
      viewed: new Set(["dcf-valuation", "pre-mortem-analysis"]),
      reviewed: new Map([
        [
          "ebitda",
          review("ebitda", {
            frameworkSlug: "financial-mastery",
            conceptSlug: "ebitda",
            nextReviewAt: "2026-05-15T00:00:00.000Z",
          }),
        ],
      ]),
      quizPctByFramework: new Map([["financial-mastery", 55]]),
    }
    const actions = pickNextActions(state, g, 5, NOW)
    expect(actions.length).toBe(5)
    expect(actions[0].kind).toBe("due_review")
    expect(actions[0].conceptId).toBe("ebitda")
    // Should include some prerequisite gap-fill for dcf / pre-mortem
    expect(kinds(actions).some((k) => k === "prerequisite" || k === "weak_quiz" || k === "explore")).toBe(
      true,
    )
    // All actions resolve to known seed concepts
    for (const a of actions) {
      expect(g.concepts[a.conceptId]).toBeDefined()
      expect(a.frameworkSlug).toBeTruthy()
      expect(a.conceptSlug).toBeTruthy()
    }
  })
})

// ---------------------------------------------------------------------------
// loadMasteryGraph (RTDB + static fallback)
// ---------------------------------------------------------------------------

vi.mock("@/lib/firebase", () => ({
  db: { type: "database" },
  ref: vi.fn((_db: unknown, path: string) => ({ _path: path })),
  get: vi.fn(),
}))

function makeSnap(data: unknown, exists = true) {
  return {
    exists: () => exists,
    val: () => data,
  }
}

describe("loadMasteryGraph", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("loads from RTDB when concepts exist", async () => {
    const { get } = await import("@/lib/firebase")
    const mockGet = vi.mocked(get)
    mockGet.mockImplementation(async (r: unknown) => {
      const path = (r as { _path?: string })?._path ?? ""
      if (path === "mastery/concepts") {
        return makeSnap({
          alpha: { frameworkSlug: "fw", conceptSlug: "alpha" },
        }) as any
      }
      if (path === "mastery/edges") {
        return makeSnap({
          alpha: { beta: { type: "requires", weight: 0.4 } },
        }) as any
      }
      return makeSnap(null, false) as any
    })

    const { loadMasteryGraph, getMasteryGraphSource, clearMasteryGraphCache } =
      await import("../mastery/load")
    clearMasteryGraphCache()
    const g = await loadMasteryGraph()
    expect(g.concepts.alpha.conceptSlug).toBe("alpha")
    expect(g.edges).toHaveLength(1)
    expect(getMasteryGraphSource()).toBe("rtdb")
  })

  it("falls back to static seed when RTDB is empty", async () => {
    const { get } = await import("@/lib/firebase")
    vi.mocked(get).mockResolvedValue(makeSnap(null, false) as any)

    const { loadMasteryGraph, getMasteryGraphSource, clearMasteryGraphCache } =
      await import("../mastery/load")
    clearMasteryGraphCache()
    const g = await loadMasteryGraph()
    expect(Object.keys(g.concepts).length).toBeGreaterThan(0)
    expect(getMasteryGraphSource()).toBe("static")
  })

  it("falls back to static seed when RTDB get throws", async () => {
    const { get } = await import("@/lib/firebase")
    vi.mocked(get).mockRejectedValue(new Error("network"))

    const { loadMasteryGraph, getMasteryGraphSource, clearMasteryGraphCache } =
      await import("../mastery/load")
    clearMasteryGraphCache()
    const g = await loadMasteryGraph()
    expect(Object.keys(g.concepts).length).toBeGreaterThan(0)
    expect(getMasteryGraphSource()).toBe("static")
  })

  it("loadMasteryGraphFromStatic is sync and non-empty", async () => {
    const { loadMasteryGraphFromStatic } = await import("../mastery/load")
    const g = loadMasteryGraphFromStatic()
    expect(Object.keys(g.concepts).length).toBeGreaterThanOrEqual(10)
  })

  it("caches subsequent loadMasteryGraph calls", async () => {
    const { get } = await import("@/lib/firebase")
    const mockGet = vi.mocked(get)
    mockGet.mockReset()
    mockGet.mockResolvedValue(makeSnap(null, false) as any)

    const { loadMasteryGraph, getCachedMasteryGraph, clearMasteryGraphCache } =
      await import("../mastery/load")
    clearMasteryGraphCache()
    const a = await loadMasteryGraph()
    const callsAfterFirst = mockGet.mock.calls.length
    const b = await loadMasteryGraph()
    expect(a).toBe(b)
    expect(getCachedMasteryGraph()).toBe(a)
    // Second call must not hit RTDB again
    expect(mockGet.mock.calls.length).toBe(callsAfterFirst)
    expect(callsAfterFirst).toBeGreaterThan(0)
  })
})
