"use client"

import { useState, useEffect, useCallback } from "react"
import type { AiProviderId } from "./ai/provider"

/** @deprecated Prefer AiProviderId from `@/lib/ai` */
export type SettingsAiProvider = AiProviderId

export interface AppSettings {
  ollamaModel: string
  localAiMode: boolean
  ollamaUrl: string
  /**
   * Optional provider preference. When unset, router uses env then "agent".
   * localAiMode still overrides to "local" when true.
   */
  aiProvider?: AiProviderId
}

const DEFAULT_SETTINGS: AppSettings = {
  ollamaModel: "gemma4:31b-cloud",
  localAiMode: false,
  ollamaUrl: "http://localhost:11434",
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
