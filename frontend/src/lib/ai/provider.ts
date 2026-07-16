/**
 * AI provider identifiers for the pluggable provider model.
 *
 * - agent: Firebase RTDB requests + local agent (current production default)
 * - local: Browser → Ollama direct (Local AI Mode)
 * - cloud: Cloud Function path (scaffold only until later PR)
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

/** Clear error until cloud provider is wired (PR 3/4). */
export const CLOUD_PROVIDER_NOT_CONFIGURED =
  "Cloud AI provider is not configured yet. Use agent mode or enable Local AI Mode in Profile."
