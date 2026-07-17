"use client"

import React, { useState } from "react"
import { formatAuthError, useAuthSession } from "@/lib/AuthSessionProvider"

/**
 * Full-screen entry for users who are not signed in with Google.
 * Main app (navbar/sidebar/home) is hidden until Google auth succeeds.
 */
export function FlashLogin() {
  const { signInWithGoogle, ready } = useAuthSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onGoogle = async () => {
    if (busy) return
    if (!ready) {
      setError("Still starting up - wait a moment, then try again.")
      return
    }
    setError(null)
    setBusy(true)
    try {
      await signInWithGoogle()
      // On success AppShellGate switches to the enter transition.
      // Keep busy true briefly; unmount will clear UI.
    } catch (err) {
      console.error("[flash-login] Google sign-in failed", err)
      setError(formatAuthError(err))
      setBusy(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-b from-dark-950 via-dark-900 to-dark-950 text-dark-100"
      data-testid="flash-login"
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="h-9 w-9 rounded-xl bg-primary-500/20 border border-primary-400/40 flex items-center justify-center text-primary-300 font-bold text-sm">
              CC
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">CEO Compass</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
            Navigate every leadership decision
          </h1>
          <p className="text-sm sm:text-base text-dark-300 leading-relaxed">
            Frameworks, scenarios, and a personal learning loop for operators and CEOs.
            Sign in to open your workspace.
          </p>
        </div>

        <div className="rounded-2xl border border-dark-700/80 bg-dark-900/80 backdrop-blur p-6 sm:p-8 shadow-2xl">
          <button
            type="button"
            onClick={() => void onGoogle()}
            disabled={!ready || busy}
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-white text-dark-900 font-medium text-sm py-3.5 px-4 hover:bg-dark-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? (
              <>
                <Spinner className="text-dark-600" />
                Connecting to Google...
              </>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </button>

          {!ready && (
            <p className="mt-3 text-[11px] text-dark-500 text-center">
              Preparing secure session...
            </p>
          )}

          {error && (
            <div
              className="mt-4 rounded-lg border border-red-800/50 bg-red-950/40 px-3 py-2.5 text-xs text-red-300 text-left leading-relaxed"
              role="alert"
            >
              {error}
            </div>
          )}

          <p className="mt-5 text-[11px] text-dark-500 text-center leading-relaxed">
            Your progress, journal, and reviews sync to your Google account so you can continue on any device.
            Allow pop-ups if the browser blocks the Google window.
          </p>
        </div>

        <ul className="mt-8 grid gap-3 text-left text-xs text-dark-400">
          <li className="flex gap-2">
            <span className="text-primary-400">*</span>
            <span>57+ leadership frameworks with deep concepts</span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary-400">*</span>
            <span>Interactive scenarios and decision practice</span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary-400">*</span>
            <span>Spaced review, pathway, and decision journal</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin h-4 w-4 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}
