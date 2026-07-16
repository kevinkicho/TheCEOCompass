"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { loadFrameworks } from "@/lib/rtdb-cache"
import type { Framework, FrameworkListItem } from "@/lib/types"
import { useSettings } from "@/lib/settings"
import { useAuth } from "@/lib/useAuth"
import { useAuthSession } from "@/lib/AuthSessionProvider"
import { SkeletonCard } from "@/components/SkeletonCard"
import { db, ref, get } from "@/lib/firebase"
import {
  downloadUserDataExport,
  importUserData,
  loadJournalEntries,
  loadPathwayProgress,
  loadAllReviews,
  buildPathway,
  tryUid,
  userPath,
} from "@/lib/user-data"
import { computeCalibration, type CalibrationResult } from "@/lib/calibration"
import { analyzeBlindSpots, type BlindSpotReport } from "@/lib/ollama"
import { canUseFirebasePersistence } from "@/lib/capabilities"

export default function ProfilePage() {
  const router = useRouter()
  const { user, isAdmin, loading: authLoading, signInWithGoogle, signOut } = useAuth()
  const { ready: authReady, mergeStatus, clearMergeStatus, linkGoogle } = useAuthSession()
  const [pathwayPct, setPathwayPct] = useState(0)
  const [pathwayCompleted, setPathwayCompleted] = useState(0)
  const [pathwayTotal, setPathwayTotal] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)
  const [calibration, setCalibration] = useState<CalibrationResult | null>(null)
  const [journalCount, setJournalCount] = useState(0)
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [viewedByFramework, setViewedByFramework] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const { settings, setSettings, loaded } = useSettings()
  const [exportBusy, setExportBusy] = useState(false)
  const [importMsg, setImportMsg] = useState("")
  const [importError, setImportError] = useState("")
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkError, setLinkError] = useState("")

  // Blind spot analysis
  const [blindSpotReport, setBlindSpotReport] = useState<BlindSpotReport | null>(null)
  const [blindSpotLoading, setBlindSpotLoading] = useState(false)
  const [blindSpotError, setBlindSpotError] = useState("")

  useEffect(() => {
    if (!authReady && canUseFirebasePersistence()) return

    const load = async () => {
      setIsLoading(true)
      try {
        const fws = (await loadFrameworks()) as Framework[]
        setFrameworks(fws)

        if (!canUseFirebasePersistence() || !tryUid()) {
          return
        }

        const [journal, pathway, reviews, cal] = await Promise.all([
          loadJournalEntries().catch(() => []),
          loadPathwayProgress().catch(() => ({ completedIds: [] as string[], inProgressId: null as string | null })),
          loadAllReviews().catch(() => []),
          computeCalibration().catch(() => null),
        ])

        setJournalCount(journal.length)
        setReviewCount(reviews.length)
        setCalibration(cal)

        const steps = buildPathway(fws as FrameworkListItem[])
        setPathwayTotal(steps.length)
        setPathwayCompleted(pathway.completedIds.length)
        setPathwayPct(steps.length > 0 ? Math.round((pathway.completedIds.length / steps.length) * 100) : 0)

        const uid = tryUid()
        if (uid && db) {
          const snap = await get(ref(db, userPath(uid, "viewed")))
          if (snap.exists()) {
            const val = snap.val() as Record<string, Record<string, unknown>>
            const counts: Record<string, number> = {}
            for (const fw of Object.keys(val)) {
              counts[fw] = Object.keys(val[fw] || {}).filter((k) => k !== "viewed_at").length
            }
            setViewedByFramework(counts)
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [authReady])

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

      {/* Account merge status (credential-already-in-use path) */}
      {mergeStatus && (
        <div
          role="status"
          className={`mb-6 rounded-xl border p-4 ${
            mergeStatus.state === "error"
              ? "border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/15"
              : mergeStatus.state === "partial"
                ? "border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/15"
                : "border-green-200 dark:border-green-800/40 bg-green-50 dark:bg-green-900/15"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                className={`text-sm font-semibold ${
                  mergeStatus.state === "error"
                    ? "text-red-800 dark:text-red-200"
                    : mergeStatus.state === "partial"
                      ? "text-amber-800 dark:text-amber-200"
                      : "text-green-800 dark:text-green-200"
                }`}
              >
                {mergeStatus.state === "error"
                  ? "Account merge issue"
                  : mergeStatus.state === "partial"
                    ? "Account merge partial"
                    : "Account data merged"}
              </p>
              <p
                className={`mt-1 text-xs ${
                  mergeStatus.state === "error"
                    ? "text-red-700 dark:text-red-300"
                    : mergeStatus.state === "partial"
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-green-700 dark:text-green-300"
                }`}
              >
                {mergeStatus.message}
              </p>
              {mergeStatus.mergedKeys && mergeStatus.mergedKeys.length > 0 && (
                <p className="mt-1 text-[11px] text-dark-500 dark:text-dark-400">
                  Keys: {mergeStatus.mergedKeys.join(", ")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={clearMergeStatus}
              className="shrink-0 rounded-lg border border-dark-200 dark:border-dark-600 px-2 py-1 text-xs text-dark-600 dark:text-dark-300 hover:bg-white/50 dark:hover:bg-dark-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {canUseFirebasePersistence() && (
        <div className="mb-8 rounded-xl border border-dark-200 dark:border-dark-700 p-4">
          <p className="text-sm font-semibold text-dark-900 dark:text-dark-100 mb-1">Export / import learning data</p>
          <p className="text-xs text-dark-500 dark:text-dark-400 mb-3">
            Download a JSON backup of journal, reviews, pathway, and favorites. Import can merge or replace.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={exportBusy}
              onClick={async () => {
                setExportBusy(true)
                setImportError("")
                try {
                  await downloadUserDataExport()
                } catch (e) {
                  setImportError(e instanceof Error ? e.message : "Export failed")
                }
                setExportBusy(false)
              }}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {exportBusy ? "Exporting…" : "Export JSON"}
            </button>
            <label className="rounded-lg border border-dark-200 dark:border-dark-700 px-3 py-1.5 text-xs font-medium text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-800 cursor-pointer">
              Import (merge)
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ""
                  if (!file) return
                  setImportError("")
                  setImportMsg("")
                  try {
                    const text = await file.text()
                    const raw = JSON.parse(text)
                    const r = await importUserData(raw, "merge")
                    setImportMsg(`Merged ${r.journal} journal entries, ${r.reviews} reviews.`)
                  } catch (err) {
                    setImportError(err instanceof Error ? err.message : "Import failed")
                  }
                }}
              />
            </label>
            <label className="rounded-lg border border-amber-300 dark:border-amber-700 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer">
              Import (replace)
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ""
                  if (!file) return
                  if (!window.confirm("Replace will wipe journal/reviews/progress/favorites after auto-export. Continue?")) return
                  setImportError("")
                  setImportMsg("")
                  try {
                    await downloadUserDataExport()
                    const text = await file.text()
                    const raw = JSON.parse(text)
                    const r = await importUserData(raw, "replace")
                    setImportMsg(`Replaced with ${r.journal} journal entries, ${r.reviews} reviews.`)
                  } catch (err) {
                    setImportError(err instanceof Error ? err.message : "Import failed")
                  }
                }}
              />
            </label>
          </div>
          {importMsg && <p className="mt-2 text-xs text-green-600 dark:text-green-400">{importMsg}</p>}
          {importError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{importError}</p>}
        </div>
      )}

      {/* Key Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="Pathway"
          value={`${pathwayPct}%`}
          subtitle={pathwayTotal > 0 ? `${pathwayCompleted} / ${pathwayTotal} modules` : "No modules loaded"}
        />
        <StatsCard
          label="Concepts Reviewed"
          value={reviewCount}
          subtitle="Spaced-repetition cards"
        />
        <StatsCard
          label="Decisions Logged"
          value={journalCount}
          subtitle={calibration ? `${calibration.entriesUsed} with outcomes` : "0 with outcomes"}
        />
        <StatsCard
          label="Calibration"
          value={calibration && calibration.entriesUsed > 0 ? `${calibration.overall}%` : "—"}
          subtitle={calibration && calibration.entriesUsed > 0 ? "Outcome accuracy" : "Log outcomes in Journal"}
        />
      </div>

      {/* Calibration Chart */}
      {calibration && calibration.entriesUsed > 0 && (
        <div className="mb-8 rounded-xl border border-dark-200 p-6 dark:border-dark-700">
          <h2 className="mb-4 text-xl font-semibold text-dark-900 dark:text-dark-100">Calibration</h2>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-dark-50 p-4 text-center dark:bg-dark-900">
              <p className="text-2xl font-bold text-dark-900 dark:text-dark-100">{calibration.overall}%</p>
              <p className="text-xs text-dark-500 dark:text-dark-300">Overall accuracy</p>
            </div>
            <div className="rounded-lg bg-dark-50 p-4 text-center dark:bg-dark-900">
              <p className="text-2xl font-bold text-dark-900 dark:text-dark-100">{calibration.entriesUsed}</p>
              <p className="text-xs text-dark-500 dark:text-dark-300">Outcomes used</p>
            </div>
          </div>
          <div className="space-y-2">
            {calibration.buckets.map((b) => (
              <div key={b.label} className="flex items-center gap-3 text-sm">
                <span className="w-28 text-dark-500 dark:text-dark-300">{b.label}</span>
                <div className="flex-1 h-5 flex rounded-full overflow-hidden bg-dark-100 dark:bg-dark-800">
                  <div className="bg-primary-500 transition-all" style={{ width: `${b.accuracy}%` }} />
                </div>
                <span className="w-10 text-right text-dark-600 dark:text-dark-300">{b.accuracy}%</span>
                <span className="w-8 text-right text-dark-400 dark:text-dark-300">n={b.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Framework engagement (viewed concepts) */}
      <div className="mb-8 rounded-xl border border-dark-200 p-6 dark:border-dark-700">
        <h2 className="mb-4 text-xl font-semibold text-dark-900 dark:text-dark-100">Framework engagement</h2>
        <p className="text-xs text-dark-500 dark:text-dark-400 mb-3">Concepts viewed per framework (from RTDB progress)</p>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {frameworks.map((fw) => {
            const viewed = viewedByFramework[fw.slug] || 0
            const totalConcepts = fw.concepts?.length || 0
            const pct = totalConcepts > 0 ? Math.min(100, Math.round((viewed / totalConcepts) * 100)) : 0
            return (
              <div key={fw.id || fw.slug}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <button
                    onClick={() => router.push(`/frameworks/${fw.slug}`)}
                    className="font-medium text-dark-700 hover:text-primary-600 dark:text-dark-300"
                  >
                    {fw.title}
                  </button>
                  <span className="text-dark-500 dark:text-dark-300">
                    {viewed}{totalConcepts > 0 ? ` / ${totalConcepts}` : ""} viewed
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-dark-100 dark:bg-dark-800">
                  <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${pct}%` }} />
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
                  if (!db) throw new Error("Firebase not configured")
                  const uid = tryUid()
                  if (!uid) throw new Error("Not signed in — wait for auth session")
                  const database = db!
                  const base = userPath(uid)
                  const [viewedSnap, reviewsSnap, quizSnap, journalSnap, progressSnap] = await Promise.all([
                    get(ref(database, `${base}/viewed`)).catch(() => ({ exists: () => false, val: () => null })),
                    get(ref(database, `${base}/reviews`)).catch(() => ({ exists: () => false, val: () => null })),
                    get(ref(database, `${base}/quizResults`)).catch(() => ({ exists: () => false, val: () => null })),
                    get(ref(database, `${base}/journal/entries`)).catch(() => ({ exists: () => false, val: () => null })),
                    get(ref(database, `${base}/progress`)).catch(() => ({ exists: () => false, val: () => null })),
                  ])

                  const viewedFrameworks = viewedSnap.exists() ? Object.keys(viewedSnap.val() as object) : []
                  const reviewedConcepts = reviewsSnap.exists() ? Object.keys(reviewsSnap.val() as object) : []
                  const quizResults = quizSnap.exists()
                    ? Object.values(quizSnap.val() as Record<string, { framework_slug?: string; pct?: number }>).map((r) => ({
                        framework: r.framework_slug || "",
                        pct: r.pct || 0,
                      }))
                    : []
                  const journalEntries = journalSnap.exists() ? Object.keys(journalSnap.val() as object).length : 0
                  const completedPathways = progressSnap.exists()
                    ? ((progressSnap.val() as { completed_ids?: string[] }).completed_ids || [])
                    : []

                  const report = await analyzeBlindSpots({
                    viewedFrameworks,
                    reviewedConcepts,
                    quizResults,
                    journalEntries,
                    completedPathways,
                  })
                  setBlindSpotReport(report)
                } catch (err: unknown) {
                  setBlindSpotError(err instanceof Error ? err.message : "Analysis failed")
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {user.photoURL && <Image src={user.photoURL} alt="" width={40} height={40} className="h-10 w-10 rounded-full" unoptimized />}
                  <div>
                    <p className="text-sm font-medium text-dark-900 dark:text-dark-100">
                      {user.isAnonymous
                        ? "Anonymous session"
                        : user.displayName || user.email || "Signed in"}
                    </p>
                    <p className="text-xs text-dark-500 dark:text-dark-400">
                      {isAdmin ? "Admin" : user.isAnonymous ? "Local progress (this browser)" : "Signed in"}
                      {user.isAnonymous ? "" : user.email ? ` · ${user.email}` : ""}
                    </p>
                  </div>
                </div>
                {!user.isAnonymous && (
                  <button
                    onClick={signOut}
                    className="rounded-lg border border-dark-200 dark:border-dark-700 px-4 py-2 text-sm text-dark-600 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-800 transition"
                  >
                    Sign Out
                  </button>
                )}
              </div>
              {user.isAnonymous && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-dark-500 dark:text-dark-400">
                    Link Google to keep progress across devices. If this Google account already has data,
                    we merge your anonymous progress into it — nothing is dropped silently.
                  </p>
                  <button
                    disabled={linkBusy}
                    onClick={async () => {
                      setLinkBusy(true)
                      setLinkError("")
                      try {
                        await linkGoogle()
                      } catch (e) {
                        setLinkError(e instanceof Error ? e.message : "Google link failed")
                      }
                      setLinkBusy(false)
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-dark-200 dark:border-dark-700 px-4 py-2.5 text-sm font-medium text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-800 transition disabled:opacity-50"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    {linkBusy ? "Linking…" : "Link Google account"}
                  </button>
                  {linkError && <p className="text-xs text-red-600 dark:text-red-400">{linkError}</p>}
                </div>
              )}
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