// Direct Ollama client — tries multiple ports automatically
//  1. 11434  (default Ollama, needs OLLAMA_ORIGINS=*)
//  2. 11435  (CORS-enabled Ollama, user runs separately)
//  3. 8080   (CORS proxy, user runs node proxy.js)

const OLLAMA_PORTS = [11434, 11435, 8080]

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

  // Try each port until one works
  let lastError: Error | null = null
  for (const port of OLLAMA_PORTS) {
    try {
      const url = `http://localhost:${port}/api/generate`
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      })

      if (res.status === 429) {
        throw new Error("Ollama is busy. Wait a moment and try again.")
      }
      if (!res.ok) {
        const text = await res.text()
        // CORS failures show as network errors, not HTTP errors
        // So if we get here, Ollama responded but rejected our origin
        if (res.status === 403) {
          console.warn(`[Ollama] Port ${port} rejects origin, trying next...`)
          continue
        }
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
      console.warn(`[Ollama] Port ${port} failed: ${e.message}`)
    }
  }

  throw lastError || new Error("Failed to reach Ollama on any port (11434, 11435, 8080)")
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
