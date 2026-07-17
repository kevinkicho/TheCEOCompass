"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  loadJournalEntries,
  createJournalEntry,
  deleteJournalEntry,
  recordOutcome,
} from "@/lib/firebase-crud"
import {
  loadLearnerJournalContext,
  type LearnerJournalContext,
} from "@/lib/user-data"
import { canUseFirebasePersistence } from "@/lib/capabilities"
import { PersistenceUnavailableBanner } from "@/components/RequiresBackend"
import { useAuthSession } from "@/lib/AuthSessionProvider"
import {
  structureJournalFromThoughts,
  structureOutcomeFromNote,
} from "@/lib/ai"
import type { JournalEntry } from "@/lib/types"

type Mode = "capture" | "outcome"

/**
 * AI-first Decision Journal.
 * User shares rough thoughts; AI structures and saves the entry.
 * No manual multi-field modal forms.
 * Learner context is loaded from RTDB and shown as a preview before capture.
 */
export default function JournalPage() {
  const { ready: authReady } = useAuthSession()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [mode, setMode] = useState<Mode>("capture")
  const [outcomeTarget, setOutcomeTarget] = useState<JournalEntry | null>(null)
  const [thoughts, setThoughts] = useState("")
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("")
  const [journalError, setJournalError] = useState("")
  const [lastSavedId, setLastSavedId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [learnerCtx, setLearnerCtx] = useState<LearnerJournalContext | null>(null)
  const [ctxLoading, setCtxLoading] = useState(false)

  const loadEntries = useCallback(async () => {
    setJournalError("")
    try {
      const data = await loadJournalEntries()
      setEntries(data)
    } catch (err) {
      setJournalError(err instanceof Error ? err.message : "Failed to load journal entries")
    }
  }, [])

  const refreshLearnerContext = useCallback(async () => {
    if (!canUseFirebasePersistence()) {
      setLearnerCtx(null)
      return
    }
    setCtxLoading(true)
    try {
      const ctx = await loadLearnerJournalContext(8)
      setLearnerCtx(ctx)
    } catch {
      setLearnerCtx(null)
    }
    setCtxLoading(false)
  }, [])

  useEffect(() => {
    if (canUseFirebasePersistence() && authReady) {
      void loadEntries()
      void refreshLearnerContext()
    }
  }, [authReady, loadEntries, refreshLearnerContext])

  const handleAiCapture = async () => {
    const text = thoughts.trim()
    if (!text || busy) return
    if (!canUseFirebasePersistence()) {
      setJournalError("Sign in and enable Firebase to save journal entries.")
      return
    }
    setBusy(true)
    setJournalError("")
    setStatus("Loading your recent learning activity, then writing entries...")
    try {
      // Fresh snapshot at capture time (preview may be stale)
      const freshCtx = await loadLearnerJournalContext(8)
      setLearnerCtx(freshCtx)
      setStatus(
        freshCtx.recentScenarios.length || freshCtx.recentViewed.length
          ? "AI is turning your recent activity into journal entries..."
          : "AI is structuring your notes...",
      )
      const drafts = await structureJournalFromThoughts(text, {
        learnerContextBlock: freshCtx.promptBlock,
      })
      if (!drafts.length) {
        throw new Error(
          "AI could not extract a concrete activity. Mention what you practiced, or open a few concepts/scenarios first so we have account context.",
        )
      }
      setStatus(
        drafts.length > 1
          ? `Saving ${drafts.length} entries from your activities...`
          : "Saving entry...",
      )
      const created: JournalEntry[] = []
      for (const draft of drafts) {
        const entry = await createJournalEntry({
          title: draft.title,
          context: draft.context,
          decision: draft.decision,
          rationale: draft.rationale,
          confidence: draft.confidence,
          review_date: draft.review_date,
          alternatives_considered: draft.alternatives_considered,
          key_assumptions: draft.key_assumptions,
          success_metrics: draft.success_metrics,
        })
        created.push(entry)
      }
      setEntries((prev) => [...created, ...prev])
      setLastSavedId(created[0]?.id ?? null)
      setThoughts("")
      setStatus(
        created.length > 1
          ? `Saved ${created.length} journal entries about your activities.`
          : "Saved. Entry is about your activity — not about recordkeeping.",
      )
    } catch (err) {
      setJournalError(err instanceof Error ? err.message : "AI capture failed")
      setStatus("")
    }
    setBusy(false)
  }

  const handleAiOutcome = async () => {
    if (!outcomeTarget || busy) return
    const text = thoughts.trim()
    if (!text) return
    setBusy(true)
    setJournalError("")
    setStatus("AI is recording the outcome...")
    try {
      const draft = await structureOutcomeFromNote(text, {
        title: outcomeTarget.title,
        decision: outcomeTarget.decision,
        confidence: outcomeTarget.confidence,
      })
      await recordOutcome(outcomeTarget.id, draft)
      setOutcomeTarget(null)
      setMode("capture")
      setThoughts("")
      setStatus("Outcome saved.")
      await loadEntries()
    } catch (err) {
      setJournalError(err instanceof Error ? err.message : "AI outcome failed")
      setStatus("")
    }
    setBusy(false)
  }

  const handleDelete = async () => {
    if (!confirmDeleteId) return
    try {
      await deleteJournalEntry(confirmDeleteId)
      setEntries((e) => e.filter((x) => x.id !== confirmDeleteId))
      setConfirmDeleteId(null)
    } catch (err) {
      setJournalError(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString()
    } catch {
      return dateStr
    }
  }
  const isPastReview = (dateStr: string) => {
    try {
      return new Date(dateStr) < new Date()
    } catch {
      return false
    }
  }

  const startOutcome = (entry: JournalEntry) => {
    setMode("outcome")
    setOutcomeTarget(entry)
    setThoughts("")
    setStatus(`Tell AI what happened after: "${entry.title}"`)
    setLastSavedId(null)
  }

  const cancelOutcome = () => {
    setMode("capture")
    setOutcomeTarget(null)
    setThoughts("")
    setStatus("")
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-dark-900 dark:text-dark-100">
          Decision Journal
        </h1>
        <p className="mt-1 text-dark-500 dark:text-dark-300">
          Speak your mind in a few sentences. AI writes the structured entry so you stay focused on learning.
        </p>
      </div>

      <PersistenceUnavailableBanner
        feature="Decision Journal"
        description="AI-structured decision log saved to your account"
      />

      {journalError && canUseFirebasePersistence() && (
        <p className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3">
          {journalError}
        </p>
      )}

      {/* Account context preview — cornerstone: transparent what AI will use */}
      {mode === "capture" && canUseFirebasePersistence() && (
        <section
          className="mb-6 rounded-xl border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-900/60 p-4 sm:p-5"
          data-testid="journal-context-preview"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-dark-500 dark:text-dark-400">
                Learning context for AI
              </p>
              <p className="text-xs text-dark-500 dark:text-dark-400 mt-0.5">
                Loaded from your account (scenarios, concepts, quizzes, pathway). AI uses this so
                entries describe real activity — not meta recordkeeping.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshLearnerContext()}
              disabled={ctxLoading || busy}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline shrink-0 disabled:opacity-50"
            >
              {ctxLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          {ctxLoading && !learnerCtx ? (
            <p className="text-xs text-dark-400">Loading activity…</p>
          ) : learnerCtx ? (
            <div className="grid gap-3 sm:grid-cols-2 text-xs text-dark-600 dark:text-dark-300">
              <div>
                <p className="font-medium text-dark-700 dark:text-dark-200 mb-1">
                  Recent scenarios
                </p>
                {learnerCtx.recentScenarios.length === 0 ? (
                  <p className="text-dark-400">None yet — try a scenario first.</p>
                ) : (
                  <ul className="space-y-0.5 list-disc list-inside">
                    {learnerCtx.recentScenarios.slice(0, 5).map((s) => (
                      <li key={`${s.slug}-${s.completedAt}`}>
                        <span className="font-mono text-[11px]">{s.slug}</span>
                        {s.stageCount > 0 && (
                          <span className="text-dark-400"> · {s.stageCount} stages</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="font-medium text-dark-700 dark:text-dark-200 mb-1">
                  Recently viewed
                </p>
                {learnerCtx.recentViewed.length === 0 ? (
                  <p className="text-dark-400">None yet — open a few concepts.</p>
                ) : (
                  <ul className="space-y-0.5 list-disc list-inside">
                    {learnerCtx.recentViewed.slice(0, 5).map((v) => (
                      <li key={`${v.frameworkSlug}-${v.conceptId}`}>
                        <span className="font-mono text-[11px]">
                          {v.frameworkSlug}/{v.conceptId}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="sm:col-span-2 flex flex-wrap gap-3 pt-1 border-t border-dark-100 dark:border-dark-800">
                <span>
                  Pathway{" "}
                  <strong className="text-dark-800 dark:text-dark-100">
                    {learnerCtx.pathway.pct}%
                  </strong>
                  {learnerCtx.pathway.nextSlug && (
                    <span className="text-dark-400">
                      {" "}
                      · next {learnerCtx.pathway.nextSlug}
                    </span>
                  )}
                </span>
                <span>
                  Due reviews{" "}
                  <strong className="text-dark-800 dark:text-dark-100">
                    {learnerCtx.dueReviewCount}
                  </strong>
                </span>
                {learnerCtx.quizHighlights.length > 0 && (
                  <span>
                    Best quiz{" "}
                    <strong className="text-dark-800 dark:text-dark-100">
                      {learnerCtx.quizHighlights[0].framework}{" "}
                      {learnerCtx.quizHighlights[0].pct}%
                    </strong>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-dark-400">
              Context will load when your session is ready.
            </p>
          )}
        </section>
      )}

      {/* AI capture panel - always on page, no modal */}
      <section
        className="mb-10 rounded-2xl border border-primary-200 dark:border-primary-800/40 bg-primary-50/40 dark:bg-primary-950/20 p-5 sm:p-6"
        data-testid="journal-ai-panel"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
              {mode === "capture" ? "Capture with AI" : "Outcome with AI"}
            </p>
            <p className="text-sm text-dark-600 dark:text-dark-300 mt-0.5">
              {mode === "capture"
                ? "Add notes if you want. Or say \"record my recent activities\" and AI uses the context above."
                : `What actually happened for "${outcomeTarget?.title}"? AI writes the outcome review.`}
            </p>
          </div>
          {mode === "outcome" && (
            <button
              type="button"
              onClick={cancelOutcome}
              className="text-xs text-dark-500 hover:text-dark-800 dark:hover:text-dark-200 shrink-0"
            >
              Cancel
            </button>
          )}
        </div>

        <textarea
          value={thoughts}
          onChange={(e) => setThoughts(e.target.value)}
          rows={5}
          disabled={busy || !canUseFirebasePersistence()}
          placeholder={
            mode === "capture"
              ? "Example: Record my last few activities. Or: Pricing war scenario — I matched price short-term; still unsure about unit economics..."
              : "Example: We raised. Dilution was worse than expected. Market window closed for wait-and-see. Lesson: move before the window, not after."
          }
          className="w-full resize-none rounded-xl border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-900 px-4 py-3 text-sm text-dark-800 dark:text-dark-100 focus:border-primary-400 focus:outline-none disabled:opacity-60"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void (mode === "capture" ? handleAiCapture() : handleAiOutcome())}
            disabled={busy || !thoughts.trim() || !canUseFirebasePersistence()}
            className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {busy
              ? "Working..."
              : mode === "capture"
                ? "Let AI write & save entry"
                : "Let AI record outcome"}
          </button>
          {status && (
            <p className="text-xs text-dark-500 dark:text-dark-400" role="status">
              {status}
            </p>
          )}
        </div>
      </section>

      {!canUseFirebasePersistence() ? (
        <div className="rounded-xl border border-dark-200 p-12 text-center dark:border-dark-700">
          <p className="text-dark-500 dark:text-dark-300">
            Sign in to save AI journal entries to your account.
          </p>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-dark-200 p-10 text-center dark:border-dark-700">
          <p className="text-dark-500 dark:text-dark-300">
            No decisions yet. Use the panel above - you talk, AI writes.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-dark-700 dark:text-dark-200 uppercase tracking-wide">
            Your entries
          </h2>
          {entries.map((entry) => (
            <article
              key={entry.id}
              className={`rounded-xl border p-5 transition dark:border-dark-700 ${
                lastSavedId === entry.id
                  ? "border-primary-400 ring-1 ring-primary-300/50 dark:border-primary-600"
                  : "border-dark-200 hover:shadow-md"
              }`}
            >
              <div className="mb-3 flex items-center gap-3 flex-wrap">
                <h2 className="font-semibold text-dark-900 dark:text-dark-100">{entry.title}</h2>
                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                  Confidence: {entry.confidence}/10
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    entry.outcome_captured
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : isPastReview(entry.review_date)
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-dark-100 text-dark-600 dark:bg-dark-800 dark:text-dark-300"
                  }`}
                >
                  {entry.outcome_captured
                    ? "Outcome recorded"
                    : isPastReview(entry.review_date)
                      ? "Ready for outcome"
                      : `Review by ${formatDate(entry.review_date)}`}
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(entry.id)}
                  className="ml-auto rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  Delete
                </button>
              </div>
              <p className="mb-2 text-sm text-dark-600 dark:text-dark-300">{entry.context}</p>
              <p className="mb-2 text-sm text-dark-600 dark:text-dark-300">
                <strong>Decision:</strong> {entry.decision}
              </p>
              <p className="text-sm text-dark-500 dark:text-dark-300">
                <strong>Rationale:</strong> {entry.rationale}
              </p>

              {(entry.alternatives_considered?.length > 0 ||
                entry.key_assumptions?.length > 0 ||
                entry.success_metrics?.length > 0) && (
                <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs text-dark-500 dark:text-dark-400">
                  {entry.alternatives_considered?.length > 0 && (
                    <div>
                      <p className="font-medium text-dark-600 dark:text-dark-300 mb-1">Alternatives</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {entry.alternatives_considered.map((a, i) => (
                          <li key={i}>
                            {a.name}
                            {a.description ? ` - ${a.description}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {entry.key_assumptions?.length > 0 && (
                    <div>
                      <p className="font-medium text-dark-600 dark:text-dark-300 mb-1">Assumptions</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {entry.key_assumptions.map((a, i) => (
                          <li key={i}>{a.assumption}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {entry.success_metrics?.length > 0 && (
                    <div>
                      <p className="font-medium text-dark-600 dark:text-dark-300 mb-1">Metrics</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {entry.success_metrics.map((m, i) => (
                          <li key={i}>
                            {m.metric}
                            {m.target ? `: ${m.target}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {entry.outcome_captured && entry.outcomes?.[0] && (
                <div className="mt-4 pt-4 border-t border-dark-100 dark:border-dark-800">
                  <p className="text-sm font-medium text-dark-700 dark:text-dark-300">Outcome</p>
                  <p className="mt-1 text-sm text-dark-600 dark:text-dark-300">
                    {entry.outcomes[0].what_happened}
                  </p>
                  <p className="text-sm text-dark-600 dark:text-dark-300">
                    Right?{" "}
                    {entry.outcomes[0].was_right === "yes"
                      ? "Yes"
                      : entry.outcomes[0].was_right === "partially"
                        ? "Partially"
                        : "No"}{" "}
                    - confidence now {entry.outcomes[0].updated_confidence}/10
                  </p>
                  {entry.outcomes[0].lesson && (
                    <p className="mt-2 text-sm text-dark-500 italic dark:text-dark-300">
                      Lesson: {entry.outcomes[0].lesson}
                    </p>
                  )}
                </div>
              )}

              {!entry.outcome_captured && (
                <div className="mt-4 pt-4 border-t border-dark-100 dark:border-dark-800">
                  <button
                    type="button"
                    onClick={() => startOutcome(entry)}
                    className="rounded-lg border border-primary-300 px-4 py-2 text-xs font-medium text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:border-primary-800/50 dark:text-primary-300"
                  >
                    Tell AI what happened
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-dark-900">
            <h2 className="mb-2 text-lg font-semibold text-dark-900 dark:text-dark-100">Delete entry?</h2>
            <p className="mb-6 text-sm text-dark-500 dark:text-dark-300">This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-lg border border-dark-300 px-4 py-2 text-sm font-medium text-dark-700 hover:bg-dark-50 dark:hover:bg-dark-800 dark:text-dark-300 dark:border-dark-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
