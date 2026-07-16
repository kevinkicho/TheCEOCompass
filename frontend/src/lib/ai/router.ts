import type { AiProviderId } from "./provider"
import { isAiProviderId } from "./provider"

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
}

/**
 * Resolve which AI provider to use.
 *
 * Priority (matches today's agent + local paths; cloud opt-in later):
 * 1. localAiMode === true → "local" (Profile Local AI Mode override)
 * 2. settings.aiProvider if a valid AiProviderId
 * 3. NEXT_PUBLIC_AI_PROVIDER / envProvider if valid
 * 4. "agent" (default — Firebase request + agent)
 */
export function resolveAiProvider(input: AiRouterInput = {}): AiProviderId {
  if (input.localAiMode === true) {
    return "local"
  }

  if (isAiProviderId(input.aiProvider)) {
    return input.aiProvider
  }

  if (isAiProviderId(input.envProvider)) {
    return input.envProvider
  }

  return "agent"
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
