/**
 * Pure "Today's Plan" builder — one review, one concept, one scenario.
 */

import type { ReviewRecord } from "../spaced-repetition"
import type { NextAction } from "../mastery"
import type { ScenarioListItem } from "../types"
import type { LearnerPrefs } from "../settings"

export type PlanItemKind = "review" | "concept" | "scenario"

export type PlanItem = {
  kind: PlanItemKind
  title: string
  subtitle: string
  href: string
  reason: string
}

export type TodaysPlan = {
  items: PlanItem[]
  empty: boolean
}

function preferDomain(prefs: LearnerPrefs | undefined, text: string): number {
  if (!prefs?.industry) return 0
  const ind = prefs.industry.toLowerCase()
  return text.toLowerCase().includes(ind) ? 2 : 0
}

/**
 * Build a compact daily plan from current learning state.
 */
export function buildTodaysPlan(input: {
  dueReviews: ReviewRecord[]
  recommended: NextAction[]
  scenarios: ScenarioListItem[]
  prefs?: LearnerPrefs
  pathwayNext?: { slug: string | null; title: string | null } | null
}): TodaysPlan {
  const items: PlanItem[] = []
  const prefs = input.prefs

  // 1) Spaced review (most overdue first if multiple)
  const due = [...input.dueReviews].sort((a, b) => {
    const ta = a.nextReviewAt ? new Date(a.nextReviewAt).getTime() : 0
    const tb = b.nextReviewAt ? new Date(b.nextReviewAt).getTime() : 0
    return ta - tb
  })
  if (due[0]) {
    const r = due[0]
    items.push({
      kind: "review",
      title: r.conceptName || r.conceptSlug || "Due concept",
      subtitle: "Spaced repetition",
      href:
        r.frameworkSlug && r.conceptSlug
          ? `/frameworks/${r.frameworkSlug}/${r.conceptSlug}`
          : "/review/session",
      reason:
        due.length > 1
          ? `${due.length} concepts due — start with this one`
          : "Due for review today",
    })
  } else {
    items.push({
      kind: "review",
      title: "Review session",
      subtitle: "Spaced repetition",
      href: "/review",
      reason: "No cards due — check weekly review or rate a concept",
    })
  }

  // 2) Concept to learn (mastery rec or pathway)
  const rec = input.recommended[0]
  if (rec) {
    items.push({
      kind: "concept",
      title: rec.conceptSlug.replace(/-/g, " "),
      subtitle: rec.frameworkSlug.replace(/-/g, " "),
      href: `/frameworks/${rec.frameworkSlug}/${rec.conceptSlug}`,
      reason: rec.reason || "Recommended from your mastery graph",
    })
  } else if (input.pathwayNext?.slug) {
    items.push({
      kind: "concept",
      title: input.pathwayNext.title || input.pathwayNext.slug,
      subtitle: "Pathway",
      href: `/frameworks/${input.pathwayNext.slug}`,
      reason: "Next step on your learning pathway",
    })
  } else {
    items.push({
      kind: "concept",
      title: "Explore frameworks",
      subtitle: "Learn",
      href: "/frameworks",
      reason: "Browse a framework to start building mastery",
    })
  }

  // 3) Scenario practice
  const scenarios = [...input.scenarios]
  scenarios.sort((a, b) => {
    const sa =
      preferDomain(prefs, `${a.title} ${a.pack_id || ""} ${a.description || ""}`) +
      (prefs?.timeBudgetMinutes && prefs.timeBudgetMinutes <= 15
        ? (a.difficulty || 3) <= 2
          ? 1
          : 0
        : 0)
    const sb =
      preferDomain(prefs, `${b.title} ${b.pack_id || ""} ${b.description || ""}`) +
      (prefs?.timeBudgetMinutes && prefs.timeBudgetMinutes <= 15
        ? (b.difficulty || 3) <= 2
          ? 1
          : 0
        : 0)
    return sb - sa
  })
  const sc = scenarios[0]
  if (sc) {
    items.push({
      kind: "scenario",
      title: sc.title,
      subtitle: sc.pack_title || sc.pack_id || "Practice",
      href: `/scenarios/${sc.slug || sc.id}`,
      reason: prefs?.industry
        ? `Practice scenario${sc.pack_id ? ` · ${sc.pack_id}` : ""}`
        : "Apply frameworks under pressure",
    })
  } else {
    items.push({
      kind: "scenario",
      title: "Scenarios",
      subtitle: "Practice",
      href: "/scenarios",
      reason: "Try a multi-stage leadership scenario",
    })
  }

  // Cap for short sessions
  if (prefs?.timeBudgetMinutes && prefs.timeBudgetMinutes <= 10) {
    return { items: items.slice(0, 2), empty: false }
  }

  return { items, empty: false }
}
