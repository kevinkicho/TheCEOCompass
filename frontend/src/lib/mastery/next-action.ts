/**
 * Pure next-best-action engine for the mastery graph.
 *
 * Priority is **kind-primary** (not score-primary):
 *  1. Due spaced reviews
 *  2. Unblocking required-edge prerequisites (gap-fill + blockers for known dependents)
 *  3. Concepts in weak-quiz frameworks
 *  4. Unseen high-centrality concepts
 *
 * Within a kind, `score` ranks candidates. Score additives never override kind order.
 */

import type { ReviewRecord } from "../spaced-repetition"
import {
  computeCentrality,
  getConcept,
  getDependents,
  getPrerequisites,
  safeWeight,
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
  /** Higher = more urgent / valuable within the same kind. */
  score: number
  reason: string
}

/** Quiz % below this is treated as "weak" for prioritization. */
export const WEAK_QUIZ_THRESHOLD = 70

/** Kind rank: higher = higher priority. Sort uses this before score. */
export const KIND_RANK: Record<NextActionKind, number> = {
  due_review: 4,
  prerequisite: 3,
  weak_quiz: 2,
  explore: 1,
}

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
 * - Gap fill: prereqs of concepts the learner already knows
 * - Blockers: prereqs that unlock dependents the learner has already started
 *
 * Pure cold-start hubs (no known dependents) are NOT classified as prerequisite;
 * they surface via explore + centrality instead.
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
    const dependentMeta = resolveMeta(graph, conceptId)
    const dependentLabel = dependentMeta?.conceptSlug ?? conceptId
    for (const edge of getPrerequisites(graph, conceptId)) {
      if (isKnown(state, edge.to)) continue
      if (!graph.concepts[edge.to]) continue
      const w = safeWeight(edge.weight)
      const score = SCORE.prerequisite + w * 100
      const reason = `Required before ${dependentLabel}`
      const prev = candidateScores.get(edge.to)
      if (!prev || score > prev.score) {
        candidateScores.set(edge.to, { score, reason })
      }
    }
  }

  // Blockers: unknown prereqs that unlock dependents the learner has started
  for (const conceptId of Object.keys(graph.concepts)) {
    if (isKnown(state, conceptId)) continue
    const dependents = getDependents(graph, conceptId).filter((e) => isKnown(state, e.from))
    if (dependents.length === 0) continue

    const weightSum = dependents.reduce((s, e) => s + safeWeight(e.weight), 0)
    const score = SCORE.prerequisite - 50 + weightSum * 40 + dependents.length * 10
    const topDep = dependents.slice().sort((a, b) => safeWeight(b.weight) - safeWeight(a.weight))[0]
    const topLabel = resolveMeta(graph, topDep.from)?.conceptSlug ?? topDep.from
    const reason = `Unlocks ${dependents.length} started concept${dependents.length === 1 ? "" : "s"} (e.g. ${topLabel})`
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
  centrality: Map<string, number>,
  out: NextAction[],
): void {
  for (const [frameworkSlug, pct] of state.quizPctByFramework) {
    if (typeof pct !== "number" || !Number.isFinite(pct)) continue
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
  centrality: Map<string, number>,
  out: NextAction[],
): void {
  for (const concept of Object.values(graph.concepts)) {
    // Unseen = not viewed and not reviewed
    if (isKnown(state, concept.id)) continue
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
 * Compare actions: kind rank first (due > prereq > weak > explore), then score within kind.
 * Returns negative if `a` should rank above `b`.
 */
export function compareNextActions(a: NextAction, b: NextAction): number {
  const kindDiff = KIND_RANK[b.kind] - KIND_RANK[a.kind]
  if (kindDiff !== 0) return kindDiff
  // Higher score first within kind; NaN scores sort last
  const sa = Number.isFinite(a.score) ? a.score : Number.NEGATIVE_INFINITY
  const sb = Number.isFinite(b.score) ? b.score : Number.NEGATIVE_INFINITY
  return sb - sa
}

/** Prefer higher kind even when score is lower (kind-primary dedupe). */
function prefersOver(candidate: NextAction, existing: NextAction): boolean {
  const kr = KIND_RANK[candidate.kind] - KIND_RANK[existing.kind]
  if (kr !== 0) return kr > 0
  const sa = Number.isFinite(candidate.score) ? candidate.score : Number.NEGATIVE_INFINITY
  const sb = Number.isFinite(existing.score) ? existing.score : Number.NEGATIVE_INFINITY
  return sa > sb
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

  const centrality = computeCentrality(graph)
  const raw: NextAction[] = []
  collectDueReviews(state, graph, nowMs, raw)
  collectPrerequisites(state, graph, raw)
  collectWeakQuiz(state, graph, centrality, raw)
  collectExplore(state, graph, centrality, raw)

  // Dedupe by conceptId — keep higher kind first, then higher score
  const best = new Map<string, NextAction>()
  for (const action of raw) {
    const prev = best.get(action.conceptId)
    if (!prev || prefersOver(action, prev)) {
      best.set(action.conceptId, action)
    }
  }

  return Array.from(best.values())
    .sort(compareNextActions)
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
