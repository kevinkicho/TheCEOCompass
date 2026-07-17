import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * Catalog API tests use the dual-path scenarios-cache (bundled seed when no RTDB).
 * User-data (journal/progress) is not part of api.ts — tested under user-data / firebase-crud.
 */

const state = vi.hoisted(() => ({
  mockGet: vi.fn(),
  db: null as object | null,
}))

vi.mock("@/lib/firebase", () => ({
  get db() {
    return state.db
  },
  ref: (_db: unknown, path: string) => ({ _path: path }),
  get: (...args: unknown[]) => state.mockGet(...args),
}))

vi.mock("@/lib/rtdb-cache", () => ({
  getCachedFrameworks: () => null,
  loadFrameworks: async () => [],
}))

import {
  getFrameworks,
  getFrameworkBySlug,
  getScenarios,
  getScenario,
  getBundledScenarioCatalog,
} from "../api"
import { clearScenariosCache } from "../scenarios-cache"

describe("API Client (catalog)", () => {
  beforeEach(() => {
    state.db = null
    state.mockGet.mockReset()
    clearScenariosCache()
  })

  it("getFrameworks returns an array when cache empty", async () => {
    const result = await getFrameworks()
    expect(Array.isArray(result)).toBe(true)
  })

  it("getFrameworkBySlug returns null for unknown slug", async () => {
    const result = await getFrameworkBySlug("test")
    expect(result).toBeNull()
  })

  it("getScenarios returns an array from bundled seed", async () => {
    const result = await getScenarios()
    expect(Array.isArray(result)).toBe(true)
  })

  it("getScenarios includes pack metadata and expanded catalog", async () => {
    const result = await getScenarios()
    expect(result.length).toBeGreaterThanOrEqual(12)
    expect(result.every((s) => typeof s.pack_id === "string" && s.pack_id.length > 0)).toBe(true)
    expect(result.every((s) => typeof s.pack_title === "string" && s.pack_title.length > 0)).toBe(
      true,
    )
    expect(result.some((s) => s.pack_id === "core")).toBe(true)
    expect(result.some((s) => s.pack_id && s.pack_id !== "core")).toBe(true)
  })

  it("getScenarios filters by framework_slugs", async () => {
    const finance = await getScenarios("financial-mastery")
    expect(finance.length).toBeGreaterThan(0)
    expect(
      finance.every(
        (s) =>
          s.framework_slugs?.includes("financial-mastery") ||
          s.framework_id === "financial-mastery",
      ),
    ).toBe(true)
  })

  it("getScenario returns pack scenario with stages and concept_ids", async () => {
    const result = await getScenario("runway-unit-economics-crisis")
    expect(result).not.toBeNull()
    expect(result!.title).toBeTruthy()
    expect(result!.stages.length).toBeGreaterThanOrEqual(3)
    expect(result!.concept_ids?.length).toBeGreaterThan(0)
    expect(result!.pack_id).toBe("finance")
    expect(result!.outcome_branches).toHaveProperty("optimal")
    expect(result!.outcome_branches).toHaveProperty("acceptable")
    expect(result!.outcome_branches).toHaveProperty("failure")
  })

  it("getScenario returns a scenario with slug", async () => {
    const list = await getScenarios()
    expect(list.length).toBeGreaterThan(0)
    const result = await getScenario(list[0].slug)
    expect(result).toHaveProperty("title")
    expect(result).toHaveProperty("slug")
  })

  it("getBundledScenarioCatalog matches seed size", () => {
    const bundled = getBundledScenarioCatalog()
    expect(bundled.length).toBeGreaterThanOrEqual(12)
    expect(bundled.every((s) => Array.isArray(s.stages))).toBe(true)
  })
})
