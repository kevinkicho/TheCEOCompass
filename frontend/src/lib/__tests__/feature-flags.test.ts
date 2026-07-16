import { describe, it, expect, beforeEach } from "vitest"
import {
  DEFAULT_FEATURE_FLAGS,
  FEATURE_FLAG_KEYS,
  FEATURE_FLAGS_PATH,
  getFlag,
  getFeatureFlags,
  parseFeatureFlags,
  resetFeatureFlagsCache,
  setCachedFeatureFlags,
  type FeatureFlags,
} from "../feature-flags"

describe("feature-flags defaults", () => {
  it("documents all expected flag keys", () => {
    expect(FEATURE_FLAG_KEYS).toEqual([
      "ai_provider_default",
      "cloud_ai_enabled",
      "app_check_enforced",
      "mastery_graph_enabled",
      "sr_session_enabled",
    ])
  })

  it("uses AI-ready defaults (cloud + learning features on until RTDB overrides)", () => {
    expect(DEFAULT_FEATURE_FLAGS).toEqual({
      ai_provider_default: "cloud",
      cloud_ai_enabled: true,
      app_check_enforced: false,
      mastery_graph_enabled: true,
      sr_session_enabled: true,
    })
  })

  it("subscribes at _config/feature_flags", () => {
    expect(FEATURE_FLAGS_PATH).toBe("_config/feature_flags")
  })
})

describe("parseFeatureFlags", () => {
  it("returns defaults for null / missing", () => {
    expect(parseFeatureFlags(null)).toEqual(DEFAULT_FEATURE_FLAGS)
    expect(parseFeatureFlags(undefined)).toEqual(DEFAULT_FEATURE_FLAGS)
    expect(parseFeatureFlags({})).toEqual(DEFAULT_FEATURE_FLAGS)
  })

  it("returns defaults for non-object raw", () => {
    expect(parseFeatureFlags("bad")).toEqual(DEFAULT_FEATURE_FLAGS)
    expect(parseFeatureFlags(42)).toEqual(DEFAULT_FEATURE_FLAGS)
    expect(parseFeatureFlags([])).toEqual(DEFAULT_FEATURE_FLAGS)
  })

  it("merges partial RTDB payload over defaults", () => {
    expect(parseFeatureFlags({ cloud_ai_enabled: true })).toEqual({
      ...DEFAULT_FEATURE_FLAGS,
      cloud_ai_enabled: true,
    })
  })

  it("accepts valid ai_provider_default values", () => {
    expect(parseFeatureFlags({ ai_provider_default: "cloud" }).ai_provider_default).toBe("cloud")
    expect(parseFeatureFlags({ ai_provider_default: "local" }).ai_provider_default).toBe("local")
    expect(parseFeatureFlags({ ai_provider_default: "agent" }).ai_provider_default).toBe("agent")
  })

  it("rejects invalid ai_provider_default (falls back to default)", () => {
    expect(parseFeatureFlags({ ai_provider_default: "openai" }).ai_provider_default).toBe(
      DEFAULT_FEATURE_FLAGS.ai_provider_default,
    )
    expect(parseFeatureFlags({ ai_provider_default: 1 }).ai_provider_default).toBe(
      DEFAULT_FEATURE_FLAGS.ai_provider_default,
    )
  })

  it("coerces boolean-ish values (case-insensitive strings)", () => {
    expect(parseFeatureFlags({ cloud_ai_enabled: "true" }).cloud_ai_enabled).toBe(true)
    expect(parseFeatureFlags({ cloud_ai_enabled: "TRUE" }).cloud_ai_enabled).toBe(true)
    expect(parseFeatureFlags({ app_check_enforced: 1 }).app_check_enforced).toBe(true)
    expect(parseFeatureFlags({ mastery_graph_enabled: "false" }).mastery_graph_enabled).toBe(false)
    expect(parseFeatureFlags({ mastery_graph_enabled: "False" }).mastery_graph_enabled).toBe(false)
    expect(parseFeatureFlags({ sr_session_enabled: 0 }).sr_session_enabled).toBe(false)
  })

  it("setCachedFeatureFlags stores a shallow copy (does not alias DEFAULT)", () => {
    setCachedFeatureFlags(DEFAULT_FEATURE_FLAGS)
    const cached = getFeatureFlags()
    expect(cached).toEqual(DEFAULT_FEATURE_FLAGS)
    expect(cached).not.toBe(DEFAULT_FEATURE_FLAGS)
    cached.cloud_ai_enabled = true
    expect(DEFAULT_FEATURE_FLAGS.cloud_ai_enabled).toBe(true)
    resetFeatureFlagsCache()
  })

  it("ignores unknown keys", () => {
    const parsed = parseFeatureFlags({ cloud_ai_enabled: true, experimental_foo: true })
    expect(parsed.cloud_ai_enabled).toBe(true)
    expect((parsed as Record<string, unknown>).experimental_foo).toBeUndefined()
  })
})

describe("getFlag / cache", () => {
  beforeEach(() => {
    resetFeatureFlagsCache()
  })

  it("returns default via getFlag before any RTDB update", () => {
    expect(getFlag("cloud_ai_enabled")).toBe(DEFAULT_FEATURE_FLAGS.cloud_ai_enabled)
    expect(getFlag("ai_provider_default")).toBe(DEFAULT_FEATURE_FLAGS.ai_provider_default)
  })

  it("reflects setCachedFeatureFlags", () => {
    const next: FeatureFlags = {
      ...DEFAULT_FEATURE_FLAGS,
      cloud_ai_enabled: true,
      mastery_graph_enabled: true,
    }
    setCachedFeatureFlags(next)
    expect(getFlag("cloud_ai_enabled")).toBe(true)
    expect(getFlag("mastery_graph_enabled")).toBe(true)
    expect(getFeatureFlags()).toEqual(next)
  })
})
