/**
 * OpenAI-compatible Chat Completions client for the cloud AI provider.
 *
 * Env (set via Firebase secrets / params — never commit keys):
 *   OPENAI_API_KEY   — required bearer token
 *   OPENAI_API_BASE  — default https://api.openai.com/v1
 *   CLOUD_AI_MODEL   — default gpt-4o-mini
 */

export type LlmConfig = {
  apiKey: string
  apiBase?: string
  model?: string
}

export type GenerateOptions = {
  prompt: string
  model?: string
  temperature?: number
  /** Abort hung provider calls so the handler can write status=error. Default 100s. */
  timeoutMs?: number
  /** Optional external signal (combined with timeout when both provided). */
  signal?: AbortSignal
  /** Injected for tests; defaults to global fetch */
  fetchImpl?: typeof fetch
}

export type GenerateResult = {
  text: string
  model: string
}

const DEFAULT_API_BASE = "https://api.openai.com/v1"
const DEFAULT_MODEL = "gpt-4o-mini"
/** Stay under Cloud Function timeoutSeconds (120) so writeError can still run. */
export const DEFAULT_LLM_TIMEOUT_MS = 100_000

export function loadLlmConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): LlmConfig {
  // Prefer OPENAI_* then OLLAMA_* aliases (same key works for Ollama Cloud)
  const apiKey =
    env.OPENAI_API_KEY?.trim() || env.OLLAMA_API_KEY?.trim() || ""
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY (or OLLAMA_API_KEY) is not set. Configure the secret before deploying cloud AI.",
    )
  }
  const apiBase =
    env.OPENAI_API_BASE?.trim() ||
    env.OLLAMA_API_BASE?.trim() ||
    DEFAULT_API_BASE
  const model =
    env.CLOUD_AI_MODEL?.trim() ||
    env.OLLAMA_MODEL?.trim() ||
    DEFAULT_MODEL
  return { apiKey, apiBase, model }
}

/** Strip markdown code fences the same way the local agent does. */
export function stripCodeFences(text: string): string {
  let result = text.trim()
  if (result.startsWith("```")) {
    result = result.split("\n").slice(1).join("\n")
  }
  if (result.endsWith("```")) {
    result = result.slice(0, -3).trim()
  }
  return result.trim()
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const name = (err as { name?: string }).name
  return name === "AbortError" || name === "TimeoutError"
}

/**
 * Call an OpenAI-compatible `/chat/completions` endpoint with a single user prompt.
 * Compatible with OpenAI, Azure OpenAI (with base path), Ollama cloud, Groq, etc.
 */
export async function generateText(
  config: LlmConfig,
  options: GenerateOptions,
): Promise<GenerateResult> {
  const apiBase = (config.apiBase || DEFAULT_API_BASE).replace(/\/+$/, "")
  const model = options.model || config.model || DEFAULT_MODEL
  const temperature =
    typeof options.temperature === "number" ? options.temperature : 0.7
  const fetchImpl = options.fetchImpl || fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS

  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal

  const url = `${apiBase}/chat/completions`
  let res: Response
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        messages: [{ role: "user", content: options.prompt }],
      }),
      signal,
    })
  } catch (err) {
    if (isAbortError(err)) {
      throw new Error(`Cloud LLM timed out after ${timeoutMs}ms`)
    }
    throw err
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(
      `Cloud LLM error (${res.status}): ${body.substring(0, 300)}`,
    )
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    model?: string
  }

  const raw = data.choices?.[0]?.message?.content
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Cloud LLM returned empty completion")
  }

  return {
    text: stripCodeFences(raw),
    model: data.model || model,
  }
}
