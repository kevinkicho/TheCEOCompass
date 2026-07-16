"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { getProgress, getCalibration, getJournalEntries } from "@/lib/api"
import { loadFrameworks } from "@/lib/rtdb-cache"
import type { Progress, CalibrationSummary, JournalEntry, FrameworkListItem } from "@/lib/types"
import { useSettings } from "@/lib/settings"
import { useAuth } from "@/lib/useAuth"
import { SkeletonCard } from "@/components/SkeletonCard"
import { db, ref, get } from "@/lib/firebase"
import { getDeviceId } from "@/lib/firebase-crud"
import { analyzeBlindSpots, type BlindSpotReport } from "@/lib/ollama"
import { canUseFirebasePersistence } from "@/lib/capabilities"

export default function ProfilePage() {
  const router = useRouter()
  const { user, isAdmin, loading: authLoading, signInWithGoogle, signOut } = useAuth()
  const [progress, setProgress] = useState<Progress | null>(null)
  const [calibration, setCalibration] = useState<CalibrationSummary | null>(null)
  const [journalCount, setJournalCount] = useState(0)
  const [frameworks, setFrameworks] = useState<FrameworkListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { settings, setSettings, loaded } = useSettings()

  // Blind spot analysis
  const [blindSpotReport, setBlindSpotReport] = useState<BlindSpotReport | null>(null)
  const [blindSpotLoading, setBlindSpotLoading] = useState(false)
  const [blindSpotError, setBlindSpotError] = useState("")

  useEffect(() => {
    Promise.all([
      getProgress(),
      getCalibration(),
      getJournalEntries(),
      loadFrameworks() as Promise<FrameworkListItem[]>,
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

      {/* Blind Spot Analysis */}
      {canUseFirebasePersistence() && (
        <div className="mb-8 rounded-xl border border-dark-200 p-6 dark:border-dark-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-dark-900 dark:text-dark-100">Blind Spot Analysis</h2>
              <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">AI identifies gaps in your learning patterns across frameworks, quizzes, and journals</p>
            </div>
            <button
              onClick={async () => {
                if (blindSpotLoading) return
                setBlindSpotLoading(true); setBlindSpotError(""); setBlindSpotReport(null)
                try {
                  if (!db) { throw new Error("Firebase not configured") }
                  const deviceId = getDeviceId()
                  const database = db!
                  const [viewedSnap, reviewsSnap, quizSnap, journalSnap, progressSnap] = await Promise.all([
                    get(ref(database, `viewed/${deviceId}`)).catch(() => ({ exists: () => false, val: () => null })),
                    get(ref(database, `reviews/${deviceId}`)).catch(() => ({ exists: () => false, val: () => null })),
                    get(ref(database, `quizResults/${deviceId}`)).catch(() => ({ exists: () => false, val: () => null })),
                    get(ref(database, `journal/${deviceId}/entries`)).catch(() => ({ exists: () => false, val: () => null })),
                    get(ref(database, `progress/${deviceId}`)).catch(() => ({ exists: () => false, val: () => null })),
                  ])

                  const viewedFrameworks = viewedSnap.exists() ? Object.keys(viewedSnap.val()) : []
                  const reviewedConcepts = reviewsSnap.exists() ? Object.keys(reviewsSnap.val()) : []
                  const quizResults = quizSnap.exists()
                    ? Object.values(quizSnap.val() as any).map((r: any) => ({ framework: r.framework_slug || "", pct: r.pct || 0 }))
                    : []
                  const journalEntries = journalSnap.exists() ? Object.keys(journalSnap.val()).length : 0
                  const completedPathways = progressSnap.exists() ? (progressSnap.val().completed_ids || []) : []

                  const report = await analyzeBlindSpots({ viewedFrameworks, reviewedConcepts, quizResults, journalEntries, completedPathways })
                  setBlindSpotReport(report)
                } catch (err: any) {
                  setBlindSpotError(err.message || "Analysis failed")
                }
                setBlindSpotLoading(false)
              }}
              disabled={blindSpotLoading}
              className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-700 transition disabled:opacity-50 shrink-0"
            >{blindSpotLoading ? "Analyzing..." : "Run Analysis"}</button>
          </div>

          {blindSpotError && <p className="mb-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{blindSpotError}</p>}

          {blindSpotReport && (
            <div className="space-y-3 animate-slide-up">
              <div className="rounded-lg bg-primary-50 dark:bg-primary-900/20 p-3">
                <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wide mb-1">Summary</p>
                <p className="text-sm text-dark-700 dark:text-dark-300">{blindSpotReport.summary}</p>
              </div>

              {blindSpotReport.gaps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wide">Gaps</p>
                  {blindSpotReport.gaps.map((g, i) => (
                    <div key={i} className={`rounded-lg border p-3 ${g.severity === "high" ? "border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10" : g.severity === "medium" ? "border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10" : "border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-800"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-dark-700 dark:text-dark-300">{g.area}</p>
                        <span className={`text-[10px] font-medium uppercase ${g.severity === "high" ? "text-red-600" : g.severity === "medium" ? "text-amber-600" : "text-dark-400"}`}>{g.severity}</span>
                      </div>
                      <p className="text-xs text-dark-500 dark:text-dark-400">{g.recommendation}</p>
                    </div>
                  ))}
                </div>
              )}

              {blindSpotReport.strengths.length > 0 && (
                <div className="rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/40 p-3">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide mb-1">Strengths</p>
                  <ul className="space-y-1">
                    {blindSpotReport.strengths.map((s, i) => (
                      <li key={i} className="text-xs text-dark-600 dark:text-dark-400">• {s}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/40 p-3">
                <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-1">Recommended Next Focus</p>
                <p className="text-sm text-dark-700 dark:text-dark-300">{blindSpotReport.next_focus}</p>
              </div>
            </div>
          )}
        </div>
      )}

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
          {/* Local AI Mode Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-dark-700 dark:text-dark-300">Local AI Mode</label>
              <p className="text-xs text-dark-500 dark:text-dark-400">Call Ollama directly from your browser (no Firebase/agent needed)</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, localAiMode: !settings.localAiMode })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.localAiMode ? "bg-primary-600" : "bg-dark-300 dark:bg-dark-600"
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.localAiMode ? "translate-x-6" : "translate-x-1"
              }`} />
            </button>
          </div>

          {settings.localAiMode && (
            <div className="rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/40 p-3 space-y-2">
              <p className="text-xs text-green-700 dark:text-green-300">
                <strong>Local AI Mode:</strong> Browser calls Ollama directly. No Firebase or agent needed.
              </p>
              <p className="text-xs text-green-700 dark:text-green-300">
                <strong>Requires running the app locally</strong> (not GitHub Pages) to avoid CORS:
              </p>
              <pre className="text-[10px] font-mono bg-green-100 dark:bg-green-900/30 rounded p-2 overflow-x-auto">{`# Terminal 1 — Start Ollama
OLLAMA_ORIGINS=* ollama serve

# Terminal 2 — Start the app
cd frontend && npm run dev
# Open http://localhost:3000`}</pre>
            </div>
          )}

          {!settings.localAiMode && (
            <div className="rounded-lg bg-primary-50 dark:bg-primary-900/10 p-3">
              <p className="text-xs text-primary-700 dark:text-primary-300">
                AI requests go through Firebase RTDB. Run the local agent: <code className="font-mono bg-primary-100 dark:bg-primary-900/30 px-1 rounded">cd agent && node index.js</code>
              </p>
            </div>
          )}

          {/* Ollama URL (local mode only) */}
          {settings.localAiMode && (
            <div>
              <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300">Ollama URL</label>
              <input
                type="text"
                value={settings.ollamaUrl}
                onChange={(e) => setSettings({ ...settings, ollamaUrl: e.target.value })}
                className="w-full rounded-lg border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-900 px-4 py-2 text-sm text-dark-900 dark:text-dark-100 focus:border-primary-400 focus:outline-none"
                placeholder="http://localhost:11434"
              />
              <p className="mt-1 text-xs text-dark-500 dark:text-dark-400">Ollama server URL. Default: http://localhost:11434</p>
            </div>
          )}

          {/* Model Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-dark-700 dark:text-dark-300">Ollama Model</label>
            <input
              type="text"
              value={settings.ollamaModel}
              onChange={(e) => setSettings({ ...settings, ollamaModel: e.target.value })}
              className="w-full rounded-lg border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-900 px-4 py-2 text-sm text-dark-900 dark:text-dark-100 focus:border-primary-400 focus:outline-none"
              placeholder="gemma4:31b-cloud"
            />
            <p className="mt-1 text-xs text-dark-500 dark:text-dark-400">Model to pull with <code className="font-mono bg-dark-100 dark:bg-dark-800 px-1 rounded">ollama pull {settings.ollamaModel || "gemma4:31b-cloud"}</code></p>
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