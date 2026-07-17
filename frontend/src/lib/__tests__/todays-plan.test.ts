import { describe, it, expect } from "vitest"
import { buildTodaysPlan } from "../learning/todays-plan"

describe("buildTodaysPlan", () => {
  it("includes review, concept, and scenario when learner has real progress", () => {
    const plan = buildTodaysPlan({
      dueReviews: [
        {
          conceptId: "c1",
          frameworkSlug: "fw",
          conceptName: "OODA Loop",
          conceptSlug: "ooda-loop",
          reviewCount: 1,
          interval: 1,
          easeFactor: 2.5,
          lastReviewedAt: new Date().toISOString(),
          nextReviewAt: new Date(Date.now() - 1000).toISOString(),
        },
      ],
      recommended: [
        {
          kind: "explore",
          conceptId: "x",
          frameworkSlug: "strategic-decision-making",
          conceptSlug: "first-principles-thinking",
          score: 10,
          reason: "High centrality",
        },
      ],
      scenarios: [
        {
          id: "s1",
          slug: "pricing-war-response",
          title: "Pricing War",
          description: "Compete",
          difficulty: 3,
          pack_id: "core",
        } as any,
      ],
    })
    expect(plan.empty).toBe(false)
    expect(plan.items).toHaveLength(3)
    expect(plan.items[0].kind).toBe("review")
    expect(plan.items[1].kind).toBe("concept")
    expect(plan.items[2].kind).toBe("scenario")
    expect(plan.items[0].href).toContain("/frameworks/")
  })

  it("returns empty with no filler cards when learner has no progress", () => {
    const plan = buildTodaysPlan({
      dueReviews: [],
      recommended: [],
      scenarios: [
        {
          id: "s1",
          slug: "pricing-war-response",
          title: "Pricing War",
          description: "Compete",
          difficulty: 3,
          pack_id: "core",
        } as any,
      ],
    })
    expect(plan.empty).toBe(true)
    expect(plan.items).toHaveLength(0)
  })

  it("short time budget caps to 2 items when progress exists", () => {
    const plan = buildTodaysPlan({
      dueReviews: [
        {
          conceptId: "c1",
          frameworkSlug: "fw",
          conceptName: "OODA",
          conceptSlug: "ooda",
          reviewCount: 1,
          interval: 1,
          easeFactor: 2.5,
          lastReviewedAt: new Date().toISOString(),
          nextReviewAt: new Date(Date.now() - 1000).toISOString(),
        },
      ],
      recommended: [
        {
          kind: "explore",
          conceptId: "x",
          frameworkSlug: "fw",
          conceptSlug: "concept",
          score: 1,
          reason: "r",
        },
      ],
      scenarios: [
        {
          id: "s1",
          slug: "s",
          title: "S",
          description: "d",
          difficulty: 2,
          pack_id: "core",
        } as any,
      ],
      prefs: { timeBudgetMinutes: 10 },
    })
    expect(plan.empty).toBe(false)
    expect(plan.items.length).toBeLessThanOrEqual(2)
  })
})
