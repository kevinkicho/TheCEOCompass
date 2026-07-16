"use client"

import { useState, type ReactNode } from "react"
import { canUseFirebasePersistence } from "@/lib/capabilities"
import { isStaticHosting as isSH } from "@/lib/constants"

/** @deprecated Prefer canUseFirebasePersistence / AI availability. Kept for tests & api catalog. */
export const isStaticHosting = isSH

export function useRequiresBackend() {
  const [showModal, setShowModal] = useState(false)
  return { isStaticHosting, showModal, setShowModal, canUseFirebasePersistence: canUseFirebasePersistence() }
}

export function AiSetupModal({ show, onClose, feature }: { show: boolean; onClose: () => void; feature: string }) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl animate-slide-up dark:bg-dark-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-dark-900 dark:text-dark-100">
            <span className="text-amber-500 mr-1">⚡</span> Local AI agent required
          </h3>
          <button onClick={onClose} className="text-dark-400 hover:text-dark-600 text-lg dark:text-dark-300">&times;</button>
        </div>

        <p className="text-dark-600 mb-4 dark:text-dark-300">
          <strong>{feature}</strong> needs the local Node.js agent + Ollama (or Local AI Mode in Profile).
        </p>

        <div className="rounded-lg bg-dark-50 p-4 mb-4 dark:bg-dark-900">
          <p className="text-xs font-semibold text-dark-700 mb-2 dark:text-dark-300">Quick setup — 2 minutes</p>
          <div className="rounded bg-dark-800 p-3 font-mono text-[11px] text-green-300 text-left overflow-x-auto">
            <p>git clone https://github.com/kevinkicho/TheCEOCompass.git</p>
            <p>cd TheCEOCompass</p>
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

/** @deprecated Use AiSetupModal */
export const BackendRequiredModal = AiSetupModal

export function AiGuard({ children, feature }: { children: ReactNode; feature: string; onClick?: () => void }) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div onClick={() => setShowModal(true)}>
        {children}
      </div>
      <AiSetupModal show={showModal} onClose={() => setShowModal(false)} feature={feature} />
    </>
  )
}

/** @deprecated Use AiGuard */
export const BackendGuard = AiGuard

export function PersistenceUnavailableBanner({ feature, description }: { feature: string; description: string }) {
  if (canUseFirebasePersistence()) return null

  return (
    <div className="mb-6 w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-left dark:border-amber-800/40 dark:bg-amber-900/20">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">⚡</span>
        <span className="font-semibold text-amber-800 dark:text-amber-300">Firebase not configured — {feature}</span>
      </div>
      <p className="text-sm text-amber-600 dark:text-amber-400/80 ml-7">{description}</p>
    </div>
  )
}

/** @deprecated — was hostname-based; now only shows when Firebase is missing (persistence path). */
export function StaticHostingBanner({ feature, description }: { feature: string; description: string }) {
  // For AI-only features, keep a soft AI setup banner only when not on a true static-without-firebase host
  if (canUseFirebasePersistence()) return null
  return <PersistenceUnavailableBanner feature={feature} description={description} />
}
