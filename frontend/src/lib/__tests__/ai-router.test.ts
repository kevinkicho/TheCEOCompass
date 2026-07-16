import { describe, it, expect } from "vitest"
import { resolveAiProvider } from "../ai/router"
import {
  isAiProviderId,
  normalizeAiProviderId,
  AI_PROVIDER_IDS,
  CLOUD_PROVIDER_NOT_CONFIGURED,
  type AiProviderId,
} from "../ai/provider"

describe("isAiProviderId / normalizeAiProviderId", () => {
  it("accepts agent, local, cloud", () => {
    for (const id of AI_PROVIDER_IDS) {
      expect(isAiProviderId(id)).toBe(true)
      expect(normalizeAiProviderId(id)).toBe(id)
    }
  })

  it("accepts case-insensitive values", () => {
    expect(isAiProviderId("Cloud")).toBe(true)
    expect(isAiProviderId("LOCAL")).toBe(true)
    expect(isAiProviderId(" Agent ")).toBe(true)
    expect(normalizeAiProviderId("Cloud")).toBe("cloud")
    expect(normalizeAiProviderId("LOCAL")).toBe("local")
  })

  it("rejects invalid values", () => {
    expect(isAiProviderId("local-agent")).toBe(false)
    expect(isAiProviderId("")).toBe(false)
    expect(isAiProviderId(null)).toBe(false)
    expect(isAiProviderId(undefined)).toBe(false)
    expect(isAiProviderId(1)).toBe(false)
    expect(normalizeAiProviderId("bogus")).toBeNull()
  })
})

describe("resolveAiProvider selection matrix", () => {
  const cases: Array<{
    name: string
    input: Parameters<typeof resolveAiProvider>[0]
    expected: AiProviderId
  }> = [
    // Defaults
    { name: "empty input → agent", input: {}, expected: "agent" },
    { name: "all undefined → agent", input: { localAiMode: undefined, aiProvider: undefined, envProvider: undefined }, expected: "agent" },

    // localAiMode wins over everything
    { name: "localAiMode true → local", input: { localAiMode: true }, expected: "local" },
    { name: "localAiMode overrides settings agent", input: { localAiMode: true, aiProvider: "agent" }, expected: "local" },
    { name: "localAiMode overrides settings cloud", input: { localAiMode: true, aiProvider: "cloud" }, expected: "local" },
    { name: "localAiMode overrides env cloud", input: { localAiMode: true, envProvider: "cloud" }, expected: "local" },
    { name: "localAiMode overrides env agent", input: { localAiMode: true, envProvider: "agent" }, expected: "local" },
    { name: "localAiMode overrides both settings and env", input: { localAiMode: true, aiProvider: "cloud", envProvider: "agent" }, expected: "local" },
    { name: "localAiMode false does not force local", input: { localAiMode: false }, expected: "agent" },

    // settings.aiProvider (when local off)
    { name: "settings agent → agent", input: { localAiMode: false, aiProvider: "agent" }, expected: "agent" },
    { name: "settings local → local", input: { localAiMode: false, aiProvider: "local" }, expected: "local" },
    { name: "settings cloud → cloud", input: { localAiMode: false, aiProvider: "cloud" }, expected: "cloud" },
    { name: "settings wins over env", input: { localAiMode: false, aiProvider: "agent", envProvider: "cloud" }, expected: "agent" },
    { name: "settings cloud wins over env agent", input: { localAiMode: false, aiProvider: "cloud", envProvider: "agent" }, expected: "cloud" },

    // env NEXT_PUBLIC_AI_PROVIDER (when local off and no settings)
    { name: "env agent → agent", input: { envProvider: "agent" }, expected: "agent" },
    { name: "env local → local", input: { envProvider: "local" }, expected: "local" },
    { name: "env cloud → cloud", input: { envProvider: "cloud" }, expected: "cloud" },
    { name: "env cloud with localAiMode false → cloud", input: { localAiMode: false, envProvider: "cloud" }, expected: "cloud" },
    { name: "env Cloud (case) → cloud", input: { envProvider: "Cloud" }, expected: "cloud" },
    { name: "env LOCAL (case) → local", input: { envProvider: "LOCAL" }, expected: "local" },
    { name: "settings Cloud (case) → cloud", input: { localAiMode: false, aiProvider: "Cloud" }, expected: "cloud" },

    // flagDefault (ai_provider_default) after env
    { name: "flagDefault cloud when no settings/env → cloud", input: { flagDefault: "cloud" }, expected: "cloud" },
    { name: "env wins over flagDefault", input: { envProvider: "agent", flagDefault: "cloud" }, expected: "agent" },
    { name: "settings wins over flagDefault", input: { aiProvider: "local", flagDefault: "cloud" }, expected: "local" },
    { name: "flagDefault ignored when invalid", input: { flagDefault: "openai" }, expected: "agent" },

    // cloudAiEnabled kill-switch
    { name: "cloud demoted when cloudAiEnabled false (settings)", input: { aiProvider: "cloud", cloudAiEnabled: false }, expected: "agent" },
    { name: "cloud demoted when cloudAiEnabled false (env)", input: { envProvider: "cloud", cloudAiEnabled: false }, expected: "agent" },
    { name: "cloud demoted when cloudAiEnabled false (flag)", input: { flagDefault: "cloud", cloudAiEnabled: false }, expected: "agent" },
    { name: "cloud allowed when cloudAiEnabled true", input: { aiProvider: "cloud", cloudAiEnabled: true }, expected: "cloud" },
    { name: "cloud allowed when cloudAiEnabled omitted", input: { aiProvider: "cloud" }, expected: "cloud" },
    { name: "agent unaffected by cloudAiEnabled false", input: { aiProvider: "agent", cloudAiEnabled: false }, expected: "agent" },
    { name: "local unaffected by cloudAiEnabled false", input: { localAiMode: true, cloudAiEnabled: false }, expected: "local" },

    // Invalid preferences fall through
    { name: "invalid settings ignored → agent", input: { aiProvider: "not-a-provider" }, expected: "agent" },
    { name: "invalid settings + valid env → env", input: { aiProvider: "bogus", envProvider: "cloud" }, expected: "cloud" },
    { name: "invalid env ignored → agent", input: { envProvider: "openai" }, expected: "agent" },
    { name: "empty env string → agent", input: { envProvider: "" }, expected: "agent" },
    { name: "null settings and env → agent", input: { aiProvider: null, envProvider: null }, expected: "agent" },
  ]

  it.each(cases)("$name", ({ input, expected }) => {
    expect(resolveAiProvider(input)).toBe(expected)
  })
})

describe("CLOUD_PROVIDER_NOT_CONFIGURED", () => {
  it("is a non-empty guidance message", () => {
    expect(CLOUD_PROVIDER_NOT_CONFIGURED.length).toBeGreaterThan(20)
    expect(CLOUD_PROVIDER_NOT_CONFIGURED.toLowerCase()).toContain("cloud")
  })
})
