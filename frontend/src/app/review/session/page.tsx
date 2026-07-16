"use client"

import React from "react"
import { ReviewSession } from "@/components/review/ReviewSession"
import { useFeatureFlags } from "@/components/FeatureFlagsProvider"
import { canUseFirebasePersistence } from "@/lib/capabilities"
import { PersistenceUnavailableBanner } from "@/components/RequiresBackend"
import { SkeletonCard } from "@/components/SkeletonCard"

export default function ReviewSessionPage() {
  const { flags, ready: flagsReady } = useFeatureFlags()
  const sessionEnabled = flags.sr_session_enabled

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wide text-primary-600 dark:text-primary-400 mb-1">
          Spaced repetition
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-dark-900 dark:text-dark-100">Review session</h1>
        <p className="mt-2 text-dark-500 dark:text-dark-300">
          Rate due concepts one by one. Use buttons or keyboard shortcuts 1–4 (Again / Hard / Good / Easy).
        </p>
      </div>

      <PersistenceUnavailableBanner
        feature="Review session"
        description="Loads your due concepts and saves SM-2 ratings to your account"
      />

      {!flagsReady && (
        <div data-testid="review-session-flags-loading">
          <SkeletonCard lines={3} />
        </div>
      )}

      {flagsReady && !sessionEnabled && (
        <div
          className="rounded-xl border border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-900/40 p-6"
          data-testid="review-session-disabled"
        >
          <p className="text-sm text-dark-700 dark:text-dark-300 mb-3">
            Review session mode is not enabled yet. An admin can turn on{" "}
            <code className="text-xs bg-dark-100 dark:bg-dark-800 px-1.5 py-0.5 rounded">sr_session_enabled</code>{" "}
            in remote feature flags.
          </p>
          <a
            href="/review"
            className="inline-block rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-700 transition"
          >
            Back to Weekly Review
          </a>
        </div>
      )}

      {flagsReady && sessionEnabled && canUseFirebasePersistence() && <ReviewSession />}

      {flagsReady && sessionEnabled && !canUseFirebasePersistence() && (
        <p className="text-sm text-dark-500 dark:text-dark-400">
          Connect Firebase persistence to run a review session.
        </p>
      )}
    </div>
  )
}
