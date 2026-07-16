"use client"

import React, { useState, useEffect, useRef } from "react"
import { markConceptReviewed, loadReviewRecord } from "@/lib/firebase-crud"
import { getReviewStatus, getDaysUntilReview, type ReviewRating } from "@/lib/spaced-repetition"
import { canUseFirebasePersistence } from "@/lib/capabilities"

type ReviewSnap = { nextReviewAt: string; reviewCount: number; interval: number }

interface Props {
  frameworkSlug: string
  conceptId: string
  conceptName: string
  conceptSlug: string
  onError?: (message: string) => void
}

export function SpacedReviewBar({
  frameworkSlug,
  conceptId,
  conceptName,
  conceptSlug,
  onError,
}: Props) {
  const [reviewRecord, setReviewRecord] = useState<ReviewSnap | null>(null)
  const [showReviewRating, setShowReviewRating] = useState(false)
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const reviewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!conceptId || !canUseFirebasePersistence()) return
    loadReviewRecord(conceptId)
      .then((r) => {
        if (r) {
          setReviewRecord({
            nextReviewAt: r.nextReviewAt,
            reviewCount: r.reviewCount,
            interval: r.interval,
          })
        }
      })
      .catch(() => {})
  }, [conceptId])

  useEffect(
    () => () => {
      if (reviewTimeoutRef.current) clearTimeout(reviewTimeoutRef.current)
    },
    [],
  )

  if (!canUseFirebasePersistence()) return null

  return (
    <div className="mb-6 mt-8 rounded-xl border border-dark-200 dark:border-dark-700 p-4" data-testid="spaced-review-bar">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-semibold text-dark-400 dark:text-dark-400 uppercase tracking-wide">Spaced Repetition</p>
          {reviewRecord && (
            <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
              {["overdue", "due"].includes(getReviewStatus(reviewRecord.nextReviewAt)) ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  {getReviewStatus(reviewRecord.nextReviewAt) === "overdue" ? "Overdue for review" : "Due for review today"}
                </span>
              ) : (
                <span>
                  Next review in {getDaysUntilReview(reviewRecord.nextReviewAt)} day
                  {getDaysUntilReview(reviewRecord.nextReviewAt) === 1 ? "" : "s"}
                </span>
              )}
              {reviewRecord.reviewCount > 0 && (
                <span className="ml-2 text-dark-400 dark:text-dark-500">({reviewRecord.reviewCount} reviews)</span>
              )}
            </p>
          )}
        </div>
        {!showReviewRating ? (
          <button
            onClick={() => setShowReviewRating(true)}
            className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-700 transition"
          >
            Mark as Reviewed
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {([["Again", 0], ["Hard", 3], ["Good", 4], ["Easy", 5]] as [string, ReviewRating][]).map(
              ([label, rating]) => (
                <button
                  key={label}
                  onClick={async () => {
                    try {
                      const updated = await markConceptReviewed(
                        frameworkSlug,
                        conceptId,
                        conceptName,
                        conceptSlug,
                        rating,
                      )
                      setReviewRecord({
                        nextReviewAt: updated.nextReviewAt,
                        reviewCount: updated.reviewCount,
                        interval: updated.interval,
                      })
                      setShowReviewRating(false)
                      setReviewSubmitted(true)
                      reviewTimeoutRef.current = setTimeout(() => setReviewSubmitted(false), 3000)
                    } catch (err: unknown) {
                      setShowReviewRating(false)
                      onError?.(err instanceof Error ? err.message : "Failed to save review")
                    }
                  }}
                  className="rounded-lg border border-dark-200 dark:border-dark-700 px-3 py-1.5 text-xs font-medium text-dark-600 dark:text-dark-400 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition"
                >
                  {label}
                </button>
              ),
            )}
            <button
              onClick={() => setShowReviewRating(false)}
              className="rounded-lg text-xs text-dark-400 hover:text-red-500 transition px-2"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      {reviewSubmitted && reviewRecord && (
        <p className="text-xs text-green-600 dark:text-green-400 mt-2">
          Review saved! Next review in {reviewRecord.interval} day
          {reviewRecord.interval === 1 ? "" : "s"}.
        </p>
      )}
    </div>
  )
}
