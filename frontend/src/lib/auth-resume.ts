/**
 * Post-redirect resume for Google Auth.
 *
 * Full-page redirect is the primary sign-in path (avoids COOP / popup-closed noise).
 * Before leaving the app we stash the path the user was on; after return we restore it.
 *
 * sessionStorage is intentional: same tab only, cleared on close, not sent to the network.
 */

const RESUME_PATH_KEY = "ceo_compass_auth_resume_path"
const RESUME_AT_KEY = "ceo_compass_auth_resume_at"
/** Ignore stashes older than this (user abandoned mid-flow). */
const RESUME_TTL_MS = 30 * 60 * 1000

function safeSession(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/**
 * Normalize a path for in-app navigation after redirect.
 * Accepts pathname + search + hash; rejects absolute external URLs.
 */
export function normalizeResumePath(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed.startsWith("/")) return null
  if (trimmed.startsWith("//")) return null
  // Reject protocol-relative or scheme injection
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return null
  return trimmed
}

/** Call immediately before signInWithRedirect / linkWithRedirect. */
export function stashAuthResumePath(path?: string | null): void {
  const store = safeSession()
  if (!store) return
  let target = path
  if (!target && typeof window !== "undefined") {
    target = window.location.pathname + window.location.search + window.location.hash
  }
  const normalized = normalizeResumePath(target)
  if (!normalized) return
  try {
    store.setItem(RESUME_PATH_KEY, normalized)
    store.setItem(RESUME_AT_KEY, String(Date.now()))
  } catch {
    /* quota / private mode */
  }
}

/**
 * Read and clear the stashed path if still fresh.
 * Returns null when missing, expired, or invalid.
 */
export function consumeAuthResumePath(): string | null {
  const store = safeSession()
  if (!store) return null
  try {
    const path = normalizeResumePath(store.getItem(RESUME_PATH_KEY))
    const atRaw = store.getItem(RESUME_AT_KEY)
    store.removeItem(RESUME_PATH_KEY)
    store.removeItem(RESUME_AT_KEY)
    if (!path) return null
    const at = atRaw ? Number(atRaw) : 0
    if (!at || Date.now() - at > RESUME_TTL_MS) return null
    return path
  } catch {
    return null
  }
}

export function peekAuthResumePath(): string | null {
  const store = safeSession()
  if (!store) return null
  try {
    return normalizeResumePath(store.getItem(RESUME_PATH_KEY))
  } catch {
    return null
  }
}
