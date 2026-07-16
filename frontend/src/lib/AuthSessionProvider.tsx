"use client"

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"
import {
  auth,
  db,
  onAuthStateChanged,
  signInAnonymously,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  linkWithPopup,
  linkWithRedirect,
  googleProvider,
  GoogleAuthProvider,
  signOut as fbSignOut,
  ref,
  get,
} from "./firebase"
import {
  migrateDeviceDataToUser,
  prepareAnonMerge,
  runPendingAnonMerge,
  peekPendingAnonMerge,
  setLastMergeStatus,
  getLastMergeStatus,
  clearLastMergeStatus,
  type MergeStatus,
} from "./user-data"
import type { User } from "firebase/auth"

type AuthSession = {
  user: User | null
  ready: boolean
  isAdmin: boolean
  isAnonymous: boolean
  /** Status of the last anon→Google credential-in-use merge (for Profile banner). */
  mergeStatus: MergeStatus | null
  clearMergeStatus: () => void
  /** Retry a failed merge while already signed in as Google (uses stashed pending snapshot). */
  retryPendingMerge: () => Promise<void>
  ensureAnonymous: () => Promise<void>
  linkGoogle: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthSessionContext = createContext<AuthSession>({
  user: null,
  ready: false,
  isAdmin: false,
  isAnonymous: false,
  mergeStatus: null,
  clearMergeStatus: () => {},
  retryPendingMerge: async () => {},
  ensureAnonymous: async () => {},
  linkGoogle: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
})

export function useAuthSession() {
  return useContext(AuthSessionContext)
}

async function fetchIsAdmin(uid: string): Promise<boolean> {
  if (!db) return false
  try {
    const snap = await get(ref(db, `admins/${uid}`))
    return snap.exists() && snap.val() === true
  } catch {
    return false
  }
}

const POPUP_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
])

const CREDENTIAL_IN_USE_CODES = new Set([
  "auth/credential-already-in-use",
  "auth/email-already-in-use",
])

function authErrorCode(err: unknown): string | undefined {
  return (err as { code?: string })?.code
}

