/**
 * Local Ollama first, then cloud API key fallback (same contract as frontend ollama-client).
 *
 * Env:
 *   OLLAMA_URL / default http://localhost:11434
 *   OLLAMA_MODEL / default gemma4:31b-cloud
 *   OLLAMA_API_KEY — required for cloud fallback
 *   OLLAMA_API_BASE — default https://ollama.com/v1
 */

const DEFAULT_LOCAL = "http://localhost:11434"
const DEFAULT_CLOUD_BASE = "https://ollama.com/v1"
const DEFAULT_MODEL = "gemma4:31b-cloud"

export function loadOllamaEnv(env = process.env) {
  return {
    localUrl: (env.OLLAMA_URL || DEFAULT_LOCAL).replace(/\/+$/, ""),
    model: env.OLLAMA_MODEL || DEFAULT_MODEL,
    apiKey: (env.OLLAMA_API_KEY || env.OPENAI_API_KEY || "").trim() || null,
    apiBase: (env.OLLAMA_API_BASE || env.OPENAI_API_BASE || DEFAULT_CLOUD_BASE).replace(/\/+$/, ""),
  }
}

function stripCodeFences(text) {
  let result = String(text || "").trim()
  if (result.startsWith("```")) {
    result = result.split("\n").slice(1).join("\n")
  }
  if (result.endsWith("```")) {
    result = result.slice(0, -3).trim()
  }
  return result.trim()
}

export async function probeLocalOllama(localUrl, timeoutMs = 2500) {
  try {
    const res = await fetch(`${localUrl}/api/tags`, {
      signal: AbortSignal.timeout(timeoutMs),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Generate text from a full prompt string (already includes system preamble).
 * Returns { text, model, source: "local"|"cloud" }
 */
export async function generateWithFallback(prompt, options = {}) {
  const env = loadOllamaEnv()
  const model = options.model || env.model
  const temperature =
    typeof options.temperature === "number" ? options.temperature : 0.7
  const localUrl = env.localUrl
  const timeoutMs = options.timeoutMs ?? 300_000

  // 1) Local streaming generate when daemon is up
  if (await probeLocalOllama(localUrl)) {
    const ollamaRes = await fetch(`${localUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: true,
        options: { temperature },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!ollamaRes.ok) {
      const text = await ollamaRes.text()
      throw new Error(`Ollama local error (${ollamaRes.status}): ${text.substring(0, 200)}`)
    }
    const reader = ollamaRes.body.getReader()
    const decoder = new TextDecoder()
    let fullResponse = ""
    let buffer = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const chunk = JSON.parse(line)
          if (chunk.response) fullResponse += chunk.response
        } catch {
          /* skip */
        }
      }
    }
    if (buffer.trim()) {
      try {
        const chunk = JSON.parse(buffer)
        if (chunk.response) fullResponse += chunk.response
      } catch {
        /* skip */
      }
    }
    const text = stripCodeFences(fullResponse)
    if (!text) throw new Error("Ollama local returned empty response")
    return { text, model, source: "local" }
  }

  // 2) Cloud OpenAI-compatible chat
  if (!env.apiKey) {
    throw new Error(
      "Local Ollama unreachable and OLLAMA_API_KEY is not set. " +
        "Start Ollama or set OLLAMA_API_KEY in agent/.env",
    )
  }

  const url = `${env.apiBase}/chat/completions`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature,
      stream: false,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama cloud error (${res.status}): ${text.substring(0, 200)}`)
  }
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || ""
  const text = stripCodeFences(content)
  if (!text) throw new Error("Ollama cloud returned empty response")
  return { text, model: data.model || model, source: "cloud" }
}
