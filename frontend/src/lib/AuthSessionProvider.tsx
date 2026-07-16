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
  mergeUsersData,
  snapshotUserTree,
  stashPendingAnonMerge,
  takePendingAnonMerge,
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

/**
 * Snapshot current anon tree + stash for post-sign-in merge.
 * Must run while still authenticated as the anonymous user (RTDB rules).
 */
async function prepareAnonMerge(anonUid: string): Promise<void> {
  let snapshot: Record<string, unknown> | null = null
  try {
    snapshot = await snapshotUserTree(anonUid)
  } catch (err) {
    console.warn("[auth] anon snapshot failed; merge may be empty", err)
  }
  stashPendingAnonMerge(anonUid, snapshot)
}

/**
 * After Google sign-in (popup or redirect), merge stashed anon data into the Google uid.
 */
async function runPendingAnonMerge(googleUid: string): Promise<MergeStatus | null> {
  const pending = takePendingAnonMerge()
  if (!pending?.fromUid) return null
  if (pending.fromUid === googleUid) return null

  try {
    const result = await mergeUsersData(pending.fromUid, googleUid, pending.snapshot)
    const keys = result.mergedKeys
    const status: MergeStatus =
      keys.length === 0
        ? {
            state: "success",
            message:
              "Signed in with an existing Google account. No anonymous learning data was found to merge.",
            fromUid: pending.fromUid,
            toUid: googleUid,
            mergedKeys: keys,
            at: Date.now(),
          }
        : {
            state: result.recordedOnTarget ? "success" : "partial",
            message: result.recordedOnTarget
              ? `Merged your anonymous progress (${keys.join(", ")}) into this Google account.`
              : `Merged data (${keys.join(", ")}) but could not write merge provenance. Progress should still be present.`,
            fromUid: pending.fromUid,
            toUid: googleUid,
            mergedKeys: keys,
            at: Date.now(),
          }
    setLastMergeStatus(status)
    return status
  } catch (err) {
    console.error("[auth] anon→Google merge failed", err)
    // Re-stash so a refresh can retry? Safer to surface error and keep data in snapshot via status.
    // Re-stash on failure so user can retry without losing snapshot.
    stashPendingAnonMerge(pending.fromUid, pending.snapshot)
    const status: MergeStatus = {
      state: "error",
      message:
        err instanceof Error
          ? `Could not merge anonymous data: ${err.message}. Your Google account is signed in; try again from Profile or export from another device.`
          : "Could not merge anonymous data into this Google account.",
      fromUid: pending.fromUid,
      toUid: googleUid,
      at: Date.now(),
    }
    setLastMergeStatus(status)
    return status
  }
}

const POPUP_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
])

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

  const ensureAnonymous = useCallback(async () => {
    if (!auth) return
    if (auth.currentUser) return
    await signInAnonymously(auth)
  }, [])

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

    // Post-redirect resume: link completion keeps uid; credential-in-use sign-in needs merge
    ;(async () => {
      try {
        const result = await getRedirectResult(auth!)
        if (cancelled || !result?.user) return
        if (result.user.isAnonymous) return
        // If we stashed anon data before redirect, merge now
        if (peekPendingAnonMerge()) {
          if (mergeInFlight.current) return
          mergeInFlight.current = true
          try {
            const status = await runPendingAnonMerge(result.user.uid)
            if (!cancelled && status) setMergeStatus(status)
          } finally {
            mergeInFlight.current = false
          }
        }
      } catch {
        /* no redirect result or error — ignore */
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

      // If we landed on a non-anon user with a pending stash (e.g. popup path finished
      // before this callback), run merge once.
      if (!u.isAnonymous && peekPendingAnonMerge() && !mergeInFlight.current) {
        mergeInFlight.current = true
        try {
          const status = await runPendingAnonMerge(u.uid)
          if (!cancelled && status) setMergeStatus(status)
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
      // Emergency local-only fallback while admins/{uid} is not bootstrapped yet
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
  }, [])

  const linkGoogle = useCallback(async () => {
    if (!auth?.currentUser) return

    const tryCredentialInUseRecovery = async (err: unknown) => {
      const anonUid = auth!.currentUser?.isAnonymous ? auth!.currentUser.uid : null
      if (anonUid) {
        await prepareAnonMerge(anonUid)
      }

      // Hold the lock so onAuthStateChanged does not double-merge while we finish sign-in
      mergeInFlight.current = true
      try {
        // Prefer credential embedded in the link error (no second popup)
        // Firebase types require AuthError; cast from unknown catch value
        const credential = GoogleAuthProvider.credentialFromError(
          err as Parameters<typeof GoogleAuthProvider.credentialFromError>[0],
        )
        if (credential) {
          const credResult = await signInWithCredential(auth!, credential)
          const status = await runPendingAnonMerge(credResult.user.uid)
          if (status) setMergeStatus(status)
          return
        }

        // Fallback: full Google sign-in popup / redirect
        try {
          const popupResult = await signInWithPopup(auth!, googleProvider)
          const status = await runPendingAnonMerge(popupResult.user.uid)
          if (status) setMergeStatus(status)
        } catch (e2: unknown) {
          const c2 = (e2 as { code?: string })?.code
          if (c2 && POPUP_FALLBACK_CODES.has(c2)) {
            // pending merge already stashed; redirect return will complete merge
            // release lock so getRedirectResult / onAuth can run merge after return
            mergeInFlight.current = false
            await signInWithRedirect(auth!, googleProvider)
            return
          }
          throw e2
        }
      } finally {
        // Keep lock false after popup/credential path (redirect path cleared above)
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
      const code = (err as { code?: string })?.code
      if (code && POPUP_FALLBACK_CODES.has(code)) {
        if (auth.currentUser?.isAnonymous) {
          await linkWithRedirect(auth.currentUser, googleProvider)
        } else {
          await signInWithRedirect(auth, googleProvider)
        }
      } else if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
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
      const code = (err as { code?: string })?.code
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
