/**
 * Pure mastery-graph helpers: build in-memory graphs, adjacency, centrality.
 */

import type {
  MasteryConcept,
  MasteryConceptNode,
  MasteryEdge,
  MasteryEdgeRecord,
  MasteryGraph,
  MasterySeedFile,
} from "./types"

/** Build MasteryGraph from seed JSON shape. */
export function graphFromSeed(seed: MasterySeedFile): MasteryGraph {
  const concepts: Record<string, MasteryConcept> = {}
  for (const c of seed.concepts) {
    concepts[c.id] = { ...c }
  }
  return {
    concepts,
    edges: seed.edges.map((e) => ({ ...e })),
  }
}

/**
 * Build MasteryGraph from RTDB snapshots.
 * edgesRaw: mastery/edges → { [from]: { [to]: { type, weight } } }
 * conceptsRaw: mastery/concepts → { [id]: { frameworkSlug, conceptSlug, ... } }
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
        if (!rec.type || typeof rec.weight !== "number") continue
        edges.push({ from, to, type: rec.type, weight: rec.weight })
      }
    }
  }

  return { concepts, edges }
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
 * Weighted degree centrality: sum of edge weights where the concept is endpoint.
 * Higher = more connected / pedagogically central.
 */
export function computeCentrality(graph: MasteryGraph): Map<string, number> {
  const scores = new Map<string, number>()
  for (const id of Object.keys(graph.concepts)) {
    scores.set(id, 0)
  }
  for (const e of graph.edges) {
    scores.set(e.from, (scores.get(e.from) ?? 0) + e.weight)
    scores.set(e.to, (scores.get(e.to) ?? 0) + e.weight)
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
