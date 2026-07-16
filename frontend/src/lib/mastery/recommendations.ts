/**
 * Load graph + user progress and return pickNextActions results.
 */

import { db, ref, get } from "../firebase"
import { loadFrameworks } from "../rtdb-cache"
import { tryUid, userPath, loadAllReviews } from "../user-data"
import { loadMasteryGraph } from "./load"
import { pickNextActions, type NextAction } from "./next-action"
import {
  buildConceptIdToMasteryId,
  buildLearnerState,
  scenarioScoresFromHistory,
  type QuizResultRow,
  type ViewedTree,
} from "./learner-state"

export const DEFAULT_RECOMMENDATION_LIMIT = 4

/**
 * Fetch learner progress from RTDB (best-effort) and rank next actions.
 * Works with empty progress (cold start → explore via centrality).
 * Does not check feature flags — callers gate on mastery_graph_enabled.
 */
export async function loadMasteryRecommendations(
  limit: number = DEFAULT_RECOMMENDATION_LIMIT,
  nowMs: number = Date.now(),
): Promise<NextAction[]> {
  if (limit <= 0) return []

  const uid = tryUid()

  const graphPromise = loadMasteryGraph()
  const frameworksPromise = loadFrameworks().catch(() => [])
  const reviewsPromise =
    uid && db
      ? loadAllReviews().catch(() => [])
      : Promise.resolve([])

  let viewedTree: ViewedTree | null = null
  let quizResults: QuizResultRow[] = []
  let scenarioScores = new Map<string, number>()

  if (uid && db) {
    const [viewedSnap, quizSnap, scenarioSnap] = await Promise.all([
      get(ref(db, userPath(uid, "viewed"))).catch(() => null),
      get(ref(db, userPath(uid, "quizResults"))).catch(() => null),
      get(ref(db, userPath(uid, "scenarioHistory"))).catch(() => null),
    ])
    if (viewedSnap?.exists()) {
      viewedTree = viewedSnap.val() as ViewedTree
    }
    if (quizSnap?.exists()) {
      quizResults = Object.values(quizSnap.val() as Record<string, QuizResultRow>)
    }
    if (scenarioSnap?.exists()) {
      scenarioScores = scenarioScoresFromHistory(
        scenarioSnap.val() as Parameters<typeof scenarioScoresFromHistory>[0],
      )
    }
  }

  const [graph, frameworks, reviews] = await Promise.all([
    graphPromise,
    frameworksPromise,
    reviewsPromise,
  ])

  const conceptIdToMasteryId = buildConceptIdToMasteryId(frameworks as Parameters<typeof buildConceptIdToMasteryId>[0])
  const state = buildLearnerState({
    reviews,
    viewedTree,
    quizResults,
    scenarioScores,
    conceptIdToMasteryId,
  })

  return pickNextActions(state, graph, limit, nowMs)
}

/** Human label for NextAction.kind (UI). */
export function nextActionKindLabel(kind: NextAction["kind"]): string {
  switch (kind) {
    case "due_review":
      return "Due for review"
    case "prerequisite":
      return "Prerequisite"
    case "weak_quiz":
      return "Strengthen"
    case "explore":
      return "Recommended concept"
    default:
      return "Recommended concept"
  }
}

export function nextActionHref(action: Pick<NextAction, "frameworkSlug" | "conceptSlug">): string {
  return `/frameworks/${action.frameworkSlug}/${action.conceptSlug}`
}
