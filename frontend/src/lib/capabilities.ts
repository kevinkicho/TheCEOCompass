import { db } from "./firebase"
import type { AiProviderId } from "./ai/provider"

/**
 * True only when the Firebase RTDB client actually initialized.
 * Matches getDb() / firebase-crud behavior — NOT hostname, NOT a single env var.
 */
export function canUseFirebasePersistence(): boolean {
  return typeof window !== "undefined" && db != null
}

export type AiAvailability =
  | { status: "available"; mode: "agent" | "local"; ollamaOk: boolean }
  | {
      status: "unavailable"
      reason:
        | "no_heartbeat"
        | "stale"
        | "ollama_down"
        | "no_firebase"
        | "cloud_not_configured"
        | "unknown"
    }

export const AGENT_HEARTBEAT_PATH = "_meta/agent_heartbeat"
/** Agent writes every 30s; UI treats stale after 90s. Allow ±120s clock skew buffer. */
export const AGENT_HEARTBEAT_STALE_MS = 90_000
export const AGENT_HEARTBEAT_SKEW_MS = 120_000

export type AgentHeartbeat = {
  status: "ok" | "degraded"
  updated_at: number
  ollama_ok: boolean
  ollama_checked_at?: number
  model_default?: string
  agent_version?: string
  hostname?: string
}

/**
 * Resolve effective "local" flag for availability.
 * Prefer explicit provider when given; otherwise fall back to Profile localAiMode.
 */
function isLocalProvider(localAiMode: boolean, provider?: AiProviderId): boolean {
  if (provider === "local") return true
  if (provider === "agent" || provider === "cloud") return false
  return localAiMode
}

export function canUseAIFromHeartbeat(
  heartbeat: AgentHeartbeat | null,
  localAiMode: boolean,
  provider?: AiProviderId,
): boolean {
  if (provider === "cloud") return false
  if (isLocalProvider(localAiMode, provider)) return true
  if (!heartbeat) return false
  const age = Date.now() - heartbeat.updated_at
  if (age > AGENT_HEARTBEAT_STALE_MS + AGENT_HEARTBEAT_SKEW_MS) return false
  return heartbeat.ollama_ok
}

export function getAiAvailability(
  heartbeat: AgentHeartbeat | null,
  localAiMode: boolean,
  provider?: AiProviderId,
): AiAvailability {
  if (provider === "cloud") {
    return { status: "unavailable", reason: "cloud_not_configured" }
  }
  if (isLocalProvider(localAiMode, provider)) {
    return { status: "available", mode: "local", ollamaOk: true }
  }
  if (!db) {
    return { status: "unavailable", reason: "no_firebase" }
  }
  if (!heartbeat) {
    return { status: "unavailable", reason: "no_heartbeat" }
  }
  const age = Date.now() - heartbeat.updated_at
  if (age > AGENT_HEARTBEAT_STALE_MS + AGENT_HEARTBEAT_SKEW_MS) {
    return { status: "unavailable", reason: "stale" }
  }
  if (!heartbeat.ollama_ok) {
    return { status: "unavailable", reason: "ollama_down" }
  }
  return { status: "available", mode: "agent", ollamaOk: true }
}
