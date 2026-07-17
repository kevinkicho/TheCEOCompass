"use client"

import { useState } from "react"
import { db, ref, set, remove } from "@/lib/firebase"
import type { QuoteEntry } from "@/lib/types"
import type { QuoteCategory } from "@/lib/quotes-catalog"

const CAT_COLORS: Record<string, string> = {
  rose: "border-rose-400 dark:border-rose-500",
  violet: "border-violet-400 dark:border-violet-500",
  blue: "border-blue-400 dark:border-blue-500",
  teal: "border-teal-400 dark:border-teal-500",
  amber: "border-amber-400 dark:border-amber-500",
  emerald: "border-emerald-400 dark:border-emerald-500",
}

function getCat(categories: QuoteCategory[], catId: string) {
  return categories.find((c) => c.id === catId)
}
function getBorder(categories: QuoteCategory[], catId: string) {
  const c = getCat(categories, catId)
  return c ? CAT_COLORS[c.color] || CAT_COLORS.blue : CAT_COLORS.blue
}

interface Props {
  q: QuoteEntry
  categories: QuoteCategory[]
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
}

export function QuoteCard({
  q, categories, isAdmin, isEditing, editingId, editForm, saving, favoriteIds,
  setEditingId, setEditForm, setSaving, onToggleFavorite,
}: Props) {
  const [flipped, setFlipped] = useState(false)
  const cat = getCat(categories, q.category)

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

  const borderCls = getBorder(categories, q.category)

  return (
    <div className="rounded-xl cursor-pointer" style={{ perspective: "1000px" }} onClick={handleClick}>
      <div className="relative min-h-[220px]">
        {/* Front face */}
        <div className={`absolute inset-0 rounded-xl bg-white dark:bg-dark-900 border-l-4 ${borderCls} p-6 flex flex-col transition-all duration-500 ease-in-out will-change-transform ${flipped ? "opacity-0 pointer-events-none rotateY-180" : "opacity-100 rotateY-0"} ${q.generated ? "ring-1 ring-primary-300/30 dark:ring-primary-700/30" : ""}`}>
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
        <div className={`absolute inset-0 rounded-xl bg-white dark:bg-dark-900 border-l-4 ${borderCls} p-5 flex flex-col overflow-y-auto transition-all duration-500 ease-in-out ${flipped ? "opacity-100 rotateY-0" : "opacity-0 pointer-events-none rotateY-180"} ${q.generated ? "ring-1 ring-primary-300/30 dark:ring-primary-700/30" : ""}`}>
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
                <p className="text-xs font-semibold text-dark-900 dark:text-dark-100">— {q.person}</p>
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
