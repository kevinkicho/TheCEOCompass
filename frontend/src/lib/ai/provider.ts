/**
 * AI provider identifiers for the pluggable provider model.
 *
 * - agent: Firebase RTDB requests + local agent (current production default)
 * - local: Browser → Ollama direct (Local AI Mode)
 * - cloud: Firebase RTDB requests + Cloud Function (provider: "cloud")
 */
export type AiProviderId = "agent" | "local" | "cloud"

export const AI_PROVIDER_IDS: readonly AiProviderId[] = ["agent", "local", "cloud"] as const

/**
 * Normalize a raw settings/env value to AiProviderId (case-insensitive).
 * Returns null for missing/invalid values.
 */
export function normalizeAiProviderId(value: unknown): AiProviderId | null {
  if (typeof value !== "string") return null
  const v = value.trim().toLowerCase()
  if (v === "agent" || v === "local" || v === "cloud") return v
  return null
}

export function isAiProviderId(value: unknown): value is AiProviderId {
  return normalizeAiProviderId(value) !== null
}

/**
 * Shown when cloud was requested but the remote flag `cloud_ai_enabled` is off
 * (and code paths choose not to silently demote). Kept for messaging/tests.
 */
export const CLOUD_PROVIDER_NOT_CONFIGURED =
  "Cloud AI is not enabled. An admin must set cloud_ai_enabled in feature flags, or use Agent / Local AI Mode."
