import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { pathToFileURL } from "url"
import { execFileSync } from "child_process"

/**
 * Schema invariants for frontend/src/data/mastery-edges.json and
 * validateSeed from scripts/seed-mastery-graph.mjs (invoked via node so
 * we test the real helper without pulling scripts/ into the Vite graph).
 */
const root = join(__dirname, "../../../..")
const seedPath = join(root, "frontend/src/data/mastery-edges.json")
const metaPath = join(root, "frontend/src/data/framework-meta.json")
const scriptPath = join(root, "scripts/seed-mastery-graph.mjs")

const EDGE_TYPES = new Set(["requires", "reinforces", "applied_in"])
const UNSAFE_KEY = /[.#$[\]/]/

const seed = JSON.parse(readFileSync(seedPath, "utf8"))
const meta = JSON.parse(readFileSync(metaPath, "utf8"))

function runValidateSeed(seedObj: unknown): { ok: boolean; message: string } {
  // Avoid ENAMETOOLONG: pass payload via env, not argv.
  const code = `
    import { validateSeed } from ${JSON.stringify(pathToFileURL(scriptPath).href)};
    const seed = JSON.parse(process.env.MASTERY_SEED_PAYLOAD || "null");
    try {
      validateSeed(seed);
      process.stdout.write("OK");
    } catch (e) {
      process.stderr.write(String(e && e.message ? e.message : e));
      process.exit(1);
    }
  `
  try {
    const out = execFileSync(process.execPath, ["--input-type=module", "-e", code], {
      encoding: "utf8",
      cwd: root,
      env: { ...process.env, MASTERY_SEED_PAYLOAD: JSON.stringify(seedObj) },
    })
    return { ok: true, message: out }
  } catch (err: unknown) {
    const e = err as { stderr?: string; message?: string }
    return { ok: false, message: (e.stderr || e.message || String(err)).trim() }
  }
}

describe("mastery-edges.json schema invariants", () => {
  it("has version, ≥2 frameworks, 15–30 edges, non-empty concepts", () => {
    expect(typeof seed.version).toBe("number")
    expect(Array.isArray(seed.concepts)).toBe(true)
    expect(Array.isArray(seed.edges)).toBe(true)
    expect(seed.concepts.length).toBeGreaterThan(0)
    expect(seed.edges.length).toBeGreaterThanOrEqual(15)
    expect(seed.edges.length).toBeLessThanOrEqual(40)
    const frameworks = new Set(seed.concepts.map((c: { frameworkSlug: string }) => c.frameworkSlug))
    expect(frameworks.size).toBeGreaterThanOrEqual(2)
  })

  it("concept ids are path-safe and equal conceptSlug", () => {
    for (const c of seed.concepts) {
      expect(c.id).toBe(c.conceptSlug)
      expect(UNSAFE_KEY.test(c.id)).toBe(false)
      expect(UNSAFE_KEY.test(c.frameworkSlug)).toBe(false)
    }
  })

  it("edges have finite weights in [0,1], valid types, no self/duplicate edges", () => {
    const seen = new Set<string>()
    for (const e of seed.edges) {
      expect(EDGE_TYPES.has(e.type)).toBe(true)
      expect(Number.isFinite(e.weight)).toBe(true)
      expect(e.weight).toBeGreaterThanOrEqual(0)
      expect(e.weight).toBeLessThanOrEqual(1)
      expect(e.from).not.toBe(e.to)
      const key = `${e.from}/${e.to}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  it("edge endpoints ⊆ concept ids", () => {
    const ids = new Set(seed.concepts.map((c: { id: string }) => c.id))
    for (const e of seed.edges) {
      expect(ids.has(e.from)).toBe(true)
      expect(ids.has(e.to)).toBe(true)
    }
  })

  it("reinforces edges are stored both directions", () => {
    const reinforces = seed.edges.filter((e: { type: string }) => e.type === "reinforces")
    expect(reinforces.length).toBeGreaterThan(0)
    for (const e of reinforces) {
      const reverse = reinforces.find(
        (x: { from: string; to: string }) => x.from === e.to && x.to === e.from
      )
      expect(reverse, `missing reverse for ${e.from} ↔ ${e.to}`).toBeDefined()
    }
  })

  it("concepts exist in framework-meta.json", () => {
    const known = new Map<string, Set<string>>()
    for (const fw of meta) {
      known.set(fw.slug, new Set((fw.concepts || []).map((c: { slug: string }) => c.slug)))
    }
    for (const c of seed.concepts) {
      const slugs = known.get(c.frameworkSlug)
      expect(slugs, c.frameworkSlug).toBeDefined()
      expect(slugs!.has(c.conceptSlug), `${c.frameworkSlug}/${c.conceptSlug}`).toBe(true)
    }
  })
})

describe("validateSeed (seed-mastery-graph.mjs)", () => {
  it("accepts the committed seed file via dry-run CLI", () => {
    const out = execFileSync(process.execPath, [scriptPath, "--dry-run"], {
      encoding: "utf8",
      cwd: root,
    })
    expect(out).toMatch(/validation OK/)
  })

  it("rejects NaN, Infinity, out-of-range weights, and unsafe ids", () => {
    const base = {
      version: 1,
      concepts: [
        { id: "a", frameworkSlug: "f1", conceptSlug: "a" },
        { id: "b", frameworkSlug: "f2", conceptSlug: "b" },
      ],
      edges: [{ from: "a", to: "b", type: "requires", weight: 0.5 }],
    }

    // NaN cannot round-trip through JSON — exercise non-finite check in-process via node -e
    const nanCode = `
      import { validateSeed } from ${JSON.stringify(pathToFileURL(scriptPath).href)};
      try {
        validateSeed({
          version: 1,
          concepts: [
            { id: "a", frameworkSlug: "f1", conceptSlug: "a" },
            { id: "b", frameworkSlug: "f2", conceptSlug: "b" },
          ],
          edges: [{ from: "a", to: "b", type: "requires", weight: NaN }],
        });
        process.exit(0);
      } catch (e) {
        process.stderr.write(String(e.message));
        process.exit(1);
      }
    `
    try {
      execFileSync(process.execPath, ["--input-type=module", "-e", nanCode], {
        encoding: "utf8",
        cwd: root,
      })
      expect.fail("expected NaN weight to throw")
    } catch (err: unknown) {
      const e = err as { stderr?: string; status?: number }
      expect(e.status).not.toBe(0)
      expect(e.stderr || "").toMatch(/weight/i)
    }

    expect(runValidateSeed({
      ...base,
      edges: [{ from: "a", to: "b", type: "requires", weight: 1.5 }],
    }).ok).toBe(false)

    expect(runValidateSeed({
      ...base,
      concepts: [
        { id: "a.b", frameworkSlug: "f1", conceptSlug: "a.b" },
        { id: "b", frameworkSlug: "f2", conceptSlug: "b" },
      ],
      edges: [{ from: "a.b", to: "b", type: "requires", weight: 0.5 }],
    }).message).toMatch(/unsafe/i)

    expect(runValidateSeed({
      ...base,
      edges: [{ from: "a", to: "b", type: "reinforces", weight: 0.5 }],
    }).message).toMatch(/reverse/i)
  })
})
