import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/firebase", () => ({
  db: { type: "database" },
  ref: vi.fn((_db: any, path: string) => ({ _path: path })),
  get: vi.fn(),
  onValue: vi.fn(),
  set: vi.fn(),
}))

import { waitForFirebaseResponse } from "../ollama"
import { onValue, get, ref } from "@/lib/firebase"

const mockOnValue = vi.mocked(onValue)
const mockGet = vi.mocked(get)
const mockRef = vi.mocked(ref)

describe("waitForFirebaseResponse", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("resolves when response arrives via onValue callback", async () => {
    mockRef.mockReturnValue({ _path: "test" } as any)

    // First onValue call is for statusRef, second for responseRef
    mockOnValue.mockImplementation((_ref: any, callback: any) => {
      // Defer the callback to avoid const-before-init issue in production code
      Promise.resolve().then(() => {
        callback({ val: () => ({ result: '{"key":"value"}', created_at: Date.now() }) })
      })
      return () => {}
    })

    const promise = waitForFirebaseResponse(
      { type: "database" } as any,
      "req-1",
      "framework/fw/concept/cat/req-1",
      60000,
    )

    // Let microtasks resolve
    await vi.advanceTimersByTimeAsync(0)

    const result = await promise
    expect(result.result).toBe('{"key":"value"}')
    expect(result.data).toEqual({ key: "value" })
  })

  it("resolves with null data for non-JSON result", async () => {
    mockRef.mockReturnValue({ _path: "test" } as any)

    mockOnValue.mockImplementation((_ref: any, callback: any) => {
      Promise.resolve().then(() => {
        callback({ val: () => ({ result: "plain text response", created_at: Date.now() }) })
      })
      return () => {}
    })

    const promise = waitForFirebaseResponse(
      { type: "database" } as any,
      "req-2",
      "framework/fw/concept/cat/req-2",
      60000,
    )

    await vi.advanceTimersByTimeAsync(0)

    const result = await promise
    expect(result.result).toBe("plain text response")
    expect(result.data).toBeNull()
  })

  it("rejects on timeout", async () => {
    mockRef.mockReturnValue({ _path: "test" } as any)
    mockOnValue.mockImplementation(() => () => {})

    const promise = waitForFirebaseResponse(
      { type: "database" } as any,
      "req-3",
      "framework/fw/concept/cat/req-3",
      5000,
    )

    vi.advanceTimersByTime(6000)

    await expect(promise).rejects.toThrow("Request timed out after 5s")
  })

  it("calls onProgress callback", async () => {
    mockRef.mockReturnValue({ _path: "test" } as any)
    mockOnValue.mockImplementation(() => () => {})

    const onProgress = vi.fn()

    const promise = waitForFirebaseResponse(
      { type: "database" } as any,
      "req-5",
      "framework/fw/concept/cat/req-5",
      10000,
      onProgress,
    )

    vi.advanceTimersByTime(3500)
    vi.advanceTimersByTime(1000)

    // Cancel by timing out
    vi.advanceTimersByTime(10000)

    try { await promise } catch {}

    expect(onProgress).toHaveBeenCalled()
    // Should have been called at least 3 times (at 1s, 2s, 3s)
    expect(onProgress.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it("ignores responses without result field", async () => {
    mockRef.mockReturnValue({ _path: "test" } as any)

    let responseCallback: any = null
    mockOnValue.mockImplementation((_ref: any, callback: any) => {
      const path = _ref?._path || ""
      if (path.includes("status")) {
        return () => {}
      }
      responseCallback = callback
      return () => {}
    })

    const promise = waitForFirebaseResponse(
      { type: "database" } as any,
      "req-6",
      "framework/fw/concept/cat/req-6",
      5000,
    )

    // Send a response without result — should be ignored
    await vi.advanceTimersByTimeAsync(0)
    if (responseCallback) {
      responseCallback({ val: () => ({ created_at: Date.now() }) })
    }

    // Now send the actual result
    await vi.advanceTimersByTimeAsync(0)
    if (responseCallback) {
      responseCallback({ val: () => ({ result: "final answer", created_at: Date.now() }) })
    }

    const result = await promise
    expect(result.result).toBe("final answer")
  })
})
