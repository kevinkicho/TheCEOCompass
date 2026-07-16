"use client"

import React, { createContext, useContext, useEffect, useState, useMemo } from "react"
import { db, ref, onValue } from "@/lib/firebase"
import {
  AGENT_HEARTBEAT_PATH,
  AGENT_HEARTBEAT_STALE_MS,
  AGENT_HEARTBEAT_SKEW_MS,
  getAiAvailability,
  type AgentHeartbeat,
  type AiAvailability,
} from "@/lib/capabilities"

type AiStatusContextValue = {
  heartbeat: AgentHeartbeat | null
  availability: AiAvailability
  localAiMode: boolean
}

const AiStatusContext = createContext<AiStatusContextValue>({
  heartbeat: null,
  availability: { status: "unavailable", reason: "no_firebase" },
  localAiMode: false,
})

export function useAiStatus() {
  return useContext(AiStatusContext)
}

function loadLocalAiMode(): boolean {
  if (typeof window === "undefined") return false
  try {
    const raw = localStorage.getItem("ceocompass_settings")
    if (!raw) return false
    return JSON.parse(raw).localAiMode === true
  } catch {
    return false
  }
}

export function AiStatusProvider({ children }: { children: React.ReactNode }) {
  const [heartbeat, setHeartbeat] = useState<AgentHeartbeat | null>(null)
  const [localAiMode, setLocalAiMode] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setLocalAiMode(loadLocalAiMode())
    const onStorage = () => setLocalAiMode(loadLocalAiMode())
    window.addEventListener("storage", onStorage)
    const iv = setInterval(() => {
      setLocalAiMode(loadLocalAiMode())
      setTick((t) => t + 1)
    }, 10_000)
    return () => {
      window.removeEventListener("storage", onStorage)
      clearInterval(iv)
    }
  }, [])

  useEffect(() => {
    if (!db) return
    const unsub = onValue(ref(db, AGENT_HEARTBEAT_PATH), (snap) => {
      if (!snap.exists()) {
        setHeartbeat(null)
        return
      }
      const v = snap.val()
      setHeartbeat({
        status: v.status === "degraded" ? "degraded" : "ok",
        updated_at: Number(v.updated_at) || 0,
        ollama_ok: Boolean(v.ollama_ok),
        ollama_checked_at: v.ollama_checked_at,
        model_default: v.model_default,
        agent_version: v.agent_version,
        hostname: v.hostname,
      })
    })
    return () => unsub()
  }, [])

  const liveAvailability = useMemo(() => {
    if (localAiMode) return getAiAvailability(heartbeat, true)
    if (!heartbeat) return getAiAvailability(null, false)
    const age = Date.now() - heartbeat.updated_at
    if (age > AGENT_HEARTBEAT_STALE_MS + AGENT_HEARTBEAT_SKEW_MS) {
      return { status: "unavailable" as const, reason: "stale" as const }
    }
    return getAiAvailability(heartbeat, false)
  }, [heartbeat, localAiMode, tick])

  return (
    <AiStatusContext.Provider value={{ heartbeat, availability: liveAvailability, localAiMode }}>
      {children}
    </AiStatusContext.Provider>
  )
}

export function AiStatusIndicator() {
  const { availability, localAiMode, heartbeat } = useAiStatus()

  let label = "AI offline"
  let color = "bg-dark-300 dark:bg-dark-600"
  let title = "Agent not detected — run agent + Ollama, or enable Local AI Mode in Profile"

  if (availability.status === "available") {
    if (localAiMode || availability.mode === "local") {
      label = "AI local"
      color = "bg-emerald-500"
      title = "Local AI Mode (browser → Ollama)"
    } else {
      label = "AI online"
      color = "bg-emerald-500"
      title = `Agent online${heartbeat?.model_default ? ` · ${heartbeat.model_default}` : ""}`
    }
  } else if (availability.reason === "ollama_down" || (heartbeat && !heartbeat.ollama_ok)) {
    label = "AI degraded"
    color = "bg-amber-500"
    title = "Agent up but Ollama not responding"
  } else if (availability.reason === "stale") {
    label = "AI stale"
    color = "bg-amber-500"
    title = "Agent heartbeat is stale"
  }

  return (
    <span
      className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium text-dark-600 dark:text-dark-300 bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-700"
      title={title}
      data-testid="ai-status-indicator"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  )
}
