"use client"

import { useState, useEffect, useCallback } from "react"
import { auth, signInWithPopup, googleProvider, signOut as fbSignOut, onAuthStateChanged } from "./firebase"
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
    return unsub
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!auth) return
    await signInWithPopup(auth, googleProvider)
  }, [])

  const signOut = useCallback(async () => {
    if (!auth) return
    await fbSignOut(auth)
  }, [])

  const isAdmin = user?.email === ADMIN_EMAIL

  return { user, isAdmin, loading, signInWithGoogle, signOut }
}
