"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import {
  auth,
  db,
  onAuthStateChanged,
  signInAnonymously,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  linkWithPopup,
  linkWithRedirect,
  googleProvider,
  signOut as fbSignOut,
  ref,
  get,
} from "./firebase"
import { migrateDeviceDataToUser } from "./user-data"
import type { User } from "firebase/auth"

type AuthSession = {
  user: User | null
  ready: boolean
  isAdmin: boolean
  isAnonymous: boolean
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

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const ensureAnonymous = useCallback(async () => {
    if (!auth) return
    if (auth.currentUser) return
    await signInAnonymously(auth)
  }, [])

  useEffect(() => {
    if (!auth) {
      setReady(true)
      return
    }

    let cancelled = false

    getRedirectResult(auth).catch(() => {})

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
      try {
        await migrateDeviceDataToUser(u.uid)
      } catch (err) {
        console.warn("[auth] device migration skipped/failed", err)
      }
      const admin = await fetchIsAdmin(u.uid)
      // Fallback for local emergency only: known owner email while admins node empty
      const emailAdmin = u.email === "kevinkicho@gmail.com"
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
    try {
      if (auth.currentUser.isAnonymous) {
        await linkWithPopup(auth.currentUser, googleProvider)
      } else {
        await signInWithPopup(auth, googleProvider)
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (
        code === "auth/popup-blocked" ||
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request"
      ) {
        if (auth.currentUser?.isAnonymous) {
          await linkWithRedirect(auth.currentUser, googleProvider)
        } else {
          await signInWithRedirect(auth, googleProvider)
        }
      } else if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
        // Fall back to signing in with Google; prior anon tree may need manual merge later
        try {
          await signInWithPopup(auth, googleProvider)
        } catch (e2: unknown) {
          const c2 = (e2 as { code?: string })?.code
          if (c2 === "auth/popup-blocked" || c2 === "auth/popup-closed-by-user") {
            await signInWithRedirect(auth, googleProvider)
          } else {
            throw e2
          }
        }
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
      if (
        code === "auth/popup-blocked" ||
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request"
      ) {
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
