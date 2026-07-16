/**
 * AI provider identifiers for the pluggable provider model.
 *
 * - agent: Firebase RTDB requests + local agent (current production default)
 * - local: Browser → Ollama direct (Local AI Mode)
 * - cloud: Cloud Function path (scaffold only until later PR)
 */
export type AiProviderId = "agent" | "local" | "cloud"

export const AI_PROVIDER_IDS: readonly AiProviderId[] = ["agent", "local", "cloud"] as const

export function isAiProviderId(value: unknown): value is AiProviderId {
  return value === "agent" || value === "local" || value === "cloud"
}

/** Clear error until cloud provider is wired (PR 3/4). */
export const CLOUD_PROVIDER_NOT_CONFIGURED =
  "Cloud AI provider is not configured yet. Use agent mode or enable Local AI Mode in Profile."
