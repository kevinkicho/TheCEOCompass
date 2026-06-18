"use client"

import { useState, useEffect, useCallback } from "react"

export interface AppSettings {
  ollamaUrl: string
  ollamaModel: string
}

const DEFAULT_SETTINGS: AppSettings = {
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "gemma3:latest",
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
