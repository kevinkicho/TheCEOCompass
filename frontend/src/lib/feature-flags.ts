/**
 * Remote feature flags from RTDB `_config/feature_flags`.
 * Safe defaults when missing / offline. No product behavior change until
 * consumers gate on these flags (and values are flipped in RTDB).
 */

export const FEATURE_FLAGS_PATH = "_config/feature_flags"

export type AiProviderDefault = "agent" | "local" | "cloud"

export type FeatureFlags = {
  ai_provider_default: AiProviderDefault
  cloud_ai_enabled: boolean
  app_check_enforced: boolean
  mastery_graph_enabled: boolean
  sr_session_enabled: boolean
}

export type FeatureFlagKey = keyof FeatureFlags

/** Documented flag keys (for ops / ENGINEERING.md). */
export const FEATURE_FLAG_KEYS: FeatureFlagKey[] = [
  "ai_provider_default",
  "cloud_ai_enabled",
  "app_check_enforced",
  "mastery_graph_enabled",
  "sr_session_enabled",
]

/**
 * Safe product defaults when RTDB flags are missing.
 * AI/learning surfaces are enabled so the app is usable without an ops flag flip;
 * RTDB can still override any key.
 */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  ai_provider_default: "cloud",
  cloud_ai_enabled: true,
  app_check_enforced: false,
  mastery_graph_enabled: true,
  sr_session_enabled: true,
}

const VALID_PROVIDERS = new Set<AiProviderDefault>(["agent", "local", "cloud"])

/** Module-level cache updated by FeatureFlagsProvider (and tests). */
let cachedFlags: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS }

export function getFeatureFlags(): FeatureFlags {
  return cachedFlags
}

/** Synchronous read of a single flag from the module cache. */
export function getFlag<K extends FeatureFlagKey>(key: K): FeatureFlags[K] {
  return cachedFlags[key]
}

/** Test / provider helper — update module cache (always shallow-copies). */
export function setCachedFeatureFlags(flags: FeatureFlags): void {
  cachedFlags = { ...flags }
}

/** Reset to defaults (tests). */
export function resetFeatureFlagsCache(): void {
  cachedFlags = { ...DEFAULT_FEATURE_FLAGS }
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value
  if (value === 1 || value === "1") return true
  if (value === 0 || value === "0") return false
  if (typeof value === "string") {
    const lower = value.toLowerCase()
    if (lower === "true") return true
    if (lower === "false") return false
  }
  return fallback
}

function asProviderDefault(value: unknown, fallback: AiProviderDefault): AiProviderDefault {
  if (typeof value === "string" && VALID_PROVIDERS.has(value as AiProviderDefault)) {
    return value as AiProviderDefault
  }
  return fallback
}

/**
 * Merge raw RTDB payload with defaults. Unknown keys ignored; bad types coerced.
 */
export function parseFeatureFlags(raw: unknown): FeatureFlags {
  const base = { ...DEFAULT_FEATURE_FLAGS }
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return base
  }
  const o = raw as Record<string, unknown>
  return {
    ai_provider_default: asProviderDefault(o.ai_provider_default, base.ai_provider_default),
    cloud_ai_enabled: asBoolean(o.cloud_ai_enabled, base.cloud_ai_enabled),
    app_check_enforced: asBoolean(o.app_check_enforced, base.app_check_enforced),
    mastery_graph_enabled: asBoolean(o.mastery_graph_enabled, base.mastery_graph_enabled),
    sr_session_enabled: asBoolean(o.sr_session_enabled, base.sr_session_enabled),
  }
}
