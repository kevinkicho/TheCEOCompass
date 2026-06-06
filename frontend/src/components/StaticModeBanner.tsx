"use client"

import { useState } from "react"

const isStaticHosting = typeof window !== "undefined" && !window.location.hostname.includes("localhost") && !window.location.hostname.includes("127.0.0.1")

export function StaticModeBanner({ feature, description }: { feature: string; description: string }) {
  const [showModal, setShowModal] = useState(false)

  if (!isStaticHosting) return null

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="mb-6 w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-left hover:bg-amber-100 transition"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">⚡</span>
          <span className="font-semibold text-amber-800">Static Demo — {feature} requires local backend</span>
        </div>
        <p className="text-sm text-amber-600 ml-7">{description}</p>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-dark-900">{feature} — Run locally to access</h3>
              <button onClick={() => setShowModal(false)} className="text-dark-400 hover:text-dark-600 text-lg">&times;</button>
            </div>

            <p className="text-dark-600 mb-5">This feature needs the Python backend and LLM API keys. Here&apos;s what you get running locally:</p>

            <div className="space-y-3 text-left text-dark-600 mb-5">
              <div className="flex gap-3">
                <span className="text-lg shrink-0">🎯</span>
                <div>
                  <p className="font-medium text-dark-800">AI-Coached Scenarios</p>
                  <p className="text-xs text-dark-500">6 branching decision simulations where an LLM coach evaluates your choices and gives personalized feedback</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-lg shrink-0">📝</span>
                <div>
                  <p className="font-medium text-dark-800">AI-Generated Quizzes</p>
                  <p className="text-xs text-dark-500">Generate quiz questions on any framework with real-time answer evaluation and explanations</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-lg shrink-0">📊</span>
                <div>
                  <p className="font-medium text-dark-800">Decision Journal & Calibration</p>
                  <p className="text-xs text-dark-500">Log decisions, record outcomes over time, and see your calibration analytics</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-lg shrink-0">🧠</span>
                <div>
                  <p className="font-medium text-dark-800">Full Concept Library</p>
                  <p className="text-xs text-dark-500">All 57 frameworks with ~200 concepts, definitions, formulas, and 3 real-world examples each</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-dark-50 p-4 mb-4">
              <p className="text-xs font-semibold text-dark-700 mb-2">Quick setup</p>
              <div className="rounded bg-dark-800 p-3 font-mono text-[11px] text-green-300 text-left overflow-x-auto">
                <p>git clone https://github.com/kevinkicho/TheCEOCompass.git</p>
                <p>cd TheCEOCompass/ceo-platform</p>
                <p>python3 -m venv venv && source venv/bin/activate</p>
                <p>pip install -r backend/requirements.txt</p>
                <p>PYTHONPATH=backend python backend/seed/seed_db.py</p>
                <p>PYTHONPATH=backend uvicorn app.main:app --app-dir backend --port 50128 &</p>
                <p>cd frontend && npm install && npm run dev</p>
              </div>
            </div>

            <p className="text-xs text-dark-400 text-center">
              <a href="https://github.com/kevinkicho/TheCEOCompass#quick-start" target="_blank" rel="noopener" className="text-primary-500 hover:underline">Full README</a> &middot; Built by DeepSeek V4 Pro via OpenCode Go
            </p>
          </div>
        </div>
      )}
    </>
  )
}