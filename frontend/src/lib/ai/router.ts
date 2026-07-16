import type { AiProviderId } from "./provider"
import { normalizeAiProviderId } from "./provider"

/**
 * Inputs for pure provider selection. Keep free of React/Firebase so unit tests
 * can exercise the full matrix without mocks.
 */
export type AiRouterInput = {
  /** Profile toggle: browser Ollama (highest priority when true). */
  localAiMode?: boolean
  /** Optional explicit preference from settings (agent | local | cloud). */
  aiProvider?: AiProviderId | string | null
  /**
   * Build-time / env default, e.g. process.env.NEXT_PUBLIC_AI_PROVIDER.
   * Only used when localAiMode is false and no valid settings preference.
   */
  envProvider?: string | null
  /**
   * Remote default from RTDB feature flags (`ai_provider_default`).
   * Used after env when no settings preference.
   */
  flagDefault?: string | null
  /**
   * When false, cloud is demoted to agent (ops kill-switch / pre-enable gate).
   * When true or omitted, cloud is allowed.
   */
  cloudAiEnabled?: boolean
}

/**
 * Resolve which AI provider to use.
 *
 * Priority:
 * 1. localAiMode === true → "local" (Profile Local AI Mode override)
 * 2. settings.aiProvider if a valid AiProviderId (case-insensitive)
 * 3. NEXT_PUBLIC_AI_PROVIDER / envProvider if valid (case-insensitive)
 * 4. remote flagDefault (ai_provider_default) if valid
 * 5. "agent" (default — Firebase request + agent)
 *
 * If the resolved provider is "cloud" and cloudAiEnabled === false → "agent".
 */
export function resolveAiProvider(input: AiRouterInput = {}): AiProviderId {
  if (input.localAiMode === true) {
    return "local"
  }

  let resolved: AiProviderId = "agent"

  const fromSettings = normalizeAiProviderId(input.aiProvider)
  if (fromSettings) {
    resolved = fromSettings
  } else {
    const fromEnv = normalizeAiProviderId(input.envProvider)
    if (fromEnv) {
      resolved = fromEnv
    } else {
      const fromFlag = normalizeAiProviderId(input.flagDefault)
      if (fromFlag) resolved = fromFlag
    }
  }

  if (resolved === "cloud" && input.cloudAiEnabled === false) {
    return "agent"
  }

  return resolved
}

/**
 * Read env default for provider. Safe on server and in tests (no throw).
 */
export function getEnvAiProvider(): string | null {
  try {
    const v = process.env.NEXT_PUBLIC_AI_PROVIDER
    return typeof v === "string" && v.length > 0 ? v : null
  } catch {
    return null
  }
}
