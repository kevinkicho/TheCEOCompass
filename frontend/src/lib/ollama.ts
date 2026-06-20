import { db, ref, set, onValue, off, get, update, query, orderByChild, limitToLast } from "./firebase"
import { staticFrameworks } from "./staticData"

function generateId(): string {
  return crypto.randomUUID()
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function loadSettings(): Record<string, string> {
  try {
    const raw = localStorage.getItem("ceocompass_settings")
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function getFrameworkMeta(slug: string) {
  const fw = (staticFrameworks as any[]).find((f) => f.slug === slug)
  if (!fw) return null
  return {
    slug: fw.slug,
    title: fw.title,
    category: fw.category,
    difficulty: fw.difficulty,
    use_cases: fw.use_cases || [],
    key_concepts: fw.key_concepts || [],
  }
}

function buildSystemPrompt(type: "explain" | "quiz"): string {
  if (type === "explain") {
    return "You are a CEO coach explaining a specific framework concept to a busy executive. Be concise and actionable. Respond only with valid JSON."
  }
  return "You are a business school professor creating an assessment for MBA students. Questions should test understanding, not recall. Respond only with valid JSON."
}

export type CacheRecord = {
  result: string
  prompt?: string
  model?: string
  created_at: number
}

async function checkCache(
  frameworkSlug: string,
  conceptSlug: string | null,
): Promise<CacheRecord | null> {
  if (!db) return null
  const database = db!
  try {
    const cachePath = conceptSlug
      ? `framework/${frameworkSlug}/${conceptSlug}/responses`
      : `framework/${frameworkSlug}/quiz/responses`

    const cacheQuery = query(ref(database, cachePath), orderByChild("created_at"), limitToLast(1))
    const snap = await get(cacheQuery)
    if (!snap.exists()) {
      console.log(`[AI] Cache miss: ${cachePath}`)
      return null
    }

    const entries = snap.val()
    const latest = Object.values(entries)[0] as any
    if (!latest || !latest.result) return null
    if (Date.now() - (latest.created_at || 0) > 86400000) {
      console.log(`[AI] Cache stale: ${cachePath} (${Math.round((Date.now() - latest.created_at) / 3600000)}h old)`)
      return null
    }

    console.log(`[AI] Cache hit: ${cachePath} (${latest.result.length} chars)`)
    return {
      result: latest.result,
      prompt: latest.prompt,
      model: latest.model,
      created_at: latest.created_at,
    }
  } catch {
    return null
  }
}

async function callOllamaViaFirebase(
  model: string,
  prompt: string,
  temperature: number,
  frameworkSlug: string,
  conceptSlug: string | null,
  type: "explain" | "quiz",
  skipCache: boolean = false,
): Promise<{ result: string; cached: boolean; prompt: string }> {
  if (!db) {
    throw new Error("Firebase not configured. Set NEXT_PUBLIC_FIREBASE_* env vars or add them to .env.local")
  }

  const database = db!
  const settings = loadSettings()
  const actualModel = model || settings.ollamaModel || "gemma4:latest"
  const fullPrompt = `${buildSystemPrompt(type)}\n\n${prompt}`

  if (!skipCache) {
    const cached = await checkCache(frameworkSlug, conceptSlug)
    if (cached) return { result: cached.result, cached: true, prompt: fullPrompt }
  }

  const requestId = generateId()

  const payload = {
    model: actualModel,
    prompt: fullPrompt,
    stream: false,
    options: { temperature },
  }

  console.log(`[AI] Pushing request ${requestId} for ${frameworkSlug}/${conceptSlug || "quiz"}`)
  await set(ref(database, `requests/${requestId}`), {
    type,
    framework_slug: frameworkSlug,
    concept_slug: conceptSlug,
    payload,
    status: "pending",
    created_at: Date.now(),
  })

  return new Promise((resolve, reject) => {
    const responseRef = ref(database, `responses/${requestId}`)
    const statusRef = ref(database, `requests/${requestId}/status`)
    let done = false

    const unsubStatus = onValue(statusRef, (snap) => {
      if (done) return
      const s = snap.val()
      if (s === "processing") {
        console.log(`[AI] Request ${requestId} picked up by agent`)
      }
      if (s === "error") {
        done = true
        unsubStatus()
        unsubResp()
        get(responseRef).then((s) => {
          const d = s.val()
          console.log(`[AI] Request ${requestId} failed: ${d?.error || "unknown"}`)
          reject(new Error(d?.error || "Ollama returned an error"))
        })
      }
    })

    const unsubResp = onValue(responseRef, (snap) => {
      if (done) return
      const data = snap.val()
      if (!data) return
      if (data.result) {
        done = true
        unsubStatus()
        unsubResp()
        console.log(`[AI] Response ${requestId} received (${data.result.length} chars)`)
        resolve({ result: data.result, cached: false, prompt: fullPrompt })
      }
    })
  })
}

export async function generateQuiz(
  frameworkSlug: string,
  numQuestions: number,
  difficulty: string,
) {
  const meta = getFrameworkMeta(frameworkSlug)
  if (!meta) throw new Error(`Framework not found: ${frameworkSlug}`)

  const num = numQuestions || 5
  const diff = difficulty || "medium"

  const concepts = meta.key_concepts.join(", ")

  const prompt = `Framework: ${meta.title}
Domain: ${meta.category}
Difficulty: ${diff} (easy=recall definition, medium=apply to business scenario, hard=compare/contrast concepts or analyze tradeoffs)
Use cases: ${meta.use_cases.join(", ")}
Concepts to cover: ${concepts}

Generate ${num} questions as a JSON array. Mix question types across the concepts:
[
  {
    "id": "q1",
    "question": "Question text",
    "type": "multiple_choice|free_response|calculation",
    "options": ["A", "B", "C", "D"],
    "correct_answer": "A",
    "explanation": "Why this is correct",
    "framework_concept": "Concept name"
  }
]

Return ONLY valid JSON array.`

  const { result } = await callOllamaViaFirebase("", prompt, 0.5, frameworkSlug, null, "quiz")
  return JSON.parse(result)
}

export async function explainConcept(
  conceptName: string,
  definition: string,
  frameworkSlug: string,
  skipCache: boolean = false,
): Promise<{ parsed: Record<string, string>; cached: boolean; prompt: string }> {
  const meta = getFrameworkMeta(frameworkSlug)
  if (!meta) throw new Error(`Framework not found: ${frameworkSlug}`)

  const conceptSlug = slugify(conceptName)
  const related = meta.key_concepts.filter((k: string) => k !== conceptName).join(", ")

  const prompt = `Framework: ${meta.title}
Domain: ${meta.category}
Difficulty: ${meta.difficulty}/5
Use cases: ${meta.use_cases.join(", ")}
Related concepts in this framework: ${related}

Concept: ${conceptName}
Definition: ${definition}

Return a JSON object with these fields:
{
  "real_world_example": "A brief real-world CEO example of this concept in action (2-3 sentences)",
  "ceo_insight": "Why this matters specifically to a CEO (1-2 sentences)",
  "common_mistake": "One common mistake CEOs make with this concept (1-2 sentences)",
  "related_tip": "A quick actionable tip for applying this (1 sentence)"
}

Return ONLY valid JSON.`

  const { result, cached, prompt: fullPrompt } = await callOllamaViaFirebase("", prompt, 0.4, frameworkSlug, conceptSlug, "explain", skipCache)
  return { parsed: JSON.parse(result), cached, prompt: fullPrompt }
}

export async function regenerateEnrichment(
  conceptName: string,
  definition: string,
  frameworkSlug: string,
  frameworkTitle: string,
  conceptTags: string[],
  skipCache: boolean = false,
): Promise<{ parsed: any; cached: boolean; prompt: string }> {
  const conceptSlug = slugify(conceptName)
  const tags = conceptTags.join(", ")

  const prompt = `Framework: ${frameworkTitle}

Concept: ${conceptName}
Definition: ${definition}
Tags: ${tags}

Return a JSON object with enriched fields for this concept — designed for a CEO audience. Each field must be concise, specific, and immediately actionable.

{
  "why_it_matters": "Why this concept matters specifically to a CEO (2-3 sentences, high strategic relevance)",
  "steps": [
    { "title": "Step 1 short name", "description": "1-sentence description of the action" },
    { "title": "Step 2 short name", "description": "..." },
    { "title": "Step 3 short name", "description": "..." }
  ],
  "pitfalls": [
    { "title": "Pitfall name", "description": "What to watch out for (1-2 sentences)" },
    { "title": "Pitfall name", "description": "..." }
  ],
  "related_concepts": [
    { "name": "Related concept", "relationship": "How it relates to ${conceptName} (1 sentence)" },
    { "name": "Another concept", "relationship": "..." }
  ]
}

Generate exactly 3 steps, 2 pitfalls, and 2 related concepts. Return ONLY valid JSON.`

  const { result, cached, prompt: fullPrompt } = await callOllamaViaFirebase("", prompt, 0.3, frameworkSlug, conceptSlug, "explain", skipCache)
  return { parsed: JSON.parse(result), cached, prompt: fullPrompt }
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "risk-management": "Risk management, uncertainty, probability, and decision-making under unknown conditions",
  "decision-making": "Decision-making, cognitive biases, thinking models, and mental frameworks",
  "strategy-planning": "Strategy, planning, competitive positioning, and trade-offs",
  "modeling-analytics": "Analytical methods, modeling, statistics, and systems thinking",
  "organizational-management": "Organizational leadership, management, and corporate culture",
  "supply-chain-operations": "Supply chain, lean operations, quality control, and process improvement",
}

export async function generateQuote(
  category: string,
): Promise<{ parsed: QuoteGenResult; prompt: string }> {
  const catDesc = CATEGORY_DESCRIPTIONS[category] || "Leadership and management"
  const prompt = `You are a curator of wisdom. Generate an insightful, real quote from a notable figure (CEO, philosopher, scientist, economist, or strategist) on the topic of ${catDesc}.

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

  const settings = loadSettings()
  const actualModel = settings.ollamaModel || "gemma4:latest"
  const fullPrompt = `${buildSystemPrompt("explain")}\n\n${prompt}`

  if (!db) throw new Error("Firebase not configured")

  const database = db!
  const requestId = generateId()

  const payload = {
    model: actualModel,
    prompt: fullPrompt,
    stream: false,
    options: { temperature: 0.7 },
  }

  await set(ref(database, `requests/${requestId}`), {
    type: "quote",
    category,
    payload,
    status: "pending",
    created_at: Date.now(),
  })

  return new Promise((resolve, reject) => {
    const responseRef = ref(database, `responses/${requestId}`)
    const statusRef = ref(database, `requests/${requestId}/status`)
    let done = false

    const unsubStatus = onValue(statusRef, (snap) => {
      if (done) return
      const s = snap.val()
      if (s === "error") {
        done = true
        unsubStatus()
        unsubResp()
        get(responseRef).then((s) => {
          const d = s.val()
          reject(new Error(d?.error || "Quote generation failed"))
        })
      }
    })

    const unsubResp = onValue(responseRef, (snap) => {
      if (done) return
      const data = snap.val()
      if (!data) return
      if (data.result) {
        done = true
        unsubStatus()
        unsubResp()
        resolve({ parsed: JSON.parse(data.result), prompt: fullPrompt })
      }
    })
  })
}

type QuoteGenResult = {
  person: string
  role: string
  text: string
  context?: string
  source?: string
  year?: string
}

const STAGE_TYPE_DESCRIPTIONS: Record<string, string> = {
  diagnosis: "identifying the core problem and gathering relevant information",
  analysis: "analyzing data, evaluating options, and applying analytical frameworks",
  decision: "making a strategic decision with trade-offs and risk assessment",
  communication: "crafting a clear, data-driven message for stakeholders",
  outcome: "evaluating results and reflecting on lessons learned",
}

export async function evaluateScenarioStage(
  stage: { id: string; type: string; prompt: string; feedback_prompt_template: string; options?: { id: string; label: string }[] },
  scenarioTitle: string,
  choiceId?: string,
  freeResponse?: string,
): Promise<{ parsed: { feedback: string; score: number; key_insights: string[]; next_framework_suggestion?: string }; prompt: string }> {
  const stageType = STAGE_TYPE_DESCRIPTIONS[stage.type] || stage.type
  const optionLabel = choiceId && stage.options?.length
    ? stage.options.find((o) => o.id === choiceId)?.label || choiceId
    : ""

  const expandedTemplate = stage.feedback_prompt_template
    .replace("{option}", optionLabel || freeResponse || "")
    .replace("{response}", freeResponse || optionLabel || "")

  const prompt = `You are a CEO coach evaluating a leader's decision-making in a business scenario.

Scenario: ${scenarioTitle}
Stage type: ${stage.type} (${stageType})
Question: ${stage.prompt}

${expandedTemplate}

Return ONLY valid JSON:
{
  "feedback": "Detailed coaching feedback (2-4 sentences) evaluating the choice and offering guidance",
  "score": <number between 0 and 10>,
  "key_insights": ["Specific actionable insight 1", "Specific actionable insight 2", "Specific actionable insight 3"],
  "next_framework_suggestion": "Name of a related framework to study next, or empty string if none"
}`

  const settings = loadSettings()
  const actualModel = settings.ollamaModel || "gemma4:latest"
  const fullPrompt = `${buildSystemPrompt("explain")}\n\n${prompt}`

  if (!db) throw new Error("Firebase not configured")
  const database = db!
  const requestId = generateId()

  const payload = {
    model: actualModel,
    prompt: fullPrompt,
    stream: false,
    options: { temperature: 0.5 },
  }

  await set(ref(database, `requests/${requestId}`), {
    type: "scenario",
    stage_id: stage.id,
    payload,
    status: "pending",
    created_at: Date.now(),
  })

  return new Promise((resolve, reject) => {
    const responseRef = ref(database, `responses/${requestId}`)
    const statusRef = ref(database, `requests/${requestId}/status`)
    let done = false

    const unsubStatus = onValue(statusRef, (snap) => {
      if (done) return
      if (snap.val() === "error") {
        done = true
        unsubStatus()
        unsubResp()
        get(responseRef).then((s) => reject(new Error(s.val()?.error || "Scenario evaluation failed")))
      }
    })

    const unsubResp = onValue(responseRef, (snap) => {
      if (done) return
      const data = snap.val()
      if (!data?.result) return
      done = true
      unsubStatus()
      unsubResp()
      resolve({ parsed: JSON.parse(data.result), prompt: fullPrompt })
    })
  })
}

export { slugify, checkCache }
