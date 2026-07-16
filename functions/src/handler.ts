/**
 * Cloud AI request orchestration (testable, no Firebase Functions imports).
 *
 * Claim → rate-limit → generate → write response → status done|error
 */

import type { LlmConfig, GenerateResult } from "./llm"
import {
  getResponsePath,
  isCloudProviderRequest,
  type AiRequestData,
} from "./response-path"
import { consumeRateLimit } from "./rate-limit"

/** Minimal RTDB surface used by the handler (injectable for unit tests). */
export type DbRef = {
  transaction: (
    updateFn: (current: AiRequestData | null) => AiRequestData | undefined | null,
  ) => Promise<{ committed: boolean; snapshot: { val: () => AiRequestData | null } }>
  update: (data: Record<string, unknown>) => Promise<void>
  set: (data: Record<string, unknown>) => Promise<void>
}

export type DbLike = {
  ref: (path: string) => DbRef
}

export type GenerateTextFn = (
  config: LlmConfig,
  options: {
    prompt: string
    model?: string
    temperature?: number
    timeoutMs?: number
  },
) => Promise<GenerateResult>

export type HandlerDeps = {
  db: DbLike
  generateText: GenerateTextFn
  llmConfig: LlmConfig
  /** LLM fetch timeout (ms). Default 100_000 — under function timeoutSeconds. */
  llmTimeoutMs?: number
  now?: () => number
  log?: (msg: string) => void
  logError?: (msg: string) => void
}

export type HandleResult =
  | { outcome: "skipped"; reason: string }
  | { outcome: "done"; responsePath: string; chars: number }
  | { outcome: "error"; message: string }

/**
 * Atomically claim a pending cloud request. Returns null if already claimed
 * or not eligible (retry/re-delivery safe).
 */
export async function claimCloudRequest(
  requestRef: DbRef,
  now: number,
): Promise<AiRequestData | null> {
  const result = await requestRef.transaction((current) => {
    if (!current || current.provider !== "cloud" || current.status !== "pending") {
      // Abort transaction — another attempt already owns this request
      return
    }
    return {
      ...current,
      status: "processing",
      started_at: now,
    }
  })
  if (!result.committed) return null
  return result.snapshot.val()
}

/**
 * Prefer status=error first so clients fail fast even if response path write fails.
 * Also stores `error` on the request so the frontend can surface the message when
 * the response path is missing or not yet written.
 */
export async function writeError(
  db: DbLike,
  requestId: string,
  data: AiRequestData,
  errorMessage: string,
  now: number = Date.now(),
): Promise<void> {
  const errorData = { error: errorMessage, created_at: now }
  try {
    await db.ref(`requests/${requestId}`).update({
      status: "error",
      error: errorMessage,
    })
  } finally {
    const path = getResponsePath(requestId, data)
    if (path) {
      try {
        await db.ref(path).set(errorData)
      } catch (e) {
        console.error(
          `writeError response path failed (${path}): ${e instanceof Error ? e.message : e}`,
        )
      }
    }
  }
}

export async function handleCloudRequest(
  requestId: string,
  eventData: AiRequestData | null,
  deps: HandlerDeps,
): Promise<HandleResult> {
  const now = deps.now ?? (() => Date.now())
  const log = deps.log ?? (() => {})
  const logError = deps.logError ?? ((m: string) => console.error(m))
  const llmTimeoutMs = deps.llmTimeoutMs ?? 100_000

  // Fast path from create snapshot (avoids transaction on agent traffic)
  if (!isCloudProviderRequest(eventData)) {
    return { outcome: "skipped", reason: "not_cloud_provider" }
  }
  if (!eventData || eventData.status !== "pending") {
    return { outcome: "skipped", reason: "not_pending" }
  }

  const requestRef = deps.db.ref(`requests/${requestId}`)
  const claimed = await claimCloudRequest(requestRef, now())
  if (!claimed) {
    return { outcome: "skipped", reason: "claim_failed" }
  }

  // Prefer live claimed row (post-transaction) over create-event snapshot
  const data = claimed
  const startedAt = now()
  log(`[processAIRequest] ${requestId} type=${data.type || "generate"}`)

  // Security (Phase 2 design): cloud path requires request.uid (AuthSession attaches it)
  const uid = typeof data.uid === "string" ? data.uid.trim() : ""
  if (!uid) {
    const message =
      "Cloud AI requires an authenticated user (missing uid on request)"
    log(`[processAIRequest] ${requestId} rejected: missing uid`)
    await writeError(deps.db, requestId, data, message, now())
    return { outcome: "error", message }
  }

  // Per-uid sliding window (Admin SDK `_rate/{uid}`) — before any LLM call
  const rate = await consumeRateLimit(
    deps.db as import("./rate-limit").RateDbLike,
    uid,
    now(),
  )
  if (!rate.allowed) {
    const message = rate.message || "AI rate limit exceeded"
    log(`[processAIRequest] ${requestId} rate_limited uid=${uid} remaining=0`)
    await writeError(deps.db, requestId, data, message, now())
    return { outcome: "error", message }
  }

  try {
    const responsePath = getResponsePath(requestId, data)
    if (!responsePath) {
      throw new Error("No response path for request type/category")
    }

    const prompt = data.payload?.prompt
    if (!prompt || typeof prompt !== "string") {
      throw new Error("Request payload.prompt is required for cloud AI")
    }

    const temperature = data.payload?.options?.temperature
    const payloadModel = data.payload?.model

    const { text, model } = await deps.generateText(deps.llmConfig, {
      prompt,
      model: payloadModel,
      temperature,
      timeoutMs: llmTimeoutMs,
    })

    const responseData: Record<string, unknown> = {
      result: text,
      model,
      prompt,
      created_at: now(),
    }

    if (data.category === "quote") {
      await deps.db.ref(responsePath).set({
        ...responseData,
        category: data.category || "",
      })
    } else if (data.category === "scenario") {
      await deps.db.ref(responsePath).set({
        ...responseData,
        stage_id: data.stage_id || "",
      })
    } else {
      await deps.db.ref(responsePath).set(responseData)
    }

    await requestRef.update({ status: "done" })
    const latencyMs = Math.max(0, now() - startedAt)
    log(
      `[processAIRequest] ${requestId} done uid=${uid} latency_ms=${latencyMs} chars=${text.length} → ${responsePath}`,
    )
    // Observability: optional cloud worker heartbeat (mirrors agent heartbeat)
    try {
      await deps.db.ref("_meta/cloud_worker_heartbeat").set({
        status: "ok",
        updated_at: now(),
        last_request_id: requestId,
        last_uid: uid,
        last_latency_ms: latencyMs,
        last_model: model,
      })
    } catch (hbErr) {
      logError(
        `[processAIRequest] heartbeat write failed: ${hbErr instanceof Error ? hbErr.message : hbErr}`,
      )
    }
    return { outcome: "done", responsePath, chars: text.length }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const latencyMs = Math.max(0, now() - startedAt)
    logError(
      `[processAIRequest] ${requestId} error uid=${uid} latency_ms=${latencyMs}: ${message}`,
    )
    await writeError(deps.db, requestId, data, message, now())
    return { outcome: "error", message }
  }
}
