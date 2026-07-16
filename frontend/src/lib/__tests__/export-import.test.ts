import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockRef, mockGet, mockSet, mockRemove } = vi.hoisted(() => {
  const mockRef = vi.fn((_db: unknown, path: string) => ({ key: path }))
  const mockGet = vi.fn()
  const mockSet = vi.fn(() => Promise.resolve())
  const mockRemove = vi.fn(() => Promise.resolve())
  return { mockRef, mockGet, mockSet, mockRemove }
})

vi.mock("@/lib/firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "user-1", isAnonymous: true } },
  ref: (...args: unknown[]) => (mockRef as Function)(...args),
  get: (...args: unknown[]) => (mockGet as Function)(...args),
  set: (...args: unknown[]) => (mockSet as Function)(...args),
  remove: (...args: unknown[]) => (mockRemove as Function)(...args),
}))

import { exportUserData, importUserData } from "../user-data/export-import"

describe("export-import", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockResolvedValue({ exists: () => false, val: () => null })
  })

  it("exportUserData returns schema_version 1 shape", async () => {
    const data = await exportUserData()
    expect(data.schema_version).toBe(1)
    expect(data).toHaveProperty("exported_at")
    expect(Array.isArray(data.journal)).toBe(true)
    expect(Array.isArray(data.reviews)).toBe(true)
    expect(data.progress).toHaveProperty("completed_ids")
    expect(Array.isArray(data.favoriteQuotes)).toBe(true)
  })

  it("importUserData rejects invalid schema", async () => {
    await expect(importUserData({ schema_version: 99 }, "merge")).rejects.toThrow(/Unsupported schema/)
  })

  it("importUserData merge writes journal entries under users/{uid}", async () => {
    await importUserData(
      {
        schema_version: 1,
        exported_at: new Date().toISOString(),
        journal: [
          {
            id: "j1",
            user_id: "user-1",
            title: "Test decision",
            context: "ctx",
            decision: "d",
            rationale: "r",
            confidence: 7,
            review_date: "2026-01-01",
            outcome_captured: false,
            alternatives_considered: [],
            key_assumptions: [],
            success_metrics: [],
            created_at: new Date().toISOString(),
          },
        ],
        reviews: [],
        progress: { completed_ids: ["fw-a"], current_module_id: null },
        favoriteQuotes: [],
      },
      "merge",
    )

    expect(mockSet).toHaveBeenCalled()
    const paths = (mockSet.mock.calls as unknown as [{ key: string }][]).map((c) => c[0].key)
    expect(paths.some((p) => p.includes("users/user-1/journal/entries/j1"))).toBe(true)
    expect(paths.some((p) => p.includes("users/user-1/progress"))).toBe(true)
  })
})
