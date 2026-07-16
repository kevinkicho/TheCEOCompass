import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const { mockSet, mockGet, mockOnValue, mockRef, mockAuth } = vi.hoisted(() => ({
  mockSet: vi.fn(async (_ref: unknown, _data: Record<string, unknown>) => {}),
  mockGet: vi.fn(),
  mockOnValue: vi.fn(),
  mockRef: vi.fn((_db: any, path: string) => ({ _path: path })),
  mockAuth: { currentUser: { uid: "test-uid" } as { uid: string } | null },
}))

vi.mock("@/lib/firebase", () => ({
  db: { type: "database" },
  auth: mockAuth,
  ref: mockRef,
  set: mockSet,
  get: mockGet,
  onValue: mockOnValue,
}))

import {
  getActiveAiProvider,
  callOllamaViaFirebase,
  callOllamaDirect,
  pushAiRequest,
  runWithAiProvider,
} from "../ai"
import {
  resetFeatureFlagsCache,
  setCachedFeatureFlags,
  DEFAULT_FEATURE_FLAGS,
} from "../feature-flags"

describe("getActiveAiProvider", () => {
  const originalEnv = process.env.NEXT_PUBLIC_AI_PROVIDER

  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
    delete process.env.NEXT_PUBLIC_AI_PROVIDER
    resetFeatureFlagsCache()
  })

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_AI_PROVIDER
    else process.env.NEXT_PUBLIC_AI_PROVIDER = originalEnv
    resetFeatureFlagsCache()
    vi.unstubAllGlobals()
  })

  it("defaults to agent when settings empty and no env", () => {
    expect(getActiveAiProvider()).toBe("agent")
  })

  it("reads localAiMode from settings", () => {
    ;(localStorage.getItem as any).mockReturnValue(JSON.stringify({ localAiMode: true }))
    expect(getActiveAiProvider()).toBe("local")
  })

  it("reads aiProvider cloud when flag enabled", () => {
    setCachedFeatureFlags({ ...DEFAULT_FEATURE_FLAGS, cloud_ai_enabled: true })
    ;(localStorage.getItem as any).mockReturnValue(JSON.stringify({ aiProvider: "cloud" }))
    expect(getActiveAiProvider()).toBe("cloud")
  })

  it("demotes settings cloud to agent when flag disabled", () => {
    setCachedFeatureFlags({ ...DEFAULT_FEATURE_FLAGS, cloud_ai_enabled: false })
    ;(localStorage.getItem as any).mockReturnValue(JSON.stringify({ aiProvider: "cloud" }))
    expect(getActiveAiProvider()).toBe("agent")
  })

  it("reads NEXT_PUBLIC_AI_PROVIDER env when cloud enabled", () => {
    setCachedFeatureFlags({ ...DEFAULT_FEATURE_FLAGS, cloud_ai_enabled: true })
    process.env.NEXT_PUBLIC_AI_PROVIDER = "cloud"
    expect(getActiveAiProvider()).toBe("cloud")
  })

  it("uses remote ai_provider_default when no settings/env and cloud enabled", () => {
    setCachedFeatureFlags({
      ...DEFAULT_FEATURE_FLAGS,
      cloud_ai_enabled: true,
      ai_provider_default: "cloud",
    })
    expect(getActiveAiProvider()).toBe("cloud")
  })

  it("localAiMode wins over env cloud", () => {
    setCachedFeatureFlags({ ...DEFAULT_FEATURE_FLAGS, cloud_ai_enabled: true })
    process.env.NEXT_PUBLIC_AI_PROVIDER = "cloud"
    ;(localStorage.getItem as any).mockReturnValue(JSON.stringify({ localAiMode: true }))
    expect(getActiveAiProvider()).toBe("local")
  })
})

