import { ref, set, get } from "../firebase"
import { sm2, getNextReviewDate, type ReviewRating, type ReviewRecord } from "../spaced-repetition"
import { slugify } from "../rtdb-cache"
import type { ConceptReviewTarget, Framework } from "../types"
import { getDb, requireUid, userPath, dbOptional } from "./scope-helpers"

/** AI evaluate scores are 0–10. Below this is treated as a weak stage. */
export const WEAK_STAGE_SCORE_THRESHOLD = 5
/** Weak stages scoring below this seed as Again (0); otherwise Hard (3). */
export const AGAIN_STAGE_SCORE_THRESHOLD = 3

export function isWeakStageScore(
  score0to10: number,
  threshold: number = WEAK_STAGE_SCORE_THRESHOLD,
): boolean {
  return Number.isFinite(score0to10) && score0to10 < threshold
}

export function hasWeakStages(
  stages: Array<{ score: number }>,
  threshold: number = WEAK_STAGE_SCORE_THRESHOLD,
): boolean {
  return stages.some((s) => isWeakStageScore(s.score, threshold))
}

/** True when the scenario has linked concepts and at least one weak stage score. */
export function shouldOfferConceptReview(
  stages: Array<{ score: number }>,
  conceptIds: string[] | undefined | null,
): boolean {
  return (conceptIds?.length ?? 0) > 0 && hasWeakStages(stages)
}

/**
 * SM-2 rating for seeding weak scenario concepts:
 * - null when no weak stages
 * - 0 (Again) when the weakest stage is very low
 * - 3 (Hard) otherwise
 */
export function ratingForWeakStages(
  stages: Array<{ score: number }>,
  weakThreshold: number = WEAK_STAGE_SCORE_THRESHOLD,
  againThreshold: number = AGAIN_STAGE_SCORE_THRESHOLD,
): ReviewRating | null {
  const weak = stages.filter((s) => isWeakStageScore(s.score, weakThreshold))
  if (weak.length === 0) return null
  const min = Math.min(...weak.map((s) => s.score))
  return min < againThreshold ? 0 : 3
}

function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/**
 * Map scenario `concept_ids` (concept slugs) to review targets.
 * Prefers frameworks listed in `framework_slugs`. Falls back to slug-based
 * targets when frameworks are unavailable so seeding can still proceed.
 */
export function resolveConceptsForReview(
  conceptIds: string[],
  frameworkSlugs: string[] | undefined | null,
  frameworks: Framework[] | null | undefined,
): ConceptReviewTarget[] {
  const preferred = new Set(frameworkSlugs ?? [])
  const fws = frameworks ?? []
  const ordered = [
    ...fws.filter((f) => preferred.has(f.slug)),
    ...fws.filter((f) => !preferred.has(f.slug)),
  ]

  return conceptIds.map((conceptSlug) => {
    for (const fw of ordered) {
      for (const c of fw.concepts ?? []) {
        const fromName = slugify(c.name)
        if (fromName === conceptSlug || c.id === conceptSlug) {
          return {
            conceptId: c.id || conceptSlug,
            frameworkSlug: fw.slug,
            conceptName: c.name,
            conceptSlug: fromName || conceptSlug,
          }
        }
      }
    }
    return {
      conceptId: conceptSlug,
      frameworkSlug: frameworkSlugs?.[0] ?? "unknown",
      conceptName: humanizeSlug(conceptSlug),
      conceptSlug,
    }
  })
}

export async function markConceptReviewed(
  frameworkSlug: string,
  conceptId: string,
  conceptName: string,
  conceptSlug: string,
  rating: ReviewRating,
): Promise<ReviewRecord> {
  const database = getDb()
  const uid = requireUid()
  const path = userPath(uid, "reviews", conceptId)
  const snap = await get(ref(database, path))
  const prev = snap.exists()
    ? snap.val()
    : { interval: 0, easeFactor: 2.5, reviewCount: 0, lastReviewedAt: new Date().toISOString() }

  const updated = sm2(
    {
      interval: prev.interval || 0,
      easeFactor: prev.easeFactor || 2.5,
      reviewCount: prev.reviewCount || 0,
    },
    rating,
  )
  const now = new Date().toISOString()
  const nextReviewAt = getNextReviewDate(now, updated.interval)

  const record: ReviewRecord = {
    conceptId,
    frameworkSlug,
    conceptName,
    conceptSlug,
    reviewCount: updated.reviewCount,
    interval: updated.interval,
    easeFactor: updated.easeFactor,
    lastReviewedAt: now,
    nextReviewAt,
  }

  await set(ref(database, path), record)
  return record
}

/**
 * Seed SM-2 review records for weak-scenario concepts.
 * Non-blocking: per-concept failures are counted, never thrown.
 */
export async function seedConceptsToReview(
  targets: ConceptReviewTarget[],
  rating: ReviewRating,
): Promise<{ seeded: number; failed: number }> {
  let seeded = 0
  let failed = 0
  for (const t of targets) {
    try {
      await markConceptReviewed(
        t.frameworkSlug,
        t.conceptId,
        t.conceptName,
        t.conceptSlug,
        rating,
      )
      seeded++
    } catch {
      failed++
    }
  }
  return { seeded, failed }
}

export async function loadDueReviews(): Promise<ReviewRecord[]> {
  const database = getDb()
  const uid = requireUid()
  const snap = await get(ref(database, userPath(uid, "reviews")))
  if (!snap.exists()) return []
  const val = snap.val()
  return Object.values(val).filter((r: unknown) => {
    const rec = r as ReviewRecord
    if (!rec.nextReviewAt) return false
    return new Date(rec.nextReviewAt).getTime() <= Date.now()
  }) as ReviewRecord[]
}

export async function loadAllReviews(): Promise<ReviewRecord[]> {
  const database = getDb()
  const uid = requireUid()
  const snap = await get(ref(database, userPath(uid, "reviews")))
  if (!snap.exists()) return []
  return Object.values(snap.val()) as ReviewRecord[]
}

export async function loadReviewRecord(conceptId: string): Promise<ReviewRecord | null> {
  const database = getDb()
  const uid = requireUid()
  const snap = await get(ref(database, userPath(uid, "reviews", conceptId)))
  if (!snap.exists()) return null
  return snap.val() as ReviewRecord
}

export async function markConceptViewed(frameworkSlug: string, conceptId: string): Promise<void> {
  const database = dbOptional()
  if (!database) return
  const uid = requireUid()
  await set(ref(database, userPath(uid, "viewed", frameworkSlug, conceptId)), {
    viewed_at: new Date().toISOString(),
  })
}

export async function loadFrameworkProgress(frameworkSlug: string): Promise<string[]> {
  const database = dbOptional()
  if (!database) return []
  const uid = requireUid()
  const snap = await get(ref(database, userPath(uid, "viewed", frameworkSlug)))
  if (!snap.exists()) return []
  const val = snap.val()
  return Object.keys(val).filter((k) => k !== "viewed_at")
}
