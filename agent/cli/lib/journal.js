/**
 * Journal list / create via Admin SDK.
 */
import { randomUUID } from "crypto"
import { getDb, userPath } from "./firebase.js"
import { loadUserContext } from "./context.js"
import { generateWithFallback } from "../../ollama-client.js"

function reviewDefaultDate() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
}

export async function listJournal(uid) {
  const db = getDb()
  const snap = await db.ref(userPath(uid, "journal", "entries")).get()
  if (!snap.exists()) return []
  const entries = snap.val() || {}
  return Object.entries(entries).map(([id, e]) => ({
    id,
    title: e.title,
    decision: e.decision,
    confidence: e.confidence,
    review_date: e.review_date,
    outcome_captured: Boolean(e.outcome_captured),
    created_at: e.created_at,
  }))
}

export async function createJournalEntry(uid, data) {
  const db = getDb()
  const entryId = randomUUID()
  const entry = {
    title: data.title,
    context: data.context || "",
    decision: data.decision || "",
    rationale: data.rationale || "",
    confidence: data.confidence ?? 7,
    review_date: data.review_date || reviewDefaultDate(),
    alternatives_considered: data.alternatives_considered || [],
    key_assumptions: data.key_assumptions || [],
    success_metrics: data.success_metrics || [],
    outcome_captured: false,
    created_at: new Date().toISOString(),
    ...(data.scenario_id ? { scenario_id: data.scenario_id } : {}),
    source: data.source || "agent-cli",
  }
  await db.ref(userPath(uid, "journal", "entries", entryId)).set(entry)
  return { id: entryId, user_id: uid, ...entry }
}

function extractJsonValue(raw) {
  const trimmed = String(raw).trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const arrStart = trimmed.indexOf("[")
    const objStart = trimmed.indexOf("{")
    let start = -1
    let end = -1
    if (arrStart >= 0 && (objStart < 0 || arrStart < objStart)) {
      start = arrStart
      end = trimmed.lastIndexOf("]")
    } else {
      start = objStart
      end = trimmed.lastIndexOf("}")
    }
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1))
    throw new Error("AI did not return JSON")
  }
}

const META_JUNK =
  /record[- ]?keeping|activity record|document three|formal decision journal|structure and record the activity|maintain a historical log/i

/**
 * Draft journal entries from account context + optional notes (uses Ollama/cloud).
 * Does not write unless apply=true.
 */
export async function draftJournalFromContext(uid, { notes = "", limit = 3, apply = false } = {}) {
  const ctx = await loadUserContext(uid, Math.max(limit, 8))
  const reviewDefault = reviewDefaultDate()

  const prompt = `You are a CEO decision-journal scribe writing for an executive learning product.

CRITICAL:
- Write about REAL activities from ACCOUNT CONTEXT (scenarios, concepts viewed, quizzes, pathway).
- NEVER write about journaling/recordkeeping itself.
- Create up to ${limit} concrete entries (one per distinct recent activity).
- Titles must name real topics (scenario slug, concept, quiz, pathway step).

LEARNER NOTES (optional free-text):
${notes || "(none)"}

${ctx.promptBlock}

Return ONLY a JSON array:
[
  {
    "title": "concrete topic",
    "context": "situation",
    "decision": "what they chose or concluded",
    "rationale": "why / takeaway",
    "confidence": 1-10,
    "review_date": "${reviewDefault}",
    "alternatives_considered": [],
    "key_assumptions": [],
    "success_metrics": []
  }
]`

  const gen = await generateWithFallback(prompt, {
    temperature: 0.35,
  })
  const raw = typeof gen === "string" ? gen : gen?.text || ""

  const parsed = extractJsonValue(raw)
  const list = Array.isArray(parsed) ? parsed : [parsed]
  const drafts = list
    .filter((d) => d && typeof d === "object")
    .map((d) => ({
      title: String(d.title || "Learning activity").slice(0, 200),
      context: String(d.context || "").slice(0, 4000),
      decision: String(d.decision || "").slice(0, 2000),
      rationale: String(d.rationale || "").slice(0, 2000),
      confidence: Math.max(1, Math.min(10, Math.round(Number(d.confidence) || 7))),
      review_date: String(d.review_date || reviewDefault).slice(0, 32),
      alternatives_considered: Array.isArray(d.alternatives_considered)
        ? d.alternatives_considered
        : [],
      key_assumptions: Array.isArray(d.key_assumptions) ? d.key_assumptions : [],
      success_metrics: Array.isArray(d.success_metrics) ? d.success_metrics : [],
      source: "agent-cli-context",
    }))
    .filter((d) => d.title && (d.decision || d.context))
    .filter((d) => !META_JUNK.test(`${d.title} ${d.context} ${d.decision} ${d.rationale}`))
    .slice(0, limit)

  if (!apply) {
    return { applied: false, drafts, contextSummary: {
      viewed: ctx.recentViewed.length,
      scenarios: ctx.recentScenarios.length,
      quizzes: ctx.quizHighlights.length,
      dueReviews: ctx.dueReviewCount,
    } }
  }

  const created = []
  for (const d of drafts) {
    created.push(await createJournalEntry(uid, d))
  }
  return {
    applied: true,
    created,
    drafts,
    contextSummary: {
      viewed: ctx.recentViewed.length,
      scenarios: ctx.recentScenarios.length,
      quizzes: ctx.quizHighlights.length,
      dueReviews: ctx.dueReviewCount,
    },
  }
}
