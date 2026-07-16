/**
 * Build LearnerState from user-data snapshots for the next-action engine.
 * Pure helpers here; I/O lives in loadMasteryRecommendations.
 */

import type { Framework } from "../types"
import type { ReviewRecord } from "../spaced-repetition"
import { slugify } from "../rtdb-cache"
import { emptyLearnerState, type LearnerState } from "./next-action"

/** RTDB users/{uid}/viewed shape: frameworkSlug → conceptKey → { viewed_at }. */
export type ViewedTree = Record<string, Record<string, { viewed_at?: string } | undefined> | undefined>

/** RTDB quizResults row (id → row). */
export type QuizResultRow = {
  framework_slug?: string
  pct?: number
  score?: number
  total?: number
  completed_at?: string
}

/**
 * Map storage concept keys (often UUIDs from concept.id) → mastery concept ids
 * (slugify(name) / conceptSlug), matching mastery graph node ids.
 */
export function buildConceptIdToMasteryId(frameworks: Framework[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const fw of frameworks) {
    for (const c of fw.concepts || []) {
      if (!c) continue
      const masteryId = c.name ? slugify(c.name) : ""
      if (!masteryId) continue
      if (c.id) map.set(c.id, masteryId)
      // identity mapping so slug keys stay as-is
      map.set(masteryId, masteryId)
    }
  }
  return map
}

function resolveMasteryId(
  key: string,
  conceptIdToMasteryId?: Map<string, string>,
): string {
  return conceptIdToMasteryId?.get(key) ?? key
}

/**
 * Latest quiz % per framework (by completed_at when present; otherwise last wins).
 * Falls back to score/total when pct missing.
 */
export function quizPctByFrameworkFromRows(rows: QuizResultRow[]): Map<string, number> {
  type Entry = { pct: number; at: number }
  const best = new Map<string, Entry>()

  for (const row of rows) {
    const slug = row.framework_slug
    if (!slug) continue
    let pct = typeof row.pct === "number" && Number.isFinite(row.pct) ? row.pct : NaN
    if (!Number.isFinite(pct) && typeof row.score === "number" && typeof row.total === "number" && row.total > 0) {
      pct = Math.round((row.score / row.total) * 100)
    }
    if (!Number.isFinite(pct)) continue
    const at = row.completed_at ? new Date(row.completed_at).getTime() : 0
    const prev = best.get(slug)
    if (!prev || at >= prev.at) {
      best.set(slug, { pct, at: Number.isFinite(at) ? at : 0 })
    }
  }

  const out = new Map<string, number>()
  for (const [k, v] of best) out.set(k, v.pct)
  return out
}

/**
 * scenarioHistory/{slug}/{attemptId} → { stages, completed_at }.
 * Score = mean of stage.score on the latest attempt, scaled as-is (typically 0–100).
 */
export function scenarioScoresFromHistory(
  history: Record<string, Record<string, { stages?: { score?: number }[]; completed_at?: string }> | undefined> | null | undefined,
): Map<string, number> {
  const out = new Map<string, number>()
  if (!history || typeof history !== "object") return out

  for (const [scenarioSlug, attempts] of Object.entries(history)) {
    if (!attempts || typeof attempts !== "object") continue
    let latestAt = -1
    let latestScore: number | null = null
    for (const attempt of Object.values(attempts)) {
      if (!attempt || typeof attempt !== "object") continue
      const at = attempt.completed_at ? new Date(attempt.completed_at).getTime() : 0
      const stages = attempt.stages || []
      if (stages.length === 0) continue
      const scores = stages.map((s) => (typeof s?.score === "number" && Number.isFinite(s.score) ? s.score : 0))
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length
      if (at >= latestAt) {
        latestAt = Number.isFinite(at) ? at : 0
        latestScore = mean
      }
    }
    if (latestScore != null) out.set(scenarioSlug, latestScore)
  }
  return out
}

export type BuildLearnerStateInput = {
  reviews?: ReviewRecord[]
  viewedTree?: ViewedTree | null
  quizResults?: QuizResultRow[]
  scenarioScores?: Map<string, number>
  /** UUID / storage key → mastery concept id (slug). */
  conceptIdToMasteryId?: Map<string, string>
}

/**
 * Pure: assemble LearnerState aligned with mastery graph concept ids (slugs).
 *
 * `reviewed` is keyed **once** by the mastery graph id (prefer conceptSlug, then
 * UUID→slug map, then raw conceptId). Dual-keying would emit duplicate due_review
 * actions because pickNextActions dedupes only by map key / action.conceptId.
 *
 * `viewed` may still include both UUID and slug so isKnown works either way.
 */
export function buildLearnerState(input: BuildLearnerStateInput = {}): LearnerState {
  const state = emptyLearnerState()
  const map = input.conceptIdToMasteryId

  for (const rec of input.reviews || []) {
    if (!rec) continue
    const mappedFromId = rec.conceptId ? resolveMasteryId(rec.conceptId, map) : ""
    // Single key: mastery/graph id first so collectDueReviews emits one action per record
    const masteryKey =
      (rec.conceptSlug && rec.conceptSlug.trim()) ||
      (mappedFromId && mappedFromId !== rec.conceptId ? mappedFromId : "") ||
      rec.conceptId ||
      ""
    if (!masteryKey) continue

    state.reviewed.set(masteryKey, rec)
    state.viewed.add(masteryKey)
    if (rec.conceptId && rec.conceptId !== masteryKey) {
      state.viewed.add(rec.conceptId)
    }
    if (mappedFromId && mappedFromId !== masteryKey) {
      state.viewed.add(mappedFromId)
    }
  }

  const tree = input.viewedTree
  if (tree && typeof tree === "object") {
    for (const fw of Object.keys(tree)) {
      const concepts = tree[fw]
      if (!concepts || typeof concepts !== "object") continue
      for (const cid of Object.keys(concepts)) {
        if (cid === "viewed_at") continue
        state.viewed.add(cid)
        const mapped = resolveMasteryId(cid, map)
        if (mapped) state.viewed.add(mapped)
      }
    }
  }

  if (input.quizResults?.length) {
    for (const [fw, pct] of quizPctByFrameworkFromRows(input.quizResults)) {
      state.quizPctByFramework.set(fw, pct)
    }
  }

  if (input.scenarioScores) {
    for (const [k, v] of input.scenarioScores) {
      state.scenarioScores.set(k, v)
    }
  }

  return state
}
