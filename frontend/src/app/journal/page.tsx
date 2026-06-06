"use client"

import { useState, useEffect } from "react"
import { getJournalEntries, createJournalEntry, createJournalOutcome } from "@/lib/api"
import { StaticModeBanner } from "@/components/StaticModeBanner"
import { BackendGuard } from "@/components/RequiresBackend"
import type { JournalEntry } from "@/lib/types"

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [showEntryModal, setShowEntryModal] = useState(false)
  const [outcomeEntryId, setOutcomeEntryId] = useState<string | null>(null)
  const [entryForm, setEntryForm] = useState({
    title: "",
    context: "",
    decision: "",
    rationale: "",
    confidence: 8,
    review_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  })
  const [outcomeForm, setOutcomeForm] = useState({
    what_happened: "",
    was_right: "partially",
    updated_confidence: 7,
    lesson: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isOutcomeLoading, setIsOutcomeLoading] = useState(false)

  useEffect(() => {
    loadEntries()
  }, [])

  const loadEntries = async () => {
    try {
      const data = await getJournalEntries()
      setEntries(data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const entry = await createJournalEntry({
        ...entryForm,
        alternatives_considered: [],
        key_assumptions: [],
        success_metrics: [],
      })
      setEntries([entry, ...entries])
      setShowEntryModal(false)
      setEntryForm({
        title: "",
        context: "",
        decision: "",
        rationale: "",
        confidence: 8,
        review_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      })
    } catch (err) {
      console.error(err)
    }
    setIsLoading(false)
  }

  const handleOutcomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!outcomeEntryId) return
    setIsOutcomeLoading(true)
    try {
      await createJournalOutcome(outcomeEntryId, outcomeForm)
      setOutcomeEntryId(null)
      setOutcomeForm({
        what_happened: "",
        was_right: "partially",
        updated_confidence: 7,
        lesson: "",
      })
      await loadEntries()
    } catch (err) {
      console.error(err)
    }
    setIsOutcomeLoading(false)
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString()
  const isPastReview = (dateStr: string) => new Date(dateStr) < new Date()

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-dark-900 dark:text-dark-100">Decision Journal</h1>
          <p className="mt-1 text-dark-500 dark:text-dark-400 dark:text-dark-500">Track decisions, review outcomes, calibrate judgment.</p>
        </div>

        <StaticModeBanner
          feature="Decision Journal"
          description="Log decisions, record outcomes, and track calibration over time"
        />
        <BackendGuard feature="Decision Journal">
          <button
          onClick={() => setShowEntryModal(true)}
          className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          New Entry
        </button>
        </BackendGuard>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dark-200 dark:border-dark-700 p-12 text-center">
          <p className="mb-4 text-dark-500 dark:text-dark-400 dark:text-dark-500">No decisions logged yet. Complete a scenario or log your first decision.</p>
          <BackendGuard feature="Decision Journal">
            <button
            onClick={() => setShowEntryModal(true)}
            className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            Log Your First Decision
          </button>
          </BackendGuard>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-xl border border-dark-200 dark:border-dark-700 p-5 hover:shadow-md transition"
            >
              <div className="mb-3 flex items-center gap-3">
                <h2 className="font-semibold text-dark-900 dark:text-dark-100">{entry.title}</h2>
                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                  Confidence: {entry.confidence}/10
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${entry.outcome_captured ? "bg-green-100 text-green-700" : isPastReview(entry.review_date) ? "bg-amber-100 text-amber-700" : "bg-dark-100 text-dark-600 dark:text-dark-300 dark:text-dark-600"}`}>
                  {entry.outcome_captured
                    ? "Outcome Recorded"
                    : isPastReview(entry.review_date)
                    ? "Ready for Review"
                    : `Review by ${formatDate(entry.review_date)}`}
                </span>
              </div>
              <p className="mb-2 text-sm text-dark-600 dark:text-dark-300 dark:text-dark-600">{entry.context}</p>
              <p className="mb-2 text-sm text-dark-600 dark:text-dark-300 dark:text-dark-600"><strong>Decision:</strong> {entry.decision}</p>
              <p className="text-sm text-dark-500 dark:text-dark-400 dark:text-dark-500"><strong>Rationale:</strong> {entry.rationale}</p>

              {/* Recorded Outcome */}
              {entry.outcome_captured && entry.outcomes?.[0] && (
                <div className="mt-4 pt-4 border-t border-dark-100 dark:border-dark-800">
                  <p className="text-sm font-medium text-dark-700 dark:text-dark-300 dark:text-dark-600">Outcome Review</p>
                  <p className="mt-1 text-sm text-dark-600 dark:text-dark-300 dark:text-dark-600"><strong>What happened:</strong> {entry.outcomes[0].what_happened}</p>
                  <p className="text-sm text-dark-600 dark:text-dark-300 dark:text-dark-600"><strong>Was I right?</strong> {entry.outcomes[0].was_right === "yes" ? "Yes" : entry.outcomes[0].was_right === "partially" ? "Partially" : "No"}</p>
                  <p className="text-sm text-dark-600 dark:text-dark-300 dark:text-dark-600"><strong>Updated confidence:</strong> {entry.outcomes[0].updated_confidence}/10</p>
                  {entry.outcomes[0].lesson && (
                    <p className="mt-2 text-sm text-dark-500 dark:text-dark-400 dark:text-dark-500 italic">&ldquo;{entry.outcomes[0].lesson}&rdquo;</p>
                  )}
                </div>
              )}

              {/* Review button */}
              {!entry.outcome_captured && (
                <div className="mt-4 pt-4 border-t border-dark-100 dark:border-dark-800">
                  <button
                    onClick={() => {
                      setOutcomeEntryId(entry.id)
                      setOutcomeForm({
                        what_happened: "",
                        was_right: "partially",
                        updated_confidence: entry.confidence,
                        lesson: "",
                      })
                    }}
                    className="rounded-lg border border-primary-300 px-4 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50"
                  >
                    Record Outcome
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Entry Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-xl dark:bg-dark-900 bg-white dark:bg-dark-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="mb-4 text-xl font-semibold text-dark-900 dark:text-dark-100">New Decision Entry</h2>
            <form onSubmit={handleCreateEntry} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300 dark:text-dark-600">Title</label>
                <input type="text" value={entryForm.title} onChange={(e) => setEntryForm({ ...entryForm, title: e.target.value })} className="w-full rounded-lg border border-dark-200 dark:border-dark-700 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300 dark:text-dark-600">Context</label>
                <textarea value={entryForm.context} onChange={(e) => setEntryForm({ ...entryForm, context: e.target.value })} rows={3} className="w-full resize-none rounded-lg border border-dark-200 dark:border-dark-700 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300 dark:text-dark-600">Decision</label>
                <textarea value={entryForm.decision} onChange={(e) => setEntryForm({ ...entryForm, decision: e.target.value })} rows={2} className="w-full resize-none rounded-lg border border-dark-200 dark:border-dark-700 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300 dark:text-dark-600">Rationale</label>
                <textarea value={entryForm.rationale} onChange={(e) => setEntryForm({ ...entryForm, rationale: e.target.value })} rows={2} className="w-full resize-none rounded-lg border border-dark-200 dark:border-dark-700 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none" required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300 dark:text-dark-600">Confidence (1-10)</label>
                  <select value={entryForm.confidence} onChange={(e) => setEntryForm({ ...entryForm, confidence: Number(e.target.value) })} className="w-full rounded-lg border border-dark-200 dark:border-dark-700 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none">
                    {[...Array(10)].map((_, i) => (<option key={i + 1} value={i + 1}>{i + 1}</option>))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300 dark:text-dark-600">Review Date</label>
                  <input type="date" value={entryForm.review_date} onChange={(e) => setEntryForm({ ...entryForm, review_date: e.target.value })} className="w-full rounded-lg border border-dark-200 dark:border-dark-700 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowEntryModal(false)} className="rounded-lg border border-dark-300 dark:border-dark-600 px-5 py-2.5 text-sm font-medium text-dark-700 dark:text-dark-300 dark:text-dark-600 hover:bg-dark-50 dark:hover:bg-dark-800">Cancel</button>
                <button type="submit" disabled={isLoading} className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{isLoading ? "Saving..." : "Save Entry"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Outcome Modal */}
      {outcomeEntryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl dark:bg-dark-900 bg-white dark:bg-dark-900 p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold text-dark-900 dark:text-dark-100">Record Outcome</h2>
            <form onSubmit={handleOutcomeSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300 dark:text-dark-600">What Actually Happened?</label>
                <textarea value={outcomeForm.what_happened} onChange={(e) => setOutcomeForm({ ...outcomeForm, what_happened: e.target.value })} rows={3} className="w-full resize-none rounded-lg border border-dark-200 dark:border-dark-700 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300 dark:text-dark-600">Was I Right?</label>
                <select value={outcomeForm.was_right} onChange={(e) => setOutcomeForm({ ...outcomeForm, was_right: e.target.value })} className="w-full rounded-lg border border-dark-200 dark:border-dark-700 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none">
                  <option value="yes">Yes — called it correctly</option>
                  <option value="partially">Partially — right direction, wrong details</option>
                  <option value="no">No — completely wrong</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300 dark:text-dark-600">Updated Confidence (1-10)</label>
                <select value={outcomeForm.updated_confidence} onChange={(e) => setOutcomeForm({ ...outcomeForm, updated_confidence: Number(e.target.value) })} className="w-full rounded-lg border border-dark-200 dark:border-dark-700 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none">
                  {[...Array(10)].map((_, i) => (<option key={i + 1} value={i + 1}>{i + 1}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300 dark:text-dark-600">Lesson Learned</label>
                <textarea value={outcomeForm.lesson} onChange={(e) => setOutcomeForm({ ...outcomeForm, lesson: e.target.value })} rows={2} placeholder="What will you do differently next time?" className="w-full resize-none rounded-lg border border-dark-200 dark:border-dark-700 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOutcomeEntryId(null)} className="rounded-lg border border-dark-300 dark:border-dark-600 px-5 py-2.5 text-sm font-medium text-dark-700 dark:text-dark-300 dark:text-dark-600 hover:bg-dark-50 dark:hover:bg-dark-800">Cancel</button>
                <button type="submit" disabled={isOutcomeLoading} className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{isOutcomeLoading ? "Saving..." : "Save Outcome"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}