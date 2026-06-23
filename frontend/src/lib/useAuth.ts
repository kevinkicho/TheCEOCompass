"use client"

import { useState, useEffect, useCallback } from "react"
import { auth, signInWithPopup, googleProvider, signOut as fbSignOut, onAuthStateChanged } from "./firebase"
import { signInWithRedirect, getRedirectResult } from "firebase/auth"
import type { User } from "firebase/auth"

const ADMIN_EMAIL = "kevinkicho@gmail.com"

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth) { setLoading(false); return }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    // Handle redirect result (fallback from blocked popup)
    getRedirectResult(auth).catch(() => {})
    return unsub
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!auth) return
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err: any) {
      // Popup blocked or failed — fall back to redirect
      if (err.code === "auth/popup-blocked" || err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
        await signInWithRedirect(auth, googleProvider)
      } else {
        throw err
      }
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!auth) return
    await fbSignOut(auth)
  }, [])

  const isAdmin = user?.email === ADMIN_EMAIL

  return { user, isAdmin, loading, signInWithGoogle, signOut }
}
