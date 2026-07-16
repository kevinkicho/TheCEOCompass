"use client"

import { useState, useEffect } from "react"
import { db, ref, get } from "@/lib/firebase"
import { loadPathwayProgress, buildPathway, loadDueReviews, tryUid, userPath } from "@/lib/firebase-crud"
import { getReviewStatus, getDaysUntilReview, type ReviewRecord } from "@/lib/spaced-repetition"
import { loadFrameworks } from "@/lib/rtdb-cache"
import { canUseFirebasePersistence } from "@/lib/capabilities"
import { PersistenceUnavailableBanner } from "@/components/RequiresBackend"
import { useAuthSession } from "@/lib/AuthSessionProvider"
import { useFeatureFlags } from "@/components/FeatureFlagsProvider"
import { SkeletonCard } from "@/components/SkeletonCard"
import { generateLearningBrief } from "@/lib/ollama"
import type { FrameworkListItem } from "@/lib/types"

export default function WeeklyReviewPage() {
  const { ready: authReady } = useAuthSession()
  const { flags } = useFeatureFlags()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [summary, setSummary] = useState("")
  const [viewedThisWeek, setViewedThisWeek] = useState(0)
  const [quizScores, setQuizScores] = useState<{ pct: number; framework: string; date: string }[]>([])
  const [overdueReviews, setOverdueReviews] = useState(0)
  const [pathwayPct, setPathwayPct] = useState(0)
  const [dueReviews, setDueReviews] = useState<ReviewRecord[]>([])
  const [learningBrief, setLearningBrief] = useState("")
  const [briefLoading, setBriefLoading] = useState(false)
  const srSessionEnabled = flags.sr_session_enabled

  useEffect(() => {
    if (!canUseFirebasePersistence()) { setLoading(false); return }
    if (!authReady) return

    const uid = tryUid()
    if (!db || !uid) { setLoading(false); return }

    const database = db!

    Promise.all([
      get(ref(database, userPath(uid, "viewed"))).then((snap) => {
        if (!snap.exists()) return 0
        const val = snap.val()
        let count = 0
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
        for (const fwSlug of Object.keys(val)) {
          for (const cId of Object.keys(val[fwSlug])) {
            const entry = val[fwSlug][cId]
            if (entry?.viewed_at && new Date(entry.viewed_at).getTime() > oneWeekAgo) count++
          }
        }
        return count
      }),

      get(ref(database, userPath(uid, "quizResults"))).then((snap) => {
        if (!snap.exists()) return []
        const val = snap.val()
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
        return Object.values(val)
          .filter((r: any) => new Date(r.completed_at).getTime() > oneWeekAgo)
          .map((r: any) => ({ pct: r.pct || 0, framework: r.framework_slug || "", date: r.completed_at }))
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }),

      get(ref(database, userPath(uid, "journal", "entries"))).then((snap) => {
        if (!snap.exists()) return 0
        const val = snap.val()
        const now = new Date()
        return Object.values(val).filter((e: any) => {
          if (e.outcome_captured) return false
          try { return new Date(e.review_date) < now } catch { return false }
        }).length
      }),

      loadPathwayProgress().then((p) => {
        return loadFrameworks().then((fw) => {
          const steps = buildPathway(fw as FrameworkListItem[])
          return steps.length > 0 ? Math.round((p.completedIds.length / steps.length) * 100) : 0
        })
      }),

      loadDueReviews(),
    ]).then(([viewed, quizRes, overdue, pathway, dueRev]) => {
      setViewedThisWeek(viewed as number)
      setQuizScores(quizRes as { pct: number; framework: string; date: string }[])
      setOverdueReviews(overdue as number)
      setPathwayPct(pathway as number)
      setDueReviews((dueRev as ReviewRecord[]) || [])

      const total = (quizRes as any[]).length > 0
        ? Math.round((quizRes as any[]).reduce((s: number, r: any) => s + r.pct, 0) / (quizRes as any[]).length)
        : 0
      const summaryParts = [`This week you explored ${viewed} concept pages.`]
      if ((quizRes as any[]).length > 0) summaryParts.push(`Completed ${(quizRes as any[]).length} quiz with average score ${total}%.`)
      if ((overdue as number) > 0) summaryParts.push(`${overdue} decision${(overdue as number) === 1 ? " is" : "s are"} overdue for review in your journal.`)
      summaryParts.push(`Learning pathway: ${pathway}% complete.`)
      if ((dueRev as ReviewRecord[]).length > 0) summaryParts.push(`${(dueRev as ReviewRecord[]).length} concept${(dueRev as ReviewRecord[]).length === 1 ? " is" : "s are"} due for spaced repetition review.`)
      if (viewed === 0 && (quizRes as any[]).length === 0 && overdue === 0 && (dueRev as ReviewRecord[]).length === 0) {
        summaryParts.push("No activity this week. Start by exploring a framework or taking a quiz.")
      }
      setSummary(summaryParts.join(" "))
    }).catch((err) => {
      setError(err.message || "Failed to load review data")
    }).finally(() => setLoading(false))
  }, [authReady])

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-dark-900 dark:text-dark-100">Weekly Review</h1>
        <p className="mt-2 text-dark-500 dark:text-dark-300">Your learning activity and progress snapshot.</p>
      </div>

      <PersistenceUnavailableBanner
        feature="Weekly Review"
        description="Aggregates your concepts viewed, quiz scores, journal reviews, and pathway progress"
      />

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3">{error}</p>}
      {loading && <SkeletonCard lines={4} />}

      {!loading && canUseFirebasePersistence() && (
        <>
          {/* AI Learning Brief */}
          <div className="mb-6 rounded-xl border border-violet-200 dark:border-violet-800/40 bg-violet-50 dark:bg-violet-900/10 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">AI Learning Brief</p>
              <button
                onClick={async () => {
                  if (briefLoading) return
                  setBriefLoading(true)
                  try {
                    const frameworksViewed: string[] = []
                    const database = db!
                    const uid = tryUid()
                    if (uid) {
                      const viewedSnap = await get(ref(database, userPath(uid, "viewed")))
                      if (viewedSnap.exists()) {
                        for (const fwSlug of Object.keys(viewedSnap.val())) {
                          frameworksViewed.push(fwSlug)
                        }
                      }
                    }
                    const avg = quizScores.length > 0 ? Math.round(quizScores.reduce((s, r) => s + r.pct, 0) / quizScores.length) : 0
                    const brief = await generateLearningBrief({
                      viewedCount: viewedThisWeek,
                      frameworksViewed,
                      quizScores: quizScores.map(q => ({ framework: q.framework, pct: q.pct })),
                      avgQuizPct: avg,
                      overdueJournals: overdueReviews,
                      dueReviewsCount: dueReviews.length,
                      pathwayPct,
                    })
                    setLearningBrief(brief)
                  } catch {}
                  setBriefLoading(false)
                }}
                disabled={briefLoading}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-violet-700 transition disabled:opacity-50"
              >{briefLoading ? "Generating..." : learningBrief ? "Regenerate" : "Generate Brief"}</button>
            </div>
            {learningBrief && (
              <p className="text-sm text-dark-700 dark:text-dark-300 leading-relaxed">{learningBrief}</p>
            )}
          </div>

          {/* Summary */}
          <div className="mb-8 rounded-xl bg-primary-50 p-6 dark:bg-primary-900/20">
            <p className="text-sm text-dark-700 dark:text-dark-300 leading-relaxed">{summary}</p>
          </div>

          {/* Stats grid */}
          <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-dark-200 dark:border-dark-700 p-4 text-center">
              <p className="text-2xl font-bold text-primary-600">{viewedThisWeek}</p>
              <p className="text-xs text-dark-500 dark:text-dark-400">Concepts viewed</p>
            </div>
            <div className="rounded-xl border border-dark-200 dark:border-dark-700 p-4 text-center">
              <p className="text-2xl font-bold text-primary-600">{quizScores.length}</p>
              <p className="text-xs text-dark-500 dark:text-dark-400">Quizzes taken</p>
            </div>
            <div className="rounded-xl border border-dark-200 dark:border-dark-700 p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{overdueReviews}</p>
              <p className="text-xs text-dark-500 dark:text-dark-400">Overdue reviews</p>
            </div>
            <div className="rounded-xl border border-dark-200 dark:border-dark-700 p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{pathwayPct}%</p>
              <p className="text-xs text-dark-500 dark:text-dark-400">Pathway complete</p>
            </div>
          </div>

          {/* Quiz scores */}
          {quizScores.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-3 text-sm font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wide">Recent Quiz Scores</h2>
              <div className="space-y-2">
                {quizScores.map((q, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-dark-200 dark:border-dark-700 p-3">
                    <div>
                      <p className="text-xs font-medium text-dark-700 dark:text-dark-300">{q.framework}</p>
                      <p className="text-[10px] text-dark-400 dark:text-dark-500">{new Date(q.date).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-sm font-bold ${q.pct >= 80 ? "text-green-600" : q.pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                      {q.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Concepts Due for Review (Spaced Repetition) */}
          {dueReviews.length > 0 && (
            <div className="mb-8">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wide">
                  Concepts Due for Review
                </h2>
                {srSessionEnabled && (
                  <a
                    href="/review/session"
                    data-testid="start-review-session"
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-amber-700 transition shrink-0"
                  >
                    Start review session
                  </a>
                )}
              </div>
              <div className="space-y-2">
                {dueReviews.map((r, i) => (
                  <a key={i} href={`/frameworks/${r.frameworkSlug}/${r.conceptSlug}`}
                    className="flex items-center justify-between rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10 p-3 hover:border-amber-300 dark:hover:border-amber-700 transition cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-medium text-dark-700 dark:text-dark-300">{r.conceptName}</p>
                      <p className="text-[10px] text-dark-400 dark:text-dark-500">
                        {r.reviewCount} review{r.reviewCount === 1 ? "" : "s"} | interval: {r.interval}d
                      </p>
                    </div>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      {getReviewStatus(r.nextReviewAt) === "overdue"
                        ? `${Math.abs(getDaysUntilReview(r.nextReviewAt))}d overdue`
                        : "Due today"}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Session CTA when flag on but no due list header (0 due still can open session for empty state) */}
          {srSessionEnabled && dueReviews.length === 0 && (
            <div className="mb-8 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10 p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Spaced repetition session</p>
                <p className="text-[11px] text-dark-500 dark:text-dark-400 mt-0.5">
                  Keyboard-driven reviews (1–4) when concepts are due.
                </p>
              </div>
              <a
                href="/review/session"
                data-testid="start-review-session"
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-amber-700 transition shrink-0"
              >
                Start review session
              </a>
            </div>
          )}

          {/* Quick actions */}
          <div className="rounded-xl border border-dark-200 dark:border-dark-700 p-5">
            <h2 className="mb-3 text-sm font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wide">Quick Actions</h2>
            <div className="flex flex-wrap gap-2">
              {srSessionEnabled && (
                <a
                  href="/review/session"
                  className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-700 transition"
                >
                  Review session
                </a>
              )}
              <a href="/frameworks" className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-700 transition">Explore frameworks</a>
              <a href="/quiz" className="rounded-lg border border-primary-300 dark:border-primary-700 px-4 py-2 text-xs font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition">Take a quiz</a>
              <a href="/journal" className="rounded-lg border border-dark-300 dark:border-dark-600 px-4 py-2 text-xs font-medium text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-800 transition">Review journal</a>
              <a href="/pathway" className="rounded-lg border border-dark-300 dark:border-dark-600 px-4 py-2 text-xs font-medium text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-800 transition">Continue pathway</a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
