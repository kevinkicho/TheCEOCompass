/**
 * Navigation / pipeline suggestions for agents (no browser required).
 * Emits structured next steps: routes, RTDB paths, CLI follow-ups.
 */

const BASE = process.env.CEOCOMPASS_BASE_URL || "http://localhost:33221"

export function buildNavigationPlan(context, catalog = {}) {
  const steps = []

  // 1) Spaced reviews
  if (context.dueReviewCount > 0) {
    steps.push({
      id: "reviews-due",
      priority: 1,
      kind: "review",
      title: `${context.dueReviewCount} spaced review(s) due`,
      route: `${BASE}/review/session`,
      cli: `node agent/cli/index.js context --uid ${context.uid} --json`,
      rtdb: `users/${context.uid}/reviews`,
      why: "Keep SM-2 queue healthy before new content",
    })
  }

  // 2) Journal outcomes overdue
  if (context.journalOpenOutcomes?.length) {
    steps.push({
      id: "journal-outcomes",
      priority: 2,
      kind: "journal_outcome",
      title: `${context.journalOpenOutcomes.length} journal outcome(s) due`,
      route: `${BASE}/journal`,
      cli: `node agent/cli/index.js journal list --uid ${context.uid} --json`,
      items: context.journalOpenOutcomes,
      why: "Capture outcomes to improve calibration",
    })
  }

  // 3) Continue last viewed concept
  if (context.recentViewed?.[0]) {
    const v = context.recentViewed[0]
    steps.push({
      id: "resume-concept",
      priority: 3,
      kind: "learn",
      title: `Resume ${v.frameworkSlug}/${v.conceptId}`,
      route: `${BASE}/frameworks/${v.frameworkSlug}/${v.conceptId}`,
      rtdb: `frameworks/${v.frameworkSlug}/concepts`,
      why: "Continue recent concept study",
    })
  }

  // 4) Pathway next
  if (context.pathway?.inProgressId) {
    steps.push({
      id: "pathway-in-progress",
      priority: 4,
      kind: "pathway",
      title: `Pathway in progress: ${context.pathway.inProgressId}`,
      route: `${BASE}/frameworks/${context.pathway.inProgressId}`,
      why: "Finish current pathway module",
    })
  } else {
    steps.push({
      id: "pathway",
      priority: 5,
      kind: "pathway",
      title: "Open learning pathway",
      route: `${BASE}/pathway`,
      why: "Pick next structured module",
    })
  }

  // 5) Scenario practice
  const scenarioSlug =
    context.recentScenarios?.[0]?.slug ||
    catalog.scenarios?.[0]?.slug ||
    "pricing-war-response"
  steps.push({
    id: "scenario-practice",
    priority: 6,
    kind: "scenario",
    title: `Practice scenario: ${scenarioSlug}`,
    route: `${BASE}/scenarios/${scenarioSlug}`,
    cli: `node agent/cli/index.js catalog scenario --slug ${scenarioSlug} --json`,
    why: "Apply frameworks under pressure",
  })

  // 6) Journal sync from context
  steps.push({
    id: "journal-sync",
    priority: 7,
    kind: "journal_sync",
    title: "Draft journal entries from recent activity",
    route: `${BASE}/journal`,
    cli: `node agent/cli/index.js journal draft-from-context --uid ${context.uid} --limit 3 --json`,
    cliApply: `node agent/cli/index.js journal draft-from-context --uid ${context.uid} --limit 3 --apply --json`,
    why: "Smarter recordkeeping without manual forms",
  })

  steps.sort((a, b) => a.priority - b.priority)

  return {
    uid: context.uid,
    baseUrl: BASE,
    generatedAt: new Date().toISOString(),
    summary: {
      dueReviews: context.dueReviewCount,
      openJournalOutcomes: context.journalOpenOutcomes?.length || 0,
      recentViewed: context.recentViewed?.length || 0,
      recentScenarios: context.recentScenarios?.length || 0,
    },
    steps,
    /** Linear pipeline agents can execute in order */
    pipeline: [
      "context",
      "reviews-due (if any)",
      "journal-outcomes (if any)",
      "resume-concept or pathway",
      "scenario-practice",
      "journal draft-from-context [--apply]",
    ],
  }
}
