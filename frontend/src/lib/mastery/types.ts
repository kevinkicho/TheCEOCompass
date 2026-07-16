/**
 * Mastery graph types (Phase 3).
 *
 * RTDB layout:
 *   mastery/edges/{fromConceptId}/{toConceptId} → MasteryEdgeRecord
 *   mastery/concepts/{conceptId} → MasteryConceptNode
 *
 * Concept ids are slug-style strings (slugify(concept.name)), matching
 * frontend/src/data/framework-meta.json concept slugs.
 */

/** Directed edge semantics between two concepts. */
export type MasteryEdgeType = "requires" | "reinforces" | "applied_in"

/**
 * Seed / API edge shape: { from, to, type, weight }.
 *
 * - requires: `from` depends on `to` (master `to` before `from`) — directed only
 * - reinforces: soft mutual link; **seed stores both directions** (A→B and B→A)
 *   with the same weight so directed adjacency walkers treat it as undirected
 * - applied_in: `from` is applied when learning/practicing `to` (often cross-framework)
 */
export interface MasteryEdge {
  from: string
  to: string
  type: MasteryEdgeType
  /** Relative importance in [0, 1]; higher = stronger dependency / link. */
  weight: number
}

/** RTDB value stored under mastery/edges/{from}/{to} (from/to are path keys). */
export interface MasteryEdgeRecord {
  type: MasteryEdgeType
  weight: number
}

/** Concept node metadata for the mastery graph. */
export interface MasteryConcept {
  id: string
  frameworkSlug: string
  conceptSlug: string
  difficulty?: number
  tags?: string[]
}

/** RTDB value stored under mastery/concepts/{conceptId} (id is the path key). */
export interface MasteryConceptNode {
  frameworkSlug: string
  conceptSlug: string
  difficulty?: number
  tags?: string[]
}

/** In-memory graph used by the next-action engine (PR 8). */
export interface MasteryGraph {
  concepts: Record<string, MasteryConcept>
  edges: MasteryEdge[]
}

/** Seed JSON file shape (frontend/src/data/mastery-edges.json). */
export interface MasterySeedFile {
  version: number
  description?: string
  concepts: MasteryConcept[]
  edges: MasteryEdge[]
}
