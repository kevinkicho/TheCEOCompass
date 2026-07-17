/**
 * Multi-step agent workflows (read + optional write).
 */
import { loadUserContext } from "./context.js"
import { listScenarios } from "./catalog.js"
import { buildNavigationPlan } from "./navigate.js"
import { draftJournalFromContext, listJournal } from "./journal.js"

/**
 * Daily learning pipeline for a user.
 * --apply-journal will write journal drafts (default dry-run).
 */
export async function runDailyPipeline(uid, { applyJournal = false, journalLimit = 3, notes = "" } = {}) {
  const context = await loadUserContext(uid, 8)
  const scenarios = await listScenarios()
  const plan = buildNavigationPlan(context, { scenarios })
  const journal = await listJournal(uid)

  let journalDraft = null
  if (context.recentViewed.length || context.recentScenarios.length || notes) {
    try {
      journalDraft = await draftJournalFromContext(uid, {
        notes,
        limit: journalLimit,
        apply: applyJournal,
      })
    } catch (err) {
      journalDraft = {
        error: err instanceof Error ? err.message : String(err),
        hint: "Ensure Ollama is running or OLLAMA_API_KEY is set for agent cloud fallback.",
      }
    }
  } else {
    journalDraft = {
      skipped: true,
      reason: "No recent activity and no notes — nothing to journal yet.",
    }
  }

  return {
    ok: true,
    workflow: "daily",
    uid,
    generatedAt: new Date().toISOString(),
    context: {
      dueReviewCount: context.dueReviewCount,
      dueReviews: context.dueReviews,
      recentViewed: context.recentViewed,
      recentScenarios: context.recentScenarios,
      quizHighlights: context.quizHighlights,
      pathway: context.pathway,
      journalCount: context.journalCount,
      journalOpenOutcomes: context.journalOpenOutcomes,
    },
    navigation: plan,
    journal: {
      existingCount: journal.length,
      draft: journalDraft,
    },
    nextCli: [
      `node agent/cli/index.js navigate plan --uid ${uid} --json`,
      applyJournal
        ? null
        : `node agent/cli/index.js journal draft-from-context --uid ${uid} --limit ${journalLimit} --apply --json`,
    ].filter(Boolean),
  }
}
