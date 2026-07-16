import { ref, set, get } from "../firebase"
import { sm2, getNextReviewDate, type ReviewRating, type ReviewRecord } from "../spaced-repetition"
import { slugify } from "../rtdb-cache"
import type { ConceptReviewTarget, Framework } from "../types"
import { getDb, requireUid, userPath, dbOptional } from "./scope-helpers"
import { toLocalDayKey } from "./review-stats"

/** AI evaluate scores are 0–10. Below this is treated as a weak stage. */
export const WEAK_STAGE_SCORE_THRESHOLD = 5
/** Weak stages scoring below this map to Again intensity for messaging / future use. */
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
 * Suggested SM-2 intensity for weak scenario concepts (display / analytics only).
 * Seeding uses pull-forward due-now and does **not** apply this as a grade on existing cards.
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

/** Title-case a concept slug for display when the real name is unavailable. */
export function humanizeConceptSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/**
 * Map scenario `concept_ids` (concept slugs) to review targets.
 * Prefers frameworks listed in `framework_slugs`.
 * Fallback targets (`resolved: false`) are for display only — do not write them to reviews.
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
          const hasRealId = typeof c.id === "string" && c.id.length > 0
          return {
            conceptId: hasRealId ? c.id : conceptSlug,
            frameworkSlug: fw.slug,
            conceptName: c.name,
            conceptSlug: fromName || conceptSlug,
            resolved: hasRealId,
          }
        }
      }
    }
    return {
      conceptId: conceptSlug,
      frameworkSlug: frameworkSlugs?.[0] ?? "unknown",
      conceptName: humanizeConceptSlug(conceptSlug),
      conceptSlug,
      // Slug-keyed writes would orphan from concept-page SR (loads by UUID concept.id).
      resolved: false,
    }
  })
}

/**
 * Seed / pull-forward a single concept so it is due for review now.
 *
 * - **No existing record**: create a learning card due immediately (`interval: 0`, `reviewCount: 0`).
 *   This is not a graded SM-2 step.
 * - **Existing record**: only pull `nextReviewAt` forward to now when it is in the future.
 *   Never lengthens interval, never raises ease, never increments reviewCount.
 *
 * Used for "Add related concepts to review" after weak scenario stages.
 */
export async function seedConceptDueNow(target: ConceptReviewTarget): Promise<ReviewRecord> {
  if (!target.resolved) {
    throw new Error("Cannot seed unresolved concept (slug fallback only)")
  }

  const database = getDb()
  const uid = requireUid()
  const path = userPath(uid, "reviews", target.conceptId)
  const snap = await get(ref(database, path))
  const now = new Date().toISOString()

  if (!snap.exists()) {
    const record: ReviewRecord = {
      conceptId: target.conceptId,
      frameworkSlug: target.frameworkSlug,
      conceptName: target.conceptName,
      conceptSlug: target.conceptSlug,
      reviewCount: 0,
      interval: 0,
      easeFactor: 2.5,
      lastReviewedAt: now,
      nextReviewAt: now,
    }
    await set(ref(database, path), record)
    return record
  }

  const prev = snap.val() as ReviewRecord
  const prevNextMs = prev.nextReviewAt ? new Date(prev.nextReviewAt).getTime() : Number.POSITIVE_INFINITY
  // Pull forward only — never push the due date later
  const nextReviewAt = prevNextMs <= Date.now() ? prev.nextReviewAt : now

  const record: ReviewRecord = {
    conceptId: target.conceptId,
    frameworkSlug: target.frameworkSlug || prev.frameworkSlug,
    conceptName: target.conceptName || prev.conceptName,
    conceptSlug: target.conceptSlug || prev.conceptSlug,
    reviewCount: prev.reviewCount ?? 0,
    interval: prev.interval ?? 0,
    easeFactor: prev.easeFactor ?? 2.5,
    lastReviewedAt: prev.lastReviewedAt ?? now,
    nextReviewAt,
  }

  await set(ref(database, path), record)
  return record
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
  const nowDate = new Date()
  const now = nowDate.toISOString()
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

  // Durable review-day activity (survives lastReviewedAt overwrite on re-review)
  const dayKey = toLocalDayKey(nowDate)
  if (dayKey) {
    await set(ref(database, userPath(uid, "reviewActivity", dayKey)), true)
  }

  return record
}

/**
 * Seed SM-2 review records for weak-scenario concepts (due now / pull-forward).
 * Skips unresolved (slug-only) targets. Non-blocking: per-concept failures are counted, never thrown.
 */
export async function seedConceptsToReview(
  targets: ConceptReviewTarget[],
): Promise<{ seeded: number; failed: number; skipped: number }> {
  let seeded = 0
  let failed = 0
  let skipped = 0
  for (const t of targets) {
    if (!t.resolved) {
      skipped++
      continue
    }
    try {
      await seedConceptDueNow(t)
      seeded++
    } catch {
      failed++
    }
  }
  return { seeded, failed, skipped }
}

/**
 * Load local calendar days the user completed at least one spaced-repetition rating.
 * Path: `users/{uid}/reviewActivity/{YYYY-MM-DD} = true`
 */
export async function loadReviewActivityDays(): Promise<string[]> {
  const database = getDb()
  const uid = requireUid()
  const snap = await get(ref(database, userPath(uid, "reviewActivity")))
  if (!snap.exists()) return []
  const val = snap.val() as Record<string, unknown>
  return Object.keys(val).filter((k) => val[k] === true || val[k] === 1)
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
