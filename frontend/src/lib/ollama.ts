// Direct Ollama client — calls http://localhost:11434 from the browser
// If that fails due to CORS, tries http://localhost:8080 (CORS proxy)
// Requires Ollama to be started with: OLLAMA_ORIGINS=* ollama serve

const OLLAMA_URL = "http://localhost:11434"
const PROXY_URL = "http://localhost:8080"

function systemPrompt(): string {
  return "You are an expert CEO coach and business strategy expert. Respond only with valid JSON."
}

async function callOllama(
  model: string,
  prompt: string,
  temperature: number = 0.3,
): Promise<string> {
  const settings = loadSettings()
  const actualModel = model || settings.ollamaModel || "gemma4:latest"
  const body = JSON.stringify({
    model: actualModel.replace(":cloud", ""),
    prompt: `${systemPrompt()}\n\n${prompt}`,
    stream: false,
    options: { temperature },
  })

  // Try direct Ollama first, then proxy fallback
  const urls = [OLLAMA_URL, PROXY_URL]
  let lastError: Error | null = null

  for (const baseUrl of urls) {
    try {
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      })

      if (res.status === 429) {
        throw new Error("Ollama is busy. Wait a moment and try again.")
      }
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Ollama error (${res.status}): ${text.substring(0, 200)}`)
      }

      const data = await res.json()
      let text: string = (data.response || "").trim()

      // Strip markdown code fences
      if (text.startsWith("```")) {
        text = text.split("\n").slice(1).join("\n")
      }
      if (text.endsWith("```")) {
        text = text.slice(0, -3).trim()
      }

      return text
    } catch (e: any) {
      lastError = e
      // If direct failed and proxy is next, try proxy
      if (baseUrl === OLLAMA_URL && urls.indexOf(PROXY_URL) > urls.indexOf(OLLAMA_URL)) {
        console.warn(`[Ollama] Direct call failed (${e.message}), trying proxy...`)
        continue
      }
      break
    }
  }

  throw lastError || new Error("Failed to reach Ollama")
}

function loadSettings() {
  try {
    const raw = localStorage.getItem("ceocompass_settings")
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
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

  const response = await callOllama("", prompt, 0.5)
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

  const response = await callOllama("", prompt, 0.4)
  return JSON.parse(response)
}
