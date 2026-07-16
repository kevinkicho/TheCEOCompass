import { describe, it, expect, vi, beforeEach } from "vitest"

const store: Record<string, unknown> = {}

const { mockRef, mockGet, mockSet, mockUpdate, mockRemove } = vi.hoisted(() => {
  const mockRef = vi.fn((_db: unknown, path: string) => ({ key: path, path }))
  const mockGet = vi.fn()
  const mockSet = vi.fn()
  const mockUpdate = vi.fn()
  const mockRemove = vi.fn()
  return { mockRef, mockGet, mockSet, mockUpdate, mockRemove }
})

vi.mock("@/lib/firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "google-uid", isAnonymous: false } },
  ref: (...args: unknown[]) => (mockRef as Function)(...args),
  get: (...args: unknown[]) => (mockGet as Function)(...args),
  set: (...args: unknown[]) => (mockSet as Function)(...args),
  update: (...args: unknown[]) => (mockUpdate as Function)(...args),
  remove: (...args: unknown[]) => (mockRemove as Function)(...args),
}))

import {
  mergeUsersData,
  stashPendingAnonMerge,
  takePendingAnonMerge,
  peekPendingAnonMerge,
  setLastMergeStatus,
  getLastMergeStatus,
  clearLastMergeStatus,
} from "../user-data/migrate"

function pathOf(call: unknown[]): string {
  const r = call[0] as { key?: string; path?: string }
  return r.key || r.path || ""
}

describe("mergeUsersData", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of Object.keys(store)) delete store[k]
    sessionStorage.clear()

    mockGet.mockImplementation(async (r: { key: string }) => {
      const path = r.key
      const val = store[path]
      return {
        exists: () => val !== undefined && val !== null,
        val: () => val ?? null,
      }
    })
    mockSet.mockImplementation(async (r: { key: string }, val: unknown) => {
      store[r.key] = val
    })
    mockUpdate.mockImplementation(async (r: { key: string }, val: Record<string, unknown>) => {
      store[r.key] = { ...((store[r.key] as object) || {}), ...val }
    })
    mockRemove.mockImplementation(async (r: { key: string }) => {
      delete store[r.key]
    })
  })

  it("no-ops when fromUid === toUid", async () => {
    const r = await mergeUsersData("u1", "u1", { reviews: { c1: { conceptId: "c1" } } })
    expect(r.mergedKeys).toEqual([])
    expect(mockSet).not.toHaveBeenCalled()
  })

  it("merges journal entries from snapshot into destination", async () => {
    store["users/google-uid/journal/entries"] = {
      existing: { title: "keep", created_at: "2020" },
    }
    const snapshot = {
      journal: {
        entries: {
          anon1: { title: "from anon", created_at: "2021" },
        },
      },
    }
    const r = await mergeUsersData("anon-uid", "google-uid", snapshot)
    expect(r.mergedKeys).toContain("journal")
    expect(store["users/google-uid/journal/entries"]).toEqual({
      existing: { title: "keep", created_at: "2020" },
      anon1: { title: "from anon", created_at: "2021" },
    })
  })

  it("merges progress completed_ids as a union", async () => {
    store["users/google-uid/progress"] = {
      completed_ids: ["a"],
      current_module_id: "mod-g",
    }
    const r = await mergeUsersData("anon-uid", "google-uid", {
      progress: { completed_ids: ["b", "a"], current_module_id: "mod-a" },
    })
    expect(r.mergedKeys).toContain("progress")
    const p = store["users/google-uid/progress"] as {
      completed_ids: string[]
      current_module_id: string
    }
    expect(p.completed_ids.sort()).toEqual(["a", "b"])
    expect(p.current_module_id).toBe("mod-g")
  })

  it("prefers higher reviewCount when merging reviews", async () => {
    store["users/google-uid/reviews"] = {
      c1: { conceptId: "c1", reviewCount: 5, lastReviewedAt: "2020-01-01", nextReviewAt: "x" },
    }
    await mergeUsersData("anon-uid", "google-uid", {
      reviews: {
        c1: { conceptId: "c1", reviewCount: 2, lastReviewedAt: "2026-01-01", nextReviewAt: "y" },
        c2: { conceptId: "c2", reviewCount: 1, lastReviewedAt: "2026-01-01", nextReviewAt: "z" },
      },
    })
    const reviews = store["users/google-uid/reviews"] as Record<string, { reviewCount: number }>
    expect(reviews.c1.reviewCount).toBe(5)
    expect(reviews.c2.reviewCount).toBe(1)
  })

  it("records merge provenance on destination _meta", async () => {
    await mergeUsersData("anon-uid", "google-uid", {
      viewed: { fw: { concept1: true } },
    })
    const meta = store["users/google-uid/_meta"] as {
      merged_from_anon: { uid: string }[]
      last_anon_merge_from: string
    }
    expect(meta.last_anon_merge_from).toBe("anon-uid")
    expect(meta.merged_from_anon.some((e) => e.uid === "anon-uid")).toBe(true)
  })

  it("handles empty snapshot without throwing", async () => {
    const r = await mergeUsersData("anon-uid", "google-uid", null)
    expect(r.mergedKeys).toEqual([])
    expect(r.recordedOnTarget).toBe(true)
  })
})

describe("pending anon merge sessionStorage", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it("stash / peek / take round-trip", () => {
    stashPendingAnonMerge("anon-1", { reviews: {} })
    const peeked = peekPendingAnonMerge()
    expect(peeked?.fromUid).toBe("anon-1")
    const taken = takePendingAnonMerge()
    expect(taken?.fromUid).toBe("anon-1")
    expect(peekPendingAnonMerge()).toBeNull()
  })

  it("merge status get/set/clear", () => {
    setLastMergeStatus({
      state: "success",
      message: "ok",
      at: 1,
      mergedKeys: ["journal"],
    })
    expect(getLastMergeStatus()?.message).toBe("ok")
    clearLastMergeStatus()
    expect(getLastMergeStatus()).toBeNull()
  })
})
