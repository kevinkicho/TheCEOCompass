import { ref, set, get, remove } from "../firebase"
import type { FrameworkListItem } from "../types"
import { getDb, requireUid, userPath, dbOptional } from "./scope-helpers"

export async function loadPathwayProgress(): Promise<{ completedIds: string[]; inProgressId: string | null }> {
  const database = getDb()
  const uid = requireUid()
  const snap = await get(ref(database, userPath(uid, "progress")))
  if (!snap.exists()) return { completedIds: [], inProgressId: null }
  const d = snap.val()
  return {
    completedIds: d.completed_ids || [],
    inProgressId: d.current_module_id || null,
  }
}

export async function markPathwayComplete(slug: string): Promise<void> {
  const database = getDb()
  const uid = requireUid()
  const path = userPath(uid, "progress")
  const snap = await get(ref(database, path))
  const current = snap.exists() ? snap.val() : {}
  const completed = current.completed_ids || []
  if (!completed.includes(slug)) {
    completed.push(slug)
  }
  await set(ref(database, path), {
    completed_ids: completed,
    current_module_id: current.current_module_id || null,
  })
}

export async function saveQuizResult(score: number, total: number, frameworkSlug: string): Promise<void> {
  const database = dbOptional()
  if (!database) return
  const uid = requireUid()
  const resultId = crypto.randomUUID()
  await set(ref(database, userPath(uid, "quizResults", resultId)), {
    score,
    total,
    framework_slug: frameworkSlug,
    pct: total > 0 ? Math.round((score / total) * 100) : 0,
    completed_at: new Date().toISOString(),
  })
}

export async function saveScenarioAttempt(
  scenarioSlug: string,
  stages: { stageId: string; choice: string; score: number }[],
): Promise<void> {
  const database = dbOptional()
  if (!database) return
  const uid = requireUid()
  const attemptId = crypto.randomUUID()
  await set(ref(database, userPath(uid, "scenarioHistory", scenarioSlug, attemptId)), {
    stages,
    completed_at: new Date().toISOString(),
  })
}

export async function loadScenarioHistory(
  scenarioSlug: string,
): Promise<{ attemptId: string; stages: { stageId: string; choice: string; score: number }[]; completed_at: string }[]> {
  const database = dbOptional()
  if (!database) return []
  const uid = requireUid()
  const snap = await get(ref(database, userPath(uid, "scenarioHistory", scenarioSlug)))
  if (!snap.exists()) return []
  const val = snap.val()
  return Object.entries(val)
    .map(([attemptId, d]: [string, unknown]) => {
      const row = d as { stages?: { stageId: string; choice: string; score: number }[]; completed_at?: string }
      return {
        attemptId,
        stages: row.stages || [],
        completed_at: row.completed_at || "",
      }
    })
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
}

export async function toggleFavoriteQuote(
  quoteId: string,
  data: { text: string; person: string },
): Promise<boolean> {
  const database = dbOptional()
  if (!database) return false
  const uid = requireUid()
  const path = userPath(uid, "favoriteQuotes", quoteId)
  const snap = await get(ref(database, path))
  if (snap.exists()) {
    await remove(ref(database, path))
    return false
  }
  await set(ref(database, path), {
    text: data.text,
    person: data.person,
    saved_at: new Date().toISOString(),
  })
  return true
}

export async function loadFavoriteQuotes(): Promise<{ id: string; text: string; person: string }[]> {
  const database = dbOptional()
  if (!database) return []
  const uid = requireUid()
  const snap = await get(ref(database, userPath(uid, "favoriteQuotes")))
  if (!snap.exists()) return []
  const val = snap.val()
  return Object.entries(val).map(([id, d]: [string, unknown]) => {
    const row = d as { text?: string; person?: string }
    return { id, text: row.text || "", person: row.person || "" }
  })
}

export function buildPathway(frameworks: FrameworkListItem[]) {
  const categoryOrder = [
    "decision-making", "strategy", "financial", "negotiation",
    "analysis", "engineering", "innovation", "org",
    "operations", "risk",
  ]
  const grouped = new Map<string, FrameworkListItem[]>()
  for (const fw of frameworks) {
    const cat = fw.category || "other"
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(fw)
  }
  const ordered: FrameworkListItem[] = []
  const seen = new Set<string>()
  for (const cat of categoryOrder) {
    const items = (grouped.get(cat) || []).sort((a, b) => a.difficulty - b.difficulty)
    for (const item of items) {
      if (!seen.has(item.slug)) {
        ordered.push(item)
        seen.add(item.slug)
      }
    }
  }
  for (const [, items] of grouped) {
    for (const item of items) {
      if (!seen.has(item.slug)) {
        ordered.push(item)
        seen.add(item.slug)
      }
    }
  }
  return ordered
}
