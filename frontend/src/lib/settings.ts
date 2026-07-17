"use client"

import { useState, useEffect, useCallback } from "react"
import type { AiProviderId } from "./ai/provider"

/** @deprecated Prefer AiProviderId from `@/lib/ai` */
export type SettingsAiProvider = AiProviderId

/** Optional personalization for next-actions / Today's Plan. */
export type LearnerPrefs = {
  /** e.g. ceo | operator | pm | founder */
  role?: string
  /** free text industry domain */
  industry?: string
  /** minutes available per session */
  timeBudgetMinutes?: number
}

export interface AppSettings {
  ollamaModel: string
  localAiMode: boolean
  ollamaUrl: string
  /**
   * Optional provider preference. When unset, router uses env then "agent".
   * localAiMode still overrides to "local" when true.
   */
  aiProvider?: AiProviderId
  /** Phase 6 learner preferences */
  learnerPrefs?: LearnerPrefs
}

const DEFAULT_SETTINGS: AppSettings = {
  ollamaModel: "gemma4:31b-cloud",
  localAiMode: false,
  ollamaUrl: "http://localhost:11434",
  learnerPrefs: {},
}

/** Sync read of settings (no React). */
export function loadAppSettings(): AppSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(stored) as Partial<AppSettings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      learnerPrefs: {
        ...DEFAULT_SETTINGS.learnerPrefs,
        ...(parsed.learnerPrefs || {}),
      },
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

const STORAGE_KEY = "ceocompass_settings"

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setSettingsState({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) })
      }
    } catch { /* ignore */ }
    setLoaded(true)
  }, [])

  const setSettings = useCallback((s: AppSettings) => {
    setSettingsState(s)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* ignore */ }
  }, [])

  return { settings, setSettings, loaded }
}
