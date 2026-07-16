/**
 * Pure next-best-action engine for the mastery graph.
 *
 * Priority (highest first):
 *  1. Due spaced reviews
 *  2. Unblocking required-edge prerequisites
 *  3. Concepts in weak-quiz frameworks
 *  4. Unseen high-centrality concepts
 */

import type { ReviewRecord } from "../spaced-repetition"
import {
  computeCentrality,
  getConcept,
  getDependents,
  getPrerequisites,
} from "./graph"
import type { MasteryGraph } from "./types"

/** Snapshot of learner progress used by pickNextActions. */
export type LearnerState = {
  /** Concept ids the learner has opened / viewed. */
  viewed: Set<string>
  /** SM-2 review records keyed by conceptId. */
  reviewed: Map<string, ReviewRecord>
  /** Latest quiz score percent (0–100) by framework slug. */
  quizPctByFramework: Map<string, number>
  /** Optional scenario scores by scenario slug (reserved for later weighting). */
  scenarioScores: Map<string, number>
}

export type NextActionKind =
  | "due_review"
  | "prerequisite"
  | "weak_quiz"
  | "explore"

export type NextAction = {
  kind: NextActionKind
  conceptId: string
  frameworkSlug: string
  conceptSlug: string
  /** Higher = more urgent / valuable. Used for ranking only. */
  score: number
  reason: string
}

/** Quiz % below this is treated as "weak" for prioritization. */
export const WEAK_QUIZ_THRESHOLD = 70

const SCORE = {
  dueReview: 1000,
  prerequisite: 800,
  weakQuiz: 500,
  explore: 100,
} as const

function isKnown(state: LearnerState, conceptId: string): boolean {
  return state.viewed.has(conceptId) || state.reviewed.has(conceptId)
}

function resolveMeta(
  graph: MasteryGraph,
  conceptId: string,
  review?: ReviewRecord,
): { frameworkSlug: string; conceptSlug: string } | null {
  const node = getConcept(graph, conceptId)
  if (node) {
    return { frameworkSlug: node.frameworkSlug, conceptSlug: node.conceptSlug }
  }
  if (review?.frameworkSlug && review?.conceptSlug) {
    return { frameworkSlug: review.frameworkSlug, conceptSlug: review.conceptSlug }
  }
  return null
}

function collectDueReviews(
  state: LearnerState,
  graph: MasteryGraph,
  nowMs: number,
  out: NextAction[],
): void {
  for (const [conceptId, rec] of state.reviewed) {
    if (!rec.nextReviewAt) continue
    const dueAt = new Date(rec.nextReviewAt).getTime()
    if (Number.isNaN(dueAt) || dueAt > nowMs) continue

    const meta = resolveMeta(graph, conceptId, rec)
    if (!meta) continue

    const overdueDays = Math.max(0, (nowMs - dueAt) / 86_400_000)
    out.push({
      kind: "due_review",
      conceptId,
      frameworkSlug: meta.frameworkSlug,
      conceptSlug: meta.conceptSlug,
      score: SCORE.dueReview + overdueDays,
      reason: overdueDays >= 1
        ? `Review overdue by ${Math.floor(overdueDays)}d`
        : "Due for spaced review",
    })
  }
}

/**
 * Recommend unknown prerequisites that unblock progress:
 * - Prereqs of concepts the learner already knows (gap fill)
 * - Prereqs that unlock many dependents (high leverage blockers)
 */
