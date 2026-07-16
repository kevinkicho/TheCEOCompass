import { describe, it, expect } from "vitest"
import type { ReviewRecord } from "@/lib/spaced-repetition"
import type { Framework } from "@/lib/types"
import {
  buildConceptIdToMasteryId,
  buildLearnerState,
  quizPctByFrameworkFromRows,
  scenarioScoresFromHistory,
} from "@/lib/mastery/learner-state"
import { nextActionHref, nextActionKindLabel } from "@/lib/mastery/recommendations"
import { pickNextActions, type MasteryGraph } from "@/lib/mastery"

function review(partial: Partial<ReviewRecord> & { conceptId: string }): ReviewRecord {
  return {
    frameworkSlug: "fw",
    conceptName: partial.conceptId,
    conceptSlug: partial.conceptSlug || partial.conceptId,
    reviewCount: 1,
    interval: 1,
    easeFactor: 2.5,
    lastReviewedAt: "2026-01-01T00:00:00.000Z",
    nextReviewAt: "2026-01-02T00:00:00.000Z",
    ...partial,
  }
}

describe("buildConceptIdToMasteryId", () => {
  it("maps UUID ids to slugify(name)", () => {
    const frameworks = [
      {
        slug: "strategic-decision-making",
        concepts: [
          { id: "uuid-1", name: "First Principles Thinking" },
          { id: "uuid-2", name: "OODA Loop" },
        ],
      },
    ] as Framework[]
    const map = buildConceptIdToMasteryId(frameworks)
    expect(map.get("uuid-1")).toBe("first-principles-thinking")
    expect(map.get("uuid-2")).toBe("ooda-loop")
    expect(map.get("first-principles-thinking")).toBe("first-principles-thinking")
  })
})

describe("quizPctByFrameworkFromRows", () => {
  it("keeps latest score by completed_at", () => {
    const map = quizPctByFrameworkFromRows([
      { framework_slug: "financial-mastery", pct: 40, completed_at: "2026-01-01T00:00:00.000Z" },
      { framework_slug: "financial-mastery", pct: 80, completed_at: "2026-06-01T00:00:00.000Z" },
      { framework_slug: "strategic-decision-making", score: 2, total: 4 },
    ])
    expect(map.get("financial-mastery")).toBe(80)
    expect(map.get("strategic-decision-making")).toBe(50)
  })

  it("ignores rows without framework", () => {
    const map = quizPctByFrameworkFromRows([{ pct: 90 }])
    expect(map.size).toBe(0)
  })
})

describe("scenarioScoresFromHistory", () => {
  it("uses mean stage score of latest attempt", () => {
    const map = scenarioScoresFromHistory({
      "pricing-crisis": {
        a1: {
          stages: [{ score: 40 }, { score: 60 }],
          completed_at: "2026-01-01T00:00:00.000Z",
        },
        a2: {
          stages: [{ score: 80 }, { score: 100 }],
          completed_at: "2026-03-01T00:00:00.000Z",
        },
      },
    })
    expect(map.get("pricing-crisis")).toBe(90)
  })

  it("handles null/empty", () => {
    expect(scenarioScoresFromHistory(null).size).toBe(0)
    expect(scenarioScoresFromHistory({}).size).toBe(0)
  })
})

describe("buildLearnerState", () => {
  it("keys reviewed once by conceptSlug; dual-keys only viewed", () => {
    const map = new Map([
      ["uuid-abc", "first-principles-thinking"],
      ["uuid-rev", "ebitda"],
      ["first-principles-thinking", "first-principles-thinking"],
      ["ebitda", "ebitda"],
    ])
    const state = buildLearnerState({
      reviews: [
        review({
          conceptId: "uuid-rev",
          conceptSlug: "ebitda",
          frameworkSlug: "financial-mastery",
        }),
      ],
      viewedTree: {
        "strategic-decision-making": {
          "uuid-abc": { viewed_at: "2026-01-01T00:00:00.000Z" },
        },
      },
      quizResults: [{ framework_slug: "financial-mastery", pct: 55 }],
      scenarioScores: new Map([["s1", 70]]),
      conceptIdToMasteryId: map,
    })

    // Single reviewed key (mastery id / conceptSlug) — not dual UUID+slug
    expect(state.reviewed.has("ebitda")).toBe(true)
    expect(state.reviewed.has("uuid-rev")).toBe(false)
    expect(state.reviewed.size).toBe(1)
    // viewed still has slug + storage UUID for isKnown
    expect(state.viewed.has("ebitda")).toBe(true)
    expect(state.viewed.has("uuid-rev")).toBe(true)
    expect(state.viewed.has("first-principles-thinking")).toBe(true)
    expect(state.viewed.has("uuid-abc")).toBe(true)
    expect(state.quizPctByFramework.get("financial-mastery")).toBe(55)
    expect(state.scenarioScores.get("s1")).toBe(70)
  })

  it("returns empty collections when no input", () => {
    const state = buildLearnerState()
    expect(state.viewed.size).toBe(0)
    expect(state.reviewed.size).toBe(0)
    expect(state.quizPctByFramework.size).toBe(0)
    expect(state.scenarioScores.size).toBe(0)
  })

  it("one ReviewRecord with conceptId !== conceptSlug yields one due_review", () => {
    const NOW = new Date("2026-06-01T00:00:00.000Z").getTime()
    const graph: MasteryGraph = {
      concepts: {
        ebitda: {
          id: "ebitda",
          frameworkSlug: "financial-mastery",
          conceptSlug: "ebitda",
        },
      },
      edges: [],
    }
    const state = buildLearnerState({
      reviews: [
        review({
          conceptId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          conceptSlug: "ebitda",
          frameworkSlug: "financial-mastery",
          nextReviewAt: "2026-05-01T00:00:00.000Z", // due
        }),
      ],
      conceptIdToMasteryId: new Map([
        ["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "ebitda"],
        ["ebitda", "ebitda"],
      ]),
    })

    expect(state.reviewed.size).toBe(1)
    const actions = pickNextActions(state, graph, 10, NOW)
    const due = actions.filter((a) => a.kind === "due_review")
    expect(due).toHaveLength(1)
    expect(due[0].conceptId).toBe("ebitda")
    expect(due[0].conceptSlug).toBe("ebitda")
    expect(due[0].frameworkSlug).toBe("financial-mastery")
  })
})

describe("nextAction UI helpers", () => {
  it("builds concept hrefs", () => {
    expect(
      nextActionHref({
        frameworkSlug: "financial-mastery",
        conceptSlug: "ebitda",
      }),
    ).toBe("/frameworks/financial-mastery/ebitda")
  })

  it("labels kinds", () => {
    expect(nextActionKindLabel("due_review")).toBe("Due for review")
    expect(nextActionKindLabel("prerequisite")).toBe("Prerequisite")
    expect(nextActionKindLabel("weak_quiz")).toBe("Strengthen")
    expect(nextActionKindLabel("explore")).toBe("Recommended concept")
  })
})
