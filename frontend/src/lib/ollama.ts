import { db, ref, set, onValue, off, get, update } from "./firebase"
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

function buildSystemPrompt(type: string): string {
  const prompts: Record<string, string> = {
    explain_further: "You are a CEO coach explaining a specific framework concept to a busy executive. Be concise and actionable. Respond only with valid JSON.",
    why_it_matters: "You are a CEO coach writing a concise explanation of why a concept matters to a CEO. Respond only with valid JSON.",
    how_to_apply: "You are a CEO coach writing actionable steps for applying a concept. Respond only with valid JSON.",
    common_pitfalls: "You are a CEO coach identifying common mistakes CEOs make with a concept. Respond only with valid JSON.",
    connected_concepts: "You are a CEO coach connecting related concepts for strategic context. Respond only with valid JSON.",
    case_study: "You are a business educator writing a case study about a company that applied a specific framework concept. Be factual and specific. Respond only with valid JSON.",
    test_yourself: "You are a business school professor creating a self-test exercise for students learning about a specific concept. Respond only with valid JSON.",
    real_world_examples: "You are a CEO coach providing real-world examples of a concept in action. Each example must mention actual companies or situations. Respond only with valid JSON.",
  }
  return prompts[type] || "You are a business school professor creating an assessment for MBA students. Questions should test understanding, not recall. Respond only with valid JSON."
}

export type CacheRecord = {
  result: string
  prompt?: string
  model?: string
  created_at: number
}

