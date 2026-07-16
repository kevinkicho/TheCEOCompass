import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { FirebaseApp } from "firebase/app"

const { initializeAppCheck, ReCaptchaV3Provider, getFlag } = vi.hoisted(() => {
  const initializeAppCheck = vi.fn()
  const ReCaptchaV3Provider = vi.fn(function MockProvider(this: unknown, key: string) {
    return { key }
  })
  const getFlag = vi.fn(() => false)
  return { initializeAppCheck, ReCaptchaV3Provider, getFlag }
})

vi.mock("firebase/app-check", () => ({
  initializeAppCheck,
  ReCaptchaV3Provider,
}))

vi.mock("@/lib/feature-flags", () => ({
  getFlag,
}))

import {
  getAppCheckSiteKey,
  isAppCheckConfigured,
  isAppCheckEnforced,
  initAppCheckIfConfigured,
  getAppCheckInstance,
  resetAppCheckForTests,
} from "../app-check"

describe("app-check scaffold", () => {
  const originalSiteKey = process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY
  const originalDebug = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

  beforeEach(() => {
    resetAppCheckForTests()
    initializeAppCheck.mockReset()
    ReCaptchaV3Provider.mockClear()
    delete process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY
    delete process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN
    getFlag.mockReturnValue(false)
    warn.mockClear()
  })

  afterEach(() => {
    if (originalSiteKey === undefined) delete process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY
    else process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY = originalSiteKey
    if (originalDebug === undefined) delete process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN
    else process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN = originalDebug
    delete (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown }).FIREBASE_APPCHECK_DEBUG_TOKEN
  })

  it("reports unconfigured when site key missing", () => {
    expect(getAppCheckSiteKey()).toBe("")
    expect(isAppCheckConfigured()).toBe(false)
  })

  it("reports configured when site key set", () => {
    process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY = "  site-key-abc  "
    expect(getAppCheckSiteKey()).toBe("site-key-abc")
    expect(isAppCheckConfigured()).toBe(true)
  })

  it("no-ops without site key and does not call initializeAppCheck", () => {
    const result = initAppCheckIfConfigured({ name: "test" } as FirebaseApp)
    expect(result).toBeNull()
    expect(initializeAppCheck).not.toHaveBeenCalled()
    expect(getAppCheckInstance()).toBeNull()
  })

  it("no-ops when app is null", () => {
    process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY = "site-key"
    expect(initAppCheckIfConfigured(null)).toBeNull()
    expect(initializeAppCheck).not.toHaveBeenCalled()
  })

  it("no-ops when app is undefined", () => {
    process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY = "site-key"
    expect(initAppCheckIfConfigured(undefined)).toBeNull()
    expect(initializeAppCheck).not.toHaveBeenCalled()
  })

  it("initializes App Check when site key and app present", () => {
    process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY = "site-key"
    const fakeApp = { name: "test" } as FirebaseApp
    const fakeCheck = { app: fakeApp }
    initializeAppCheck.mockReturnValue(fakeCheck)

    const result = initAppCheckIfConfigured(fakeApp)

    expect(ReCaptchaV3Provider).toHaveBeenCalledWith("site-key")
    expect(initializeAppCheck).toHaveBeenCalledWith(fakeApp, {
      provider: { key: "site-key" },
      isTokenAutoRefreshEnabled: true,
    })
    expect(result).toBe(fakeCheck)
    expect(getAppCheckInstance()).toBe(fakeCheck)
  })

  it("is idempotent (second call does not re-init)", () => {
    process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY = "site-key"
    const fakeApp = { name: "test" } as FirebaseApp
    initializeAppCheck.mockReturnValue({ app: fakeApp })

    initAppCheckIfConfigured(fakeApp)
    initAppCheckIfConfigured(fakeApp)

    expect(initializeAppCheck).toHaveBeenCalledTimes(1)
  })

  it("swallows initializeAppCheck errors", () => {
    process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY = "site-key"
    initializeAppCheck.mockImplementation(() => {
      throw new Error("recaptcha boom")
    })

    expect(initAppCheckIfConfigured({ name: "test" } as FirebaseApp)).toBeNull()
    expect(warn).toHaveBeenCalled()
  })

  it("does not re-call initializeAppCheck after a failed init", () => {
    process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY = "site-key"
    initializeAppCheck.mockImplementation(() => {
      throw new Error("recaptcha boom")
    })

    const fakeApp = { name: "test" } as FirebaseApp
    expect(initAppCheckIfConfigured(fakeApp)).toBeNull()
    expect(initAppCheckIfConfigured(fakeApp)).toBeNull()
    expect(initializeAppCheck).toHaveBeenCalledTimes(1)
  })

  it("sets debug token before init when env is true", () => {
    process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY = "site-key"
    process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN = "true"
    initializeAppCheck.mockReturnValue({})

    initAppCheckIfConfigured({ name: "test" } as FirebaseApp)

    expect(
      (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown }).FIREBASE_APPCHECK_DEBUG_TOKEN,
    ).toBe(true)
  })

  it("sets debug token when env is a UUID", () => {
    process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY = "site-key"
    const uuid = "550e8400-e29b-41d4-a716-446655440000"
    process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN = uuid
    initializeAppCheck.mockReturnValue({})

    initAppCheckIfConfigured({ name: "test" } as FirebaseApp)

    expect(
      (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown }).FIREBASE_APPCHECK_DEBUG_TOKEN,
    ).toBe(uuid)
  })

  it("ignores invalid debug token values like false", () => {
    process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY = "site-key"
    process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN = "false"
    initializeAppCheck.mockReturnValue({})

    initAppCheckIfConfigured({ name: "test" } as FirebaseApp)

    expect(
      (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown }).FIREBASE_APPCHECK_DEBUG_TOKEN,
    ).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Ignoring invalid"))
  })

  it("reflects app_check_enforced from feature flags", () => {
    getFlag.mockReturnValue(true)
    expect(isAppCheckEnforced()).toBe(true)
    getFlag.mockReturnValue(false)
    expect(isAppCheckEnforced()).toBe(false)
  })

  it("warns when enforced but site key missing", () => {
    getFlag.mockReturnValue(true)
    initAppCheckIfConfigured({ name: "test" } as FirebaseApp)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("app_check_enforced"))
  })
})
