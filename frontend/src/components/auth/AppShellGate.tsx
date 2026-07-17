"use client"

/**
 * Gates the full product shell behind Google sign-in.
 * - Not ready / boot: calm full-screen loading (min duration)
 * - Anonymous or signed-out: flash login
 * - Just signed in with Google: deliberate transition while catalog loads
 * - Google user ready: main menu (navbar, sidebar, pages)
 */

import React, { useEffect, useRef, useState } from "react"
import { useAuthSession } from "@/lib/AuthSessionProvider"
import { useAppInit } from "@/components/AppInitProvider"
import { loadFrameworks } from "@/lib/rtdb-cache"
import { getScenarios } from "@/lib/api"
import { FlashLogin } from "./FlashLogin"

/** Minimum time on boot splash so first paint does not flash incomplete chrome. */
const MIN_BOOT_MS = 1400
/** After Google login, hold transition while workspace data loads. */
const MIN_ENTER_MS = 1800

type Phase = "boot" | "flash" | "entering" | "app"

export function AppShellGate({ children }: { children: React.ReactNode }) {
  const { ready: authReady, user, isAnonymous } = useAuthSession()
  const { ready: initReady } = useAppInit()
  const [bootElapsed, setBootElapsed] = useState(false)
  const [enterDone, setEnterDone] = useState(false)
  const [enterMessage, setEnterMessage] = useState("Opening your workspace...")
  /** Uids that finished the post-login transition this page lifetime */
  const enteredUid = useRef<string | null>(null)

  const googleUser = Boolean(authReady && user && !isAnonymous && !user.isAnonymous)

  // Boot: wait for auth AND a calm minimum duration
  useEffect(() => {
    if (!authReady) {
      setBootElapsed(false)
      return
    }
    const t = window.setTimeout(() => setBootElapsed(true), MIN_BOOT_MS)
    return () => window.clearTimeout(t)
  }, [authReady])

  // Post-Google: load catalogs with a deliberate minimum transition (once per uid).
  // Depend only on uid so auth object identity churn cannot cancel the enter sequence.
  const googleUid = googleUser && user ? user.uid : null
  useEffect(() => {
    if (!googleUid) {
      setEnterDone(false)
      return
    }

    if (enteredUid.current === googleUid) {
      setEnterDone(true)
      return
    }

    let cancelled = false
    setEnterDone(false)
    setEnterMessage("Signing you in securely...")

    const started = Date.now()

    ;(async () => {
      try {
        setEnterMessage("Loading frameworks and scenarios...")
        await Promise.all([
          loadFrameworks().catch(() => null),
          getScenarios().catch(() => null),
        ])
        if (cancelled) return
        setEnterMessage("Preparing your main menu...")
        const elapsed = Date.now() - started
        const wait = Math.max(0, MIN_ENTER_MS - elapsed)
        await new Promise((r) => setTimeout(r, wait))
        if (cancelled) return
        if (!initReady) {
          setEnterMessage("Syncing settings...")
          await new Promise((r) => setTimeout(r, 700))
        } else {
          await new Promise((r) => setTimeout(r, 400))
        }
      } catch (err) {
        console.warn("[app-shell] enter transition error (continuing)", err)
        await new Promise((r) => setTimeout(r, MIN_ENTER_MS))
      }
      if (cancelled) return
      enteredUid.current = googleUid
      setEnterDone(true)
    })()

    return () => {
      cancelled = true
    }
    // initReady intentionally omitted from deps - polled inside once enter starts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleUid])

  let phase: Phase = "boot"
  if (!authReady || !bootElapsed) phase = "boot"
  else if (!googleUser) phase = "flash"
  else if (!enterDone) phase = "entering"
  else phase = "app"

  if (phase === "boot") {
    return (
      <FullScreenStatus
        title="CEO Compass"
        message="Starting up..."
        detail="Preparing a reliable session"
      />
    )
  }

  if (phase === "flash") {
    return <FlashLogin />
  }

  if (phase === "entering") {
    return (
      <FullScreenStatus
        title="Welcome"
        message={enterMessage}
        detail="This takes a moment so everything is ready"
      />
    )
  }

  return <>{children}</>
}

function FullScreenStatus({
  title,
  message,
  detail,
}: {
  title: string
  message: string
  detail?: string
}) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-dark-950 via-dark-900 to-dark-950 text-dark-100"
      data-testid="app-shell-status"
    >
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center gap-2 mb-8">
          <span className="h-9 w-9 rounded-xl bg-primary-500/20 border border-primary-400/40 flex items-center justify-center text-primary-300 font-bold text-sm">
            CC
          </span>
          <span className="text-lg font-semibold text-white">{title}</span>
        </div>
        <div className="flex justify-center mb-5">
          <svg className="animate-spin h-8 w-8 text-primary-400" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path
              className="opacity-90"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
        <p className="text-base font-medium text-white mb-1">{message}</p>
        {detail && <p className="text-xs text-dark-400">{detail}</p>}
      </div>
    </div>
  )
}