function credentialFromAuthError(err: unknown) {
  return GoogleAuthProvider.credentialFromError(
    err as Parameters<typeof GoogleAuthProvider.credentialFromError>[0],
  )
}

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mergeStatus, setMergeStatus] = useState<MergeStatus | null>(null)
  const mergeInFlight = useRef(false)

  const clearMergeStatus = useCallback(() => {
    clearLastMergeStatus()
    setMergeStatus(null)
  }, [])

  const applyMergeStatus = useCallback((status: MergeStatus | null) => {
    if (!status) return
    setMergeStatus(status)
  }, [])

  const ensureAnonymous = useCallback(async () => {
    if (!auth) return
    if (auth.currentUser) return
    await signInAnonymously(auth)
  }, [])

  const retryPendingMerge = useCallback(async () => {
    if (!auth?.currentUser || auth.currentUser.isAnonymous) {
      const status: MergeStatus = {
        state: "error",
        message: "Retry merge requires being signed in with Google.",
        at: Date.now(),
        canRetry: false,
      }
      setLastMergeStatus(status)
      setMergeStatus(status)
      return
    }
    if (!peekPendingAnonMerge()) {
      const status: MergeStatus = {
        state: "error",
        message: "No pending anonymous data to merge. If progress is missing, import a JSON export.",
        at: Date.now(),
        canRetry: false,
      }
      setLastMergeStatus(status)
      setMergeStatus(status)
      return
    }
    if (mergeInFlight.current) return
    mergeInFlight.current = true
    try {
      const status = await runPendingAnonMerge(auth.currentUser.uid)
      if (status) applyMergeStatus(status)
    } finally {
      mergeInFlight.current = false
    }
  }, [applyMergeStatus])

  useEffect(() => {
    // Hydrate last merge banner for Profile
    const last = getLastMergeStatus()
    if (last) setMergeStatus(last)
  }, [])

  useEffect(() => {
    if (!auth) {
      setReady(true)
      return
    }

    let cancelled = false

    // Post-redirect resume: link success keeps uid; credential-in-use needs recovery + merge
    ;(async () => {
      try {
        const result = await getRedirectResult(auth!)
        if (cancelled) return
        if (result?.user && !result.user.isAnonymous && peekPendingAnonMerge()) {
          if (mergeInFlight.current) return
          mergeInFlight.current = true
          try {
            const status = await runPendingAnonMerge(result.user.uid)
            if (!cancelled && status) applyMergeStatus(status)
          } finally {
            mergeInFlight.current = false
          }
        }
      } catch (err: unknown) {
        const code = authErrorCode(err)
        // linkWithRedirect / signInWithRedirect can throw credential-in-use on return
        if (code && CREDENTIAL_IN_USE_CODES.has(code)) {
          try {
            // Still anonymous on this error path — snapshot now if we somehow didn't pre-stash
            // (should have prepared before linkWithRedirect; prepare again is safe if still anon)
            if (auth!.currentUser?.isAnonymous && !peekPendingAnonMerge()) {
              const prep = await prepareAnonMerge(auth!.currentUser.uid)
              if (!prep.ok) {
                const status: MergeStatus = {
                  state: "error",
                  message: prep.message,
                  fromUid: prep.fromUid,
                  at: Date.now(),
                  canRetry: false,
                }
                setLastMergeStatus(status)
                if (!cancelled) applyMergeStatus(status)
                return
              }
            }

            const credential = credentialFromAuthError(err)
            if (!credential) {
              const status: MergeStatus = {
                state: "error",
                message:
                  "This Google account is already linked to another user, but the credential could not be recovered after redirect. Try Link Google again (popup), or export JSON first.",
                at: Date.now(),
                canRetry: Boolean(peekPendingAnonMerge()),
              }
              setLastMergeStatus(status)
              if (!cancelled) applyMergeStatus(status)
              return
            }

            if (!peekPendingAnonMerge()) {
              const status: MergeStatus = {
                state: "error",
                message:
                  "Google account is already in use, but no anonymous progress snapshot was saved before redirect. Stay anonymous if still signed out of Google, export JSON, then sign in.",
                at: Date.now(),
                canRetry: false,
              }
              setLastMergeStatus(status)
              if (!cancelled) applyMergeStatus(status)
              return
            }

            if (mergeInFlight.current) return
            mergeInFlight.current = true
            try {
              const credResult = await signInWithCredential(auth!, credential)
              const status = await runPendingAnonMerge(credResult.user.uid)
              if (!cancelled && status) applyMergeStatus(status)
            } finally {
              mergeInFlight.current = false
            }
          } catch (recoveryErr) {
            console.error("[auth] redirect credential-in-use recovery failed", recoveryErr)
            const status: MergeStatus = {
              state: "error",
              message:
                recoveryErr instanceof Error
                  ? `Could not complete Google sign-in after redirect: ${recoveryErr.message}`
                  : "Could not complete Google sign-in after redirect.",
              at: Date.now(),
              canRetry: Boolean(peekPendingAnonMerge()),
            }
            setLastMergeStatus(status)
            if (!cancelled) applyMergeStatus(status)
          }
        }
        // Other getRedirectResult errors (no pending redirect, etc.) — ignore
      }
    })()

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (cancelled) return

      if (!u) {
        try {
          await signInAnonymously(auth!)
        } catch (err) {
          console.error("[auth] anonymous sign-in failed — enable Anonymous in Firebase Console", err)
          if (!cancelled) {
            setUser(null)
            setIsAdmin(false)
            setReady(true)
          }
        }
        return
      }

      setUser(u)

      // Pending stash on a non-anon user (popup recovery, remount, retry after reload)
      if (!u.isAnonymous && peekPendingAnonMerge() && !mergeInFlight.current) {
        mergeInFlight.current = true
        try {
          const status = await runPendingAnonMerge(u.uid)
          if (!cancelled && status) applyMergeStatus(status)
        } finally {
          mergeInFlight.current = false
        }
      }

      try {
        await migrateDeviceDataToUser(u.uid)
      } catch (err) {
        console.warn("[auth] device migration skipped/failed", err)
      }
      const admin = await fetchIsAdmin(u.uid)
      const allowEmailFallback =
        process.env.NODE_ENV === "development" ||
        process.env.NEXT_PUBLIC_ADMIN_EMAIL_FALLBACK === "true"
      const emailAdmin =
        allowEmailFallback && u.email === "kevinkicho@gmail.com"
      if (!cancelled) {
        setIsAdmin(admin || emailAdmin)
        setReady(true)
      }
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [applyMergeStatus])

  const linkGoogle = useCallback(async () => {
    if (!auth?.currentUser) return

    const abortWithStatus = (message: string, fromUid?: string) => {
      const status: MergeStatus = {
        state: "error",
        message,
        fromUid,
        at: Date.now(),
        canRetry: false,
      }
      setLastMergeStatus(status)
      setMergeStatus(status)
    }

    /**
     * Snapshot+stash while still anonymous, then sign into existing Google account.
     * Never proceeds if prepare fails when we still have access to the anon uid.
     */
    const tryCredentialInUseRecovery = async (err: unknown) => {
      const anonUid = auth!.currentUser?.isAnonymous ? auth!.currentUser.uid : null
      if (anonUid) {
        const prep = await prepareAnonMerge(anonUid)
        if (!prep.ok) {
          abortWithStatus(prep.message, prep.fromUid)
          return
        }
      } else if (!peekPendingAnonMerge()) {
        abortWithStatus(
          "Google credential already in use, but no anonymous session snapshot is available to merge.",
        )
        return
      }

      mergeInFlight.current = true
      try {
        const credential = credentialFromAuthError(err)
        if (credential) {
          const credResult = await signInWithCredential(auth!, credential)
          const status = await runPendingAnonMerge(credResult.user.uid)
          if (status) setMergeStatus(status)
          return
        }

        try {
          const popupResult = await signInWithPopup(auth!, googleProvider)
          const status = await runPendingAnonMerge(popupResult.user.uid)
          if (status) setMergeStatus(status)
        } catch (e2: unknown) {
          const c2 = authErrorCode(e2)
          if (c2 && POPUP_FALLBACK_CODES.has(c2)) {
            // pending already stashed; release lock so return path can merge
            mergeInFlight.current = false
            await signInWithRedirect(auth!, googleProvider)
            return
          }
          throw e2
        }
      } finally {
        if (mergeInFlight.current) mergeInFlight.current = false
      }
    }

    try {
      if (auth.currentUser.isAnonymous) {
        await linkWithPopup(auth.currentUser, googleProvider)
        // Link success: same uid upgraded — no cross-uid merge needed
      } else {
        await signInWithPopup(auth, googleProvider)
      }
    } catch (err: unknown) {
      const code = authErrorCode(err)
      if (code && POPUP_FALLBACK_CODES.has(code)) {
        // First-hop redirect: MUST snapshot before leaving the page
        if (auth.currentUser?.isAnonymous) {
          const prep = await prepareAnonMerge(auth.currentUser.uid)
          if (!prep.ok) {
            abortWithStatus(prep.message, prep.fromUid)
            return
          }
          await linkWithRedirect(auth.currentUser, googleProvider)
        } else {
          await signInWithRedirect(auth, googleProvider)
        }
      } else if (code && CREDENTIAL_IN_USE_CODES.has(code)) {
        await tryCredentialInUseRecovery(err)
      } else {
        throw err
      }
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!auth) return
    if (auth.currentUser?.isAnonymous) {
      await linkGoogle()
      return
    }
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err: unknown) {
      const code = authErrorCode(err)
      if (code && POPUP_FALLBACK_CODES.has(code)) {
        await signInWithRedirect(auth, googleProvider)
      } else {
        throw err
      }
    }
  }, [linkGoogle])

  const signOut = useCallback(async () => {
    if (!auth) return
    await fbSignOut(auth)
    // onAuthStateChanged will re-anon
  }, [])

  const value: AuthSession = {
    user,
    ready,
    isAdmin,
    isAnonymous: Boolean(user?.isAnonymous),
    mergeStatus,
    clearMergeStatus,
    retryPendingMerge,
    ensureAnonymous,
    linkGoogle,
    signInWithGoogle,
    signOut,
  }

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  )
}
