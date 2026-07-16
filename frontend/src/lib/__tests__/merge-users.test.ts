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
  snapshotUserTree,
  stashPendingAnonMerge,
  takePendingAnonMerge,
  peekPendingAnonMerge,
  clearPendingAnonMerge,
  setLastMergeStatus,
  getLastMergeStatus,
  clearLastMergeStatus,
  runPendingAnonMerge,
  prepareAnonMerge,
} from "../user-data/migrate"

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

  it("journal same-id collision: anonymous source overwrites destination", async () => {
    store["users/google-uid/journal/entries"] = {
      same: { title: "dest title", created_at: "2020" },
    }
    await mergeUsersData("anon-uid", "google-uid", {
      journal: {
        entries: {
          same: { title: "anon title", created_at: "2022" },
        },
      },
    })
    const entries = store["users/google-uid/journal/entries"] as Record<string, { title: string }>
    expect(entries.same.title).toBe("anon title")
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

  it("source-wins leaf conflicts for favoriteQuotes", async () => {
    store["users/google-uid/favoriteQuotes"] = {
      q1: { text: "dest", person: "A" },
    }
    await mergeUsersData("anon-uid", "google-uid", {
      favoriteQuotes: {
        q1: { text: "anon", person: "B" },
        q2: { text: "new", person: "C" },
      },
    })
    const fq = store["users/google-uid/favoriteQuotes"] as Record<string, { text: string }>
    expect(fq.q1.text).toBe("anon")
    expect(fq.q2.text).toBe("new")
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

  it("confirmed empty snapshot reports sourceConfirmedEmpty", async () => {
    const r = await mergeUsersData("anon-uid", "google-uid", null, { snapshotOk: true })
    expect(r.mergedKeys).toEqual([])
    expect(r.sourceConfirmedEmpty).toBe(true)
    expect(r.recordedOnTarget).toBe(true)
  })

  it("failed snapshot does not claim sourceConfirmedEmpty", async () => {
    const r = await mergeUsersData("anon-uid", "google-uid", null, { snapshotOk: false })
    expect(r.sourceConfirmedEmpty).toBe(false)
    expect(r.failedKeys.length).toBeGreaterThan(0)
  })
})

describe("snapshotUserTree", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of Object.keys(store)) delete store[k]
    mockGet.mockImplementation(async (r: { key: string }) => {
      const val = store[r.key]
      return {
        exists: () => val !== undefined && val !== null,
        val: () => val ?? null,
      }
    })
  })

  it("returns ok true with null for empty tree", async () => {
    const r = await snapshotUserTree("anon-1")
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data).toBeNull()
  })

  it("returns ok false when get throws", async () => {
    mockGet.mockRejectedValueOnce(new Error("permission denied"))
    const r = await snapshotUserTree("anon-1")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/permission denied/)
  })
})

describe("pending anon merge sessionStorage", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it("stash returns true and peek/take round-trip", () => {
    expect(stashPendingAnonMerge("anon-1", { reviews: {} }, true)).toBe(true)
    const peeked = peekPendingAnonMerge()
    expect(peeked?.fromUid).toBe("anon-1")
    expect(peeked?.snapshotOk).toBe(true)
    const taken = takePendingAnonMerge()
    expect(taken?.fromUid).toBe("anon-1")
    expect(peekPendingAnonMerge()).toBeNull()
  })

  it("stash returns false when sessionStorage throws", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError")
    })
    expect(stashPendingAnonMerge("anon-1", { reviews: { c: 1 } }, true)).toBe(false)
    spy.mockRestore()
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

describe("runPendingAnonMerge", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockReset()
    mockSet.mockReset()
    mockUpdate.mockReset()
    mockRemove.mockReset()
    for (const k of Object.keys(store)) delete store[k]
    sessionStorage.clear()
    mockGet.mockImplementation(async (r: { key: string }) => {
      const val = store[r.key]
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
    mockRemove.mockResolvedValue(undefined)
  })

  it("failed snapshotOk reports error and clears bad stash", async () => {
    stashPendingAnonMerge("anon-uid", null, false)
    const status = await runPendingAnonMerge("google-uid")
    expect(status?.state).toBe("error")
    expect(status?.canRetry).toBe(false)
    expect(peekPendingAnonMerge()).toBeNull()
  })

  it("confirmed empty reports success and clears stash", async () => {
    stashPendingAnonMerge("anon-uid", null, true)
    const status = await runPendingAnonMerge("google-uid")
    expect(status?.state).toBe("success")
    expect(status?.message).toMatch(/No anonymous learning data/)
    expect(peekPendingAnonMerge()).toBeNull()
  })

  it("successful merge clears stash", async () => {
    stashPendingAnonMerge(
      "anon-uid",
      { progress: { completed_ids: ["a"], current_module_id: null } },
      true,
    )
    const status = await runPendingAnonMerge("google-uid")
    expect(status?.state).toBe("success")
    expect(status?.mergedKeys).toContain("progress")
    expect(peekPendingAnonMerge()).toBeNull()
  })

  it("keeps stash when all keys fail so retry works", async () => {
    stashPendingAnonMerge(
      "anon-uid",
      { progress: { completed_ids: ["a"], current_module_id: null } },
      true,
    )
    mockGet.mockImplementation(async () => {
      throw new Error("network down")
    })
    const status = await runPendingAnonMerge("google-uid")
    expect(status?.state).toBe("error")
    expect(status?.canRetry).toBe(true)
    expect(peekPendingAnonMerge()?.fromUid).toBe("anon-uid")
  })
})

describe("prepareAnonMerge", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of Object.keys(store)) delete store[k]
    sessionStorage.clear()
    mockGet.mockImplementation(async (r: { key: string }) => {
      const val = store[r.key]
      return {
        exists: () => val !== undefined && val !== null,
        val: () => val ?? null,
      }
    })
  })

  it("succeeds and stashes for empty tree", async () => {
    const r = await prepareAnonMerge("anon-1")
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.empty).toBe(true)
    expect(peekPendingAnonMerge()?.fromUid).toBe("anon-1")
  })

  it("fails when snapshot throws", async () => {
    mockGet.mockRejectedValueOnce(new Error("offline"))
    const r = await prepareAnonMerge("anon-1")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe("snapshot_failed")
  })

  it("fails when stash throws and data exists", async () => {
    store["users/anon-1"] = { progress: { completed_ids: ["x"] } }
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError")
    })
    const r = await prepareAnonMerge("anon-1")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe("stash_failed")
    spy.mockRestore()
  })
})
