/**
 * Load mastery graph from RTDB.
 * - When Firebase is configured: RTDB only (no silent static product fallback).
 * - When Firebase is not configured (unit tests / no env): bundled seed JSON.
 */

import { db, ref, get } from "../firebase"
import type { MasteryConceptNode, MasteryEdgeRecord, MasteryGraph, MasterySeedFile } from "./types"
import { graphFromRtdb, graphFromSeed } from "./graph"
import staticSeed from "@/data/mastery-edges.json"

let cachedGraph: MasteryGraph | null = null
let loadPromise: Promise<MasteryGraph> | null = null
let loadedFrom: "rtdb" | "static" | "empty" | null = null

function seedAsMasterySeedFile(): MasterySeedFile {
  return staticSeed as MasterySeedFile
}

function emptyGraph(): MasteryGraph {
  return { concepts: {}, edges: [] }
}

/** In-memory graph built only from static JSON (no network). Seed / tests. */
export function loadMasteryGraphFromStatic(): MasteryGraph {
  return graphFromSeed(seedAsMasterySeedFile())
}

/**
 * Load mastery graph.
 * Prefer RTDB `mastery/concepts` + `mastery/edges`.
 * If Firebase is configured but mastery is empty/errors, return an empty graph
 * (callers show empty recommendations). Use `loadMasteryGraphFromStatic()` or
 * `scripts/seed-mastery-graph.mjs` for the seed file.
 */
export async function loadMasteryGraph(): Promise<MasteryGraph> {
  if (cachedGraph) return cachedGraph
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    if (!db) {
      const fromStatic = loadMasteryGraphFromStatic()
      cachedGraph = fromStatic
      loadedFrom = "static"
      return fromStatic
    }

    const fromRtdb = await tryLoadFromRtdb()
    if (fromRtdb) {
      cachedGraph = fromRtdb
      loadedFrom = "rtdb"
      return fromRtdb
    }

    if (typeof console !== "undefined" && console.warn) {
      console.warn(
        "[mastery] RTDB mastery/ empty or unreadable — graph empty until seed. Run: node scripts/seed-mastery-graph.mjs",
      )
    }
    cachedGraph = emptyGraph()
    loadedFrom = "empty"
    return cachedGraph
  })().catch((err) => {
    loadPromise = null
    throw err
  })

  return loadPromise
}

async function tryLoadFromRtdb(): Promise<MasteryGraph | null> {
  if (!db) return null
  try {
    const [conceptsSnap, edgesSnap] = await Promise.all([
      get(ref(db!, "mastery/concepts")),
      get(ref(db!, "mastery/edges")),
    ])

    const conceptsRaw = conceptsSnap.exists()
      ? (conceptsSnap.val() as Record<string, MasteryConceptNode>)
      : null
    const edgesRaw = edgesSnap.exists()
      ? (edgesSnap.val() as Record<string, Record<string, MasteryEdgeRecord>>)
      : null

    if (!conceptsRaw && !edgesRaw) return null

    const graph = graphFromRtdb(conceptsRaw, edgesRaw)
    if (Object.keys(graph.concepts).length === 0) return null
    return graph
  } catch {
    return null
  }
}

export function getCachedMasteryGraph(): MasteryGraph | null {
  return cachedGraph
}

export function getMasteryGraphSource(): "rtdb" | "static" | "empty" | null {
  return loadedFrom
}

/** Test helper: clear module cache so subsequent loads re-fetch. */
export function clearMasteryGraphCache(): void {
  cachedGraph = null
  loadPromise = null
  loadedFrom = null
}
