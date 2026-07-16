import { ref, set, update, get, remove } from "../firebase"
import type { JournalEntry, JournalOutcome } from "../types"
import { getDb, requireUid, userPath } from "./scope"

function entriesPath(uid: string, entryId?: string): string {
  return entryId
    ? userPath(uid, "journal", "entries", entryId)
    : userPath(uid, "journal", "entries")
}

function outcomePath(uid: string, entryId: string, outcomeId?: string): string {
  return outcomeId
    ? userPath(uid, "journal", "entries", entryId, "outcomes", outcomeId)
    : userPath(uid, "journal", "entries", entryId, "outcomes")
}

export async function loadJournalEntries(): Promise<JournalEntry[]> {
  const database = getDb()
  const uid = requireUid()
  const snap = await get(ref(database, entriesPath(uid)))
  if (!snap.exists()) return []
  const val = snap.val()
  const entries: JournalEntry[] = []
  for (const [id, data] of Object.entries(val)) {
    const d = data as Record<string, unknown>
    if (d.title) {
      const outcomes: JournalOutcome[] = []
      if (d.outcomes && typeof d.outcomes === "object") {
        for (const [, od] of Object.entries(d.outcomes as Record<string, JournalOutcome>)) {
          outcomes.push(od)
        }
      }
      entries.push({
        id,
        user_id: uid,
        title: String(d.title),
        context: String(d.context || ""),
        decision: String(d.decision || ""),
        rationale: String(d.rationale || ""),
        confidence: Number(d.confidence || 5),
        review_date: String(d.review_date || ""),
        outcome_captured: outcomes.length > 0 || Boolean(d.outcome_captured),
        alternatives_considered: (d.alternatives_considered as JournalEntry["alternatives_considered"]) || [],
        key_assumptions: (d.key_assumptions as JournalEntry["key_assumptions"]) || [],
        success_metrics: (d.success_metrics as JournalEntry["success_metrics"]) || [],
        created_at: String(d.created_at || new Date().toISOString()),
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
  const database = getDb()
  const uid = requireUid()
  const entryId = crypto.randomUUID()
  const entry: JournalEntry = {
    id: entryId,
    user_id: uid,
    ...data,
    outcome_captured: false,
    created_at: new Date().toISOString(),
  }
  await set(ref(database, entriesPath(uid, entryId)), {
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

export async function updateJournalEntry(
  entryId: string,
  data: {
    title: string
    context: string
    decision: string
    rationale: string
    confidence: number
    review_date: string
    alternatives_considered: { name: string; description: string }[]
    key_assumptions: { assumption: string; test: string }[]
    success_metrics: { metric: string; target: string }[]
  },
): Promise<void> {
  const database = getDb()
  const uid = requireUid()
  await update(ref(database, entriesPath(uid, entryId)), {
    title: data.title,
    context: data.context,
    decision: data.decision,
    rationale: data.rationale,
    confidence: data.confidence,
    review_date: data.review_date,
    alternatives_considered: data.alternatives_considered,
    key_assumptions: data.key_assumptions,
    success_metrics: data.success_metrics,
  })
}

export async function deleteJournalEntry(entryId: string): Promise<void> {
  const database = getDb()
  const uid = requireUid()
  await remove(ref(database, entriesPath(uid, entryId)))
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
  const database = getDb()
  const uid = requireUid()
  const outcomeId = crypto.randomUUID()
  const outcome: JournalOutcome = {
    id: outcomeId,
    ...data,
    what_missed: "",
    what_got_right: "",
    metrics_actual: [],
  }
  await set(ref(database, outcomePath(uid, entryId, outcomeId)), outcome)
  await set(ref(database, `${entriesPath(uid, entryId)}/outcome_captured`), true)
}
