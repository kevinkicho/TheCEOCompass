/**
 * Pull recent learning signals from the signed-in user's RTDB tree.
 * Used so journal AI can write concrete entries without a browser/CLI navigator.
 *
 * There is no agent CLI that drives the UI. Context comes from paths the app
 * already writes: viewed, scenarioHistory, pathway progress, quizResults, reviews.
 */

import { db, ref, get } from "../firebase"
import { tryUid, userPath, requireUid } from "./scope"
import { loadPathwayProgress, buildPathway } from "./pathway"
import { loadDueReviews } from "./reviews"
import { loadFrameworks } from "../rtdb-cache"

export type LearnerJournalContext = {
  /** Human-readable block for AI prompts */
  promptBlock: string
  recentViewed: { frameworkSlug: string; conceptId: string; viewedAt: string }[]
  recentScenarios: { slug: string; completedAt: string; stageCount: number }[]
  pathway: { pct: number; nextSlug: string | null; completed: string[] }
  dueReviewCount: number
  quizHighlights: { framework: string; pct: number; at?: string }[]
}

function asRecord(v: unknown): Record<string, any> {
  return v && typeof v === "object" ? (v as Record<string, any>) : {}
}

/**
 * Load a compact snapshot of what the learner has been doing.
 * Safe to call when empty (new account) — returns empty lists.
 */
export async function loadLearnerJournalContext(limit = 8): Promise<LearnerJournalContext> {
  const empty: LearnerJournalContext = {
    promptBlock: "(No learning activity found yet in this account.)",
    recentViewed: [],
    recentScenarios: [],
    pathway: { pct: 0, nextSlug: null, completed: [] },
    dueReviewCount: 0,
    quizHighlights: [],
  }

  const uid = tryUid()
  if (!uid || !db) return empty

  try {
    const database = db
    const [viewedSnap, scenariosSnap, quizSnap, pathway, dueReviews, frameworks] =
      await Promise.all([
        get(ref(database, userPath(uid, "viewed"))).catch(() => null),
        get(ref(database, userPath(uid, "scenarioHistory"))).catch(() => null),
        get(ref(database, userPath(uid, "quizResults"))).catch(() => null),
        loadPathwayProgress().catch(() => ({
          completedIds: [] as string[],
          inProgressId: null as string | null,
        })),
        loadDueReviews().catch(() => []),
        loadFrameworks().catch(() => []),
      ])

    // --- viewed concepts ---
    const recentViewed: LearnerJournalContext["recentViewed"] = []
    if (viewedSnap?.exists()) {
      const tree = asRecord(viewedSnap.val())
      for (const fw of Object.keys(tree)) {
        const concepts = asRecord(tree[fw])
        for (const cid of Object.keys(concepts)) {
          if (cid === "viewed_at") continue
          const node = concepts[cid]
          const viewedAt =
            typeof node === "object" && node?.viewed_at
              ? String(node.viewed_at)
              : typeof node === "string"
                ? node
                : ""
          recentViewed.push({
            frameworkSlug: fw,
            conceptId: cid,
            viewedAt,
          })
        }
      }
      recentViewed.sort(
        (a, b) => new Date(b.viewedAt || 0).getTime() - new Date(a.viewedAt || 0).getTime(),
      )
    }

    // --- scenario history ---
    const recentScenarios: LearnerJournalContext["recentScenarios"] = []
    if (scenariosSnap?.exists()) {
      const tree = asRecord(scenariosSnap.val())
      for (const slug of Object.keys(tree)) {
        const attempts = tree[slug]
        // shape: scenarioHistory/{slug}/{attemptId} or flat
        if (attempts && typeof attempts === "object") {
          const vals = Object.values(attempts as Record<string, any>)
          for (const a of vals) {
            if (!a || typeof a !== "object") continue
            const stages = Array.isArray(a.stages) ? a.stages : []
            recentScenarios.push({
              slug,
              completedAt: String(a.completed_at || a.completedAt || ""),
              stageCount: stages.length,
            })
          }
        }
      }
      recentScenarios.sort(
        (a, b) =>
          new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime(),
      )
    }

    // --- quizzes ---
    const quizHighlights: LearnerJournalContext["quizHighlights"] = []
    if (quizSnap?.exists()) {
      const tree = asRecord(quizSnap.val())
      for (const [k, v] of Object.entries(tree)) {
        if (!v || typeof v !== "object") continue
        const row = v as any
        quizHighlights.push({
          framework: String(row.framework_slug || row.framework || k),
          pct: Number(row.pct || row.score || 0),
          at: row.completed_at || row.at,
        })
      }
      quizHighlights.sort((a, b) => b.pct - a.pct)
    }

    const steps = buildPathway(frameworks as any[])
    const pct =
      steps.length > 0
        ? Math.round((pathway.completedIds.length / steps.length) * 100)
        : 0
    const nextStep = steps.find((s) => !pathway.completedIds.includes(s.slug))

    const topViewed = recentViewed.slice(0, limit)
    const topScenarios = recentScenarios.slice(0, limit)
    const topQuiz = quizHighlights.slice(0, 5)

    const lines: string[] = [
      "ACCOUNT LEARNING CONTEXT (auto-loaded from this user's RTDB activity — use these as real activities when the learner asks to record recent work):",
      "",
      "Recently viewed concepts:",
      ...(topViewed.length
        ? topViewed.map(
            (v, i) =>
              `  ${i + 1}. framework=${v.frameworkSlug} concept=${v.conceptId}${v.viewedAt ? ` at=${v.viewedAt}` : ""}`,
          )
        : ["  (none)"]),
      "",
      "Recent scenario practice:",
      ...(topScenarios.length
        ? topScenarios.map(
            (s, i) =>
              `  ${i + 1}. scenario=${s.slug} stages=${s.stageCount}${s.completedAt ? ` completed=${s.completedAt}` : ""}`,
          )
        : ["  (none)"]),
      "",
      "Quiz results:",
      ...(topQuiz.length
        ? topQuiz.map((q, i) => `  ${i + 1}. ${q.framework} score=${q.pct}%`)
        : ["  (none)"]),
      "",
      `Pathway: ${pct}% complete; next=${nextStep?.slug || "none"}; completed=[${pathway.completedIds.slice(0, 8).join(", ")}]`,
      `Due spaced reviews: ${dueReviews.length}`,
    ]

    return {
      promptBlock: lines.join("\n"),
      recentViewed: topViewed,
      recentScenarios: topScenarios,
      pathway: {
        pct,
        nextSlug: nextStep?.slug || null,
        completed: pathway.completedIds,
      },
      dueReviewCount: dueReviews.length,
      quizHighlights: topQuiz,
    }
  } catch {
    return empty
  }
}

/** Optional: force uid when called outside React auth timing. */
export async function loadLearnerJournalContextForUid(
  uid: string,
  limit = 8,
): Promise<LearnerJournalContext> {
  if (!uid) return loadLearnerJournalContext(limit)
  // requireUid throws if wrong user; we only use tryUid paths above
  void requireUid
  return loadLearnerJournalContext(limit)
}
