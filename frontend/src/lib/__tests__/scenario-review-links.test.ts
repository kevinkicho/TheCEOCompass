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
  seedConceptDueNow,
  seedConceptsToReview,
  humanizeConceptSlug,
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

describe("humanizeConceptSlug", () => {
  it("title-cases hyphenated slugs for display fallback", () => {
    expect(humanizeConceptSlug("unit-economics")).toBe("Unit Economics")
    expect(humanizeConceptSlug("porter-s-five-forces")).toBe("Porter S Five Forces")
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

  it("resolves concept slugs via preferred framework_slugs with resolved:true", () => {
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
        resolved: true,
      },
      {
        conceptId: "c-fcf",
        frameworkSlug: "financial-mastery",
        conceptName: "Free Cash Flow",
        conceptSlug: "free-cash-flow",
        resolved: true,
      },
    ])
  })

  it("marks slug fallbacks as resolved:false (display-only, not writeable)", () => {
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
        resolved: false,
      },
    ])
  })

  it("uses unknown framework when no slugs or frameworks available", () => {
    const targets = resolveConceptsForReview(["ooda-loop"], undefined, null)
    expect(targets[0].frameworkSlug).toBe("unknown")
    expect(targets[0].conceptSlug).toBe("ooda-loop")
    expect(targets[0].resolved).toBe(false)
  })
})

describe("seedConceptDueNow / seedConceptsToReview", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a due-now learning card when no record exists", async () => {
    mockGet.mockResolvedValue({ exists: () => false, val: () => null })
    mockSet.mockResolvedValue(undefined)

    const record = await seedConceptDueNow({
      conceptId: "c1",
      frameworkSlug: "fw",
      conceptName: "N1",
      conceptSlug: "n1",
      resolved: true,
    })

    expect(record.interval).toBe(0)
    expect(record.reviewCount).toBe(0)
    expect(record.easeFactor).toBe(2.5)
    expect(new Date(record.nextReviewAt).getTime()).toBeLessThanOrEqual(Date.now() + 1000)
    expect(mockSet).toHaveBeenCalledTimes(1)
  })

  it("pulls mature card nextReviewAt forward without lengthening interval", async () => {
    const future = new Date(Date.now() + 86400000 * 60).toISOString()
    const mature = {
      conceptId: "c-mature",
      frameworkSlug: "fw",
      conceptName: "Mature",
      conceptSlug: "mature",
      reviewCount: 5,
      interval: 30,
      easeFactor: 2.5,
      lastReviewedAt: "2024-01-01T00:00:00.000Z",
      nextReviewAt: future,
    }
    mockGet.mockResolvedValue({ exists: () => true, val: () => mature })
    mockSet.mockResolvedValue(undefined)

    const record = await seedConceptDueNow({
      conceptId: "c-mature",
      frameworkSlug: "fw",
      conceptName: "Mature",
      conceptSlug: "mature",
      resolved: true,
    })

    // Critical: must not advance schedule the way Hard SM-2 grading would (30 → ~71)
    expect(record.interval).toBe(30)
    expect(record.easeFactor).toBe(2.5)
    expect(record.reviewCount).toBe(5)
    expect(new Date(record.nextReviewAt).getTime()).toBeLessThanOrEqual(Date.now() + 1000)
    expect(new Date(record.nextReviewAt).getTime()).toBeLessThan(new Date(future).getTime())
  })

  it("does not push already-due cards later", async () => {
    const past = new Date(Date.now() - 86400000).toISOString()
    const existing = {
      conceptId: "c-due",
      frameworkSlug: "fw",
      conceptName: "Due",
      conceptSlug: "due",
      reviewCount: 2,
      interval: 6,
      easeFactor: 2.4,
      lastReviewedAt: past,
      nextReviewAt: past,
    }
    mockGet.mockResolvedValue({ exists: () => true, val: () => existing })
    mockSet.mockResolvedValue(undefined)

    const record = await seedConceptDueNow({
      conceptId: "c-due",
      frameworkSlug: "fw",
      conceptName: "Due",
      conceptSlug: "due",
      resolved: true,
    })

    expect(record.interval).toBe(6)
    expect(record.nextReviewAt).toBe(past)
  })

  it("seeds resolved targets and skips slug-only fallbacks", async () => {
    mockGet.mockResolvedValue({ exists: () => false, val: () => null })
    mockSet.mockResolvedValue(undefined)

    const result = await seedConceptsToReview([
      {
        conceptId: "c1",
        frameworkSlug: "fw",
        conceptName: "N1",
        conceptSlug: "n1",
        resolved: true,
      },
      {
        conceptId: "unit-economics",
        frameworkSlug: "fw",
        conceptName: "Unit Economics",
        conceptSlug: "unit-economics",
        resolved: false,
      },
      {
        conceptId: "c2",
        frameworkSlug: "fw",
        conceptName: "N2",
        conceptSlug: "n2",
        resolved: true,
      },
    ])

    expect(result).toEqual({ seeded: 2, failed: 0, skipped: 1 })
    expect(mockSet).toHaveBeenCalledTimes(2)
  })

  it("counts failures without throwing", async () => {
    mockGet
      .mockResolvedValueOnce({ exists: () => false, val: () => null })
      .mockRejectedValueOnce(new Error("auth"))
    mockSet.mockResolvedValue(undefined)

    const result = await seedConceptsToReview([
      { conceptId: "ok", frameworkSlug: "fw", conceptName: "Ok", conceptSlug: "ok", resolved: true },
      { conceptId: "bad", frameworkSlug: "fw", conceptName: "Bad", conceptSlug: "bad", resolved: true },
    ])

    expect(result.seeded).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.skipped).toBe(0)
  })

  it("rejects seedConceptDueNow for unresolved targets", async () => {
    await expect(
      seedConceptDueNow({
        conceptId: "slug-only",
        frameworkSlug: "fw",
        conceptName: "Slug",
        conceptSlug: "slug-only",
        resolved: false,
      }),
    ).rejects.toThrow(/unresolved/i)
    expect(mockSet).not.toHaveBeenCalled()
  })
})

describe("thresholds", () => {
  it("exports stable weak-stage threshold", () => {
    expect(WEAK_STAGE_SCORE_THRESHOLD).toBe(5)
  })
})