function collectPrerequisites(
  state: LearnerState,
  graph: MasteryGraph,
  out: NextAction[],
): void {
  const candidateScores = new Map<string, { score: number; reason: string }>()

  // Gap fill: known concept missing a required prereq
  for (const conceptId of Object.keys(graph.concepts)) {
    if (!isKnown(state, conceptId)) continue
    for (const edge of getPrerequisites(graph, conceptId)) {
      if (isKnown(state, edge.to)) continue
      if (!graph.concepts[edge.to]) continue
      const score = SCORE.prerequisite + edge.weight * 100
      const reason = `Required before ${conceptId}`
      const prev = candidateScores.get(edge.to)
      if (!prev || score > prev.score) {
        candidateScores.set(edge.to, { score, reason })
      }
    }
  }

  // Blockers: unknown prereqs with dependents (prefer high weight + many unlocks)
  for (const conceptId of Object.keys(graph.concepts)) {
    if (isKnown(state, conceptId)) continue
    const dependents = getDependents(graph, conceptId)
    if (dependents.length === 0) continue

    const weightSum = dependents.reduce((s, e) => s + e.weight, 0)
    const score = SCORE.prerequisite - 50 + weightSum * 40 + dependents.length * 10
    const topDep = dependents.slice().sort((a, b) => b.weight - a.weight)[0]
    const reason = `Unlocks ${dependents.length} concept${dependents.length === 1 ? "" : "s"} (e.g. ${topDep.from})`
    const prev = candidateScores.get(conceptId)
    if (!prev || score > prev.score) {
      candidateScores.set(conceptId, { score, reason })
    }
  }

  for (const [conceptId, { score, reason }] of candidateScores) {
    const meta = resolveMeta(graph, conceptId)
    if (!meta) continue
    out.push({
      kind: "prerequisite",
      conceptId,
      frameworkSlug: meta.frameworkSlug,
      conceptSlug: meta.conceptSlug,
      score,
      reason,
    })
  }
}

function collectWeakQuiz(
  state: LearnerState,
  graph: MasteryGraph,
  out: NextAction[],
): void {
  const centrality = computeCentrality(graph)

  for (const [frameworkSlug, pct] of state.quizPctByFramework) {
    if (typeof pct !== "number" || Number.isNaN(pct)) continue
    if (pct >= WEAK_QUIZ_THRESHOLD) continue

    const deficit = WEAK_QUIZ_THRESHOLD - pct
    for (const concept of Object.values(graph.concepts)) {
      if (concept.frameworkSlug !== frameworkSlug) continue
      // Prefer not-yet-known; still surface known weak-framework concepts at lower score
      const knownPenalty = isKnown(state, concept.id) ? 80 : 0
      const c = centrality.get(concept.id) ?? 0
      out.push({
        kind: "weak_quiz",
        conceptId: concept.id,
        frameworkSlug: concept.frameworkSlug,
        conceptSlug: concept.conceptSlug,
        score: SCORE.weakQuiz + deficit + c * 10 - knownPenalty,
        reason: `Strengthen ${frameworkSlug} (quiz ${Math.round(pct)}%)`,
      })
    }
  }
}

function collectExplore(
  state: LearnerState,
  graph: MasteryGraph,
  out: NextAction[],
): void {
  const centrality = computeCentrality(graph)
  for (const concept of Object.values(graph.concepts)) {
    if (state.viewed.has(concept.id)) continue
    const c = centrality.get(concept.id) ?? 0
    out.push({
      kind: "explore",
      conceptId: concept.id,
      frameworkSlug: concept.frameworkSlug,
      conceptSlug: concept.conceptSlug,
      score: SCORE.explore + c * 50,
      reason: c > 0 ? "High-centrality concept to explore" : "Unseen concept",
    })
  }
}

/**
 * Rank and return up to `limit` next actions for the learner.
 * Pure: no I/O. Pass `nowMs` for deterministic due-review tests.
 */
export function pickNextActions(
  state: LearnerState,
  graph: MasteryGraph,
  limit: number,
  nowMs: number = Date.now(),
): NextAction[] {
  if (limit <= 0) return []

  const raw: NextAction[] = []
  collectDueReviews(state, graph, nowMs, raw)
  collectPrerequisites(state, graph, raw)
  collectWeakQuiz(state, graph, raw)
  collectExplore(state, graph, raw)

  // Dedupe by conceptId — keep highest score (and prefer higher-priority kinds on ties)
  const kindRank: Record<NextActionKind, number> = {
    due_review: 4,
    prerequisite: 3,
    weak_quiz: 2,
    explore: 1,
  }
  const best = new Map<string, NextAction>()
  for (const action of raw) {
    const prev = best.get(action.conceptId)
    if (!prev) {
      best.set(action.conceptId, action)
      continue
    }
    if (
      action.score > prev.score ||
      (action.score === prev.score && kindRank[action.kind] > kindRank[prev.kind])
    ) {
      best.set(action.conceptId, action)
    }
  }

  return Array.from(best.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return kindRank[b.kind] - kindRank[a.kind]
    })
    .slice(0, limit)
}

/** Empty learner state helper for tests and cold-start callers. */
export function emptyLearnerState(): LearnerState {
  return {
    viewed: new Set(),
    reviewed: new Map(),
    quizPctByFramework: new Map(),
    scenarioScores: new Map(),
  }
}
