"use client"

import { useState, useEffect } from "react"
import quotesData from "@/data/quotes.json"
import { db, ref, onValue, off, remove, set } from "@/lib/firebase"
import { generateQuote } from "@/lib/ollama"
import { useAuth } from "@/lib/useAuth"
import { toggleFavoriteQuote, loadFavoriteQuotes } from "@/lib/firebase-crud"
import { isStaticHosting } from "@/components/RequiresBackend"
import type { QuoteEntry } from "@/lib/types"

type CategoryInfo = {
  id: string
  name: string
  icon: string
  color: string
}

const categories: CategoryInfo[] = (quotesData as any).categories
const staticQuotes: QuoteEntry[] = (quotesData as any).quotes

const CAT_COLORS: Record<string, string> = {
  rose: "border-rose-400 dark:border-rose-500",
  violet: "border-violet-400 dark:border-violet-500",
  blue: "border-blue-400 dark:border-blue-500",
  teal: "border-teal-400 dark:border-teal-500",
  amber: "border-amber-400 dark:border-amber-500",
  emerald: "border-emerald-400 dark:border-emerald-500",
}

const CAT_BG: Record<string, string> = {
  rose: "bg-rose-50/60 dark:bg-rose-900/10",
  violet: "bg-violet-50/60 dark:bg-violet-900/10",
  blue: "bg-blue-50/60 dark:bg-blue-900/10",
  teal: "bg-teal-50/60 dark:bg-teal-900/10",
  amber: "bg-amber-50/60 dark:bg-amber-900/10",
  emerald: "bg-emerald-50/60 dark:bg-emerald-900/10",
}

