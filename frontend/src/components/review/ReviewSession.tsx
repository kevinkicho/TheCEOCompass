"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { loadDueReviews, markConceptReviewed } from "@/lib/firebase-crud"
import { canUseFirebasePersistence } from "@/lib/capabilities"
import { useAuthSession } from "@/lib/AuthSessionProvider"
import { SkeletonCard } from "@/components/SkeletonCard"
import type { ReviewRating, ReviewRecord } from "@/lib/spaced-repetition"

export type SessionRatingLabel = "Again" | "Hard" | "Good" | "Easy"

export const SESSION_RATING_OPTIONS: { label: SessionRatingLabel; rating: ReviewRating; key: string }[] = [
  { label: "Again", rating: 0, key: "1" },
  { label: "Hard", rating: 3, key: "2" },
  { label: "Good", rating: 4, key: "3" },
  { label: "Easy", rating: 5, key: "4" },
]

export type SessionResult = {
  conceptId: string
  conceptName: string
  frameworkSlug: string
  label: SessionRatingLabel
  rating: ReviewRating
  interval: number
}

type Phase = "loading" | "empty" | "active" | "summary" | "error"

function formatFrameworkSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (target.isContentEditable) return true
  return false
}

export function ReviewSession() {
  const { ready: authReady } = useAuthSession()
  const [phase, setPhase] = useState<Phase>("loading")
  const [queue, setQueue] = useState<ReviewRecord[]>([])
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<SessionResult[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  /** Synchronous submit lock — React state alone cannot block same-tick double rates. */
  const submittingRef = useRef(false)
  const phaseRef = useRef<Phase>("loading")
  const indexRef = useRef(0)
  const queueRef = useRef<ReviewRecord[]>([])

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])
  useEffect(() => {
    indexRef.current = index
  }, [index])
  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    if (!canUseFirebasePersistence()) {
      setPhase("error")
      phaseRef.current = "error"
      setError("Firebase is unavailable. Review sessions need persistence enabled.")
      return
    }
    if (!authReady) return

    let cancelled = false
    setPhase("loading")
    phaseRef.current = "loading"
    loadDueReviews()
      .then((due) => {
        if (cancelled) return
        if (!due.length) {
          setQueue([])
          queueRef.current = []
          setPhase("empty")
          phaseRef.current = "empty"
          return
        }
        setQueue(due)
        queueRef.current = due
        setIndex(0)
        indexRef.current = 0
        setResults([])
        setPhase("active")
        phaseRef.current = "active"
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load due reviews")
        setPhase("error")
        phaseRef.current = "error"
      })

    return () => {
      cancelled = true
    }
  }, [authReady])

  const current = phase === "active" ? queue[index] : undefined
  const total = queue.length

  const rate = useCallback(async (label: SessionRatingLabel, rating: ReviewRating) => {
    // Sync lock first — prevents double markConceptReviewed / skip / crash on rapid input
    if (submittingRef.current) return
    if (phaseRef.current !== "active") return
    const card = queueRef.current[indexRef.current]
    if (!card) return

    submittingRef.current = true
    setSubmitting(true)
    setError("")
    try {
      const updated = await markConceptReviewed(
        card.frameworkSlug,
        card.conceptId,
        card.conceptName,
        card.conceptSlug,
        rating,
      )
      const entry: SessionResult = {
        conceptId: card.conceptId,
        conceptName: card.conceptName,
        frameworkSlug: card.frameworkSlug,
        label,
        rating,
        interval: updated.interval,
      }
      setResults((prev) => [...prev, entry])

      const nextIndex = indexRef.current + 1
      if (nextIndex >= queueRef.current.length) {
        phaseRef.current = "summary"
        setPhase("summary")
      } else {
        indexRef.current = nextIndex
        setIndex(nextIndex)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save review")
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }, [])

  useEffect(() => {
    if (phase !== "active") return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isEditableKeyboardTarget(e.target)) return
      const option = SESSION_RATING_OPTIONS.find((o) => o.key === e.key)
      if (!option) return
      e.preventDefault()
      void rate(option.label, option.rating)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [phase, rate])

  if (phase === "loading" || !authReady) {
    return (
      <div data-testid="review-session-loading">
        <SkeletonCard lines={4} />
      </div>
    )
  }

  if (phase === "error") {
    return (
      <div
        className="rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/20 p-5"
        data-testid="review-session-error"
        role="alert"
      >
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <a
          href="/review"
          className="mt-3 inline-block text-xs font-medium text-red-700 dark:text-red-300 underline"
        >
          Back to Weekly Review
        </a>
      </div>
    )
  }

  if (phase === "empty") {
    return (
      <div
        className="rounded-xl border border-dashed border-dark-200 dark:border-dark-700 p-8 text-center"
        data-testid="review-session-empty"
      >
        <p className="text-sm text-dark-600 dark:text-dark-300 mb-2">No concepts due for review.</p>
        <p className="text-xs text-dark-400 dark:text-dark-500 mb-4">
          Mark concepts as reviewed from a concept page to build your queue.
        </p>
        <div className="flex justify-center gap-2">
          <a
            href="/frameworks"
            className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-700 transition"
          >
            Explore frameworks
          </a>
          <a
            href="/review"
            className="rounded-lg border border-dark-300 dark:border-dark-600 px-4 py-2 text-xs font-medium text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-800 transition"
          >
            Back to review
          </a>
        </div>
      </div>
    )
  }

  if (phase === "summary") {
    const counts: Record<SessionRatingLabel, number> = { Again: 0, Hard: 0, Good: 0, Easy: 0 }
    for (const r of results) counts[r.label] += 1

    return (
      <div
        className="rounded-xl border border-dark-200 dark:border-dark-700 p-6"
        data-testid="review-session-summary"
      >
        <h2 className="text-lg font-semibold text-dark-900 dark:text-dark-100 mb-1">Session complete</h2>
        <p className="text-sm text-dark-500 dark:text-dark-400 mb-6">
          You reviewed {results.length} concept{results.length === 1 ? "" : "s"}.
        </p>

        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SESSION_RATING_OPTIONS.map(({ label }) => (
            <div
              key={label}
              className="rounded-lg border border-dark-200 dark:border-dark-700 p-3 text-center"
              data-testid={`summary-count-${label.toLowerCase()}`}
            >
              <p className="text-xl font-bold text-dark-800 dark:text-dark-100">{counts[label]}</p>
              <p className="text-[10px] uppercase tracking-wide text-dark-400 dark:text-dark-500">{label}</p>
            </div>
          ))}
        </div>

        {results.length > 0 && (
          <ul className="mb-6 space-y-2" data-testid="session-result-list">
            {results.map((r) => (
              <li
                key={r.conceptId}
                className="flex items-center justify-between rounded-lg border border-dark-100 dark:border-dark-800 px-3 py-2"
              >
                <div>
                  <p className="text-xs font-medium text-dark-700 dark:text-dark-300">{r.conceptName}</p>
                  <p className="text-[10px] text-dark-400 dark:text-dark-500">
                    {formatFrameworkSlug(r.frameworkSlug)} · next in {r.interval}d
                  </p>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
                  {r.label}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2">
          <a
            href="/review"
            className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-700 transition"
          >
            Back to Weekly Review
          </a>
          <a
            href="/review/session"
            className="rounded-lg border border-dark-300 dark:border-dark-600 px-4 py-2 text-xs font-medium text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-800 transition"
          >
            Review again
          </a>
        </div>
      </div>
    )
  }

  // Guard: active phase but no card (should not happen with ref-locked index advances)
  if (!current) {
    return (
      <div data-testid="review-session-error" role="alert" className="text-sm text-red-600">
        Session state error. <a href="/review/session" className="underline">Reload session</a>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-dark-200 dark:border-dark-700 p-6" data-testid="review-session-card">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-dark-400 dark:text-dark-500">
          Card {index + 1} of {total}
        </p>
        <div
          className="h-1.5 w-32 rounded-full bg-dark-100 dark:bg-dark-800 overflow-hidden"
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label={`Review progress: card ${index + 1} of ${total}`}
        >
          <div
            className="h-full rounded-full bg-primary-500 transition-all"
            style={{ width: `${((index + 1) / Math.max(total, 1)) * 100}%` }}
          />
        </div>
      </div>

      <p className="text-[10px] font-medium uppercase tracking-wide text-primary-600 dark:text-primary-400 mb-1">
        {formatFrameworkSlug(current.frameworkSlug)}
      </p>
      <h2 className="text-2xl font-bold text-dark-900 dark:text-dark-100 mb-2">{current.conceptName}</h2>
      <p className="text-xs text-dark-500 dark:text-dark-400 mb-1">
        {current.reviewCount} prior review{current.reviewCount === 1 ? "" : "s"}
        {current.interval > 0 ? ` · last interval ${current.interval}d` : ""}
      </p>
      <a
        href={`/frameworks/${current.frameworkSlug}/${current.conceptSlug}`}
        className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
        target="_blank"
        rel="noreferrer"
      >
        Open concept page ↗
      </a>

      {error && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}

      <div className="mt-8">
        <p className="mb-3 text-xs text-dark-500 dark:text-dark-400">
          How well did you recall this concept?{" "}
          <span className="text-dark-400 dark:text-dark-500">(keys 1–4)</span>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="Review rating">
          {SESSION_RATING_OPTIONS.map(({ label, rating, key }) => (
            <button
              key={label}
              type="button"
              disabled={submitting}
              onClick={() => void rate(label, rating)}
              data-testid={`rate-${label.toLowerCase()}`}
              aria-keyshortcuts={key}
              className="rounded-xl border border-dark-200 dark:border-dark-700 px-3 py-3 text-center hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition disabled:opacity-50"
            >
              <span className="block text-sm font-semibold text-dark-800 dark:text-dark-100">{label}</span>
              <span className="mt-1 block text-[10px] text-dark-400 dark:text-dark-500">
                <kbd className="rounded border border-dark-200 dark:border-dark-600 px-1.5 py-0.5 font-mono">{key}</kbd>
              </span>
            </button>
          ))}
        </div>
      </div>

      {submitting && (
        <p className="mt-3 text-xs text-dark-400 dark:text-dark-500" data-testid="review-session-saving">
          Saving…
        </p>
      )}
    </div>
  )
}
