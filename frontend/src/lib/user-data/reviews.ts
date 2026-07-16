import { ref, set, get } from "../firebase"
import { sm2, getNextReviewDate, type ReviewRating, type ReviewRecord } from "../spaced-repetition"
import { getDb, requireUid, userPath, dbOptional } from "./scope-helpers"

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
