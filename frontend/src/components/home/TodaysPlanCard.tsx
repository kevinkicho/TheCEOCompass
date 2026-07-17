"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useNextActions } from "@/lib/user-data/useNextActions"
import { getScenarios } from "@/lib/api"
import { buildTodaysPlan, type PlanItem } from "@/lib/learning/todays-plan"
import { loadAppSettings } from "@/lib/settings"
import type { ScenarioListItem } from "@/lib/types"
import { SkeletonCard } from "@/components/SkeletonCard"

const kindAccent: Record<PlanItem["kind"], string> = {
  review: "border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-900/20",
  concept: "border-primary-300 dark:border-primary-700 bg-primary-50/80 dark:bg-primary-900/20",
  scenario: "border-violet-300 dark:border-violet-700 bg-violet-50/80 dark:bg-violet-900/20",
}

const kindLabel: Record<PlanItem["kind"], string> = {
  review: "Review",
  concept: "Learn",
  scenario: "Practice",
}

export function TodaysPlanCard() {
  const next = useNextActions()
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([])

  useEffect(() => {
    getScenarios()
      .then((s) => setScenarios(s as ScenarioListItem[]))
      .catch(() => setScenarios([]))
  }, [])

  if (next.status === "no_firebase") return null

  if (next.status === "loading") {
    return (
      <section className="mx-auto max-w-4xl px-4 pb-8" data-testid="todays-plan">
        <SkeletonCard lines={3} />
      </section>
    )
  }

  if (next.status === "error") {
    return null
  }

  const prefs = loadAppSettings().learnerPrefs
  const plan = buildTodaysPlan({
    dueReviews: next.dueReviews,
    recommended: (next.recommendedConcepts || []).map((r) => ({
      kind: r.kind,
      conceptId: r.conceptId,
      frameworkSlug: r.frameworkSlug,
      conceptSlug: r.conceptSlug,
      reason: r.reason,
      score: r.score,
    })),
    scenarios,
    prefs,
    pathwayNext: {
      slug: next.pathway.nextSlug,
      title: next.pathway.nextTitle,
    },
  })

  // Empty learner — home shows WelcomeSplash instead of filler cards
  if (plan.empty || plan.items.length === 0) {
    return null
  }

  return (
    <section className="mx-auto max-w-4xl px-4 pb-8" data-testid="todays-plan">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-dark-900 dark:text-dark-100">Today&apos;s plan</h2>
          <p className="text-sm text-dark-500 dark:text-dark-400">
            One review, one concept, one scenario — then stop or continue.
          </p>
        </div>
        <Link
          href="/profile"
          className="text-[11px] text-primary-600 dark:text-primary-400 hover:underline shrink-0"
        >
          Preferences
        </Link>
      </div>
      <ol className="grid gap-3 sm:grid-cols-3">
        {plan.items.map((item, i) => (
          <li key={`${item.kind}-${i}`}>
            <Link
              href={item.href}
              className={`block h-full rounded-xl border p-4 transition hover:shadow-sm ${kindAccent[item.kind]}`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-dark-500 dark:text-dark-400 mb-1">
                {i + 1}. {kindLabel[item.kind]}
              </p>
              <p className="text-sm font-semibold text-dark-900 dark:text-dark-100 capitalize line-clamp-2">
                {item.title}
              </p>
              <p className="text-[11px] text-dark-500 dark:text-dark-400 mt-1 line-clamp-1">
                {item.subtitle}
              </p>
              <p className="text-[11px] text-dark-600 dark:text-dark-300 mt-2 line-clamp-2">
                {item.reason}
              </p>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
