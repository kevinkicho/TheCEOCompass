import { db, ref, set, onValue, get } from "./firebase"
import type { Database } from "firebase/database"
import { getFrameworkBySlug } from "./api"

function generateId(): string {
  return crypto.randomUUID()
}

function waitForFirebaseResponse<T = any>(
  database: Database,
  requestId: string,
  responsePath: string,
  timeoutMs = 60000,
  onProgress?: (elapsed: number) => void,
): Promise<{ result: string; data: T | null }> {
  return new Promise((resolve, reject) => {
    const responseRef = ref(database, responsePath)
    const statusRef = ref(database, `requests/${requestId}/status`)
    let done = false
    const start = Date.now()

    const progressInterval = setInterval(() => {
      if (done) return
      const elapsed = Math.floor((Date.now() - start) / 1000)
      onProgress?.(elapsed)
    }, 1000)

    const timeout = setTimeout(() => {
      if (done) return
      done = true; clearInterval(progressInterval); unsubStatus(); unsubResp()
      reject(new Error("Request timed out after " + (timeoutMs / 1000) + "s — agent may not be running"))
    }, timeoutMs)

    const unsubStatus = onValue(statusRef, (snap) => {
      if (done) return
      if (snap.val() === "error") {
        done = true; clearTimeout(timeout); clearInterval(progressInterval); unsubStatus(); unsubResp()
        get(responseRef).then((s) => {
          const d = s.val()
          reject(new Error(d?.error || "Request failed"))
        })
      }
    })

    const unsubResp = onValue(responseRef, (snap) => {
      if (done) return
      const data = snap.val()
      if (!data?.result) return
      done = true; clearTimeout(timeout); clearInterval(progressInterval); unsubStatus(); unsubResp()
      let parsed: T | null = null
      try { parsed = JSON.parse(data.result) } catch {}
      resolve({ result: data.result, data: parsed })
    })
  })
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
  // Returns cached meta synchronously. For RTDB, we use a sync import approach.
  // This function is only used for AI prompt building, so it's fine to return null
  // and let the caller handle missing data.
  return null
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
    const results: CacheRecord[] = []
    for (const entry of Object.values(entries) as any[]) {
      if (entry?.result) {
        results.push({
          result: entry.result,
          prompt: entry.prompt,
          model: entry.model,
          created_at: entry.created_at,
        })
      } else if (entry?.real_world_example || entry?.ceo_insight || entry?.common_mistake || entry?.related_tip) {
        results.push({
          result: JSON.stringify({
            real_world_example: entry.real_world_example || "",
            ceo_insight: entry.ceo_insight || "",
            common_mistake: entry.common_mistake || "",
            related_tip: entry.related_tip || "",
          }),
          prompt: entry.prompt || "",
          model: entry.model || "legacy",
          created_at: entry.created_at || 0,
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
  const { result } = await waitForFirebaseResponse(database, requestId, responsePath)
  console.log(`[AI] Response ${requestId} received (${result.length} chars) for ${category}`)
  return { result, cached: false, prompt: fullPrompt }
}

export async function generateQuiz(
  frameworkSlug: string,
  numQuestions: number,
  difficulty: string,
  frameworkMeta?: { title: string; category: string; use_cases: string[]; key_concepts: string[] } | null,
) {
  if (!frameworkMeta) throw new Error(`Framework not found: ${frameworkSlug}`)

  const num = numQuestions || 5
  const diff = difficulty || "medium"

  const concepts = frameworkMeta.key_concepts.join(", ")

  const prompt = `Framework: ${frameworkMeta.title}
Domain: ${frameworkMeta.category}
Difficulty: ${diff} (easy=recall definition, medium=apply to business scenario, hard=compare/contrast concepts or analyze tradeoffs)
Use cases: ${frameworkMeta.use_cases.join(", ")}
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
  frameworkTitle: string = "",
  skipCache: boolean = false,
): Promise<{ parsed: Record<string, string>; cached: boolean; prompt: string }> {
  return generateExplainFurther(conceptName, definition, frameworkSlug, frameworkTitle, skipCache) as any
}

// ── Individual category generators ──

function mkGen(
  category: string, systemType: string, temp: number,
  buildPrompt: (cn: string, def: string, ft: string, tags?: string[]) => string,
) {
  return async (
    conceptName: string, definition: string, frameworkSlug: string, frameworkTitle: string,
    skipCache: boolean = false, conceptTags?: string[],
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

export const buildTestYourselfPrompt = (cn: string, _def: string, ft: string) =>
  `Framework: ${ft}
Concept: ${cn}

Generate a self-test exercise that teaches a CEO a valuable lesson about this concept. The explanation must be insightful and illuminating, not just "A is correct because..." — explain WHY it matters strategically. Return ONLY valid JSON:
{
  "scenario": "A realistic business scenario the CEO might face (2-3 sentences)",
  "options": ["First plausible option", "Second option (correct)", "Third option", "Fourth option"],
  "correct": <0-indexed index of the correct option>,
  "explanation": "A thorough explanation (2-4 sentences) that reveals the strategic reasoning behind the correct answer and why the others miss the mark. Make this genuinely educational."
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

  const { data } = await waitForFirebaseResponse<QuoteGenResult>(database, requestId, `quotes/generated/${requestId}`)
  return { parsed: data!, prompt: fullPrompt }
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

  const { data } = await waitForFirebaseResponse<{
    feedback: string; score: number; key_insights: string[]; next_framework_suggestion?: string
  }>(database, requestId, `scenario-evaluations/${requestId}`)
  return { parsed: data!, prompt: fullPrompt }
}

// ── Concept Comparison ──

export async function generateComparison(
  conceptA: { name: string; definition: string; framework: string; slug: string },
  conceptB: { name: string; definition: string; framework: string; slug: string },
  frameworkSlug: string,
  onProgress?: (elapsed: number) => void,
): Promise<{ comparison: string; similarities: string; differences: string; when_to_use_each: string }> {
  if (!db) throw new Error("Firebase not configured")
  const settings = loadSettings()
  const model = settings.ollamaModel || "gemma4:latest"
  const prompt = `Compare two leadership concepts for a CEO audience.

Concept A: "${conceptA.name}"
Definition: ${conceptA.definition}
Framework: ${conceptA.framework}

Concept B: "${conceptB.name}"
Definition: ${conceptB.definition}
Framework: ${conceptB.framework}

Return ONLY valid JSON with these fields:
{
  "comparison": "Brief 2-sentence comparison",
  "similarities": "Key similarities (3-5 bullet points as a single string with | separators)",
  "differences": "Key differences (3-5 bullet points as a single string with | separators)",
  "when_to_use_each": "Decision framework: when to use each (2-3 sentences)"
}`

  const requestId = generateId()
  const mode = "compare"
  const responsePath = `comparisons/${frameworkSlug}/${conceptA.slug}/${conceptB.slug}/${mode}`
  await set(ref(db!, `requests/${requestId}`), {
    type: "compare_concepts",
    category: "comparison",
    status: "pending",
    created_at: Date.now(),
    payload: { model, prompt },
    framework_slug: frameworkSlug,
    concept_slug: conceptA.slug,
    compare_target_slug: conceptB.slug,
    compare_mode: mode,
    compare_response_path: responsePath,
  })

  const { data } = await waitForFirebaseResponse<any>(db!, requestId, `${responsePath}/${requestId}`, 60000, onProgress)
  if (!data) throw new Error("Invalid comparison response")
  return data
}

export async function crossPollinate(
  conceptA: { name: string; definition: string; framework: string; slug: string },
  conceptB: { name: string; definition: string; framework: string; slug: string },
  frameworkSlug: string,
  onProgress?: (elapsed: number) => void,
): Promise<{ synthetic_insight: string; blind_spot: string; combined_framework: string }> {
  if (!db) throw new Error("Firebase not configured")
  const settings = loadSettings()
  const model = settings.ollamaModel || "gemma4:latest"
  const prompt = `You are a CEO coach synthesizing two concepts to create a new strategic insight.

Concept A: "${conceptA.name}"
Framework: ${conceptA.framework}
Definition: ${conceptA.definition}

Concept B: "${conceptB.name}"
Framework: ${conceptB.framework}
Definition: ${conceptB.definition}

Do NOT simply compare and contrast. Instead, find the hidden connection — what each concept reveals about the other that a CEO would miss studying them in isolation.

Return ONLY valid JSON with these fields:
{
  "synthetic_insight": "A novel insight that emerges from combining both concepts. What do you see now that you couldn't see with either alone? (2-3 sentences)",
  "blind_spot": "A blind spot or assumption each concept exposes in the other. What is Concept A's weakness that Concept B compensates for, and vice versa? (2-3 sentences)",
  "combined_framework": "A single actionable heuristic or mental model that merges both concepts into something a CEO can apply immediately (2-3 sentences)"
}`

  const requestId = generateId()
  const mode = "cross"
  const responsePath = `comparisons/${frameworkSlug}/${conceptA.slug}/${conceptB.slug}/${mode}`
  await set(ref(db!, `requests/${requestId}`), {
    type: "compare_concepts",
    category: "comparison",
    status: "pending",
    created_at: Date.now(),
    payload: { model, prompt },
    framework_slug: frameworkSlug,
    concept_slug: conceptA.slug,
    compare_target_slug: conceptB.slug,
    compare_mode: mode,
    compare_response_path: responsePath,
  })

  const { data } = await waitForFirebaseResponse<any>(db!, requestId, `${responsePath}/${requestId}`, 60000, onProgress)
  if (!data) throw new Error("Invalid cross-pollination response")
  return data
}

// ── Concept Tutor Chat ──

type ConceptArg = {
  name: string
  definition: string
  framework: string
  why_it_matters?: string
  steps?: { title: string; description: string }[]
  pitfalls?: { title: string; description: string }[]
  related_concepts?: { name: string; relationship: string }[]
  case_study?: { company: string; situation: string; application: string; result: string }
  exercise?: { scenario: string; options: string[]; correct: number; explanation: string }
  example?: string
  tags?: string[]
}

function buildConceptContext(concept: ConceptArg): string {
  return [
    `Concept: ${concept.name}`,
    `Definition: ${concept.definition}`,
    concept.framework ? `Framework: ${concept.framework}` : "",
    concept.why_it_matters ? `Why it matters: ${concept.why_it_matters}` : "",
    concept.steps?.length ? `Steps: ${concept.steps.map(s => `${s.title} — ${s.description}`).join("; ")}` : "",
    concept.pitfalls?.length ? `Pitfalls: ${concept.pitfalls.map(p => `${p.title} — ${p.description}`).join("; ")}` : "",
    concept.related_concepts?.length ? `Related: ${concept.related_concepts.map(r => `${r.name} (${r.relationship})`).join("; ")}` : "",
    concept.case_study ? `Case study: ${concept.case_study.company} — ${concept.case_study.situation} → ${concept.case_study.application} → ${concept.case_study.result}` : "",
    concept.exercise ? `Exercise: ${concept.exercise.scenario}` : "",
    concept.example ? `Examples: ${concept.example}` : "",
    concept.tags?.length ? `Tags: ${concept.tags.join(", ")}` : "",
  ].filter(Boolean).join("\n")
}

async function callConceptChat(prompt: string, model: string): Promise<string> {
  if (!db) throw new Error("Firebase not configured")
  const requestId = generateId()
  await set(ref(db!, `requests/${requestId}`), {
    type: "concept_chat",
    status: "pending",
    created_at: Date.now(),
    payload: { model, prompt, stream: false, options: { temperature: 0.5 } },
  })
  const { result } = await waitForFirebaseResponse(db!, requestId, `conceptChats/${requestId}`)
  return result
}

export async function chatWithConcept(
  concept: ConceptArg,
  messages: { role: string; content: string }[],
): Promise<string> {
  if (!db) throw new Error("Firebase not configured. Run the app locally to use AI chat.")
  const settings = loadSettings()
  const model = settings.ollamaModel || "gemma4:latest"

  const context = buildConceptContext(concept)

  const conversationHistory = messages
    .map((m) => `${m.role === "user" ? "User" : "Coach"}: ${m.content}`)
    .join("\n")

  const prompt = `You are a CEO coach helping an executive deeply understand a leadership concept. Use the concept context below to answer follow-up questions with concrete examples and actionable advice. Keep responses concise (2-4 sentences). If the user asks about something unrelated to the concept, politely redirect them.

CONCEPT CONTEXT:
${context}

${conversationHistory ? `PREVIOUS CONVERSATION:\n${conversationHistory}\n` : ""}
Answer the user's latest question. Do NOT repeat the concept context. Respond in plain text (no JSON, no markdown headers).`

  return callConceptChat(prompt, model)
}

export async function socraticTutor(
  concept: ConceptArg,
  messages: { role: string; content: string }[],
): Promise<string> {
  if (!db) throw new Error("Firebase not configured")
  const settings = loadSettings()
  const model = settings.ollamaModel || "gemma4:latest"

  const context = buildConceptContext(concept)

  const conversationHistory = messages
    .map((m) => `${m.role === "user" ? "User" : "Tutor"}: ${m.content}`)
    .join("\n")

  const isFirst = messages.length === 0
  const prompt = isFirst
    ? `You are a Socratic tutor. You must ask the user one question at a time about the concept below. Your goal is to probe the depth of their understanding — start easy, then get harder based on their answers. Do NOT explain the concept yourself. Do NOT answer your own questions. Ask only one question per turn. Wait for the user to answer before asking the next.

CONCEPT CONTEXT:
${context}

Your first question:`
    : `You are a Socratic tutor. The concept context is below. Based on the user's previous answers, decide whether to probe deeper or move to the next question. Ask only ONE question per turn. Never answer your own questions. If the user shows deep understanding, move to a harder aspect. If they struggle, simplify.

CONCEPT CONTEXT:
${context}

${conversationHistory ? `PREVIOUS CONVERSATION:\n${conversationHistory}\n` : ""}
User just answered. Respond with your next question only.`

  return callConceptChat(prompt, model)
}

export async function teachBackEvaluate(
  concept: ConceptArg,
  userExplanation: string,
): Promise<{ clarity: number; depth: number; gaps: string[]; improvement: string }> {
  if (!db) throw new Error("Firebase not configured")
  const settings = loadSettings()
  const model = settings.ollamaModel || "gemma4:latest"

  const context = buildConceptContext(concept)

  const prompt = `You are a CEO coach evaluating a student's explanation of a concept. Score the explanation below against the concept context. Be honest and specific.

CONCEPT CONTEXT:
${context}

STUDENT'S EXPLANATION:
"${userExplanation}"

Return ONLY valid JSON with these fields:
{
  "clarity": <number 1-10: how clear and understandable the explanation is>,
  "depth": <number 1-10: does it go beyond definition to strategic implications>,
  "gaps": ["specific thing they missed 1", "specific thing they missed 2"],
  "improvement": "A 2-3 sentence improved version at CEO level"
}`

  const raw = await callConceptChat(prompt, model)
  try {
    return JSON.parse(raw)
  } catch {
    return { clarity: 0, depth: 0, gaps: ["Could not parse evaluation"], improvement: raw }
  }
}

export async function generateAnalogy(
  concept: ConceptArg,
  domain: string,
): Promise<string> {
  if (!db) throw new Error("Firebase not configured")
  const settings = loadSettings()
  const model = settings.ollamaModel || "gemma4:latest"

  const context = buildConceptContext(concept)

  const prompt = `You are a CEO coach who explains concepts through creative analogies. Explain "${concept.name}" as if the user is a ${domain}. Generate 3 distinct analogies from different angles. Each analogy should illuminate a different aspect of the concept. Keep each analogy to 2-3 sentences. Do not use JSON — respond in plain text.

CONCEPT CONTEXT:
${context}

Explain ${concept.name} like I'm a ${domain}.`

  return callConceptChat(prompt, model)
}

// ── Decision Simulator ──

export async function runDecisionSimulator(
  challenge: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  if (!db) throw new Error("Firebase not configured")
  const settings = loadSettings()
  const model = settings.ollamaModel || "gemma4:latest"

  const conversationHistory = messages
    .map((m) => `${m.role === "user" ? "CEO" : "Coach"}: ${m.content}`)
    .join("\n")

  const isFirst = messages.length === 0
  const prompt = isFirst
    ? `You are a CEO coach with deep knowledge of all 57 leadership frameworks. The user describes a real business challenge. Your job:

1. Identify which 1-2 frameworks are most relevant to this challenge
2. Walk through each framework's key diagnostic questions applied to THEIR specific situation
3. Produce a structured action memo with: recommended action, risk to watch for, success metric, next check-in timeframe

Keep each section concise (2-3 sentences). Use plain text with these exact headers:
**Relevant Frameworks**
**Diagnostic Questions**
**Action Memo**
  - Recommended Action
  - Risk to Watch
  - Success Metric
  - Next Check-in

CEO's challenge: "${challenge}"`
    : `Continue assisting the CEO with their business challenge. Reference the previous conversation and frameworks discussed.

${conversationHistory ? `PREVIOUS CONVERSATION:\n${conversationHistory}\n` : ""}
Respond with additional analysis, refinements, or next steps. Use headers like **Framework Analysis**, **Refined Action Memo**, or **Follow-up Questions**. Be concise.`

  return callConceptChat(prompt, model)
}

// ── Blind Spot Detector ──

export type BlindSpotReport = {
  summary: string
  gaps: { area: string; severity: "high" | "medium" | "low"; recommendation: string }[]
  strengths: string[]
  next_focus: string
}

export async function analyzeBlindSpots(
  data: {
    viewedFrameworks: string[]
    reviewedConcepts: string[]
    quizResults: { framework: string; pct: number }[]
    journalEntries: number
    completedPathways: string[]
  },
): Promise<BlindSpotReport> {
  if (!db) throw new Error("Firebase not configured")
  const settings = loadSettings()
  const model = settings.ollamaModel || "gemma4:latest"

  const prompt = `You are a CEO coach analyzing an executive's learning patterns to identify blind spots. Below is their learning data.

VIEWED FRAMEWORKS: ${data.viewedFrameworks.join(", ") || "none recorded"}
REVIEWED CONCEPTS (spaced repetition): ${data.reviewedConcepts.join(", ") || "none recorded"}
QUIZ RESULTS (framework → score): ${data.quizResults.map(q => `${q.framework} ${q.pct}%`).join("; ") || "none recorded"}
JOURNAL ENTRIES: ${data.journalEntries}
COMPLETED PATHWAY STEPS: ${data.completedPathways.join(", ") || "none recorded"}

Identify:
1. Which frameworks/concepts they systematically avoid or underperform in
2. Which domains they're strong in
3. One specific next focus area that fills their biggest gap

Return ONLY valid JSON:
{
  "summary": "1-2 sentence overview of their learning pattern and the key blind spot",
  "gaps": [
    { "area": "Name of gap area (e.g. 'Risk Management', 'Financial Analysis')", "severity": "high"|"medium"|"low", "recommendation": "1 sentence actionable recommendation" }
  ],
  "strengths": ["Strength area 1", "Strength area 2"],
  "next_focus": "Single recommended next concept or framework to study, with rationale (2-3 sentences)"
}`

  const raw = await callConceptChat(prompt, model)
  try { return JSON.parse(raw) as BlindSpotReport }
  catch { return { summary: "Could not parse analysis", gaps: [], strengths: [], next_focus: raw } }
}

// ── Weekly Learning Brief ──

export async function generateLearningBrief(
  data: {
    viewedCount: number
    frameworksViewed: string[]
    quizScores: { framework: string; pct: number }[]
    avgQuizPct: number
    overdueJournals: number
    dueReviewsCount: number
    pathwayPct: number
  },
): Promise<string> {
  if (!db) throw new Error("Firebase not configured")
  const settings = loadSettings()
  const model = settings.ollamaModel || "gemma4:latest"

  const prompt = `You are a CEO coach writing a personalized weekly learning brief for an executive. Below is their week's data.

Concepts viewed: ${data.viewedCount} (frameworks: ${data.frameworksViewed.join(", ") || "none"})
Quizzes taken: ${data.quizScores.length} (avg ${data.avgQuizPct}%)
Quiz breakdown: ${data.quizScores.map(q => `${q.framework} ${q.pct}%`).join("; ") || "none"}
Journal decisions overdue: ${data.overdueJournals}
Due reviews: ${data.dueReviewsCount}
Pathway progress: ${data.pathwayPct}%

Write a brief (2-4 sentences) that:
1. Acknowledges their effort this week
2. Highlights their strongest area
3. Gently flags one area needing attention
4. Recommends one specific next action

Use warm, direct language. No JSON. Respond in plain text.`

  return callConceptChat(prompt, model)
}

export { slugify }