const TAB_COLORS: Record<string, { active: string; inactive: string }> = {
  rose: { active: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300", inactive: "text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200" },
  violet: { active: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300", inactive: "text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200" },
  blue: { active: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", inactive: "text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200" },
  teal: { active: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300", inactive: "text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200" },
  amber: { active: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", inactive: "text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200" },
  emerald: { active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", inactive: "text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200" },
}

function getCat(catId: string) { return categories.find((c) => c.id === catId) }
function getBorder(catId: string) { const c = getCat(catId); return c ? CAT_COLORS[c.color] || CAT_COLORS.blue : CAT_COLORS.blue }
function getBg(catId: string) { const c = getCat(catId); return c ? CAT_BG[c.color] || CAT_BG.blue : CAT_BG.blue }
function getTabClasses(catId: string, selected: boolean): string {
  const cat = getCat(catId)
  const colors = cat ? TAB_COLORS[cat.color] : TAB_COLORS.blue
  return selected ? colors.active : colors.inactive
}

function QuoteCard({
  q,
  isAdmin,
  isEditing,
  editingId,
  editForm,
  saving,
  favoriteIds,
  setEditingId,
  setEditForm,
  setSaving,
  onToggleFavorite,
}: {
  q: QuoteEntry
  isAdmin: boolean
  isEditing: boolean
  editingId: string | null
  editForm: Partial<QuoteEntry>
  saving: boolean
  favoriteIds: Set<string>
  setEditingId: (id: string | null) => void
  setEditForm: React.Dispatch<React.SetStateAction<Partial<QuoteEntry>>>
  setSaving: (v: boolean) => void
  onToggleFavorite: (id: string) => void
}) {
  const [flipped, setFlipped] = useState(false)
  const cat = getCat(q.category)

  const startEdit = () => {
    setEditingId(q.id)
    setEditForm({
      person: q.person, role: q.role, text: q.text,
      context: q.context || "", source: q.source || "", year: q.year || "",
    })
  }

  const cancelEdit = () => { setEditingId(null); setEditForm({}) }

  const saveEdit = async () => {
    if (!db || !q.rtdbId) return
    setSaving(true)
    try {
      await set(ref(db, `quotes/generated/${q.rtdbId}/result`), JSON.stringify({
        person: editForm.person || q.person,
        role: editForm.role || q.role,
        text: editForm.text || q.text,
        context: editForm.context || "",
        source: editForm.source || "",
        year: editForm.year || "",
      }))
    } catch (err) { console.error(err) }
    setEditingId(null)
    setEditForm({})
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!db || !q.rtdbId) return
    if (!window.confirm("Delete this AI-generated quote?")) return
    try { await remove(ref(db, `quotes/generated/${q.rtdbId}`)) } catch (err) { console.error(err) }
  }

  const handleClick = () => {
    if (editingId !== q.id) setFlipped((f) => !f)
  }

  const borderCls = getBorder(q.category)
  const bgCls = getBg(q.category)

  return (
      <div
        className="rounded-xl cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={handleClick}
      >
        <div className="relative min-h-[220px]">
        {/* Front face */}
        <div
          className={`absolute inset-0 rounded-xl bg-white dark:bg-dark-900 border-l-4 ${borderCls} p-6 flex flex-col transition-all duration-500 ease-in-out ${
            flipped ? "opacity-0 pointer-events-none rotateY-180" : "opacity-100 rotateY-0"
          } ${q.generated ? "ring-1 ring-primary-300/30 dark:ring-primary-700/30" : ""}`}
        >
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(q.id) }}
              className="text-sm transition hover:scale-110"
            >{favoriteIds.has(q.id) ? "♥" : "♡"}</button>
            {q.generated && (
              <span className="rounded-full bg-primary-100 dark:bg-primary-900/30 px-2 py-0.5 text-[10px] font-medium text-primary-600 dark:text-primary-300">Generated</span>
            )}
          </div>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-base leading-relaxed text-dark-800 dark:text-dark-200 italic text-center
              before:content-['\201C'] before:opacity-40 before:mr-1
              after:content-['\201D'] after:opacity-40 after:ml-1">
              {q.text}
            </p>
          </div>
        </div>

        {/* Back face */}
        <div
          className={`absolute inset-0 rounded-xl bg-white dark:bg-dark-900 border-l-4 ${borderCls} p-5 flex flex-col overflow-y-auto transition-all duration-500 ease-in-out ${
            flipped ? "opacity-100 rotateY-0" : "opacity-0 pointer-events-none rotateY-180"
          } ${q.generated ? "ring-1 ring-primary-300/30 dark:ring-primary-700/30" : ""}`}
        >
          {isEditing ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <input value={editForm.person || ""} onChange={(e) => setEditForm((f) => ({ ...f, person: e.target.value }))} placeholder="Person"
                className="w-full rounded border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800 px-2 py-1 text-xs font-semibold text-dark-900 dark:text-dark-100" />
              <input value={editForm.role || ""} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))} placeholder="Role"
                className="w-full rounded border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800 px-2 py-1 text-xs text-dark-700 dark:text-dark-200" />
              <textarea value={editForm.text || ""} onChange={(e) => setEditForm((f) => ({ ...f, text: e.target.value }))} placeholder="Quote text"
                className="w-full rounded border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800 px-2 py-1 text-xs italic text-dark-700 dark:text-dark-200 resize-y h-14" />
              <input value={editForm.source || ""} onChange={(e) => setEditForm((f) => ({ ...f, source: e.target.value }))} placeholder="Source (optional)"
                className="w-full rounded border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800 px-2 py-1 text-xs text-dark-700 dark:text-dark-200" />
              <input value={editForm.year || ""} onChange={(e) => setEditForm((f) => ({ ...f, year: e.target.value }))} placeholder="Year (e.g. ~2005)"
                className="w-full rounded border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800 px-2 py-1 text-xs text-dark-700 dark:text-dark-200" />
              <textarea value={editForm.context || ""} onChange={(e) => setEditForm((f) => ({ ...f, context: e.target.value }))} placeholder="Context (optional)"
                className="w-full rounded border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800 px-2 py-1 text-xs resize-y h-12 text-dark-700 dark:text-dark-200" />
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={saving}
                  className="rounded bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 transition disabled:opacity-50"
                >{saving ? "Saving..." : "Save"}</button>
                <button onClick={cancelEdit}
                  className="rounded border border-dark-200 dark:border-dark-700 px-3 py-1 text-xs text-dark-600 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-800 transition"
                >Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex-1">
                {q.generated && (
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-primary-100 dark:bg-primary-900/30 px-2 py-0.5 text-[10px] font-medium text-primary-600 dark:text-primary-300">Generated</span>
                    {cat && <span className="rounded-full bg-dark-100 dark:bg-dark-800 px-2 py-0.5 text-[10px] text-dark-500 dark:text-dark-400">{cat.name}</span>}
                  </div>
                )}
                <p className="text-sm leading-relaxed text-dark-800 dark:text-dark-200 mb-3 italic
                  before:content-['\201C'] before:mr-0.5 after:content-['\201D'] after:ml-0.5">
                  {q.text}
                </p>
                <p className="text-xs font-semibold text-dark-900 dark:text-dark-100">&mdash; {q.person}</p>
                <p className="text-[11px] text-dark-500 dark:text-dark-400 mt-0.5">
                  {q.role}
                  {q.year && <span className="opacity-50 ml-1.5">{q.year}</span>}
                </p>
                {q.source && <p className="text-[10px] text-dark-400 dark:text-dark-500 mt-0.5 italic">{q.source}</p>}
                {q.context && <p className="text-[11px] text-dark-400 dark:text-dark-500 mt-3 leading-relaxed">{q.context}</p>}
              </div>
              {q.generated && isAdmin && (
                <div className="mt-3 pt-2 border-t border-dark-100 dark:border-dark-700 flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); startEdit(); }} className="text-[10px] font-medium text-primary-500 hover:text-primary-600 transition">Edit</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} className="text-[10px] font-medium text-red-500 hover:text-red-600 transition">Delete</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function QuotesPage() {
  const { isAdmin } = useAuth()
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [generatedQuotes, setGeneratedQuotes] = useState<QuoteEntry[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [aiLoading, setAiLoading] = useState(false)
  const [aiCategory, setAiCategory] = useState("decision-making")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<QuoteEntry>>({})
  const [saving, setSaving] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    if (!isStaticHosting) {
      loadFavoriteQuotes().then((favs) => setFavoriteIds(new Set(favs.map((f) => f.id))))
    }
  }, [])

  const handleToggleFavorite = async (quoteId: string) => {
    const q = allQuotes.find((x: QuoteEntry) => x.id === quoteId)
    if (!q || isStaticHosting) return
    const isFav = await toggleFavoriteQuote(quoteId, { text: q.text, person: q.person })
    setFavoriteIds((prev) => {
      const next = new Set(prev)
      if (isFav) next.add(quoteId); else next.delete(quoteId)
      return next
    })
  }

  useEffect(() => {
    if (!db) return
    const genRef = ref(db, "quotes/generated")
    const cb = onValue(genRef, (snap) => {
      const val = snap.val()
      if (!val) { setGeneratedQuotes([]); return }
      const list: QuoteEntry[] = []
      for (const [key, entry] of Object.entries(val)) {
        const e = entry as any
        if (e.result) {
          try {
            const parsed = JSON.parse(e.result)
            list.push({
              id: `gen-${key}`, rtdbId: key,
              person: parsed.person || "Unknown", role: parsed.role || "",
              text: parsed.text || "", context: parsed.context || "",
              source: parsed.source || "", year: parsed.year || "",
              category: e.category || "decision-making", generated: true,
            })
          } catch {}
        }
      }
      setGeneratedQuotes(list)
    })
    return () => off(genRef, "value", cb)
  }, [])

  const allQuotes = [...staticQuotes, ...generatedQuotes]
  const searched = searchQuery.trim()
    ? allQuotes.filter((q) =>
        [q.text, q.person, q.role, q.context, q.source, q.year].some(
          (f) => f && f.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : allQuotes
  const filteredQuotes = selectedCategory === "saved"
    ? searched.filter((q) => favoriteIds.has(q.id))
    : selectedCategory === "all"
      ? searched
      : searched.filter((q) => q.category === selectedCategory)

  const currentPrompt = `You are a curator of wisdom. Generate an insightful, real quote from a notable figure (CEO, philosopher, scientist, economist, or strategist) on the topic of ${
    ({ "risk-management": "Risk management, uncertainty, probability, and decision-making under unknown conditions",
       "decision-making": "Decision-making, cognitive biases, thinking models, and mental frameworks",
       "strategy-planning": "Strategy, planning, competitive positioning, and trade-offs",
       "modeling-analytics": "Analytical methods, modeling, statistics, and systems thinking",
       "organizational-management": "Organizational leadership, management, and corporate culture",
       "supply-chain-operations": "Supply chain, lean operations, quality control, and process improvement" } as Record<string, string>)[aiCategory] || "Leadership and management"
  }.

The quote must be authentic to the person's known views and era. Include a plausible year or time period.

Return ONLY valid JSON:
{
  "person": "Full name of the speaker",
  "role": "Brief description (e.g. 'Investor & Manager', 'Nobel economist & psychologist')",
  "text": "The quote itself, 1-3 sentences",
  "context": "Brief explanation or background (1-2 sentences)",
  "source": "Book, speech, or context the quote is from (optional)",
  "year": "Year or approximate period (e.g. ~2005, ~500 BC, ~1980s)"
}`

  const handleGenerate = async () => {
    setAiLoading(true)
    try { await generateQuote(aiCategory) } catch (err) { console.error(err) }
    setAiLoading(false)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-dark-900 dark:text-dark-100 mb-2">Quotes</h1>
        <p className="text-sm text-dark-500 dark:text-dark-400 max-w-xl mx-auto">
          Wisdom from leaders, thinkers, and practitioners across management, strategy, and leadership
        </p>
      </div>

      {/* Search */}
      <div className="mb-6 max-w-md mx-auto">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 dark:text-dark-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search quotes, people, topics..."
            className="w-full rounded-xl border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800 pl-10 pr-4 py-2.5 text-sm text-dark-800 dark:text-dark-200 placeholder:text-dark-400 dark:placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-600"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        <button onClick={() => setSelectedCategory("all")}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
            selectedCategory === "all"
              ? "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
              : "text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200"
          }`}>All</button>
        <button onClick={() => setSelectedCategory("saved")}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
            selectedCategory === "saved"
              ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
              : "text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200"
          }`}>♥ Saved ({favoriteIds.size})</button>
        {categories.map((cat) => (
          <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${getTabClasses(cat.id, selectedCategory === cat.id)}`}
          >{cat.name}</button>
        ))}
      </div>

      {/* Quote grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-10">
        {filteredQuotes.map((q) => (
          <QuoteCard
            key={q.id}
            q={q}
            isAdmin={isAdmin}
            isEditing={editingId === q.id}
            editingId={editingId}
            editForm={editForm}
            saving={saving}
            favoriteIds={favoriteIds}
            setEditingId={setEditingId}
            setEditForm={setEditForm}
            setSaving={setSaving}
            onToggleFavorite={handleToggleFavorite}
          />
        ))}
        {filteredQuotes.length === 0 && (
          <div className="col-span-full text-center py-12 text-dark-400 dark:text-dark-500 text-sm">
            No quotes in this category yet.
          </div>
        )}
      </div>

      {/* AI generation */}
      <div className="rounded-xl border border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-800/30 p-6 max-w-lg mx-auto">
        <h2 className="text-sm font-semibold text-dark-900 dark:text-dark-100 mb-3">Generate a Quote with AI</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-[10px] font-medium text-dark-500 dark:text-dark-400 mb-1 uppercase tracking-wide">Category</label>
            <select value={aiCategory} onChange={(e) => setAiCategory(e.target.value)}
              className="w-full rounded-lg border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800 px-3 py-2 text-xs text-dark-700 dark:text-dark-200"
            >{categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}</select>
          </div>
          <button onClick={handleGenerate} disabled={aiLoading}
            className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-700 transition disabled:opacity-50 shrink-0"
          >{aiLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </span>
          ) : "Generate"}</button>
        </div>

        <div className="mt-3">
          <button onClick={() => setShowPrompt(!showPrompt)}
            className="text-xs text-dark-400 dark:text-dark-500 hover:text-dark-600 dark:hover:text-dark-300 transition"
          >{showPrompt ? "Hide prompt" : "Show prompt"}</button>
          {showPrompt && (
            <pre className="mt-2 rounded-lg bg-dark-800 p-3 text-xs text-green-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto">{currentPrompt}</pre>
          )}
        </div>
      </div>
    </div>
  )
}
