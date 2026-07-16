import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const { mockSet, mockGet, mockOnValue, mockRef, mockAuth } = vi.hoisted(() => ({
  mockSet: vi.fn(async () => {}),
  mockGet: vi.fn(),
  mockOnValue: vi.fn(),
  mockRef: vi.fn((_db: unknown, path: string) => ({ _path: path })),
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
  AI_RATE_LIMIT_ERROR_MESSAGE,
  isRateLimitError,
  resolveAiRequestError,
  waitForFirebaseResponse,
} from "../ai/transport"

describe("AI rate limit error message", () => {
  it("documents the 20 / 10 minute cloud limit clearly", () => {
    expect(AI_RATE_LIMIT_ERROR_MESSAGE).toMatch(/20/)
    expect(AI_RATE_LIMIT_ERROR_MESSAGE).toMatch(/10 minutes/i)
    expect(AI_RATE_LIMIT_ERROR_MESSAGE).toMatch(/rate limit exceeded/i)
  })

  it("isRateLimitError matches server message", () => {
    expect(isRateLimitError(AI_RATE_LIMIT_ERROR_MESSAGE)).toBe(true)
    expect(isRateLimitError("AI rate limit exceeded: try later")).toBe(true)
    expect(isRateLimitError("Request timed out")).toBe(false)
    expect(isRateLimitError(null)).toBe(false)
    expect(isRateLimitError("")).toBe(false)
  })

  it("resolveAiRequestError prefers response path then request.error", () => {
    expect(
      resolveAiRequestError(
        { error: AI_RATE_LIMIT_ERROR_MESSAGE },
        { error: "other", status: "error" },
      ),
    ).toBe(AI_RATE_LIMIT_ERROR_MESSAGE)

    expect(
      resolveAiRequestError(null, { error: AI_RATE_LIMIT_ERROR_MESSAGE }),
    ).toBe(AI_RATE_LIMIT_ERROR_MESSAGE)

    expect(resolveAiRequestError(null, null)).toBe("Request failed")
    expect(resolveAiRequestError({}, { status: "error" })).toBe("Request failed")
  })
})

describe("waitForFirebaseResponse surfaces rate limit errors", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("rejects with request.error when response path has no error yet", async () => {
    mockGet.mockImplementation(async (refObj: { _path?: string }) => {
      const path = refObj?._path || ""
      if (path.startsWith("requests/") && !path.endsWith("/status")) {
        return {
          val: () => ({
            status: "error",
            error: AI_RATE_LIMIT_ERROR_MESSAGE,
          }),
        }
      }
      // response path empty / not written
      return { val: () => null }
    })

    mockOnValue.mockImplementation((refObj: { _path?: string }, cb: (snap: { val: () => unknown }) => void) => {
      if (refObj?._path?.endsWith("/status")) {
        queueMicrotask(() => cb({ val: () => "error" }))
      }
      return () => {}
    })

    const promise = waitForFirebaseResponse(
      {} as any,
      "req-rate",
      "conceptChats/req-rate",
      5000,
    )

    await expect(promise).rejects.toThrow(AI_RATE_LIMIT_ERROR_MESSAGE)
    try {
      await promise
    } catch (err) {
      expect(isRateLimitError(err instanceof Error ? err.message : String(err))).toBe(true)
    }
  })

  it("rejects with response-path error when present", async () => {
    mockGet.mockImplementation(async (refObj: { _path?: string }) => {
      const path = refObj?._path || ""
      if (path.startsWith("conceptChats/")) {
        return {
          val: () => ({ error: AI_RATE_LIMIT_ERROR_MESSAGE, created_at: 1 }),
        }
      }
      return { val: () => ({ status: "error" }) }
    })

    mockOnValue.mockImplementation((refObj: { _path?: string }, cb: (snap: { val: () => unknown }) => void) => {
      if (refObj?._path?.endsWith("/status")) {
        queueMicrotask(() => cb({ val: () => "error" }))
      }
      return () => {}
    })

    await expect(
      waitForFirebaseResponse({} as any, "req-2", "conceptChats/req-2", 5000),
    ).rejects.toThrow(/rate limit exceeded/i)
  })
})
