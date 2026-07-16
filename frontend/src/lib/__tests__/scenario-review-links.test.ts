import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockRef, mockGet, mockSet } = vi.hoisted(() => {
  const mockRef = vi.fn((_db: any, path: string) => ({ key: path }))
  const mockGet = vi.fn()
  const mockSet = vi.fn(() => Promise.resolve())
  return { mockRef, mockGet, mockSet }
})

vi.mock("@/lib/firebase", () => ({
  db: { ref: mockRef, get: mockGet },
  auth: { currentUser: { uid: "test-uid", isAnonymous: true } },
  ref: (...args: any[]) => (mockRef as any)(args[0], args[1]),
  get: (...args: any[]) => (mockGet as any)(args[0], args[1]),
  set: (...args: any[]) => (mockSet as any)(args[0], args[1]),
}))

vi.mock("@/lib/rtdb-cache", () => ({
  slugify: (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  getCachedFrameworks: () => null,
  loadFrameworks: vi.fn(),
}))

import {
  isWeakStageScore,
  hasWeakStages,
  shouldOfferConceptReview,
  ratingForWeakStages,
  resolveConceptsForReview,
  seedConceptsToReview,
  WEAK_STAGE_SCORE_THRESHOLD,
} from "../user-data/reviews"
import type { Framework } from "../types"

describe("isWeakStageScore / hasWeakStages", () => {
  it("treats scores below threshold as weak (AI 0–10 scale)", () => {
    expect(isWeakStageScore(4)).toBe(true)
    expect(isWeakStageScore(5)).toBe(false)
    expect(isWeakStageScore(0)).toBe(true)
    expect(isWeakStageScore(9)).toBe(false)
  })

  it("respects custom threshold", () => {
    expect(isWeakStageScore(6, 7)).toBe(true)
    expect(isWeakStageScore(7, 7)).toBe(false)
  })

  it("hasWeakStages is true when any stage is weak", () => {
    expect(hasWeakStages([{ score: 9 }, { score: 4 }])).toBe(true)
    expect(hasWeakStages([{ score: 8 }, { score: 6 }])).toBe(false)
    expect(hasWeakStages([])).toBe(false)
  })
})

describe("shouldOfferConceptReview", () => {
  it("requires both weak stages and concept_ids", () => {
    expect(shouldOfferConceptReview([{ score: 2 }], ["unit-economics"])).toBe(true)
    expect(shouldOfferConceptReview([{ score: 9 }], ["unit-economics"])).toBe(false)
    expect(shouldOfferConceptReview([{ score: 2 }], [])).toBe(false)
    expect(shouldOfferConceptReview([{ score: 2 }], undefined)).toBe(false)
  })
})

describe("ratingForWeakStages", () => {
  it("returns null when no weak stages", () => {
    expect(ratingForWeakStages([{ score: 8 }, { score: 7 }])).toBeNull()
  })

  it("returns Again (0) when weakest stage is very low", () => {
    expect(ratingForWeakStages([{ score: 9 }, { score: 2 }])).toBe(0)
    expect(ratingForWeakStages([{ score: 0 }])).toBe(0)
  })

  it("returns Hard (3) when weak but not again-level", () => {
    expect(ratingForWeakStages([{ score: 4 }])).toBe(3)
    expect(ratingForWeakStages([{ score: 3 }])).toBe(3)
  })
})

describe("resolveConceptsForReview", () => {
  const frameworks: Framework[] = [
    {
      id: "fw1",
      slug: "financial-mastery",
      title: "Financial Mastery",
      description: "",
      category: "finance",
      difficulty: 2,
      estimated_time_minutes: 30,
      key_concepts: [],
      use_cases: [],
      content: "",
      concepts: [
        { id: "c-ue", name: "Unit Economics", definition: "", tags: [] },
        { id: "c-fcf", name: "Free Cash Flow", definition: "", tags: [] },
      ],
    },
    {
      id: "fw2",
      slug: "other",
      title: "Other",
      description: "",
      category: "x",
      difficulty: 1,
      estimated_time_minutes: 10,
      key_concepts: [],
      use_cases: [],
      content: "",
      concepts: [
        { id: "c-other", name: "Unit Economics", definition: "dup name elsewhere", tags: [] },
      ],
    },
  ]

  it("resolves concept slugs via preferred framework_slugs", () => {
    const targets = resolveConceptsForReview(
      ["unit-economics", "free-cash-flow"],
      ["financial-mastery"],
      frameworks,
    )
    expect(targets).toEqual([
      {
        conceptId: "c-ue",
        frameworkSlug: "financial-mastery",
        conceptName: "Unit Economics",
        conceptSlug: "unit-economics",
      },
      {
        conceptId: "c-fcf",
        frameworkSlug: "financial-mastery",
        conceptName: "Free Cash Flow",
        conceptSlug: "free-cash-flow",
      },
    ])
  })

  it("falls back to slug-based targets when frameworks missing", () => {
    const targets = resolveConceptsForReview(
      ["porter-s-five-forces"],
      ["competitive-market-analysis"],
      null,
    )
    expect(targets).toEqual([
      {
        conceptId: "porter-s-five-forces",
        frameworkSlug: "competitive-market-analysis",
        conceptName: "Porter S Five Forces",
        conceptSlug: "porter-s-five-forces",
      },
    ])
  })

  it("uses unknown framework when no slugs or frameworks available", () => {
    const targets = resolveConceptsForReview(["ooda-loop"], undefined, null)
    expect(targets[0].frameworkSlug).toBe("unknown")
    expect(targets[0].conceptSlug).toBe("ooda-loop")
  })
})

describe("seedConceptsToReview", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("marks each concept with the given rating", async () => {
    mockGet.mockResolvedValue({ exists: () => false, val: () => null })
    mockSet.mockResolvedValue(undefined)

    const result = await seedConceptsToReview(
      [
        {
          conceptId: "c1",
          frameworkSlug: "fw",
          conceptName: "N1",
          conceptSlug: "n1",
        },
        {
          conceptId: "c2",
          frameworkSlug: "fw",
          conceptName: "N2",
          conceptSlug: "n2",
        },
      ],
      3,
    )

    expect(result).toEqual({ seeded: 2, failed: 0 })
    expect(mockSet).toHaveBeenCalledTimes(2)
  })

  it("counts failures without throwing", async () => {
    mockGet
      .mockResolvedValueOnce({ exists: () => false, val: () => null })
      .mockRejectedValueOnce(new Error("auth"))
    mockSet.mockResolvedValue(undefined)

    const result = await seedConceptsToReview(
      [
        { conceptId: "ok", frameworkSlug: "fw", conceptName: "Ok", conceptSlug: "ok" },
        { conceptId: "bad", frameworkSlug: "fw", conceptName: "Bad", conceptSlug: "bad" },
      ],
      0,
    )

    expect(result.seeded).toBe(1)
    expect(result.failed).toBe(1)
  })
})

describe("thresholds", () => {
  it("exports stable weak-stage threshold", () => {
    expect(WEAK_STAGE_SCORE_THRESHOLD).toBe(5)
  })
})
