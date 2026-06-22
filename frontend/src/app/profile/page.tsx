"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { getProgress, getCalibration, getJournalEntries, getFrameworks } from "@/lib/api"
import type { Progress, CalibrationSummary, JournalEntry, FrameworkListItem } from "@/lib/types"
import { useSettings } from "@/lib/settings"
import { useAuth } from "@/lib/useAuth"
import { SkeletonCard } from "@/components/SkeletonCard"

export default function ProfilePage() {
  const router = useRouter()
  const { user, isAdmin, loading: authLoading, signInWithGoogle, signOut } = useAuth()
  const [progress, setProgress] = useState<Progress | null>(null)
  const [calibration, setCalibration] = useState<CalibrationSummary | null>(null)
  const [journalCount, setJournalCount] = useState(0)
  const [frameworks, setFrameworks] = useState<FrameworkListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { settings, setSettings, loaded } = useSettings()

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
        <p className="text-dark-500 dark:text-dark-300">Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="mb-8 text-4xl font-bold text-dark-900 dark:text-dark-100">Your Progress</h1>

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
        <div className="mb-8 rounded-xl border border-dark-200 p-6 dark:border-dark-700">
          <h2 className="mb-4 text-xl font-semibold text-dark-900 dark:text-dark-100">Calibration</h2>
          <div className="mb-4 grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-dark-50 p-4 text-center dark:bg-dark-900">
              <p className="text-2xl font-bold text-dark-900 dark:text-dark-100">{Math.round(calibration.accuracy * 100)}%</p>
              <p className="text-xs text-dark-500 dark:text-dark-300">Accuracy</p>
            </div>
            <div className="rounded-lg bg-dark-50 p-4 text-center dark:bg-dark-900">
              <p className="text-2xl font-bold text-dark-900 dark:text-dark-100">{Math.round(calibration.average_confidence * 100)}%</p>
              <p className="text-xs text-dark-500 dark:text-dark-300">Avg Confidence</p>
            </div>
            <div className="rounded-lg bg-dark-50 p-4 text-center dark:bg-dark-900">
              <p className="text-2xl font-bold text-dark-900 dark:text-dark-100">{calibration.average_brier_score.toFixed(2)}</p>
              <p className="text-xs text-dark-500 dark:text-dark-300">Brier Score</p>
            </div>
          </div>
          
          {Object.keys(calibration.calibration_by_confidence).length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-dark-700 dark:text-dark-300">By Confidence Level</h3>
              <div className="space-y-2">
                {Object.entries(calibration.calibration_by_confidence).map(([bucket, data]) => (
                  <div key={bucket} className="flex items-center gap-3 text-sm">
                    <span className="w-16 text-dark-500 dark:text-dark-300">{bucket}</span>
                    <div className="flex-1 h-5 flex rounded-full overflow-hidden bg-dark-100 dark:bg-dark-800">
                      <div
                        className="bg-primary-500 transition-all"
                        style={{ width: `${data.accuracy * 100}%` }}
                      />
                      <div className="bg-dark-200 transition-all dark:bg-dark-700" style={{ width: `${(1 - data.accuracy) * 100}%` }} />
                    </div>
                    <span className="w-10 text-right text-dark-600 dark:text-dark-300">{Math.round(data.accuracy * 100)}%</span>
                    <span className="w-8 text-right text-dark-400 dark:text-dark-300">n={data.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {calibration.trend.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold text-dark-700 dark:text-dark-300">Trend</h3>
              <div className="flex items-end gap-2 h-24">
                {calibration.trend.map((point) => (
                  <div key={point.month} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-primary-500 transition-all" style={{ height: `${point.accuracy * 100}%` }} />
                    <span className="text-[10px] text-dark-400 dark:text-dark-300">{point.month.slice(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Framework Mastery */}
      <div className="mb-8 rounded-xl border border-dark-200 p-6 dark:border-dark-700">
        <h2 className="mb-4 text-xl font-semibold text-dark-900 dark:text-dark-100">Framework Mastery</h2>
        <div className="space-y-3">
          {frameworks.map((fw) => {
            const mastery = (progress?.framework_mastery?.[fw.id] ?? 0) * 100
            return (
              <div key={fw.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <button
                    onClick={() => router.push(`/frameworks/${fw.slug}`)}
                    className="font-medium text-dark-700 hover:text-primary-600 dark:text-dark-300"
                  >
                    {fw.title}
                  </button>
                  <span className="text-dark-500 dark:text-dark-300">{Math.round(mastery)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-dark-100 dark:bg-dark-800">
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
          className="rounded-xl border border-primary-200 bg-primary-50 p-5 text-left hover:bg-primary-100 transition dark:bg-primary-900/20 dark:hover:bg-primary-900/30 dark:border-primary-800/40"
        >
          <h3 className="font-semibold text-primary-900 dark:text-primary-200">Scenarios</h3>
          <p className="text-sm text-primary-700 dark:text-primary-300">Practice CEO decision-making</p>
        </button>
        <button
          onClick={() => router.push("/journal")}
          className="rounded-xl border border-dark-200 p-5 text-left hover:bg-dark-50 transition dark:hover:bg-dark-800 dark:border-dark-700"
        >
          <h3 className="font-semibold text-dark-900 dark:text-dark-100">Decision Journal</h3>
          <p className="text-sm text-dark-500 dark:text-dark-300">Review your decisions and calibrate</p>
        </button>
        <button
          onClick={() => router.push("/pathway")}
          className="rounded-xl border border-dark-200 p-5 text-left hover:bg-dark-50 transition dark:hover:bg-dark-800 dark:border-dark-700"
        >
          <h3 className="font-semibold text-dark-900 dark:text-dark-100">Learning Pathway</h3>
          <p className="text-sm text-dark-500 dark:text-dark-300">Follow the structured curriculum</p>
        </button>
      </div>

      {/* Settings */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-dark-900 dark:text-dark-100">AI Settings</h2>
        <div className="rounded-xl border border-dark-200 dark:border-dark-700 p-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300">Ollama Model</label>
            <input
              type="text"
              value={settings.ollamaModel}
              onChange={(e) => setSettings({ ...settings, ollamaModel: e.target.value })}
              className="w-full rounded-lg border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-900 px-4 py-2 text-sm text-dark-900 dark:text-dark-100 focus:border-primary-400 focus:outline-none"
              placeholder="gemma4:latest"
            />
            <p className="mt-1 text-xs text-dark-500 dark:text-dark-400">Model name to use with Ollama (e.g. gemma4:latest, llama3, mistral).</p>
          </div>
          <div className="rounded-lg bg-primary-50 dark:bg-primary-900/10 p-3">
            <p className="text-xs text-primary-700 dark:text-primary-300">
              AI requests go through Firebase RTDB. Run the local agent in WSL: <code className="font-mono bg-primary-100 dark:bg-primary-900/30 px-1 rounded">cd agent && node index.js</code>
            </p>
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-dark-900 dark:text-dark-100">Account</h2>
        <div className="rounded-xl border border-dark-200 dark:border-dark-700 p-5 space-y-4">
          {authLoading ? (
            <SkeletonCard lines={2} className="border-0 p-0" />
          ) : user ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {user.photoURL && <Image src={user.photoURL} alt="" width={40} height={40} className="h-10 w-10 rounded-full" unoptimized />}
                <div>
                  <p className="text-sm font-medium text-dark-900 dark:text-dark-100">{user.displayName || user.email}</p>
                  <p className="text-xs text-dark-500 dark:text-dark-400">
                    {isAdmin ? "Admin" : "Signed in"} {user.isAnonymous ? "(anonymous)" : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={signOut}
                className="rounded-lg border border-dark-200 dark:border-dark-700 px-4 py-2 text-sm text-dark-600 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-800 transition"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-dark-500 dark:text-dark-400">Sign in with Google to edit AI prompts.</p>
              <button
                onClick={signInWithGoogle}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-dark-200 dark:border-dark-700 px-4 py-2.5 text-sm font-medium text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-800 transition"
              >
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Sign in with Google
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatsCard({ label, value, subtitle }: { label: string; value: string | number; subtitle: string }) {
  return (
    <div className="rounded-xl border border-dark-200 p-5 text-center dark:border-dark-700">
      <p className="text-3xl font-bold text-dark-900 dark:text-dark-100">{value}</p>
      <p className="text-sm font-medium text-dark-700 dark:text-dark-300">{label}</p>
      {subtitle && <p className="text-xs text-dark-500 dark:text-dark-300">{subtitle}</p>}
    </div>
  )
}