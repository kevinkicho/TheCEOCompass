import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

/**
 * Structural validation of intermediate RTDB rules (P0-T0 cases documented).
 * Full emulator tests require @firebase/rules-unit-testing + firebase emulators.
 * These assertions guard against accidental open writes and missing roots.
 */
const rulesPath = join(__dirname, "../../../../database.rules.json")
const rules = JSON.parse(readFileSync(rulesPath, "utf8")).rules

describe("database.rules.json intermediate cutover", () => {
  it("denies by default at root", () => {
    expect(rules[".read"]).toBe(false)
    expect(rules[".write"]).toBe(false)
  })

  it("allows public read of frameworks seed", () => {
    expect(rules.frameworks[".read"]).toBe(true)
  })

  it("denies client writes on agent enrichment paths", () => {
    expect(rules.framework.$slug.$concept.$category.$entryId[".write"]).toBe(false)
  })

  it("uses create-only requests (no client status update branch)", () => {
    const w = rules.requests.$requestId[".write"] as string
    expect(w).toContain("!data.exists()")
    expect(w).toContain("pending")
    // Disallow update branch: data.exists() without leading ! (create-only uses !data.exists())
    expect(w).not.toMatch(/(?<!!)data\.exists\(\)/)
  })

  it("requires auth for request create", () => {
    expect(rules.requests.$requestId[".write"]).toContain("auth != null")
  })

  it("keeps real legacy device roots read-only for migration", () => {
    for (const root of ["journal", "reviews", "progress", "viewed", "quizResults", "scenarioHistory", "favoriteQuotes"]) {
      expect(rules[root]).toBeDefined()
      // device trees must not be world-writable
      const json = JSON.stringify(rules[root])
      expect(json).not.toContain("|| true")
    }
  })

  it("scopes users tree to auth.uid", () => {
    expect(rules.users.$uid[".read"]).toContain("auth.uid === $uid")
    expect(rules.users.$uid[".write"]).toContain("auth.uid === $uid")
  })

  it("conceptChats and scenario-evaluations are create-only", () => {
    expect(rules.conceptChats.$chatId[".write"]).toContain("!data.exists()")
    expect(rules["scenario-evaluations"].$evalId[".write"]).toContain("!data.exists()")
  })

  it("exposes agent heartbeat as public read, client write false", () => {
    expect(rules._meta.agent_heartbeat[".read"]).toBe(true)
    expect(rules._meta.agent_heartbeat[".write"]).toBe(false)
  })

  it("does not use fictional legacy_devices root", () => {
    expect(rules.legacy_devices).toBeUndefined()
  })
})
