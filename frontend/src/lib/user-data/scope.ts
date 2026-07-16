import { auth, db } from "../firebase"

const DEVICE_ID_KEY = "ceocompass_device_id"

export function getDb() {
  if (!db) throw new Error("Firebase not configured")
  return db!
}

/** Anonymous or Google uid for private RTDB trees. Throws if auth session not ready. */
export function requireUid(): string {
  const uid = auth?.currentUser?.uid
  if (!uid) {
    throw new Error("Not signed in — waiting for auth session")
  }
  return uid
}

export function tryUid(): string | null {
  return auth?.currentUser?.uid ?? null
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server"
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

/** `users/{uid}/...` write path helper */
export function userPath(uid: string, ...segments: string[]): string {
  return ["users", uid, ...segments.filter(Boolean)].join("/")
}

export const LEGACY_DEVICE_ROOTS = [
  "journal",
  "reviews",
  "progress",
  "viewed",
  "quizResults",
  "scenarioHistory",
  "favoriteQuotes",
] as const
