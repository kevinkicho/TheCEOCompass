"use client"

import React from "react"
import Link from "next/link"
import { useNextActions } from "@/lib/user-data/useNextActions"
import { SkeletonCard } from "@/components/SkeletonCard"
import { nextActionHref, nextActionKindLabel } from "@/lib/mastery"

export function NextActionsDashboard() {
  const state = useNextActions()

  if (state.status === "no_firebase") return null

  if (state.status === "loading") {
    return (
      <section className="mx-auto max-w-4xl px-4 pb-12">
        <SkeletonCard lines={3} />
      </section>
    )
  }

  if (state.status === "error") {
    return (
      <section className="mx-auto max-w-4xl px-4 pb-12">
        <div className="rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/20 p-4 flex items-center justify-between">
          <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
          <button
            onClick={state.retry}
            className="rounded-lg bg-red-100 dark:bg-red-900/40 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300"
          >
            Retry
          </button>
        </div>
      </section>
    )
  }

  const recommended = state.recommendedConcepts || []
  const empty =
    state.dueReviewCount === 0 &&
    state.journalOutcomesDue === 0 &&
    state.pathway.pct === 0 &&
    !state.lastViewed &&
    recommended.length === 0

  return (
    <section className="mx-auto max-w-4xl px-4 pb-12" data-testid="next-actions">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold text-dark-900 dark:text-dark-100">Your next actions</h2>
          <p className="text-sm text-dark-500 dark:text-dark-400">
            Due reviews, pathway, and open decisions - in one place.
          </p>
        </div>
        {state.isAnonymous && (
          <p className="text-[11px] text-dark-400 dark:text-dark-500 max-w-xs text-right">
            Progress saves automatically. Link Google in the navbar for cross-device.
          </p>
        )}
      </div>

      {empty ? (
        <div className="rounded-xl border border-dashed border-dark-200 dark:border-dark-700 p-6 text-center">
          <p className="text-sm text-dark-600 dark:text-dark-300 mb-4">
            Explore frameworks - progress saves automatically
            {state.isAnonymous ? " on this device" : ""}.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/frameworks"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Browse frameworks
            </Link>
            <Link
              href="/scenarios"
              className="rounded-lg border border-dark-200 dark:border-dark-700 px-4 py-2 text-sm text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-800"
            >
              Try a scenario
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ActionCard
              href="/review"
              label="Spaced reviews due"
              value={String(state.dueReviewCount)}
              hint={
                state.dueReviews[0]
                  ? `Next: ${state.dueReviews[0].conceptName || state.dueReviews[0].conceptSlug}`
                  : "Nothing overdue - keep learning"
              }
              accent="amber"
            />
            <ActionCard
              href={state.pathway.nextSlug ? `/frameworks/${state.pathway.nextSlug}` : "/pathway"}
              label="Pathway progress"
              value={`${state.pathway.pct}%`}
              hint={state.pathway.nextTitle ? `Up next: ${state.pathway.nextTitle}` : "Pathway complete"}
              accent="primary"
            />
            <ActionCard
              href="/journal"
              label="Journal outcomes due"
              value={String(state.journalOutcomesDue)}
              hint="Capture what happened to improve calibration"
              accent="violet"
            />
            <ActionCard
              href="/scenarios"
              label="Practice"
              value="Scenarios"
              hint="Apply frameworks under pressure with AI coaching"
              accent="emerald"
            />
          </div>

          {recommended.length > 0 && (
            <div data-testid="recommended-concepts">
              <h3 className="mb-2 text-sm font-semibold text-dark-700 dark:text-dark-200">
                Recommended concepts
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {recommended.map((rec) => (
                  <ActionCard
                    key={`${rec.kind}-${rec.conceptId}`}
                    href={nextActionHref(rec)}
                    label={nextActionKindLabel(rec.kind)}
                    value={formatConceptTitle(rec.conceptSlug)}
                    hint={rec.reason}
                    accent="sky"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function formatConceptTitle(conceptSlug: string): string {
  return conceptSlug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function ActionCard({
  href,
  label,
  value,
  hint,
  accent,
}: {
  href: string
  label: string
  value: string
  hint: string
  accent: "amber" | "primary" | "violet" | "emerald" | "sky"
}) {
  const ring = {
    amber: "border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10",
    primary: "border-primary-200 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/10",
    violet: "border-violet-200 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-900/10",
    emerald: "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-900/10",
    sky: "border-sky-200 dark:border-sky-800/40 bg-sky-50/50 dark:bg-sky-900/10",
  }[accent]
  const valueCls = {
    amber: "text-amber-700 dark:text-amber-300",
    primary: "text-primary-700 dark:text-primary-300",
    violet: "text-violet-700 dark:text-violet-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
    sky: "text-sky-700 dark:text-sky-300",
  }[accent]

  return (
    <Link
      href={href}
      className={`rounded-xl border p-4 transition hover:shadow-md ${ring}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-dark-500 dark:text-dark-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valueCls} line-clamp-2`}>{value}</p>
      <p className="mt-1 text-xs text-dark-500 dark:text-dark-400 line-clamp-2">{hint}</p>
    </Link>
  )
}
