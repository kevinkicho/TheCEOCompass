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

async function checkCache(
  database: ReturnType<typeof import("firebase/database").getDatabase>,
  frameworkSlug: string,
  conceptSlug: string | null,
): Promise<string | null> {
  try {
    const cachePath = conceptSlug
      ? `framework/${frameworkSlug}/${conceptSlug}/responses`
      : `framework/${frameworkSlug}/quiz/responses`

    const cacheQuery = query(ref(database, cachePath), orderByChild("created_at"), limitToLast(1))
    const snap = await get(cacheQuery)
    if (!snap.exists()) return null

    const entries = snap.val()
    const latest = Object.values(entries)[0] as any
    if (!latest || !latest.result) return null
    if (Date.now() - (latest.created_at || 0) > 86400000) return null

    return latest.result
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
): Promise<string> {
  if (!db) {
    throw new Error("Firebase not configured. Set NEXT_PUBLIC_FIREBASE_* env vars or add them to .env.local")
  }

  const database = db!
  const settings = loadSettings()
  const actualModel = model || settings.ollamaModel || "gemma4:latest"

  const cached = await checkCache(database, frameworkSlug, conceptSlug)
  if (cached) return cached

  const requestId = generateId()
  const fullPrompt = `${buildSystemPrompt(type)}\n\n${prompt}`

  const payload = {
    model: actualModel,
    prompt: fullPrompt,
    stream: false,
    options: { temperature },
  }

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
      if (snap.val() === "error") {
        done = true
        unsubStatus()
        unsubResp()
        get(responseRef).then((s) => {
          const d = s.val()
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
        resolve(data.result)
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

  const response = await callOllamaViaFirebase("", prompt, 0.5, frameworkSlug, null, "quiz")
  return JSON.parse(response)
}

export async function explainConcept(
  conceptName: string,
  definition: string,
  frameworkSlug: string,
) {
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

  const response = await callOllamaViaFirebase("", prompt, 0.4, frameworkSlug, conceptSlug, "explain")
  return JSON.parse(response)
}

export { slugify }
