import { db, ref, set, get, push, query, orderByChild, remove, onValue, off } from "./firebase"
import type { JournalEntry, JournalOutcome, FrameworkListItem } from "./types"

const DEVICE_ID_KEY = "ceocompass_device_id"

function getDeviceId(): string {
  if (typeof window === "undefined") return "server"
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

function journalPath(deviceId: string, entryId?: string): string {
  return entryId ? `journal/${deviceId}/entries/${entryId}` : `journal/${deviceId}/entries`
}

function outcomePath(deviceId: string, entryId: string, outcomeId?: string): string {
  return outcomeId
    ? `journal/${deviceId}/entries/${entryId}/outcomes/${outcomeId}`
    : `journal/${deviceId}/entries/${entryId}/outcomes`
}

export async function loadJournalEntries(): Promise<JournalEntry[]> {
  if (!db) throw new Error("Firebase not configured")
  const database = db!
  const deviceId = getDeviceId()
  const snap = await get(ref(database, journalPath(deviceId)))
  if (!snap.exists()) return []
  const val = snap.val()
  const entries: JournalEntry[] = []
  for (const [id, data] of Object.entries(val)) {
    const d = data as any
    if (d.title) {
      const outcomes: JournalOutcome[] = []
      if (d.outcomes) {
        for (const [oid, od] of Object.entries(d.outcomes)) {
          outcomes.push(od as JournalOutcome)
        }
      }
      entries.push({
        id,
        user_id: deviceId,
        title: d.title,
        context: d.context || "",
        decision: d.decision || "",
        rationale: d.rationale || "",
        confidence: d.confidence || 5,
        review_date: d.review_date || "",
        outcome_captured: outcomes.length > 0 || d.outcome_captured || false,
        alternatives_considered: d.alternatives_considered || [],
        key_assumptions: d.key_assumptions || [],
        success_metrics: d.success_metrics || [],
        created_at: d.created_at || new Date().toISOString(),
        outcomes,
      })
    }
  }
  entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return entries
}

export async function createJournalEntry(data: {
  title: string
  context: string
  decision: string
  rationale: string
  confidence: number
  review_date: string
  alternatives_considered: { name: string; description: string }[]
  key_assumptions: { assumption: string; test: string }[]
  success_metrics: { metric: string; target: string }[]
}): Promise<JournalEntry> {
  if (!db) throw new Error("Firebase not configured")
  const database = db!
  const deviceId = getDeviceId()
  const entryId = crypto.randomUUID()
  const entry: JournalEntry = {
    id: entryId,
    user_id: deviceId,
    ...data,
    outcome_captured: false,
    created_at: new Date().toISOString(),
  }
  await set(ref(database, journalPath(deviceId, entryId)), {
    title: entry.title,
    context: entry.context,
    decision: entry.decision,
    rationale: entry.rationale,
    confidence: entry.confidence,
    review_date: entry.review_date,
    alternatives_considered: entry.alternatives_considered,
    key_assumptions: entry.key_assumptions,
    success_metrics: entry.success_metrics,
    outcome_captured: false,
    created_at: entry.created_at,
  })
  return entry
}

export async function recordOutcome(
  entryId: string,
  data: {
    what_happened: string
    was_right: string
    updated_confidence: number
    lesson: string
  },
): Promise<void> {
  if (!db) throw new Error("Firebase not configured")
  const database = db!
  const deviceId = getDeviceId()
  const outcomeId = crypto.randomUUID()
  const outcome: JournalOutcome = {
    id: outcomeId,
    ...data,
    what_missed: "",
    what_got_right: "",
    metrics_actual: [],
  }
  await set(ref(database, outcomePath(deviceId, entryId, outcomeId)), outcome)
  await set(ref(database, `${journalPath(deviceId, entryId)}/outcome_captured`), true)
}

// ── Pathway Progress ──

export async function loadPathwayProgress(): Promise<{ completedIds: string[]; inProgressId: string | null }> {
  if (!db) throw new Error("Firebase not configured")
  const database = db!
  const deviceId = getDeviceId()
  const snap = await get(ref(database, `progress/${deviceId}`))
  if (!snap.exists()) return { completedIds: [], inProgressId: null }
  const d = snap.val()
  return {
    completedIds: d.completed_ids || [],
    inProgressId: d.current_module_id || null,
  }
}

export async function markPathwayComplete(slug: string): Promise<void> {
  if (!db) throw new Error("Firebase not configured")
  const database = db!
  const deviceId = getDeviceId()
  const snap = await get(ref(database, `progress/${deviceId}`))
  const current = snap.exists() ? snap.val() : {}
  const completed = current.completed_ids || []
  if (!completed.includes(slug)) {
    completed.push(slug)
  }
  await set(ref(database, `progress/${deviceId}`), {
    completed_ids: completed,
    current_module_id: current.current_module_id || null,
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
  for (const [cat, items] of grouped) {
    if (!categoryOrder.includes(cat)) {
      for (const item of items) {
        if (!seen.has(item.slug)) {
          ordered.push(item)
          seen.add(item.slug)
        }
      }
    }
  }
  return ordered
}
