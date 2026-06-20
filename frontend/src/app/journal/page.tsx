"use client"

import { useState, useEffect } from "react"
import { loadJournalEntries, createJournalEntry, updateJournalEntry, deleteJournalEntry, recordOutcome } from "@/lib/firebase-crud"
import type { JournalEntry } from "@/lib/types"

const DEFAULT_ENTRY_FORM = {
  title: "",
  context: "",
  decision: "",
  rationale: "",
  confidence: 8,
  review_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  alternatives_considered: [{ name: "", description: "" }],
  key_assumptions: [{ assumption: "", test: "" }],
  success_metrics: [{ metric: "", target: "" }],
}

const DEFAULT_OUTCOME_FORM = {
  what_happened: "",
  was_right: "partially",
  updated_confidence: 7,
  lesson: "",
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [showEntryModal, setShowEntryModal] = useState(false)
  const [outcomeEntryId, setOutcomeEntryId] = useState<string | null>(null)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [entryForm, setEntryForm] = useState(DEFAULT_ENTRY_FORM)
  const [outcomeForm, setOutcomeForm] = useState(DEFAULT_OUTCOME_FORM)
  const [isLoading, setIsLoading] = useState(false)
  const [isOutcomeLoading, setIsOutcomeLoading] = useState(false)
  const [journalError, setJournalError] = useState("")

  useEffect(() => {
    loadEntries()
  }, [])

  const loadEntries = async () => {
    setJournalError("")
    try {
      const data = await loadJournalEntries()
      setEntries(data)
    } catch (err) {
      setJournalError(err instanceof Error ? err.message : "Failed to load journal entries")
    }
  }

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    setJournalError("")
    setIsLoading(true)
    try {
      const formData = {
        title: entryForm.title,
        context: entryForm.context,
        decision: entryForm.decision,
        rationale: entryForm.rationale,
        confidence: entryForm.confidence,
        review_date: entryForm.review_date,
        alternatives_considered: entryForm.alternatives_considered.filter((a) => a.name.trim()),
        key_assumptions: entryForm.key_assumptions.filter((a) => a.assumption.trim()),
        success_metrics: entryForm.success_metrics.filter((m) => m.metric.trim()),
      }
      if (editingEntryId) {
        await updateJournalEntry(editingEntryId, formData)
        setEntries(entries.map((e) => e.id === editingEntryId ? { ...e, ...formData } : e))
      } else {
        const entry = await createJournalEntry(formData)
        setEntries([entry, ...entries])
      }
      setShowEntryModal(false)
      setEditingEntryId(null)
      setEntryForm(DEFAULT_ENTRY_FORM)
    } catch (err) {
      setJournalError(err instanceof Error ? err.message : "Failed to save entry")
    }
    setIsLoading(false)
  }

  const handleDeleteEntry = async () => {
    if (!confirmDeleteId) return
    setJournalError("")
    try {
      await deleteJournalEntry(confirmDeleteId)
      setEntries(entries.filter((e) => e.id !== confirmDeleteId))
      setConfirmDeleteId(null)
    } catch (err) {
      setJournalError(err instanceof Error ? err.message : "Failed to delete entry")
    }
  }

  const handleOutcomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!outcomeEntryId) return
    setJournalError("")
    setIsOutcomeLoading(true)
    try {
      await recordOutcome(outcomeEntryId, outcomeForm)
      setOutcomeEntryId(null)
      setOutcomeForm(DEFAULT_OUTCOME_FORM)
      await loadEntries()
    } catch (err) {
      setJournalError(err instanceof Error ? err.message : "Failed to save outcome")
    }
    setIsOutcomeLoading(false)
  }

  const formatDate = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleDateString() } catch { return dateStr }
  }
  const isPastReview = (dateStr: string) => {
    try { return new Date(dateStr) < new Date() } catch { return false }
  }

  const addAlt = () => setEntryForm((f) => ({ ...f, alternatives_considered: [...f.alternatives_considered, { name: "", description: "" }] }))
  const addAssumption = () => setEntryForm((f) => ({ ...f, key_assumptions: [...f.key_assumptions, { assumption: "", test: "" }] }))
  const addMetric = () => setEntryForm((f) => ({ ...f, success_metrics: [...f.success_metrics, { metric: "", target: "" }] }))

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-dark-900 dark:text-dark-100">Decision Journal</h1>
          <p className="mt-1 text-dark-500 dark:text-dark-300">Track decisions, review outcomes, calibrate judgment.</p>
        </div>
        <button
          onClick={() => setShowEntryModal(true)}
          className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          New Entry
        </button>
      </div>

      {journalError && <p className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3">{journalError}</p>}

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dark-200 p-12 text-center dark:border-dark-700">
          <p className="mb-4 text-dark-500 dark:text-dark-300">No decisions logged yet.</p>
          <button
            onClick={() => setShowEntryModal(true)}
            className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            Log Your First Decision
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-xl border border-dark-200 p-5 hover:shadow-md transition dark:border-dark-700"
            >
              <div className="mb-3 flex items-center gap-3 flex-wrap">
                <h2 className="font-semibold text-dark-900 dark:text-dark-100">{entry.title}</h2>
                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                  Confidence: {entry.confidence}/10
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${entry.outcome_captured ? "bg-green-100 text-green-700" : isPastReview(entry.review_date) ? "bg-amber-100 text-amber-700" : "bg-dark-100 text-dark-600 dark:bg-dark-800 dark:text-dark-300"}`}>
                  {entry.outcome_captured
                    ? "Outcome Recorded"
                    : isPastReview(entry.review_date)
                    ? "Ready for Review"
                    : `Review by ${formatDate(entry.review_date)}`}
                </span>
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => {
                      setEditingEntryId(entry.id)
                      setEntryForm({
                        title: entry.title,
                        context: entry.context,
                        decision: entry.decision,
                        rationale: entry.rationale,
                        confidence: entry.confidence,
                        review_date: entry.review_date?.split("T")[0] || entry.review_date,
                        alternatives_considered: entry.alternatives_considered?.length
                          ? entry.alternatives_considered : [{ name: "", description: "" }],
                        key_assumptions: entry.key_assumptions?.length
                          ? entry.key_assumptions : [{ assumption: "", test: "" }],
                        success_metrics: entry.success_metrics?.length
                          ? entry.success_metrics : [{ metric: "", target: "" }],
                      })
                      setShowEntryModal(true)
                    }}
                    className="rounded border border-dark-200 px-2.5 py-1 text-xs font-medium text-dark-600 hover:bg-dark-50 dark:border-dark-600 dark:text-dark-300 dark:hover:bg-dark-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(entry.id)}
                    className="rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="mb-2 text-sm text-dark-600 dark:text-dark-300">{entry.context}</p>
              <p className="mb-2 text-sm text-dark-600 dark:text-dark-300"><strong>Decision:</strong> {entry.decision}</p>
              <p className="text-sm text-dark-500 dark:text-dark-300"><strong>Rationale:</strong> {entry.rationale}</p>

              {entry.outcome_captured && entry.outcomes?.[0] && (
                <div className="mt-4 pt-4 border-t border-dark-100 dark:border-dark-800">
                  <p className="text-sm font-medium text-dark-700 dark:text-dark-300">Outcome Review</p>
                  <p className="mt-1 text-sm text-dark-600 dark:text-dark-300"><strong>What happened:</strong> {entry.outcomes[0].what_happened}</p>
                  <p className="text-sm text-dark-600 dark:text-dark-300"><strong>Was I right?</strong> {entry.outcomes[0].was_right === "yes" ? "Yes" : entry.outcomes[0].was_right === "partially" ? "Partially" : "No"}</p>
                  <p className="text-sm text-dark-600 dark:text-dark-300"><strong>Updated confidence:</strong> {entry.outcomes[0].updated_confidence}/10</p>
                  {entry.outcomes[0].lesson && (
                    <p className="mt-2 text-sm text-dark-500 italic dark:text-dark-300">&ldquo;{entry.outcomes[0].lesson}&rdquo;</p>
                  )}
                </div>
              )}

              {!entry.outcome_captured && (
                <div className="mt-4 pt-4 border-t border-dark-100 dark:border-dark-800">
                  <button
                    onClick={() => {
                      setOutcomeEntryId(entry.id)
                      setOutcomeForm({ ...DEFAULT_OUTCOME_FORM, updated_confidence: entry.confidence })
                    }}
                    className="rounded-lg border border-primary-300 px-4 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:border-primary-800/50 dark:text-primary-300"
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
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto dark:bg-dark-900">
            <h2 className="mb-4 text-xl font-semibold text-dark-900 dark:text-dark-100">{editingEntryId ? "Edit Decision Entry" : "New Decision Entry"}</h2>
            <form onSubmit={handleCreateEntry} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300">Title</label>
                <input type="text" value={entryForm.title} onChange={(e) => setEntryForm({ ...entryForm, title: e.target.value })} className="w-full rounded-lg border border-dark-200 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none dark:border-dark-700" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300">Context</label>
                <textarea value={entryForm.context} onChange={(e) => setEntryForm({ ...entryForm, context: e.target.value })} rows={3} className="w-full resize-none rounded-lg border border-dark-200 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none dark:border-dark-700" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300">Decision</label>
                <textarea value={entryForm.decision} onChange={(e) => setEntryForm({ ...entryForm, decision: e.target.value })} rows={2} className="w-full resize-none rounded-lg border border-dark-200 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none dark:border-dark-700" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300">Rationale</label>
                <textarea value={entryForm.rationale} onChange={(e) => setEntryForm({ ...entryForm, rationale: e.target.value })} rows={2} className="w-full resize-none rounded-lg border border-dark-200 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none dark:border-dark-700" required />
              </div>

              {/* Alternatives */}
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300">Alternatives Considered</label>
                {entryForm.alternatives_considered.map((alt, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input type="text" value={alt.name} onChange={(e) => { const a = [...entryForm.alternatives_considered]; a[i] = { ...a[i], name: e.target.value }; setEntryForm({ ...entryForm, alternatives_considered: a }) }} placeholder="Alternative name" className="flex-1 rounded-lg border border-dark-200 px-3 py-1.5 text-sm dark:border-dark-700" />
                    <input type="text" value={alt.description} onChange={(e) => { const a = [...entryForm.alternatives_considered]; a[i] = { ...a[i], description: e.target.value }; setEntryForm({ ...entryForm, alternatives_considered: a }) }} placeholder="Brief description" className="flex-1 rounded-lg border border-dark-200 px-3 py-1.5 text-sm dark:border-dark-700" />
                  </div>
                ))}
                <button type="button" onClick={addAlt} className="text-xs text-primary-600 hover:text-primary-700">+ Add alternative</button>
              </div>

              {/* Assumptions */}
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300">Key Assumptions</label>
                {entryForm.key_assumptions.map((a, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input type="text" value={a.assumption} onChange={(e) => { const as = [...entryForm.key_assumptions]; as[i] = { ...as[i], assumption: e.target.value }; setEntryForm({ ...entryForm, key_assumptions: as }) }} placeholder="Assumption" className="flex-1 rounded-lg border border-dark-200 px-3 py-1.5 text-sm dark:border-dark-700" />
                    <input type="text" value={a.test} onChange={(e) => { const as = [...entryForm.key_assumptions]; as[i] = { ...as[i], test: e.target.value }; setEntryForm({ ...entryForm, key_assumptions: as }) }} placeholder="How to test" className="flex-1 rounded-lg border border-dark-200 px-3 py-1.5 text-sm dark:border-dark-700" />
                  </div>
                ))}
                <button type="button" onClick={addAssumption} className="text-xs text-primary-600 hover:text-primary-700">+ Add assumption</button>
              </div>

              {/* Success Metrics */}
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300">Success Metrics</label>
                {entryForm.success_metrics.map((m, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input type="text" value={m.metric} onChange={(e) => { const ms = [...entryForm.success_metrics]; ms[i] = { ...ms[i], metric: e.target.value }; setEntryForm({ ...entryForm, success_metrics: ms }) }} placeholder="Metric" className="flex-1 rounded-lg border border-dark-200 px-3 py-1.5 text-sm dark:border-dark-700" />
                    <input type="text" value={m.target} onChange={(e) => { const ms = [...entryForm.success_metrics]; ms[i] = { ...ms[i], target: e.target.value }; setEntryForm({ ...entryForm, success_metrics: ms }) }} placeholder="Target value" className="flex-1 rounded-lg border border-dark-200 px-3 py-1.5 text-sm dark:border-dark-700" />
                  </div>
                ))}
                <button type="button" onClick={addMetric} className="text-xs text-primary-600 hover:text-primary-700">+ Add metric</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300">Confidence (1-10)</label>
                  <select value={entryForm.confidence} onChange={(e) => setEntryForm({ ...entryForm, confidence: Number(e.target.value) })} className="w-full rounded-lg border border-dark-200 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none dark:border-dark-700">
                    {[...Array(10)].map((_, i) => (<option key={i + 1} value={i + 1}>{i + 1}</option>))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300">Review Date</label>
                  <input type="date" value={entryForm.review_date} onChange={(e) => setEntryForm({ ...entryForm, review_date: e.target.value })} className="w-full rounded-lg border border-dark-200 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none dark:border-dark-700" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowEntryModal(false); setEditingEntryId(null); setEntryForm(DEFAULT_ENTRY_FORM) }} className="rounded-lg border border-dark-300 px-5 py-2.5 text-sm font-medium text-dark-700 hover:bg-dark-50 dark:hover:bg-dark-800 dark:text-dark-300 dark:border-dark-600">Cancel</button>
                <button type="submit" disabled={isLoading} className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{isLoading ? "Saving..." : editingEntryId ? "Update Entry" : "Save Entry"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-dark-900">
            <h2 className="mb-2 text-lg font-semibold text-dark-900 dark:text-dark-100">Delete Entry?</h2>
            <p className="mb-6 text-sm text-dark-500 dark:text-dark-300">This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-lg border border-dark-300 px-4 py-2 text-sm font-medium text-dark-700 hover:bg-dark-50 dark:hover:bg-dark-800 dark:text-dark-300 dark:border-dark-600">Cancel</button>
              <button type="button" onClick={handleDeleteEntry} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Outcome Modal */}
      {outcomeEntryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-dark-900">
            <h2 className="mb-4 text-xl font-semibold text-dark-900 dark:text-dark-100">Record Outcome</h2>
            <form onSubmit={handleOutcomeSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300">What Actually Happened?</label>
                <textarea value={outcomeForm.what_happened} onChange={(e) => setOutcomeForm({ ...outcomeForm, what_happened: e.target.value })} rows={3} className="w-full resize-none rounded-lg border border-dark-200 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none dark:border-dark-700" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300">Was I Right?</label>
                <select value={outcomeForm.was_right} onChange={(e) => setOutcomeForm({ ...outcomeForm, was_right: e.target.value })} className="w-full rounded-lg border border-dark-200 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none dark:border-dark-700">
                  <option value="yes">Yes</option>
                  <option value="partially">Partially</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300">Updated Confidence (1-10)</label>
                <select value={outcomeForm.updated_confidence} onChange={(e) => setOutcomeForm({ ...outcomeForm, updated_confidence: Number(e.target.value) })} className="w-full rounded-lg border border-dark-200 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none dark:border-dark-700">
                  {[...Array(10)].map((_, i) => (<option key={i + 1} value={i + 1}>{i + 1}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300">Lesson Learned</label>
                <textarea value={outcomeForm.lesson} onChange={(e) => setOutcomeForm({ ...outcomeForm, lesson: e.target.value })} rows={2} className="w-full resize-none rounded-lg border border-dark-200 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none dark:border-dark-700" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOutcomeEntryId(null)} className="rounded-lg border border-dark-300 px-5 py-2.5 text-sm font-medium text-dark-700 hover:bg-dark-50 dark:hover:bg-dark-800 dark:text-dark-300 dark:border-dark-600">Cancel</button>
                <button type="submit" disabled={isOutcomeLoading} className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{isOutcomeLoading ? "Saving..." : "Save Outcome"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
