"use client"

import { useState, useEffect } from "react"
import { db, ref, onValue, off } from "@/lib/firebase"
import { generateQuote } from "@/lib/ollama"
import { useAuth } from "@/lib/useAuth"
import { toggleFavoriteQuote, loadFavoriteQuotes } from "@/lib/firebase-crud"
import { canUseFirebasePersistence } from "@/lib/capabilities"
import { QuoteCard } from "@/components/QuoteCard"
import {
  loadQuotesCatalog,
  getBundledQuoteCategories,
  type QuoteCategory,
} from "@/lib/quotes-catalog"
import type { QuoteEntry } from "@/lib/types"

const TAB_COLORS: Record<string, { active: string; inactive: string }> = {
  rose: { active: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300", inactive: "text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200" },
  violet: { active: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300", inactive: "text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200" },
  blue: { active: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", inactive: "text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200" },
  teal: { active: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300", inactive: "text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200" },
  amber: { active: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", inactive: "text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200" },
  emerald: { active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", inactive: "text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200" },
}

function getTabClasses(categories: QuoteCategory[], catId: string, selected: boolean): string {
  const cat = categories.find((c) => c.id === catId)
  const colors = cat ? TAB_COLORS[cat.color] : TAB_COLORS.blue
  return selected ? colors.active : colors.inactive
}

export default function QuotesPage() {
  const { isAdmin } = useAuth()
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [catalogQuotes, setCatalogQuotes] = useState<QuoteEntry[]>([])
  const [categories, setCategories] = useState<QuoteCategory[]>(() => getBundledQuoteCategories())
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [generatedQuotes, setGeneratedQuotes] = useState<QuoteEntry[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [aiLoading, setAiLoading] = useState(false)
  const [aiCategory, setAiCategory] = useState("decision-making")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<QuoteEntry>>({})
  const [saving, setSaving] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    loadQuotesCatalog()
      .then(({ quotes, categories: cats }) => {
        setCatalogQuotes(quotes)
        setCategories(cats)
        if (cats[0]?.id) setAiCategory((prev) => cats.some((c) => c.id === prev) ? prev : cats[0].id)
      })
      .catch(console.error)
      .finally(() => setCatalogLoading(false))
  }, [])

  useEffect(() => {
    if (canUseFirebasePersistence()) {
      loadFavoriteQuotes().then((favs) => setFavoriteIds(new Set(favs.map((f) => f.id))))
    }
  }, [])

  const handleToggleFavorite = async (quoteId: string) => {
    const q = allQuotes.find((x: QuoteEntry) => x.id === quoteId)
    if (!q || !canUseFirebasePersistence()) return
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

  const allQuotes = [...catalogQuotes, ...generatedQuotes]
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
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${getTabClasses(categories, cat.id, selectedCategory === cat.id)}`}
          >{cat.name}</button>
        ))}
      </div>

      {/* Quote grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-10">
        {filteredQuotes.map((q) => (
          <QuoteCard
            key={q.id}
            q={q}
            categories={categories}
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
            {catalogLoading ? "Loading quotes…" : "No quotes in this category yet."}
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
