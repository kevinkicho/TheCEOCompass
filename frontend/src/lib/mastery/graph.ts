/**
 * Pure mastery-graph helpers: build in-memory graphs, adjacency, centrality.
 */

import type {
  MasteryConcept,
  MasteryConceptNode,
  MasteryEdge,
  MasteryEdgeRecord,
  MasteryEdgeType,
  MasteryGraph,
  MasterySeedFile,
} from "./types"

const EDGE_TYPES = new Set<MasteryEdgeType>(["requires", "reinforces", "applied_in"])

/** True when weight is finite and in [0, 1]. */
export function isValidEdgeWeight(weight: unknown): weight is number {
  return typeof weight === "number" && Number.isFinite(weight) && weight >= 0 && weight <= 1
}

/** Sanitize an edge list: drop non-finite / out-of-range weights. */
function sanitizeEdges(edges: MasteryEdge[]): MasteryEdge[] {
  return edges
    .filter((e) => e && EDGE_TYPES.has(e.type) && isValidEdgeWeight(e.weight))
    .map((e) => ({ from: e.from, to: e.to, type: e.type, weight: e.weight }))
}

/** Build MasteryGraph from seed JSON shape (invalid weights dropped). */
export function graphFromSeed(seed: MasterySeedFile): MasteryGraph {
  const concepts: Record<string, MasteryConcept> = {}
  for (const c of seed.concepts) {
    concepts[c.id] = { ...c }
  }
  return {
    concepts,
    edges: sanitizeEdges(seed.edges ?? []),
  }
}

/**
 * Build MasteryGraph from RTDB snapshots.
 * edgesRaw: mastery/edges → { [from]: { [to]: { type, weight } } }
 * conceptsRaw: mastery/concepts → { [id]: { frameworkSlug, conceptSlug, ... } }
 *
 * Edges with non-finite or out-of-range weights are rejected (matches seed validator).
 */
export function graphFromRtdb(
  conceptsRaw: Record<string, MasteryConceptNode> | null | undefined,
  edgesRaw: Record<string, Record<string, MasteryEdgeRecord>> | null | undefined,
): MasteryGraph {
  const concepts: Record<string, MasteryConcept> = {}
  if (conceptsRaw && typeof conceptsRaw === "object") {
    for (const [id, node] of Object.entries(conceptsRaw)) {
      if (!node || typeof node !== "object") continue
      concepts[id] = {
        id,
        frameworkSlug: node.frameworkSlug,
        conceptSlug: node.conceptSlug,
        difficulty: node.difficulty,
        tags: node.tags,
      }
    }
  }

  const edges: MasteryEdge[] = []
  if (edgesRaw && typeof edgesRaw === "object") {
    for (const [from, targets] of Object.entries(edgesRaw)) {
      if (!targets || typeof targets !== "object") continue
      for (const [to, rec] of Object.entries(targets)) {
        if (!rec || typeof rec !== "object") continue
        if (!rec.type || !EDGE_TYPES.has(rec.type)) continue
        if (!isValidEdgeWeight(rec.weight)) continue
        edges.push({ from, to, type: rec.type, weight: rec.weight })
      }
    }
  }

  return { concepts, edges }
}

/** Finite weight helper for scoring paths (0 if invalid). */
export function safeWeight(weight: number): number {
  return Number.isFinite(weight) ? weight : 0
}

/** Concepts that `conceptId` requires (to-side of requires edges from conceptId). */
export function getPrerequisites(graph: MasteryGraph, conceptId: string): MasteryEdge[] {
  return graph.edges.filter((e) => e.type === "requires" && e.from === conceptId)
}

/** Concepts that require `conceptId` (from-side of requires edges targeting conceptId). */
export function getDependents(graph: MasteryGraph, conceptId: string): MasteryEdge[] {
  return graph.edges.filter((e) => e.type === "requires" && e.to === conceptId)
}

/**
 * Weighted degree centrality: sum of finite edge weights where the concept is endpoint.
 * Higher = more connected / pedagogically central.
 */
export function computeCentrality(graph: MasteryGraph): Map<string, number> {
  const scores = new Map<string, number>()
  for (const id of Object.keys(graph.concepts)) {
    scores.set(id, 0)
  }
  for (const e of graph.edges) {
    const w = safeWeight(e.weight)
    if (w === 0 && e.weight !== 0) continue
    scores.set(e.from, (scores.get(e.from) ?? 0) + w)
    scores.set(e.to, (scores.get(e.to) ?? 0) + w)
  }
  return scores
}

/** Lookup concept metadata; returns null if missing. */
export function getConcept(graph: MasteryGraph, conceptId: string): MasteryConcept | null {
  return graph.concepts[conceptId] ?? null
}

/** All concept ids in a framework. */
export function conceptsInFramework(graph: MasteryGraph, frameworkSlug: string): string[] {
  return Object.values(graph.concepts)
    .filter((c) => c.frameworkSlug === frameworkSlug)
    .map((c) => c.id)
}
