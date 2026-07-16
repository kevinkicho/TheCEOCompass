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
  /** Injected for tests; defaults to global fetch */
  fetchImpl?: typeof fetch
}

export type GenerateResult = {
  text: string
  model: string
}

const DEFAULT_API_BASE = "https://api.openai.com/v1"
const DEFAULT_MODEL = "gpt-4o-mini"

export function loadLlmConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): LlmConfig {
  const apiKey = env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Configure the secret before deploying cloud AI.",
    )
  }
  return {
    apiKey,
    apiBase: env.OPENAI_API_BASE?.trim() || DEFAULT_API_BASE,
    model: env.CLOUD_AI_MODEL?.trim() || DEFAULT_MODEL,
  }
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

  const url = `${apiBase}/chat/completions`
  const res = await fetchImpl(url, {
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
  })

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
