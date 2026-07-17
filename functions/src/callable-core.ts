/**
 * Pure callable AI core (no firebase-functions imports) for unit tests.
 */

import type { LlmConfig, GenerateResult } from "./llm"
import { consumeRateLimit, type RateDbLike } from "./rate-limit"

export type CallableGenerateInput = {
  prompt: string
  model?: string
  temperature?: number
  uid: string
}

export type CallableGenerateResult = {
  text: string
  model: string
  source: "callable"
  latencyMs: number
}

export type CallableDeps = {
  db: RateDbLike
  generateText: (
    config: LlmConfig,
    options: {
      prompt: string
      model?: string
      temperature?: number
      timeoutMs?: number
    },
  ) => Promise<GenerateResult>
  llmConfig: LlmConfig
  llmTimeoutMs?: number
  now?: () => number
  /** Optional heartbeat writer (Admin SDK set). */
  writeHeartbeat?: (data: Record<string, unknown>) => Promise<void>
}

/**
 * Authenticated cloud generate: rate-limit → LLM → optional heartbeat.
 */
export async function runCallableGenerate(
  input: CallableGenerateInput,
  deps: CallableDeps,
): Promise<CallableGenerateResult> {
  const now = deps.now ?? (() => Date.now())
  const started = now()
  const uid = (input.uid || "").trim()
  if (!uid) {
    throw new Error("UNAUTHENTICATED: uid required")
  }
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : ""
  if (!prompt) {
    throw new Error("INVALID_ARGUMENT: prompt is required")
  }

  const rate = await consumeRateLimit(deps.db, uid, now())
  if (!rate.allowed) {
    throw new Error(rate.message || "AI rate limit exceeded")
  }

  const { text, model } = await deps.generateText(deps.llmConfig, {
    prompt,
    model: input.model,
    temperature: input.temperature,
    timeoutMs: deps.llmTimeoutMs ?? 100_000,
  })

  const latencyMs = Math.max(0, now() - started)
  if (deps.writeHeartbeat) {
    try {
      await deps.writeHeartbeat({
        status: "ok",
        updated_at: now(),
        last_request_id: `callable-${started}`,
        last_uid: uid,
        last_latency_ms: latencyMs,
        last_model: model,
        source: "callable",
      })
    } catch {
      /* best-effort */
    }
  }

  return { text, model, source: "callable", latencyMs }
}
