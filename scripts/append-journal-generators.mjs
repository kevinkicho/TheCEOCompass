import { readFileSync, writeFileSync } from "fs"

const path = "frontend/src/lib/ai/generators.ts"
let t = readFileSync(path, "utf8")
if (t.includes("structureJournalFromThoughts")) {
  console.log("already present")
  process.exit(0)
}

const append = `

// -- Decision Journal (AI structures; user only provides raw thoughts) --

export type StructuredJournalDraft = {
  title: string
  context: string
  decision: string
  rationale: string
  confidence: number
  review_date: string
  alternatives_considered: { name: string; description: string }[]
  key_assumptions: { assumption: string; test: string }[]
  success_metrics: { metric: string; target: string }[]
}

export type StructuredOutcomeDraft = {
  what_happened: string
  was_right: "yes" | "partially" | "no"
  updated_confidence: number
  lesson: string
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf("{")
    const end = trimmed.lastIndexOf("}")
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1))
    }
    throw new Error("AI did not return valid JSON for journal")
  }
}

/** Turn free-form thoughts into a complete journal entry. */
export async function structureJournalFromThoughts(
  thoughts: string,
  extras?: { scenarioTitle?: string; scenarioContext?: string },
): Promise<StructuredJournalDraft> {
  const reviewDefault = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]
  const scenarioHint = extras?.scenarioTitle
    ? \`\\nScenario practice: \${extras.scenarioTitle}\\n\${extras.scenarioContext || ""}\`
    : ""

  const prompt = \`You are a CEO decision-journal coach. The learner shared rough notes (not a polished write-up).
Structure them into a clean decision journal entry. Infer missing structure reasonably. Do not invent facts that contradict the notes.

LEARNER NOTES:
\${thoughts}
\${scenarioHint}

Return ONLY valid JSON (no markdown):
{
  "title": "short decision title",
  "context": "situation in 1-3 sentences",
  "decision": "what they decided / will do",
  "rationale": "why, in plain language",
  "confidence": 1-10,
  "review_date": "YYYY-MM-DD (use \${reviewDefault} if unclear)",
  "alternatives_considered": [{"name":"","description":""}],
  "key_assumptions": [{"assumption":"","test":""}],
  "success_metrics": [{"metric":"","target":""}]
}

Use empty arrays if none. confidence must be integer 1-10.\`

  const { result } = await callOllamaViaFirebase(
    "",
    prompt,
    0.4,
    "journal",
    null,
    "journal_structure",
    "journal",
  )
  const parsed = extractJsonObject(result) as StructuredJournalDraft
  const conf = Math.max(1, Math.min(10, Math.round(Number(parsed.confidence) || 7)))
  return {
    title: String(parsed.title || "Decision").slice(0, 200),
    context: String(parsed.context || thoughts).slice(0, 4000),
    decision: String(parsed.decision || "").slice(0, 2000),
    rationale: String(parsed.rationale || "").slice(0, 2000),
    confidence: conf,
    review_date: String(parsed.review_date || reviewDefault).slice(0, 32),
    alternatives_considered: Array.isArray(parsed.alternatives_considered)
      ? parsed.alternatives_considered.filter((a) => a && (a.name || a.description))
      : [],
    key_assumptions: Array.isArray(parsed.key_assumptions)
      ? parsed.key_assumptions.filter((a) => a && a.assumption)
      : [],
    success_metrics: Array.isArray(parsed.success_metrics)
      ? parsed.success_metrics.filter((m) => m && m.metric)
      : [],
  }
}

/** Turn a short outcome note into a structured outcome review. */
export async function structureOutcomeFromNote(
  note: string,
  entry: { title: string; decision: string; confidence: number },
): Promise<StructuredOutcomeDraft> {
  const prompt = \`You are a CEO coach reviewing a past decision. Structure the learner's outcome notes.

ORIGINAL DECISION: \${entry.title}
DECISION: \${entry.decision}
ORIGINAL CONFIDENCE: \${entry.confidence}/10

WHAT THEY SAID HAPPENED:
\${note}

Return ONLY valid JSON:
{
  "what_happened": "clear summary",
  "was_right": "yes|partially|no",
  "updated_confidence": 1-10,
  "lesson": "one crisp lesson for next time"
}\`

  const { result } = await callOllamaViaFirebase(
    "",
    prompt,
    0.4,
    "journal",
    null,
    "journal_outcome",
    "journal",
  )
  const parsed = extractJsonObject(result) as StructuredOutcomeDraft
  const wr = String(parsed.was_right || "partially").toLowerCase()
  const was_right = wr === "yes" || wr === "no" ? wr : "partially"
  return {
    what_happened: String(parsed.what_happened || note).slice(0, 4000),
    was_right,
    updated_confidence: Math.max(1, Math.min(10, Math.round(Number(parsed.updated_confidence) || entry.confidence))),
    lesson: String(parsed.lesson || "").slice(0, 2000),
  }
}
`

writeFileSync(path, t.trimEnd() + append + "\n", "utf8")
console.log("appended ok")