async function checkCacheAt(
  frameworkSlug: string, conceptSlug: string | null, cachePath: string,
): Promise<CacheRecord | null> {
  if (!db) return null
  const database = db!
  try {
    const snap = await get(ref(database, cachePath))
    if (!snap.exists()) {
      console.log(`[AI] Cache miss: ${cachePath}`)
      return null
    }
    const now = Date.now()
    const valid: any[] = Object.values((snap.val() || {}) as any).filter((e: any) => e?.result && now - (e.created_at || 0) <= 86400000)
    if (valid.length === 0) return null
    const latest = valid.reduce((a: any, b: any) => (a.created_at || 0) > (b.created_at || 0) ? a : b)
    console.log(`[AI] Cache hit: ${cachePath} (${valid.length} entries, ${latest.result.length} chars)`)
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

export async function checkCache(
  frameworkSlug: string,
  conceptSlug: string | null,
  category: string = "explain_further",
): Promise<CacheRecord | null> {
  if (conceptSlug) {
    return checkCacheAt(frameworkSlug, conceptSlug, `framework/${frameworkSlug}/${conceptSlug}/${category}`)
  }
  return checkCacheAt(frameworkSlug, null, `framework/${frameworkSlug}/quiz`)
}

export async function loadCategoryEntries(
  frameworkSlug: string, conceptSlug: string, category: string,
): Promise<CacheRecord[]> {
  if (!db) return []
  const database = db!
  try {
    const snap = await get(ref(database, `framework/${frameworkSlug}/${conceptSlug}/${category}`))
    if (!snap.exists()) return []
    const entries = snap.val()
    const now = Date.now()
    const results: CacheRecord[] = []
    for (const entry of Object.values(entries) as any[]) {
      if (entry?.result && now - (entry.created_at || 0) <= 86400000) {
        results.push({
          result: entry.result,
          prompt: entry.prompt,
          model: entry.model,
          created_at: entry.created_at,
        })
      }
    }
    results.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
    return results
  } catch {
    return []
  }
}

async function callOllamaViaFirebase(
  model: string,
  prompt: string,
  temperature: number,
  frameworkSlug: string,
  conceptSlug: string | null,
  category: string,
  systemType: string = "explain_further",
  skipCache: boolean = false,
): Promise<{ result: string; cached: boolean; prompt: string }> {
  if (!db) {
    throw new Error("Firebase not configured. Set NEXT_PUBLIC_FIREBASE_* env vars or add them to .env.local")
  }

  const database = db!
  const settings = loadSettings()
  const actualModel = model || settings.ollamaModel || "gemma4:latest"
  const fullPrompt = `${buildSystemPrompt(systemType as any)}\n\n${prompt}`

  if (!skipCache) {
    const cached = await checkCache(frameworkSlug, conceptSlug, category)
    if (cached) return { result: cached.result, cached: true, prompt: fullPrompt }
  }

  const requestId = generateId()

  const payload = {
    model: actualModel,
    prompt: fullPrompt,
    stream: false,
    options: { temperature },
  }

  console.log(`[AI] Pushing request ${requestId} for ${frameworkSlug}/${conceptSlug}/${category}`)
  await set(ref(database, `requests/${requestId}`), {
    type: systemType,
    category,
    framework_slug: frameworkSlug,
    concept_slug: conceptSlug,
    payload,
    status: "pending",
    created_at: Date.now(),
  })

  const responsePath = `framework/${frameworkSlug}/${conceptSlug}/${category}/${requestId}`

  return new Promise((resolve, reject) => {
    const responseRef = ref(database, responsePath)
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
        console.log(`[AI] Response ${requestId} received (${data.result.length} chars) for ${category}`)
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

  const { result } = await callOllamaViaFirebase("", prompt, 0.5, frameworkSlug, null, "quiz", "quiz")
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
  return generateExplainFurther(conceptName, definition, frameworkSlug, meta.title, skipCache) as any
}

// ── Individual category generators ──

function mkGen(
  category: string, systemType: string, temp: number,
  buildPrompt: (cn: string, def: string, ft: string, tags?: string[]) => string,
) {
  return async (
    conceptName: string, definition: string, frameworkSlug: string, frameworkTitle: string,
    conceptTags?: string[], skipCache: boolean = false,
  ): Promise<{ parsed: any; cached: boolean; prompt: string }> => {
    const conceptSlug = slugify(conceptName)
    const prompt = buildPrompt(conceptName, definition, frameworkTitle, conceptTags)
    const { result, cached, prompt: fullPrompt } = await callOllamaViaFirebase("", prompt, temp, frameworkSlug, conceptSlug, category, systemType, skipCache)
    return { parsed: JSON.parse(result), cached, prompt: fullPrompt }
  }
}

export const buildWhyItMattersPrompt = (_cn: string, _def: string, ft: string, tags?: string[]) =>
  `Framework: ${ft}
Tags: ${(tags || []).join(", ")}

Explain why this concept matters specifically to a CEO. Return ONLY valid JSON:
{ "why_it_matters": "2-3 sentences explaining strategic relevance to a CEO" }`

export const buildHowToApplyPrompt = (_cn: string, _def: string, ft: string) =>
  `Framework: ${ft}

Generate 3 actionable steps for applying this concept. Return ONLY valid JSON:
{
  "steps": [
    { "title": "Step 1 short name", "description": "1-sentence description" },
    { "title": "Step 2 short name", "description": "1-sentence description" },
    { "title": "Step 3 short name", "description": "1-sentence description" }
  ]
}`

export const buildCommonPitfallsPrompt = (_cn: string, _def: string, ft: string) =>
  `Framework: ${ft}

Generate 2 common mistakes or pitfalls with this concept. Return ONLY valid JSON:
{
  "pitfalls": [
    { "title": "Pitfall name", "description": "1-2 sentences about what to watch out for" },
    { "title": "Pitfall name", "description": "1-2 sentences about what to watch out for" }
  ]
}`

export const buildConnectedConceptsPrompt = (cn: string, _def: string, ft: string) =>
  `Framework: ${ft}
Concept: ${cn}

Generate 2 related concepts that connect to ${cn}. Return ONLY valid JSON:
{
  "related_concepts": [
    { "name": "Related concept", "relationship": "How it relates to ${cn} (1 sentence)" },
    { "name": "Related concept", "relationship": "How it relates to ${cn} (1 sentence)" }
  ]
}`

export const buildCaseStudyPrompt = (_cn: string, _def: string, ft: string) =>
  `Framework: ${ft}

Generate a realistic case study of a company that applied this concept. Return ONLY valid JSON:
{
  "company": "Real company name",
  "situation": "What challenge they faced (2-3 sentences)",
  "application": "How they applied the concept (2-3 sentences)",
  "result": "What outcome they achieved (1-2 sentences)"
}`

export const buildTestYourselfPrompt = (_cn: string, _def: string, ft: string) =>
  `Framework: ${ft}

Generate a self-test exercise for this concept. The exercise should test practical application. Return ONLY valid JSON:
{
  "scenario": "A brief business scenario (2-3 sentences)",
  "options": ["First plausible option", "Second option (correct)", "Third option", "Fourth option"],
  "correct": <0-indexed index of the correct option>,
  "explanation": "Why the correct answer is right and the others are wrong (1-2 sentences)"
}`

export const buildRealWorldExamplesPrompt = (_cn: string, _def: string, ft: string) =>
  `Framework: ${ft}

Generate 3 real-world examples of this concept in action. Each must mention a specific company or industry. Return ONLY valid JSON:
{
  "examples": [
    "Example 1: Company/industry and situation (1-2 sentences)",
    "Example 2: Company/industry and situation (1-2 sentences)",
    "Example 3: Company/industry and situation (1-2 sentences)"
  ]
}`

export const generateWhyItMatters = mkGen("why_it_matters_for_ceos", "why_it_matters", 0.3, buildWhyItMattersPrompt)
export const generateHowToApply = mkGen("how_to_apply", "how_to_apply", 0.3, buildHowToApplyPrompt)
export const generateCommonPitfalls = mkGen("common_pitfalls", "common_pitfalls", 0.3, buildCommonPitfallsPrompt)
export const generateConnectedConcepts = mkGen("connected_concepts", "connected_concepts", 0.3, buildConnectedConceptsPrompt)
export const generateCaseStudy = mkGen("case_study", "case_study", 0.4, buildCaseStudyPrompt)
export const generateTestYourself = mkGen("test_yourself", "test_yourself", 0.4, buildTestYourselfPrompt)
export const generateRealWorldExamples = mkGen("real_world_examples", "real_world_examples", 0.4, buildRealWorldExamplesPrompt)

// explain_further keeps the existing 4-field explain structure
export function buildExplainPrompt(
  conceptName: string, definition: string, frameworkTitle: string,
): string {
  return `Framework: ${frameworkTitle}

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
}

export async function generateExplainFurther(
  conceptName: string,
  definition: string,
  frameworkSlug: string,
  frameworkTitle: string,
  skipCache: boolean = false,
): Promise<{ parsed: any; cached: boolean; prompt: string }> {
  const conceptSlug = slugify(conceptName)
  const prompt = buildExplainPrompt(conceptName, definition, frameworkTitle)
  const { result, cached, prompt: fullPrompt } = await callOllamaViaFirebase("", prompt, 0.4, frameworkSlug, conceptSlug, "explain_further", "explain_further", skipCache)
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

export { slugify }
