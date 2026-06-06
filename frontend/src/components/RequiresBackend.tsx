"use client"

import { useState, type ReactNode } from "react"

const isStaticHosting = typeof window !== "undefined" && !window.location.hostname.includes("localhost") && !window.location.hostname.includes("127.0.0.1")

export function useRequiresBackend() {
  const [showModal, setShowModal] = useState(false)
  return {
    isStaticHosting,
    showModal,
    setShowModal,
  }
}

export function BackendRequiredModal({ show, onClose, feature }: { show: boolean; onClose: () => void; feature: string }) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl animate-slide-up dark:bg-dark-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-dark-900 dark:text-dark-100">
            <span className="text-amber-500 mr-1">⚡</span> Local backend required
          </h3>
          <button onClick={onClose} className="text-dark-400 hover:text-dark-600 text-lg dark:text-dark-500">&times;</button>
        </div>

        <p className="text-dark-600 mb-4 dark:text-dark-300">
          <strong>{feature}</strong> and other AI-powered features need the Python backend running locally.
        </p>

        <div className="rounded-lg bg-dark-50 p-4 mb-4 dark:bg-dark-900">
          <p className="text-xs font-semibold text-dark-700 mb-2 dark:text-dark-300">Quick setup — 2 minutes</p>
          <div className="rounded bg-dark-800 p-3 font-mono text-[11px] text-green-300 text-left overflow-x-auto">
            <p>cd TheCEOCompass/ceo-platform</p>
            <p>source venv/bin/activate</p>
            <p>PYTHONPATH=backend python backend/seed/seed_db.py</p>
            <p>PYTHONPATH=backend uvicorn app.main:app --app-dir backend --port 50128 &</p>
            <p>cd frontend && npm run dev</p>
          </div>
        </div>

        <p className="text-xs text-dark-400 text-center dark:text-dark-500">
          <a href="https://github.com/kevinkicho/TheCEOCompass#quick-start" target="_blank" rel="noopener" className="text-primary-500 hover:underline">Full setup guide</a>
        </p>
      </div>
    </div>
  )
}

export function BackendGuard({ children, feature, onClick }: { children: ReactNode; feature: string; onClick?: () => void }) {
  const [showModal, setShowModal] = useState(false)

  if (!isStaticHosting) {
    return <>{children}</>
  }

  return (
    <>
      <div onClick={() => setShowModal(true)}>
        {children}
      </div>
      <BackendRequiredModal show={showModal} onClose={() => setShowModal(false)} feature={feature} />
    </>
  )
}