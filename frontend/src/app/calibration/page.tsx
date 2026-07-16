"use client"

import { useState, useEffect } from "react"
import { computeCalibration, getCalibrationAdvice, type CalibrationResult } from "@/lib/calibration"
import { canUseFirebasePersistence } from "@/lib/capabilities"
import { PersistenceUnavailableBanner } from "@/components/RequiresBackend"
import { SkeletonCard } from "@/components/SkeletonCard"

export default function CalibrationPage() {
  const [data, setData] = useState<CalibrationResult | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!canUseFirebasePersistence()) { setLoading(false); return }
    computeCalibration()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load calibration"))
      .finally(() => setLoading(false))
  }, [])

  const maxAccuracy = data ? Math.max(...data.buckets.map((b) => b.accuracy), 100) : 100

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-dark-900 dark:text-dark-100">Calibration</h1>
        <p className="mt-2 text-dark-500 dark:text-dark-300">Compare your confidence against actual outcomes to detect overconfidence or underconfidence bias.</p>
      </div>

      <PersistenceUnavailableBanner
        feature="Calibration Dashboard"
        description="Analyzes your journal entries with recorded outcomes to measure decision accuracy vs confidence"
      />

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3">{error}</p>}

      {loading && <SkeletonCard lines={4} />}

      {!loading && !data && canUseFirebasePersistence() && (
        <div className="rounded-xl border border-dark-200 p-8 text-center dark:border-dark-700">
          <p className="text-dark-500 dark:text-dark-300">Not enough data. Record outcomes in the Decision Journal to see your calibration.</p>
        </div>
      )}

      {data && data.entriesUsed === 0 && (
        <div className="rounded-xl border border-dark-200 p-8 text-center dark:border-dark-700">
          <p className="text-dark-500 dark:text-dark-300">No outcomes recorded yet. Log decisions and record outcomes in the Journal to build your calibration.</p>
        </div>
      )}

      {data && data.entriesUsed > 0 && (
        <>
          {/* Overall */}
          <div className="mb-8 rounded-xl bg-primary-50 p-6 text-center dark:bg-primary-900/20">
            <p className="text-4xl font-bold text-primary-600">{data.overall}%</p>
            <p className="text-sm text-primary-700 dark:text-primary-300">Overall accuracy ({data.entriesUsed} decisions)</p>
          </div>

          {/* Advice */}
          <div className="mb-8 rounded-lg border border-primary-200 bg-primary-50 p-4 dark:border-primary-800/40 dark:bg-primary-900/10">
            <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide mb-1 dark:text-primary-300">Insight</p>
            <p className="text-sm text-dark-700 dark:text-dark-300">{getCalibrationAdvice(data.overall, data.buckets)}</p>
          </div>

          {/* Chart */}
          <div className="space-y-4">
            {data.buckets.map((b, i) => (
              <div key={i} className="rounded-xl border border-dark-200 p-4 dark:border-dark-700">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-dark-900 dark:text-dark-100">{b.label}</p>
                    <p className="text-xs text-dark-500 dark:text-dark-400">{b.rightCount}/{b.count} correct</p>
                  </div>
                  <span className={`text-lg font-bold ${b.accuracy >= 70 ? "text-green-600 dark:text-green-400" : b.accuracy >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                    {b.accuracy}%
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-dark-100 dark:bg-dark-800">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(b.accuracy / maxAccuracy) * 100}%`,
                      backgroundColor: b.accuracy >= 70 ? "#22c55e" : b.accuracy >= 40 ? "#f59e0b" : "#ef4444",
                    }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-dark-400 dark:text-dark-500">
                  <span>0%</span>
                  <span>{b.count} decisions</span>
                  <span>{maxAccuracy}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* What this means */}
          <div className="mt-8 rounded-lg border border-dark-200 bg-dark-50 p-4 dark:border-dark-700 dark:bg-dark-900">
            <p className="text-xs font-semibold text-dark-500 uppercase tracking-wide mb-2 dark:text-dark-400">Reading the chart</p>
            <ul className="space-y-1.5 text-xs text-dark-600 dark:text-dark-400">
              <li>• Each bar shows your accuracy within a confidence range.</li>
              <li>• If accuracy &lt; confidence, you&apos;re overconfident (common CEO bias).</li>
              <li>• If accuracy &gt; confidence, you&apos;re underconfident.</li>
              <li>• Goal: accuracy should match confidence (diagonal line at 45°).</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
