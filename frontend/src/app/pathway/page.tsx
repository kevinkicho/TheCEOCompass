"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { loadFrameworks } from "@/lib/rtdb-cache"
import { loadPathwayProgress, markPathwayComplete, buildPathway } from "@/lib/firebase-crud"
import { isStaticHosting, StaticHostingBanner } from "@/components/RequiresBackend"
import type { FrameworkListItem } from "@/lib/types"

export default function PathwayPage() {
  const router = useRouter()
  const [pathwaySteps, setPathwaySteps] = useState<FrameworkListItem[]>([])
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [inProgressId, setInProgressId] = useState<string | null>(null)
  const [pathwayError, setPathwayError] = useState("")

  useEffect(() => {
    loadFrameworks()
      .then((fw) => {
        if (fw.length > 0) setPathwaySteps(buildPathway(fw as FrameworkListItem[]))
      })
      .catch(() => setPathwayError("Failed to load frameworks"))

    if (!isStaticHosting) {
      loadPathwayProgress()
        .then((progress) => {
          setCompletedIds(progress.completedIds)
          setInProgressId(progress.inProgressId)
        })
        .catch(() => {})
    }
  }, [])

  const handleMarkComplete = async (slug: string) => {
    if (isStaticHosting) return
    setPathwayError("")
    try {
      await markPathwayComplete(slug)
      setCompletedIds((prev) => prev.includes(slug) ? prev : [...prev, slug])
    } catch (err) {
      setPathwayError(err instanceof Error ? err.message : "Failed to update progress")
    }
  }

  const total = pathwaySteps.length
  const completed = completedIds.length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  const getStepStatus = (slug: string) => {
    if (completedIds.includes(slug)) return "completed"
    if (inProgressId === slug) return "in-progress"
    return "locked"
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-dark-900 dark:text-dark-100">Learning Pathway</h1>
        <p className="mt-2 text-dark-500 dark:text-dark-300">Structured curriculum from strategic thinking to crisis management.</p>
      </div>

      <StaticHostingBanner
        feature="Persistent Progress Tracking"
        description="Track completed modules and save your learning progress across sessions"
      />

      {pathwayError && !isStaticHosting && <p className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3">{pathwayError}</p>}

      {/* Progress Summary */}
      <div className="mb-8 rounded-xl bg-primary-50 p-6 dark:bg-primary-900/20">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-3xl font-bold text-primary-600">{completed}</p>
            <p className="text-sm text-primary-700 dark:text-primary-300">Completed</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-primary-600">{total - completed}</p>
            <p className="text-sm text-primary-700 dark:text-primary-300">Remaining</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-primary-600">{pct}%</p>
            <p className="text-sm text-primary-700 dark:text-primary-300">Progress</p>
          </div>
        </div>
        <div className="mt-4 h-2 w-full rounded-full bg-primary-100 dark:bg-primary-900/30">
          <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Pathway Steps */}
      <div className="space-y-4">
        {pathwaySteps.map((step, index) => {
          const status = getStepStatus(step.slug)
          const prevCompleted = index === 0 || completedIds.includes(pathwaySteps[index - 1]?.slug)
          const isAvailable = prevCompleted || status === "completed"

          return (
            <div
              key={step.slug}
              className={`rounded-xl border p-5 transition ${isAvailable ? "border-dark-200 bg-white dark:bg-dark-900 dark:border-dark-700" : "border-dark-100 bg-dark-50 opacity-60 dark:bg-dark-900 dark:border-dark-800"}`}
            >
              <div className="flex items-center gap-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${status === "completed" ? "bg-green-500 text-white" : status === "in-progress" ? "bg-primary-500 text-white" : isAvailable ? "bg-dark-100 text-dark-600 dark:bg-dark-800 dark:text-dark-300" : "bg-dark-100 text-dark-300 dark:bg-dark-800 dark:text-dark-500"}`}>
                  {status === "completed" ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (index + 1)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-semibold ${isAvailable ? "text-dark-900 dark:text-dark-100" : "text-dark-400 dark:text-dark-300"}`}>{step.title}</h3>
                    <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{step.category}</span>
                    <span className="text-[10px] text-dark-400 dark:text-dark-500">Difficulty: {step.difficulty}/5</span>
                  </div>
                  <p className="mt-1 text-sm text-dark-500 dark:text-dark-300">{step.description}</p>
                </div>

                <div className="flex gap-2 shrink-0">
                  {isAvailable && (
                    <button
                      onClick={() => router.push(`/frameworks/${step.slug}`)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${status === "completed" ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-primary-600 text-white hover:bg-primary-700"}`}
                    >
                      {status === "completed" ? "Review" : "Start"}
                    </button>
                  )}
                  {isAvailable && (
                    <button
                      onClick={() => handleMarkComplete(step.slug)}
                      className={`rounded-lg px-3 py-2 text-xs font-medium transition ${completedIds.includes(step.slug) ? "bg-green-100 text-green-600" : "border border-dark-200 dark:border-dark-700 text-dark-500 hover:text-dark-700 dark:hover:text-dark-300"}`}
                    >
                      {completedIds.includes(step.slug) ? "Done" : "Mark done"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
