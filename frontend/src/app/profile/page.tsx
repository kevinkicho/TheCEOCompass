"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getProgress, getCalibration, getJournalEntries, getFrameworks } from "@/lib/api"
import type { Progress, CalibrationSummary, JournalEntry, FrameworkListItem } from "@/lib/types"

export default function ProfilePage() {
  const router = useRouter()
  const [progress, setProgress] = useState<Progress | null>(null)
  const [calibration, setCalibration] = useState<CalibrationSummary | null>(null)
  const [journalCount, setJournalCount] = useState(0)
  const [frameworks, setFrameworks] = useState<FrameworkListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getProgress(),
      getCalibration(),
      getJournalEntries(),
      getFrameworks(),
    ])
      .then(([p, c, entries, f]) => {
        setProgress(p)
        setCalibration(c)
        setJournalCount(entries.length)
        setFrameworks(f)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <p className="text-dark-500">Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="mb-8 text-4xl font-bold text-dark-900">Your Progress</h1>

      {/* Key Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="Scenarios Done"
          value={progress?.scenarios_completed ?? 0}
          subtitle={progress ? `${progress.scenarios_in_progress} in progress` : ""}
        />
        <StatsCard
          label="Avg Score"
          value={`${Math.round((progress?.average_scenario_score ?? 0) * 100)}%`}
          subtitle={`${Math.round((progress?.total_scenario_score ?? 0) * 100)} total`}
        />
        <StatsCard
          label="Decisions Logged"
          value={journalCount}
          subtitle={calibration ? `${calibration.total_predictions} reviewed` : "0 reviewed"}
        />
        <StatsCard
          label="Streak"
          value={`${progress?.current_streak_days ?? 0}d`}
          subtitle={progress ? `Best: ${progress.longest_streak_days}d` : ""}
        />
      </div>

      {/* Calibration Chart */}
      {calibration && calibration.total_predictions > 0 && (
        <div className="mb-8 rounded-xl border border-dark-200 p-6">
          <h2 className="mb-4 text-xl font-semibold text-dark-900">Calibration</h2>
          <div className="mb-4 grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-dark-50 p-4 text-center">
              <p className="text-2xl font-bold text-dark-900">{Math.round(calibration.accuracy * 100)}%</p>
              <p className="text-xs text-dark-500">Accuracy</p>
            </div>
            <div className="rounded-lg bg-dark-50 p-4 text-center">
              <p className="text-2xl font-bold text-dark-900">{Math.round(calibration.average_confidence * 100)}%</p>
              <p className="text-xs text-dark-500">Avg Confidence</p>
            </div>
            <div className="rounded-lg bg-dark-50 p-4 text-center">
              <p className="text-2xl font-bold text-dark-900">{calibration.average_brier_score.toFixed(2)}</p>
              <p className="text-xs text-dark-500">Brier Score</p>
            </div>
          </div>
          
          {Object.keys(calibration.calibration_by_confidence).length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-dark-700">By Confidence Level</h3>
              <div className="space-y-2">
                {Object.entries(calibration.calibration_by_confidence).map(([bucket, data]) => (
                  <div key={bucket} className="flex items-center gap-3 text-sm">
                    <span className="w-16 text-dark-500">{bucket}</span>
                    <div className="flex-1 h-5 flex rounded-full overflow-hidden bg-dark-100">
                      <div
                        className="bg-primary-500 transition-all"
                        style={{ width: `${data.accuracy * 100}%` }}
                      />
                      <div className="bg-dark-200 transition-all" style={{ width: `${(1 - data.accuracy) * 100}%` }} />
                    </div>
                    <span className="w-10 text-right text-dark-600">{Math.round(data.accuracy * 100)}%</span>
                    <span className="w-8 text-right text-dark-400">n={data.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {calibration.trend.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold text-dark-700">Trend</h3>
              <div className="flex items-end gap-2 h-24">
                {calibration.trend.map((point) => (
                  <div key={point.month} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-primary-500 transition-all" style={{ height: `${point.accuracy * 100}%` }} />
                    <span className="text-[10px] text-dark-400">{point.month.slice(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Framework Mastery */}
      <div className="mb-8 rounded-xl border border-dark-200 p-6">
        <h2 className="mb-4 text-xl font-semibold text-dark-900">Framework Mastery</h2>
        <div className="space-y-3">
          {frameworks.map((fw) => {
            const mastery = (progress?.framework_mastery?.[fw.id] ?? 0) * 100
            return (
              <div key={fw.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <button
                    onClick={() => router.push(`/frameworks/${fw.slug}`)}
                    className="font-medium text-dark-700 hover:text-primary-600"
                  >
                    {fw.title}
                  </button>
                  <span className="text-dark-500">{Math.round(mastery)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-dark-100">
                  <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${mastery}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 sm:grid-cols-3">
        <button
          onClick={() => router.push("/scenarios")}
          className="rounded-xl border border-primary-200 bg-primary-50 p-5 text-left hover:bg-primary-100 transition"
        >
          <h3 className="font-semibold text-primary-900">Scenarios</h3>
          <p className="text-sm text-primary-700">Practice CEO decision-making</p>
        </button>
        <button
          onClick={() => router.push("/journal")}
          className="rounded-xl border border-dark-200 p-5 text-left hover:bg-dark-50 transition"
        >
          <h3 className="font-semibold text-dark-900">Decision Journal</h3>
          <p className="text-sm text-dark-500">Review your decisions and calibrate</p>
        </button>
        <button
          onClick={() => router.push("/pathway")}
          className="rounded-xl border border-dark-200 p-5 text-left hover:bg-dark-50 transition"
        >
          <h3 className="font-semibold text-dark-900">Learning Pathway</h3>
          <p className="text-sm text-dark-500">Follow the structured curriculum</p>
        </button>
      </div>
    </div>
  )
}

function StatsCard({ label, value, subtitle }: { label: string; value: string | number; subtitle: string }) {
  return (
    <div className="rounded-xl border border-dark-200 p-5 text-center">
      <p className="text-3xl font-bold text-dark-900">{value}</p>
      <p className="text-sm font-medium text-dark-700">{label}</p>
      {subtitle && <p className="text-xs text-dark-500">{subtitle}</p>}
    </div>
  )
}