import { describe, it, expect, beforeEach } from "vitest"
import {
  normalizeResumePath,
  stashAuthResumePath,
  consumeAuthResumePath,
  peekAuthResumePath,
} from "../auth-resume"

describe("auth-resume", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it("normalizes in-app paths only", () => {
    expect(normalizeResumePath("/journal")).toBe("/journal")
    expect(normalizeResumePath("/scenarios/x?tab=1#top")).toBe("/scenarios/x?tab=1#top")
    expect(normalizeResumePath("https://evil.com")).toBeNull()
    expect(normalizeResumePath("//evil.com")).toBeNull()
    expect(normalizeResumePath("javascript:alert(1)")).toBeNull()
    expect(normalizeResumePath("")).toBeNull()
  })

  it("stashes and consumes path once", () => {
    stashAuthResumePath("/review")
    expect(peekAuthResumePath()).toBe("/review")
    expect(consumeAuthResumePath()).toBe("/review")
    expect(consumeAuthResumePath()).toBeNull()
    expect(peekAuthResumePath()).toBeNull()
  })

  it("rejects expired stash", () => {
    stashAuthResumePath("/profile")
    // Force old timestamp
    sessionStorage.setItem("ceo_compass_auth_resume_at", String(Date.now() - 31 * 60 * 1000))
    expect(consumeAuthResumePath()).toBeNull()
  })
})
