"use client"

import { useState, type ReactNode } from "react"
import { isStaticHosting as isSH } from "@/lib/constants"
export const isStaticHosting = isSH

export function useRequiresBackend() {
  const [showModal, setShowModal] = useState(false)
  return { isStaticHosting, showModal, setShowModal }
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
          <button onClick={onClose} className="text-dark-400 hover:text-dark-600 text-lg dark:text-dark-300">&times;</button>
        </div>

        <p className="text-dark-600 mb-4 dark:text-dark-300">
          <strong>{feature}</strong> and other AI-powered features need the local Node.js agent + Ollama running.
        </p>

        <div className="rounded-lg bg-dark-50 p-4 mb-4 dark:bg-dark-900">
          <p className="text-xs font-semibold text-dark-700 mb-2 dark:text-dark-300">Quick setup — 2 minutes</p>
          <div className="rounded bg-dark-800 p-3 font-mono text-[11px] text-green-300 text-left overflow-x-auto">
            <p>git clone https://github.com/kevinkicho/TheCEOCompass.git</p>
            <p>cd TheCEOCompass/ceo-platform</p>
            <p># Terminal 1: Ollama</p>
            <p>ollama run gemma4:latest</p>
            <p># Terminal 2: Agent</p>
            <p>cd agent && npm install</p>
            <p># Add serviceAccountKey.json to agent/</p>
            <p>node index.js</p>
            <p># Terminal 3: Frontend</p>
            <p>cd frontend && cp .env.example .env</p>
            <p>npm install && npm run dev</p>
          </div>
        </div>

        <p className="text-xs text-dark-400 text-center dark:text-dark-300">
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

export function StaticHostingBanner({ feature, description }: { feature: string; description: string }) {
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

      <BackendRequiredModal show={showModal} onClose={() => setShowModal(false)} feature={feature} />
    </>
  )
}
