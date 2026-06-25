import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/firebase", () => ({
  db: { type: "database" },
  ref: vi.fn((_db: any, path: string) => ({ _path: path })),
  get: vi.fn(),
}))

function makeSnap(data: Record<string, any> | null, exists = true) {
  return {
    exists: () => exists,
    val: () => data,
    ref: { key: null },
    priority: null,
    key: null,
    size: 0,
    child: vi.fn(),
    forEach: vi.fn(),
    hasChild: vi.fn(),
    hasChildren: vi.fn(),
    numChildren: vi.fn(),
    toJSON: vi.fn(),
  } as any
}

describe("rtdb-cache", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("slugify converts names to URL slugs", async () => {
    const { slugify } = await import("../rtdb-cache")
    expect(slugify("First Principles Thinking")).toBe("first-principles-thinking")
    expect(slugify("OODA Loop")).toBe("ooda-loop")
    expect(slugify("ABC & Def")).toBe("abc-def")
  })

  it("getCachedFrameworks returns null before load", async () => {
    const { getCachedFrameworks } = await import("../rtdb-cache")
    expect(getCachedFrameworks()).toBeNull()
  })

  it("loadFrameworks returns frameworks from RTDB", async () => {
    const { get } = await import("@/lib/firebase")
    const mockGet = vi.mocked(get)

    mockGet.mockResolvedValueOnce(makeSnap({
      fw1: {
        id: "id-fw1", slug: "fw1", title: "Title fw1", description: "Desc",
        category: "test", difficulty: 2, estimated_time_minutes: 30,
        concepts: { c1: { name: "Concept A" }, c2: { name: "Concept B" } },
      },
      fw2: {
        id: "id-fw2", slug: "fw2", title: "Title fw2", description: "Desc",
        category: "test", difficulty: 1, estimated_time_minutes: 20,
        concepts: { c3: { name: "Concept C" } },
      },
    }))

    const { loadFrameworks } = await import("../rtdb-cache")
    const result = await loadFrameworks()
    expect(result.length).toBe(2)
    expect(result[0].slug).toBe("fw1")
    expect(result[0].concepts).toHaveLength(2)
    expect(result[1].concepts).toHaveLength(1)
  })

  it("loadFrameworks skips entries with error field", async () => {
    const { get } = await import("@/lib/firebase")
    const mockGet = vi.mocked(get)

    mockGet.mockResolvedValueOnce(makeSnap({
      fw1: {
        id: "id-fw1", slug: "fw1", title: "Title fw1", description: "Desc",
        category: "test", difficulty: 2, estimated_time_minutes: 30,
      },
      bad_fw: { error: "something went wrong" },
    }))

    const { loadFrameworks } = await import("../rtdb-cache")
    const result = await loadFrameworks()
    expect(result.length).toBe(1)
    expect(result[0].slug).toBe("fw1")
  })

  it("loadFrameworks assigns order_index to concepts", async () => {
    const { get } = await import("@/lib/firebase")
    const mockGet = vi.mocked(get)

    mockGet.mockResolvedValueOnce(makeSnap({
      fw1: {
        id: "id-fw1", slug: "fw1", title: "Title fw1", description: "Desc",
        category: "test", difficulty: 2, estimated_time_minutes: 30,
        concepts: { c2: { name: "B Concept" }, c1: { name: "A Concept" } },
      },
    }))

    const { loadFrameworks } = await import("../rtdb-cache")
    const result = await loadFrameworks()
    expect(result[0].concepts[0].order_index).toBe(0)
    expect(result[0].concepts[1].order_index).toBe(1)
  })

  it("loadFrameworks handles entries without concepts", async () => {
    const { get } = await import("@/lib/firebase")
    const mockGet = vi.mocked(get)

    mockGet.mockResolvedValueOnce(makeSnap({
      fw1: {
        id: "id-fw1", slug: "fw1", title: "Title fw1", description: "Desc",
        category: "test", difficulty: 2, estimated_time_minutes: 30,
      },
    }))

    const { loadFrameworks } = await import("../rtdb-cache")
    const result = await loadFrameworks()
    expect(result.length).toBe(1)
    expect(result[0].concepts).toBeUndefined()
  })

  it("loadFrameworks throws on RTDB error", async () => {
    const { get } = await import("@/lib/firebase")
    const mockGet = vi.mocked(get)

    mockGet.mockRejectedValueOnce(new Error("RTDB unavailable"))

    const { loadFrameworks } = await import("../rtdb-cache")
    await expect(loadFrameworks()).rejects.toThrow("RTDB unavailable")
  })

  it("getCachedFrameworks returns data after load", async () => {
    const { get } = await import("@/lib/firebase")
    const mockGet = vi.mocked(get)

    mockGet.mockResolvedValueOnce(makeSnap({
      fw1: {
        id: "id-fw1", slug: "fw1", title: "Title fw1", description: "Desc",
        category: "test", difficulty: 2, estimated_time_minutes: 30,
      },
    }))

    const { loadFrameworks, getCachedFrameworks } = await import("../rtdb-cache")
    expect(getCachedFrameworks()).toBeNull()
    await loadFrameworks()
    expect(getCachedFrameworks()).not.toBeNull()
    expect(getCachedFrameworks()!.length).toBe(1)
  })
})
