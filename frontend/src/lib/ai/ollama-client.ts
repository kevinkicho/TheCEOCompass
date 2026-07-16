/**
 * Ollama client: local daemon first, then cloud API key fallback.
 *
 * Env (see .env.example):
 *   NEXT_PUBLIC_OLLAMA_URL          — default http://localhost:11434
 *   NEXT_PUBLIC_OLLAMA_MODEL        — default gemma4:31b-cloud
 *   NEXT_PUBLIC_OLLAMA_API_KEY      — Ollama Cloud / OpenAI-compatible bearer (optional)
 *   NEXT_PUBLIC_OLLAMA_API_BASE     — default https://ollama.com/v1
 *
 * Note: NEXT_PUBLIC_* values are bundled into static export. Prefer agent/Functions
 * secrets for production; browser key is for local-dev and fallback when agent is offline.
 */

export type OllamaCallOptions = {
  prompt: string
  temperature?: number
  model?: string
  /** Local base URL without path (e.g. http://localhost:11434) */
  localUrl?: string
  apiKey?: string | null
  apiBase?: string | null
  /** Prefer cloud only (skip local probe). */
  forceCloud?: boolean
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export type OllamaCallResult = {
  text: string
  model: string
  source: "local" | "cloud"
}

const DEFAULT_LOCAL = "http://localhost:11434"
const DEFAULT_CLOUD_BASE = "https://ollama.com/v1"
const DEFAULT_MODEL = "gemma4:31b-cloud"

export function getOllamaEnvConfig(): {
  localUrl: string
  model: string
  apiKey: string | null
  apiBase: string
} {
  const env = typeof process !== "undefined" ? process.env : ({} as NodeJS.ProcessEnv)
  const apiKey =
    (env.NEXT_PUBLIC_OLLAMA_API_KEY || env.OLLAMA_API_KEY || "").trim() || null
  return {
    localUrl: (env.NEXT_PUBLIC_OLLAMA_URL || DEFAULT_LOCAL).replace(/\/+$/, ""),
    model: env.NEXT_PUBLIC_OLLAMA_MODEL || DEFAULT_MODEL,
    apiKey,
    apiBase: (env.NEXT_PUBLIC_OLLAMA_API_BASE || env.OLLAMA_API_BASE || DEFAULT_CLOUD_BASE).replace(
      /\/+$/,
      "",
    ),
  }
}

/** True when a cloud API key is available (env). */
export function hasOllamaApiKey(): boolean {
  return Boolean(getOllamaEnvConfig().apiKey)
}

function stripCodeFences(text: string): string {
  let result = text.trim()
  if (result.startsWith("```")) {
    result = result.split("\n").slice(1).join("\n")
  }
  if (result.endsWith("```")) {
    result = result.slice(0, -3).trim()
  }
  return result.trim()
}

async function callLocalGenerate(
  opts: Required<Pick<OllamaCallOptions, "prompt" | "temperature" | "model" | "localUrl" | "timeoutMs">> & {
    fetchImpl: typeof fetch
  },
): Promise<OllamaCallResult> {
  const res = await opts.fetchImpl(`${opts.localUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      prompt: opts.prompt,
      stream: false,
      options: { temperature: opts.temperature },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama local error (${res.status}): ${text.substring(0, 200)}`)
  }
  const data = (await res.json()) as { response?: string }
  const text = stripCodeFences(data.response || "")
  if (!text) throw new Error("Ollama local returned empty response")
  return { text, model: opts.model, source: "local" }
}

/**
 * OpenAI-compatible chat completions (Ollama Cloud, OpenAI, Groq, etc.).
 */
export async function callOllamaCloudChat(
  opts: {
    prompt: string
    temperature: number
    model: string
    apiKey: string
    apiBase: string
    timeoutMs: number
    fetchImpl: typeof fetch
  },
): Promise<OllamaCallResult> {
  const url = `${opts.apiBase.replace(/\/+$/, "")}/chat/completions`
  const res = await opts.fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: [{ role: "user", content: opts.prompt }],
      temperature: opts.temperature,
      stream: false,
    }),
    signal: AbortSignal.timeout(opts.timeoutMs),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama cloud error (${res.status}): ${text.substring(0, 200)}`)
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    model?: string
  }
  const content = data.choices?.[0]?.message?.content || ""
  const text = stripCodeFences(content)
  if (!text) throw new Error("Ollama cloud returned empty response")
  return { text, model: data.model || opts.model, source: "cloud" }
}

/**
 * Probe local Ollama tags endpoint (cheap health check).
 */
export async function probeLocalOllama(
  localUrl: string = getOllamaEnvConfig().localUrl,
  timeoutMs = 2500,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const res = await fetchImpl(`${localUrl.replace(/\/+$/, "")}/api/tags`, {
      signal: AbortSignal.timeout(timeoutMs),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Generate text: local Ollama first (if reachable), else cloud API key.
 */
export async function generateWithOllamaFallback(
  options: OllamaCallOptions,
): Promise<OllamaCallResult> {
  const env = getOllamaEnvConfig()
  const temperature = typeof options.temperature === "number" ? options.temperature : 0.7
  const model = options.model || env.model
  const localUrl = (options.localUrl || env.localUrl).replace(/\/+$/, "")
  const apiKey = options.apiKey !== undefined ? options.apiKey : env.apiKey
  const apiBase = (options.apiBase || env.apiBase).replace(/\/+$/, "")
  const timeoutMs = options.timeoutMs ?? 120_000
  const fetchImpl = options.fetchImpl || fetch

  const errors: string[] = []

  if (!options.forceCloud) {
    try {
      const localOk = await probeLocalOllama(localUrl, 2500, fetchImpl)
      if (localOk) {
        return await callLocalGenerate({
          prompt: options.prompt,
          temperature,
          model,
          localUrl,
          timeoutMs,
          fetchImpl,
        })
      }
      errors.push("local Ollama not reachable")
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }

  if (apiKey) {
    return await callOllamaCloudChat({
      prompt: options.prompt,
      temperature,
      model,
      apiKey,
      apiBase,
      timeoutMs,
      fetchImpl,
    })
  }

  throw new Error(
    `AI unavailable: ${errors.join("; ") || "local Ollama down"}. ` +
      `Set OLLAMA_API_KEY / NEXT_PUBLIC_OLLAMA_API_KEY in .env for cloud fallback, or start local Ollama.`,
  )
}
