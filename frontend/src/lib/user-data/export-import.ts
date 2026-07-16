import { get, set, ref, remove } from "../firebase"
import { getDb, requireUid, userPath } from "./scope"
import type { JournalEntry } from "../types"
import type { ReviewRecord } from "../spaced-repetition"
import { loadJournalEntries } from "./journal"
import { loadAllReviews } from "./reviews"
import { loadPathwayProgress, loadFavoriteQuotes } from "./progress"

export type UserDataExport = {
  schema_version: 1
  exported_at: string
  journal: JournalEntry[]
  reviews: ReviewRecord[]
  progress: { completed_ids: string[]; current_module_id: string | null }
  favoriteQuotes: { id: string; text: string; person: string }[]
}

const BATCH = 200

export async function exportUserData(): Promise<UserDataExport> {
  requireUid()
  const [journal, reviews, progress, favoriteQuotes] = await Promise.all([
    loadJournalEntries(),
    loadAllReviews(),
    loadPathwayProgress(),
    loadFavoriteQuotes(),
  ])
  return {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    journal,
    reviews,
    progress: {
      completed_ids: progress.completedIds,
      current_module_id: progress.inProgressId,
    },
    favoriteQuotes,
  }
}

function downloadJson(filename: string, data: unknown) {
  if (typeof window === "undefined") return
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadUserDataExport(): Promise<void> {
  const data = await exportUserData()
  downloadJson(`ceocompass-export-${new Date().toISOString().slice(0, 10)}.json`, data)
}

async function setChunked(basePath: string, map: Record<string, unknown>) {
  const database = getDb()
  const entries = Object.entries(map)
  for (let i = 0; i < entries.length; i += BATCH) {
    const chunk = entries.slice(i, i + BATCH)
    await Promise.all(chunk.map(([k, v]) => set(ref(database, `${basePath}/${k}`), v)))
  }
}

export async function importUserData(
  raw: unknown,
  mode: "merge" | "replace",
): Promise<{ journal: number; reviews: number }> {
  const uid = requireUid()
  const database = getDb()

  if (!raw || typeof raw !== "object") throw new Error("Invalid export file")
  const data = raw as Partial<UserDataExport>
  if (data.schema_version !== 1) throw new Error("Unsupported schema_version")

  if (mode === "replace") {
    // Export-first is caller's responsibility
    await Promise.all([
      remove(ref(database, userPath(uid, "journal"))),
      remove(ref(database, userPath(uid, "reviews"))),
      remove(ref(database, userPath(uid, "progress"))),
      remove(ref(database, userPath(uid, "favoriteQuotes"))),
    ])
  }

  const journal = data.journal || []
  const journalMap: Record<string, unknown> = {}
  for (const e of journal) {
    if (!e?.id || !e.title) continue
    journalMap[e.id] = {
      title: e.title,
      context: e.context || "",
      decision: e.decision || "",
      rationale: e.rationale || "",
      confidence: e.confidence ?? 5,
      review_date: e.review_date || "",
      alternatives_considered: e.alternatives_considered || [],
      key_assumptions: e.key_assumptions || [],
      success_metrics: e.success_metrics || [],
      outcome_captured: e.outcome_captured || false,
      created_at: e.created_at || new Date().toISOString(),
      outcomes: e.outcomes || undefined,
    }
  }
  if (Object.keys(journalMap).length) {
    await setChunked(userPath(uid, "journal", "entries"), journalMap)
  }

  const reviews = data.reviews || []
  const reviewMap: Record<string, unknown> = {}
  if (mode === "merge") {
    const existing = await get(ref(database, userPath(uid, "reviews")))
    if (existing.exists()) Object.assign(reviewMap, existing.val())
  }
  for (const r of reviews) {
    if (!r?.conceptId) continue
    const prev = reviewMap[r.conceptId] as ReviewRecord | undefined
    if (
      mode === "merge" &&
      prev &&
      (prev.reviewCount || 0) > (r.reviewCount || 0)
    ) {
      continue
    }
    if (
      mode === "merge" &&
      prev &&
      (prev.reviewCount || 0) === (r.reviewCount || 0) &&
      new Date(prev.lastReviewedAt || 0) > new Date(r.lastReviewedAt || 0)
    ) {
      continue
    }
    reviewMap[r.conceptId] = r
  }
  if (Object.keys(reviewMap).length) {
    await setChunked(userPath(uid, "reviews"), reviewMap)
  }

  if (data.progress) {
    const path = userPath(uid, "progress")
    if (mode === "merge") {
      const snap = await get(ref(database, path))
      const cur = snap.exists() ? snap.val() : {}
      const completed = Array.from(
        new Set([...(cur.completed_ids || []), ...(data.progress.completed_ids || [])]),
      )
      await set(ref(database, path), {
        completed_ids: completed,
        current_module_id: cur.current_module_id || data.progress.current_module_id || null,
      })
    } else {
      await set(ref(database, path), {
        completed_ids: data.progress.completed_ids || [],
        current_module_id: data.progress.current_module_id || null,
      })
    }
  }

  if (data.favoriteQuotes?.length) {
    const map: Record<string, unknown> = {}
    for (const q of data.favoriteQuotes) {
      if (!q.id) continue
      map[q.id] = { text: q.text, person: q.person, saved_at: new Date().toISOString() }
    }
    await setChunked(userPath(uid, "favoriteQuotes"), map)
  }

  return { journal: Object.keys(journalMap).length, reviews: Object.keys(reviewMap).length }
}
