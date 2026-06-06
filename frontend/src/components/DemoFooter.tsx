"use client"

import { useState } from "react"

export function DemoFooter() {
  const [showModal, setShowModal] = useState(false)

  return (
    <footer className="border-t border-dark-200 py-6 text-center text-xs text-dark-400">
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-4 py-2 text-xs font-medium text-primary-700 hover:bg-primary-100 transition border border-primary-200 shadow-sm"
        >
          <span className="h-2 w-2 rounded-full bg-primary-500 animate-pulse"></span>
          Run locally for full experience
        </button>
        <p>Full version: 6 interactive scenarios with AI feedback · 55 quiz questions · Decision journal with calibration · Progress tracking · 57 frameworks with 3 examples each</p>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-dark-900">Run locally & unlock</h3>
              <button onClick={() => setShowModal(false)} className="text-dark-400 hover:text-dark-600 text-lg">&times;</button>
            </div>

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
                  <p className="font-medium text-dark-800">Decision Calibration</p>
                  <p className="text-xs text-dark-500">Log decisions, record outcomes over time, and see your accuracy-vs-confidence calibration chart</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-lg shrink-0">🧠</span>
                <div>
                  <p className="font-medium text-dark-800">Full Concept Library</p>
                  <p className="text-xs text-dark-500">All 57 frameworks with ~200 concepts, definitions, formulas, and 3 real-world CEO examples each</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-dark-50 p-4 mb-5">
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
    </footer>
  )
}