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
  isValidEdgeWeight,
} from "../mastery/graph"
import {
  pickNextActions,
  emptyLearnerState,
  WEAK_QUIZ_THRESHOLD,
  KIND_RANK,
  compareNextActions,
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

/** Assert kinds appear in non-increasing KIND_RANK order across the full list. */
function assertKindPrimaryOrder(actions: NextAction[]) {
  for (let i = 1; i < actions.length; i++) {
    expect(KIND_RANK[actions[i - 1].kind]).toBeGreaterThanOrEqual(KIND_RANK[actions[i].kind])
  }
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

  it("graphFromRtdb rejects NaN, Infinity, and out-of-range weights", () => {
    const g = graphFromRtdb(
      {
        a: { frameworkSlug: "fw", conceptSlug: "a" },
        b: { frameworkSlug: "fw", conceptSlug: "b" },
        c: { frameworkSlug: "fw", conceptSlug: "c" },
        d: { frameworkSlug: "fw", conceptSlug: "d" },
      },
      {
        a: {
          b: { type: "requires", weight: NaN },
          c: { type: "requires", weight: Infinity },
          d: { type: "requires", weight: -0.1 },
        },
        b: {
          c: { type: "requires", weight: 1.5 },
          d: { type: "requires", weight: 0.4 },
        },
      },
    )
    // Only finite weight in [0,1] survives
    expect(g.edges).toEqual([{ from: "b", to: "d", type: "requires", weight: 0.4 }])
  })

  it("graphFromSeed drops invalid weights", () => {
    const g = graphFromSeed({
      version: 1,
      concepts: [
        { id: "a", frameworkSlug: "fw", conceptSlug: "a" },
        { id: "b", frameworkSlug: "fw", conceptSlug: "b" },
      ],
      edges: [
        { from: "a", to: "b", type: "requires", weight: NaN },
        { from: "b", to: "a", type: "requires", weight: 0.3 },
      ],
    })
    expect(g.edges).toHaveLength(1)
    expect(g.edges[0].weight).toBe(0.3)
  })

  it("isValidEdgeWeight gates finite [0,1] range", () => {
    expect(isValidEdgeWeight(0)).toBe(true)
    expect(isValidEdgeWeight(1)).toBe(true)
    expect(isValidEdgeWeight(0.5)).toBe(true)
    expect(isValidEdgeWeight(NaN)).toBe(false)
    expect(isValidEdgeWeight(Infinity)).toBe(false)
    expect(isValidEdgeWeight(-1)).toBe(false)
    expect(isValidEdgeWeight(1.01)).toBe(false)
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

  it("returns empty for empty graph", () => {
    const empty: MasteryGraph = { concepts: {}, edges: [] }
    const state: LearnerState = {
      ...emptyLearnerState(),
      viewed: new Set(["x"]),
      quizPctByFramework: new Map([["fw", 10]]),
    }
    expect(pickNextActions(state, empty, 10, NOW)).toEqual([])
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

  it("kind-primary order: due > prereq > weak_quiz > explore when all present", () => {
    const g = fixtureGraph()
    // epsilon due; gamma known → beta prereq; weak fw-b; alpha/delta explore
    const state: LearnerState = {
      ...emptyLearnerState(),
      viewed: new Set(["gamma"]),
      reviewed: new Map([
        [
          "epsilon",
          review("epsilon", {
            frameworkSlug: "fw-b",
            conceptSlug: "epsilon",
            nextReviewAt: "2026-05-01T00:00:00.000Z",
          }),
        ],
      ]),
      quizPctByFramework: new Map([["fw-b", 30]]),
    }
    const actions = pickNextActions(state, g, 20, NOW)
    const present = new Set(kinds(actions))
    expect(present.has("due_review")).toBe(true)
    expect(present.has("prerequisite")).toBe(true)
    expect(present.has("weak_quiz")).toBe(true)
    expect(present.has("explore")).toBe(true)
    assertKindPrimaryOrder(actions)

    // First occurrence of each lower kind must be after last occurrence of higher kind
    const firstIdx = (k: NextAction["kind"]) => actions.findIndex((a) => a.kind === k)
    const lastIdx = (k: NextAction["kind"]) => {
      let i = -1
      actions.forEach((a, idx) => {
        if (a.kind === k) i = idx
      })
      return i
    }
    expect(lastIdx("due_review")).toBeLessThan(firstIdx("prerequisite"))
    expect(lastIdx("prerequisite")).toBeLessThan(firstIdx("weak_quiz"))
    expect(lastIdx("weak_quiz")).toBeLessThan(firstIdx("explore"))
  })

  it("high-leverage blocker score cannot outrank due_review (kind-primary)", () => {
    // Synthetic dense graph: many dependents of hub — score would exceed due base if score-sorted
    const concepts = Array.from({ length: 16 }, (_, i) => ({
      id: `c${i}`,
      frameworkSlug: "fw",
      conceptSlug: `c${i}`,
    }))
    const edges = Array.from({ length: 15 }, (_, i) => ({
      from: `c${i}`,
      to: "c15" as string,
      type: "requires" as const,
      weight: 1,
    }))
    // c0..c14 require c15 (hub); learner knows all dependents → huge blocker score for c15
    const g = graphFromSeed({ version: 1, concepts, edges })
    const state: LearnerState = {
      ...emptyLearnerState(),
      viewed: new Set(Array.from({ length: 15 }, (_, i) => `c${i}`)),
      reviewed: new Map([
        [
          "c0",
          review("c0", {
            frameworkSlug: "fw",
            conceptSlug: "c0",
            nextReviewAt: "2026-05-31T00:00:00.000Z", // just due
          }),
        ],
      ]),
    }
    const actions = pickNextActions(state, g, 5, NOW)
    expect(actions[0].kind).toBe("due_review")
    expect(actions[0].conceptId).toBe("c0")
    const hub = actions.find((a) => a.conceptId === "c15")
    expect(hub?.kind).toBe("prerequisite")
    // Even if hub score > due score, kind order holds
    if (hub && hub.score > actions[0].score) {
      expect(KIND_RANK[actions[0].kind]).toBeGreaterThan(KIND_RANK[hub.kind])
    }
    assertKindPrimaryOrder(actions)
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

  it("excludes reviewed-but-not-viewed concepts from explore", () => {
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
    const actions = pickNextActions(state, g, 20, NOW)
    expect(actions.find((a) => a.conceptId === "alpha" && a.kind === "explore")).toBeUndefined()
    expect(actions.find((a) => a.conceptId === "alpha" && a.kind === "due_review")).toBeUndefined()
  })

  it("surfaces orphan due reviews via ReviewRecord meta when concept missing from graph", () => {
    const g = fixtureGraph()
    const state: LearnerState = {
      ...emptyLearnerState(),
      reviewed: new Map([
        [
          "orphan-concept",
          review("orphan-concept", {
            frameworkSlug: "orphan-fw",
            conceptSlug: "orphan-slug",
            nextReviewAt: "2026-01-01T00:00:00.000Z",
          }),
        ],
      ]),
    }
    const actions = pickNextActions(state, g, 5, NOW)
    expect(actions[0]).toMatchObject({
      kind: "due_review",
      conceptId: "orphan-concept",
      frameworkSlug: "orphan-fw",
      conceptSlug: "orphan-slug",
    })
  })

  it("skips requires edges whose target concept is missing", () => {
    const g: MasteryGraph = {
      concepts: {
        only: { id: "only", frameworkSlug: "fw", conceptSlug: "only" },
      },
      edges: [{ from: "only", to: "missing", type: "requires", weight: 0.9 }],
    }
    const state: LearnerState = {
      ...emptyLearnerState(),
      viewed: new Set(["only"]),
    }
    const actions = pickNextActions(state, g, 10, NOW)
    expect(actions.filter((a) => a.kind === "prerequisite")).toHaveLength(0)
  })

  it("recommends missing prerequisites for known concepts with slug in reason", () => {
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
    expect(prereqs[0].reason).toContain("gamma") // conceptSlug of dependent
  })

  it("does not classify cold-start hubs as prerequisite (explore instead)", () => {
    const g = fixtureGraph()
    // cold start: no viewed/reviewed — blockers should not be prerequisite
    const actions = pickNextActions(emptyLearnerState(), g, 10, NOW)
    expect(actions.filter((a) => a.kind === "prerequisite")).toHaveLength(0)
    // alpha is most central — should appear as explore
    const alpha = actions.find((a) => a.conceptId === "alpha")
    expect(alpha?.kind).toBe("explore")
  })

  it("classifies blockers as prerequisite only when dependents are known", () => {
    const g = fixtureGraph()
    const state: LearnerState = {
      ...emptyLearnerState(),
      viewed: new Set(["beta", "delta"]), // both require alpha
    }
    const actions = pickNextActions(state, g, 10, NOW)
    const prereqAlpha = actions.find(
      (a) => a.kind === "prerequisite" && a.conceptId === "alpha",
    )
    expect(prereqAlpha).toBeDefined()
    expect(prereqAlpha!.reason.toLowerCase()).toMatch(/unlock|required/)
  })

  it("surfaces weak-quiz framework concepts", () => {
    const g = fixtureGraph()
    const state: LearnerState = {
      ...emptyLearnerState(),
      // Mark everything known so explore is suppressed
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

  it("skips non-finite quiz percentages", () => {
    const g = fixtureGraph()
    const state: LearnerState = {
      ...emptyLearnerState(),
      viewed: new Set(["alpha", "beta", "gamma", "delta", "epsilon"]),
      quizPctByFramework: new Map([
        ["fw-b", NaN],
        ["fw-a", Infinity],
      ]),
    }
    const actions = pickNextActions(state, g, 10, NOW)
    expect(actions.filter((a) => a.kind === "weak_quiz")).toHaveLength(0)
  })

  it("recommends unseen high-centrality concepts as explore", () => {
    const g = fixtureGraph()
    const actions = pickNextActions(emptyLearnerState(), g, 10, NOW)
    const explore = actions.filter((a) => a.kind === "explore")
    expect(explore.length).toBeGreaterThan(0)
    // alpha is most central
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

  it("compareNextActions ranks by kind before score", () => {
    const lowScoreDue: NextAction = {
      kind: "due_review",
      conceptId: "a",
      frameworkSlug: "fw",
      conceptSlug: "a",
      score: 1,
      reason: "x",
    }
    const highScoreExplore: NextAction = {
      kind: "explore",
      conceptId: "b",
      frameworkSlug: "fw",
      conceptSlug: "b",
      score: 99999,
      reason: "y",
    }
    expect(compareNextActions(lowScoreDue, highScoreExplore)).toBeLessThan(0)
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
    assertKindPrimaryOrder(actions)
    // Should include some prerequisite gap-fill for dcf / pre-mortem
    expect(kinds(actions).some((k) => k === "prerequisite" || k === "weak_quiz" || k === "explore")).toBe(
      true,
    )
    // All non-orphan actions resolve to seed concepts; due ebitda is in seed
    for (const a of actions) {
      if (a.kind !== "due_review" || g.concepts[a.conceptId]) {
        expect(a.frameworkSlug).toBeTruthy()
        expect(a.conceptSlug).toBeTruthy()
      }
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
