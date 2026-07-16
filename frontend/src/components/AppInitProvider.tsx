"use client"

/**
 * Fortified app initialization:
 * - Waits for Auth session (anonymous or Google) before rendering children
 * - Waits for feature flags first RTDB snapshot (or timeout)
 * - Pre-probes local Ollama / cloud key so AI status is accurate early
 *
 * Never injects mock learning data — only readiness gates.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useAuthSession } from "@/lib/AuthSessionProvider"
import { useFeatureFlags } from "@/components/FeatureFlagsProvider"
import { canUseFirebasePersistence } from "@/lib/capabilities"
import { hasOllamaApiKey, probeLocalOllama } from "@/lib/ai/ollama-client"

export type AppInitState = {
  /** Auth + flags settled (or timed out safely). */
  ready: boolean
  authReady: boolean
  flagsReady: boolean
  firebaseOk: boolean
  localOllamaOk: boolean | null
  cloudKeyConfigured: boolean
}

const AppInitContext = createContext<AppInitState>({
  ready: false,
  authReady: false,
  flagsReady: false,
  firebaseOk: false,
  localOllamaOk: null,
  cloudKeyConfigured: false,
})

export function useAppInit(): AppInitState {
  return useContext(AppInitContext)
}

const FLAGS_TIMEOUT_MS = 8_000

export function AppInitProvider({ children }: { children: React.ReactNode }) {
  const { ready: authReady } = useAuthSession()
  const { ready: flagsReady } = useFeatureFlags()
  const [flagsTimedOut, setFlagsTimedOut] = useState(false)
  const [localOllamaOk, setLocalOllamaOk] = useState<boolean | null>(null)
  const cloudKeyConfigured = hasOllamaApiKey()
  const firebaseOk = canUseFirebasePersistence()

  useEffect(() => {
    if (flagsReady) return
    const t = setTimeout(() => setFlagsTimedOut(true), FLAGS_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [flagsReady])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const ok = await probeLocalOllama()
      if (!cancelled) setLocalOllamaOk(ok)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const flagsSettled = flagsReady || flagsTimedOut
  const ready = authReady && flagsSettled

  const value = useMemo<AppInitState>(
    () => ({
      ready,
      authReady,
      flagsReady: flagsSettled,
      firebaseOk,
      localOllamaOk,
      cloudKeyConfigured,
    }),
    [ready, authReady, flagsSettled, firebaseOk, localOllamaOk, cloudKeyConfigured],
  )

  if (!ready) {
    return (
      <AppInitContext.Provider value={value}>
        <div
          className="min-h-[40vh] flex flex-col items-center justify-center gap-3 px-4"
          data-testid="app-init-loading"
          role="status"
          aria-live="polite"
        >
          <div className="h-8 w-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
          <p className="text-sm text-dark-500 dark:text-dark-400">Starting CEO Compass…</p>
          <p className="text-[11px] text-dark-400 dark:text-dark-500">
            Auth session{authReady ? " ✓" : "…"} · Config{flagsSettled ? " ✓" : "…"}
          </p>
        </div>
      </AppInitContext.Provider>
    )
  }

  return <AppInitContext.Provider value={value}>{children}</AppInitContext.Provider>
}