describe("callOllamaViaFirebase provider branches", () => {
  const originalEnv = process.env.NEXT_PUBLIC_AI_PROVIDER
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.NEXT_PUBLIC_AI_PROVIDER
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("crypto", { randomUUID: () => "req-fixed-id" })
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
    // cache miss by default
    mockGet.mockResolvedValue({ exists: () => false, val: () => null })
    resetFeatureFlagsCache()
  })

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_AI_PROVIDER
    else process.env.NEXT_PUBLIC_AI_PROVIDER = originalEnv
    resetFeatureFlagsCache()
    vi.unstubAllGlobals()
  })

  it("cloud branch tags provider: cloud on the request payload", async () => {
    setCachedFeatureFlags({ ...DEFAULT_FEATURE_FLAGS, cloud_ai_enabled: true })
    process.env.NEXT_PUBLIC_AI_PROVIDER = "cloud"

    mockOnValue.mockImplementation((refObj: any, cb: any) => {
      if (refObj?._path?.includes("framework/")) {
        Promise.resolve().then(() => {
          cb({ val: () => ({ result: '{"x":1}' }) })
        })
      }
      return () => {}
    })

    const out = await callOllamaViaFirebase(
      "m1",
      "user prompt",
      0.3,
      "fw",
      "concept",
      "explain_further",
      "explain_further",
      true,
    )
    expect(out.result).toBe('{"x":1}')
    expect(mockSet).toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    const written = mockSet.mock.calls[0][1]
    expect(written.provider).toBe("cloud")
    expect(written.uid).toBe("test-uid")
    expect(written.payload).toBeDefined()
    expect(written.framework_slug).toBe("fw")
    expect(written.concept_slug).toBe("concept")
  })

  it("localAiMode calls Ollama direct and does not pushAiRequest", async () => {
    ;(localStorage.getItem as any).mockReturnValue(
      JSON.stringify({ localAiMode: true, ollamaUrl: "http://localhost:11434", ollamaModel: "test-model" }),
    )
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ response: '{"ok":true}' }),
    })

    const out = await callOllamaViaFirebase(
      "",
      "user prompt",
      0.4,
      "fw",
      "concept",
      "explain_further",
      "explain_further",
      true,
    )
    expect(out.cached).toBe(false)
    expect(out.result).toContain("ok")
    expect(fetchMock).toHaveBeenCalled()
    expect(mockSet).not.toHaveBeenCalled()
  })

  it("agent branch tags provider: agent on the request payload", async () => {
    // Deliver response immediately via onValue on response path
    mockOnValue.mockImplementation((refObj: any, cb: any) => {
      if (refObj?._path?.includes("framework/")) {
        Promise.resolve().then(() => {
          cb({ val: () => ({ result: '{"x":1}' }) })
        })
      }
      return () => {}
    })

    const promise = callOllamaViaFirebase(
      "m1",
      "user prompt",
      0.3,
      "fw",
      "concept",
      "explain_further",
      "explain_further",
      true,
    )
    const out = await promise
    expect(out.result).toBe('{"x":1}')
    expect(mockSet).toHaveBeenCalled()
    const written = mockSet.mock.calls[0][1]
    expect(written.provider).toBe("agent")
    expect(written.uid).toBe("test-uid")
    expect(written.payload).toBeDefined()
  })
})

describe("runWithAiProvider provider field", () => {
  const originalEnv = process.env.NEXT_PUBLIC_AI_PROVIDER

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.NEXT_PUBLIC_AI_PROVIDER
    vi.stubGlobal("crypto", { randomUUID: () => "run-req-id" })
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
    resetFeatureFlagsCache()
  })

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_AI_PROVIDER
    else process.env.NEXT_PUBLIC_AI_PROVIDER = originalEnv
    resetFeatureFlagsCache()
    vi.unstubAllGlobals()
  })

  it("includes provider: cloud on RTDB push when cloud mode", async () => {
    setCachedFeatureFlags({ ...DEFAULT_FEATURE_FLAGS, cloud_ai_enabled: true })
    process.env.NEXT_PUBLIC_AI_PROVIDER = "cloud"

    mockOnValue.mockImplementation((refObj: any, cb: any) => {
      if (refObj?._path?.includes("quotes/")) {
        Promise.resolve().then(() => {
          cb({ val: () => ({ result: '{"person":"X","role":"Y","text":"Z"}' }) })
        })
      }
      return () => {}
    })

    const out = await runWithAiProvider({
      prompt: "quote please",
      temperature: 0.7,
      systemType: "explain",
      agentRequest: { type: "quote", category: "strategy" },
      responsePath: (id) => `quotes/generated/${id}`,
    })

    expect(out.data).toMatchObject({ person: "X" })
    expect(mockSet).toHaveBeenCalled()
    const written = mockSet.mock.calls[0][1]
    expect(written.provider).toBe("cloud")
    expect(written.type).toBe("quote")
    expect(written.uid).toBe("test-uid")
  })
})

describe("pushAiRequest auth guard", () => {
  it("requires signed-in uid", async () => {
    const prev = mockAuth.currentUser
    mockAuth.currentUser = null
    await expect(pushAiRequest({} as any, "r1", { type: "x", payload: {} })).rejects.toThrow(/Not signed in/)
    mockAuth.currentUser = prev
  })
})

describe("callOllamaDirect", () => {
  it("posts to configured ollama URL", async () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() =>
        JSON.stringify({ ollamaUrl: "http://ollama.test:11434", ollamaModel: "m" }),
      ),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: "  hi  " }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await callOllamaDirect("p", 0.2, "explain_further")
    expect(result).toBe("hi")
    expect(fetchMock).toHaveBeenCalledWith(
      "http://ollama.test:11434/api/generate",
      expect.objectContaining({ method: "POST" }),
    )
    vi.unstubAllGlobals()
  })
})
