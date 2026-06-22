"use client"

import { useState, useEffect } from "react"
import { db, ref, get } from "@/lib/firebase"
import { loadPathwayProgress, buildPathway, getDeviceId } from "@/lib/firebase-crud"
import { getFrameworks } from "@/lib/api"
import { isStaticHosting, StaticHostingBanner } from "@/components/RequiresBackend"
import { SkeletonCard } from "@/components/SkeletonCard"
import type { FrameworkListItem } from "@/lib/types"

export default function WeeklyReviewPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [summary, setSummary] = useState("")
  const [viewedThisWeek, setViewedThisWeek] = useState(0)
  const [quizScores, setQuizScores] = useState<{ pct: number; framework: string; date: string }[]>([])
  const [overdueReviews, setOverdueReviews] = useState(0)
  const [pathwayPct, setPathwayPct] = useState(0)

  useEffect(() => {
    if (isStaticHosting) { setLoading(false); return }

    const deviceId = getDeviceId()
    if (!db || !deviceId) { setLoading(false); return }

    const database = db!

    Promise.all([
      // Viewed concepts this week
      get(ref(database, `viewed/${deviceId}`)).then((snap) => {
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

      // Quiz results
      get(ref(database, `quizResults/${deviceId}`)).then((snap) => {
        if (!snap.exists()) return []
        const val = snap.val()
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
        return Object.values(val)
          .filter((r: any) => new Date(r.completed_at).getTime() > oneWeekAgo)
          .map((r: any) => ({ pct: r.pct || 0, framework: r.framework_slug || "", date: r.completed_at }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }),

      // Journal entries due
      get(ref(database, `journal/${deviceId}/entries`)).then((snap) => {
        if (!snap.exists()) return 0
        const val = snap.val()
        const now = new Date()
        return Object.values(val).filter((e: any) => {
          if (e.outcome_captured) return false
          try { return new Date(e.review_date) < now } catch { return false }
        }).length
      }),

      // Pathway progress
      loadPathwayProgress().then((p) => {
        return getFrameworks().then((fw) => {
          const steps = buildPathway(fw)
          return steps.length > 0 ? Math.round((p.completedIds.length / steps.length) * 100) : 0
        })
      }),
    ]).then(([viewed, quizRes, overdue, pathway]) => {
      setViewedThisWeek(viewed as number)
      setQuizScores(quizRes as { pct: number; framework: string; date: string }[])
      setOverdueReviews(overdue as number)
      setPathwayPct(pathway as number)

      // Generate summary
      const total = quizRes.length > 0
        ? Math.round((quizRes as any[]).reduce((s: number, r: any) => s + r.pct, 0) / (quizRes as any[]).length)
        : 0
      const summaryParts = [`This week you explored ${viewed} concept pages.`]
      if (quizRes.length > 0) summaryParts.push(`Completed ${quizRes.length} quiz with average score ${total}%.`)
      if (overdue > 0) summaryParts.push(`${overdue} decision${overdue === 1 ? " is" : "s are"} overdue for review in your journal.`)
      summaryParts.push(`Learning pathway: ${pathway}% complete.`)
      if (viewed === 0 && quizRes.length === 0 && overdue === 0) {
        summaryParts.push("No activity this week. Start by exploring a framework or taking a quiz.")
      }
      setSummary(summaryParts.join(" "))
    }).catch((err) => {
      setError(err.message || "Failed to load review data")
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-dark-900 dark:text-dark-100">Weekly Review</h1>
        <p className="mt-2 text-dark-500 dark:text-dark-300">Your learning activity and progress snapshot.</p>
      </div>

      <StaticHostingBanner
        feature="Weekly Review"
        description="Aggregates your concepts viewed, quiz scores, journal reviews, and pathway progress"
      />

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3">{error}</p>}
      {loading && <SkeletonCard lines={4} />}

      {!loading && !isStaticHosting && (
        <>
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

          {/* Quick actions */}
          <div className="rounded-xl border border-dark-200 dark:border-dark-700 p-5">
            <h2 className="mb-3 text-sm font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wide">Quick Actions</h2>
            <div className="flex flex-wrap gap-2">
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
