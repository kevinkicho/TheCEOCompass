"use client"

import { useState } from "react"
import { canUseFirebasePersistence } from "@/lib/capabilities"
import { useFeatureFlags } from "@/components/FeatureFlagsProvider"

export function DemoFooter() {
  const [showModal, setShowModal] = useState(false)
  const persistenceOk = typeof window !== "undefined" ? canUseFirebasePersistence() : true
  const { flags } = useFeatureFlags()
  const cloudReady = flags.cloud_ai_enabled === true

  return (
    <footer className="border-t border-dark-200 py-6 text-center text-xs text-dark-400 dark:text-dark-300 dark:border-dark-700">
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-4 py-2 text-xs font-medium text-primary-700 hover:bg-primary-100 transition border border-primary-200 shadow-sm dark:bg-primary-900/20 dark:hover:bg-primary-900/30 dark:border-primary-800/40 dark:text-primary-300"
        >
          <span className="h-2 w-2 rounded-full bg-primary-500 animate-pulse"></span>
          {persistenceOk
            ? cloudReady
              ? "AI: agent, local, or cloud"
              : "AI features: agent or local"
            : "Configure Firebase + AI"}
        </button>
        <p>
          Journal, pathway, reviews, and calibration save to Firebase when signed in (anonymous session by default).
          AI works via the local agent + Ollama, Profile → Local AI Mode, or Cloud when{" "}
          <code className="text-[10px] bg-dark-100 dark:bg-dark-800 px-1 rounded">cloud_ai_enabled</code> is on.
        </p>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-2xl animate-slide-up dark:bg-dark-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-dark-900 dark:text-dark-100">AI setup options</h3>
              <button onClick={() => setShowModal(false)} className="text-dark-400 hover:text-dark-600 text-lg dark:text-dark-300">&times;</button>
            </div>

            <div className="space-y-3 text-left text-dark-600 mb-5 dark:text-dark-300">
              <p className="text-sm">
                Progress and journal work on this site with Firebase. Interactive AI (tutor, scenarios, quizzes)
                uses one of three providers — pick in Profile when available.
              </p>
              <ul className="text-sm list-disc pl-5 space-y-1">
                <li>
                  <strong>Agent</strong> — RTDB request bus + local <code className="text-[10px]">agent/</code> + Ollama
                </li>
                <li>
                  <strong>Local</strong> — browser calls Ollama (Local AI Mode)
                </li>
                <li>
                  <strong>Cloud</strong> — Firebase Function + OpenAI-compatible API (requires deploy +{" "}
                  <code className="text-[10px]">cloud_ai_enabled</code>)
                </li>
              </ul>
            </div>

            <div className="rounded-lg bg-dark-50 p-4 mb-5 dark:bg-dark-900">
              <p className="text-xs font-semibold text-dark-700 mb-2 dark:text-dark-300">Local agent quick setup</p>
              <div className="rounded bg-dark-800 p-3 font-mono text-[11px] text-green-300 text-left overflow-x-auto">
                <p>git clone https://github.com/kevinkicho/TheCEOCompass.git</p>
                <p>cd TheCEOCompass</p>
                <p>ollama run gemma4:latest</p>
                <p>cd agent && npm install && node index.js</p>
                <p>cd ../frontend && npm install && npm run dev</p>
              </div>
            </div>

            <p className="text-xs text-dark-400 text-center dark:text-dark-300">
              <a href="https://github.com/kevinkicho/TheCEOCompass#quick-start" target="_blank" rel="noopener" className="text-primary-500 hover:underline">Full README</a>
              {" · "}
              <a href="https://github.com/kevinkicho/TheCEOCompass/blob/master/docs/AI_CLOUD_SETUP.md" target="_blank" rel="noopener" className="text-primary-500 hover:underline">Cloud AI setup</a>
            </p>
          </div>
        </div>
      )}
    </footer>
  )
}
