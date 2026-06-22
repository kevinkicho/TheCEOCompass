export type ReviewRating = 0 | 1 | 2 | 3 | 4 | 5

export type ReviewRecord = {
  conceptId: string
  frameworkSlug: string
  conceptName: string
  conceptSlug: string
  reviewCount: number
  interval: number
  easeFactor: number
  lastReviewedAt: string
  nextReviewAt: string
}

const MS_PER_DAY = 86400000

export function sm2(
  prev: { interval: number; easeFactor: number; reviewCount: number },
  rating: ReviewRating,
): { interval: number; easeFactor: number; reviewCount: number } {
  const q = rating
  const prevEF = prev.easeFactor || 2.5
  const prevInterval = prev.interval || 0
  const prevCount = prev.reviewCount || 0

  if (q < 3) {
    return {
      interval: 1,
      easeFactor: Math.max(1.3, prevEF - 0.2),
      reviewCount: prevCount + 1,
    }
  }

  const newEF = Math.max(1.3, prevEF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
  let newInterval: number

  if (prevCount === 0) {
    newInterval = 1
  } else if (prevCount === 1) {
    newInterval = 6
  } else {
    newInterval = Math.round(prevInterval * newEF)
  }

  return {
    interval: newInterval,
    easeFactor: newEF,
    reviewCount: prevCount + 1,
  }
}

export function getNextReviewDate(
  lastReviewedAt: string,
  interval: number,
): string {
  return new Date(new Date(lastReviewedAt).getTime() + interval * MS_PER_DAY).toISOString()
}

export function isDueForReview(nextReviewAt: string): boolean {
  return new Date(nextReviewAt).getTime() <= Date.now()
}

export function getDaysUntilReview(nextReviewAt: string): number {
  return Math.ceil((new Date(nextReviewAt).getTime() - Date.now()) / MS_PER_DAY)
}

export function getReviewStatus(nextReviewAt: string): "overdue" | "due" | "soon" | "ok" {
  const days = getDaysUntilReview(nextReviewAt)
  if (days < 0) return "overdue"
  if (days === 0) return "due"
  if (days <= 2) return "soon"
  return "ok"
}