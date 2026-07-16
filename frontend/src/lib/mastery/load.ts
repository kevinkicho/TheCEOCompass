/**
 * Load mastery graph from RTDB, falling back to static seed JSON.
 */

import { db, ref, get } from "../firebase"
import type { MasteryConceptNode, MasteryEdgeRecord, MasteryGraph, MasterySeedFile } from "./types"
import { graphFromRtdb, graphFromSeed } from "./graph"
import staticSeed from "@/data/mastery-edges.json"

let cachedGraph: MasteryGraph | null = null
let loadPromise: Promise<MasteryGraph> | null = null
let loadedFrom: "rtdb" | "static" | null = null

function seedAsMasterySeedFile(): MasterySeedFile {
  return staticSeed as MasterySeedFile
}

/** In-memory graph built only from static JSON (no network). */
export function loadMasteryGraphFromStatic(): MasteryGraph {
  return graphFromSeed(seedAsMasterySeedFile())
}

/**
 * Load mastery graph: try RTDB `mastery/concepts` + `mastery/edges`,
 * fall back to `frontend/src/data/mastery-edges.json` when Firebase is
 * missing, empty, or errors.
 *
 * Module-level cache; reset via `clearMasteryGraphCache()` (tests).
 */
export async function loadMasteryGraph(): Promise<MasteryGraph> {
  if (cachedGraph) return cachedGraph
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const fromRtdb = await tryLoadFromRtdb()
    if (fromRtdb) {
      cachedGraph = fromRtdb
      loadedFrom = "rtdb"
      return fromRtdb
    }
    const fromStatic = loadMasteryGraphFromStatic()
    cachedGraph = fromStatic
    loadedFrom = "static"
    return fromStatic
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
    // Require at least one concept to treat RTDB as authoritative
    if (Object.keys(graph.concepts).length === 0) return null
    return graph
  } catch {
    return null
  }
}

export function getCachedMasteryGraph(): MasteryGraph | null {
  return cachedGraph
}

export function getMasteryGraphSource(): "rtdb" | "static" | null {
  return loadedFrom
}

/** Test helper: clear module cache so subsequent loads re-fetch. */
export function clearMasteryGraphCache(): void {
  cachedGraph = null
  loadPromise = null
  loadedFrom = null
}
