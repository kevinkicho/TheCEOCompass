import { db, ref, set, onValue, off, get, update } from "./firebase"

function generateId(): string {
  return crypto.randomUUID()
}

function systemPrompt(): string {
  return "You are an expert CEO coach and business strategy expert. Respond only with valid JSON."
}

function loadSettings(): Record<string, string> {
  try {
    const raw = localStorage.getItem("ceocompass_settings")
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

async function callOllamaViaFirebase(
  model: string,
  prompt: string,
  temperature: number = 0.3,
): Promise<string> {
  const settings = loadSettings()
  const actualModel = model || settings.ollamaModel || "gemma4:latest"
  const requestId = generateId()

  const payload = {
    model: actualModel,
    prompt: `${systemPrompt()}\n\n${prompt}`,
    stream: false,
    options: { temperature },
  }

  await set(ref(db, `requests/${requestId}`), {
    type: "generate",
    payload,
    status: "pending",
    created_at: Date.now(),
  })

  return new Promise((resolve, reject) => {
    const responseRef = ref(db, `responses/${requestId}`)
    const statusRef = ref(db, `requests/${requestId}/status`)
    let done = false

    const unsubStatus = onValue(statusRef, (snap) => {
      if (done) return
      const status = snap.val()
      if (status === "error") {
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
  frameworkId: string,
  _numQuestions: number,
  _difficulty: string,
  frameworkTitle?: string,
) {
  const num = _numQuestions || 5
  const diff = _difficulty || "medium"
  const title = frameworkTitle || "Strategic Decision-Making"

  const prompt = `Create ${num} quiz questions for the "${title}" framework.

Concepts to test: various leadership and strategy concepts
Difficulty: ${diff}

Generate JSON array of questions:
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

Mix question types. For calculation questions, include realistic numbers.
Return ONLY valid JSON array.`

  const response = await callOllamaViaFirebase("", prompt, 0.5)
  return JSON.parse(response)
}

export async function explainConcept(
  conceptName: string,
  definition: string,
  frameworkTitle: string,
) {
  const prompt = `You are an expert CEO coach. Provide a concise, actionable explanation of this concept.

Concept: ${conceptName}
Definition: ${definition}
Framework: ${frameworkTitle}

Return a JSON object with these fields:
{
  "real_world_example": "A brief real-world CEO example of this concept in action (2-3 sentences)",
  "ceo_insight": "Why this matters specifically to a CEO (1-2 sentences)",
  "common_mistake": "One common mistake CEOs make with this concept (1-2 sentences)",
  "related_tip": "A quick actionable tip for applying this (1 sentence)"
}

Return ONLY valid JSON.`

  const response = await callOllamaViaFirebase("", prompt, 0.4)
  return JSON.parse(response)
}
