"use client"

/**
 * Compatibility hook — prefers AuthSessionProvider context when mounted.
 */
import { useAuthSession } from "./AuthSessionProvider"

export function useAuth() {
  const session = useAuthSession()
  return {
    user: session.user,
    isAdmin: session.isAdmin,
    loading: !session.ready,
    isAnonymous: session.isAnonymous,
    signInWithGoogle: session.signInWithGoogle,
    linkGoogle: session.linkGoogle,
    signOut: session.signOut,
  }
}
