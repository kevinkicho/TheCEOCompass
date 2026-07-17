/**
 * Learner context from RTDB (Admin SDK) — same signals as frontend learner-context.
 */
import { getDb, userPath } from "./firebase.js"

function asRecord(v) {
  return v && typeof v === "object" ? v : {}
}

export async function loadUserContext(uid, limit = 8) {
  const db = getDb()
  const [viewedSnap, scenariosSnap, quizSnap, progressSnap, reviewsSnap, journalSnap] =
    await Promise.all([
      db.ref(userPath(uid, "viewed")).get(),
      db.ref(userPath(uid, "scenarioHistory")).get(),
      db.ref(userPath(uid, "quizResults")).get(),
      db.ref(userPath(uid, "progress")).get(),
      db.ref(userPath(uid, "reviews")).get(),
      db.ref(userPath(uid, "journal", "entries")).get(),
    ])

  const recentViewed = []
  if (viewedSnap.exists()) {
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
        recentViewed.push({ frameworkSlug: fw, conceptId: cid, viewedAt })
      }
    }
    recentViewed.sort(
      (a, b) => new Date(b.viewedAt || 0).getTime() - new Date(a.viewedAt || 0).getTime(),
    )
  }

  const recentScenarios = []
  if (scenariosSnap.exists()) {
    const tree = asRecord(scenariosSnap.val())
    for (const slug of Object.keys(tree)) {
      const attempts = tree[slug]
      if (!attempts || typeof attempts !== "object") continue
      for (const a of Object.values(attempts)) {
        if (!a || typeof a !== "object") continue
        const stages = Array.isArray(a.stages) ? a.stages : []
        recentScenarios.push({
          slug,
          completedAt: String(a.completed_at || a.completedAt || ""),
          stageCount: stages.length,
          stages: stages.slice(0, 8),
        })
      }
    }
    recentScenarios.sort(
      (a, b) =>
        new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime(),
    )
  }

  const quizHighlights = []
  if (quizSnap.exists()) {
    for (const [k, v] of Object.entries(asRecord(quizSnap.val()))) {
      if (!v || typeof v !== "object") continue
      quizHighlights.push({
        framework: String(v.framework_slug || v.framework || k),
        pct: Number(v.pct || v.score || 0),
        at: v.completed_at || v.at,
      })
    }
    quizHighlights.sort((a, b) => b.pct - a.pct)
  }

  const progress = progressSnap.exists() ? asRecord(progressSnap.val()) : {}
  const completedIds = Array.isArray(progress.completed_ids) ? progress.completed_ids : []
  const inProgressId = progress.current_module_id || progress.inProgressId || null

  let dueReviewCount = 0
  const dueReviews = []
  if (reviewsSnap.exists()) {
    const now = Date.now()
    for (const [id, r] of Object.entries(asRecord(reviewsSnap.val()))) {
      if (!r || typeof r !== "object") continue
      const next = r.nextReviewAt ? new Date(r.nextReviewAt).getTime() : 0
      if (next && next <= now) {
        dueReviewCount++
        dueReviews.push({
          conceptId: id,
          conceptSlug: r.conceptSlug || id,
          frameworkSlug: r.frameworkSlug || null,
          nextReviewAt: r.nextReviewAt,
        })
      }
    }
  }

  let journalCount = 0
  const journalOpenOutcomes = []
  if (journalSnap.exists()) {
    const entries = asRecord(journalSnap.val())
    journalCount = Object.keys(entries).length
    const now = new Date()
    for (const [id, e] of Object.entries(entries)) {
      if (!e || typeof e !== "object") continue
      if (e.outcome_captured) continue
      try {
        if (e.review_date && new Date(e.review_date) <= now) {
          journalOpenOutcomes.push({
            id,
            title: e.title || id,
            review_date: e.review_date,
          })
        }
      } catch {
        /* ignore */
      }
    }
  }

  const topViewed = recentViewed.slice(0, limit)
  const topScenarios = recentScenarios.slice(0, limit)
  const topQuiz = quizHighlights.slice(0, 5)

  const promptBlock = [
    "ACCOUNT LEARNING CONTEXT (from RTDB via Agent CLI):",
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
    `Pathway completed modules: [${completedIds.slice(0, 12).join(", ")}] inProgress=${inProgressId || "none"}`,
    `Due spaced reviews: ${dueReviewCount}`,
    `Journal entries: ${journalCount}; open outcomes due: ${journalOpenOutcomes.length}`,
  ].join("\n")

  return {
    uid,
    promptBlock,
    recentViewed: topViewed,
    recentScenarios: topScenarios,
    quizHighlights: topQuiz,
    pathway: { completedIds, inProgressId },
    dueReviewCount,
    dueReviews: dueReviews.slice(0, limit),
    journalCount,
    journalOpenOutcomes: journalOpenOutcomes.slice(0, limit),
  }
}

/** List users that have a users/{uid} node (bounded scan). */
export async function listUsers(max = 50) {
  const db = getDb()
  const snap = await db.ref("users").limitToFirst(max).get()
  if (!snap.exists()) return []
  return Object.keys(snap.val() || {})
}
