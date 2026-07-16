import { ref, get, set, update, remove } from "../firebase"
import { getDb, getDeviceId, userPath, LEGACY_DEVICE_ROOTS } from "./scope"
import type { ReviewRecord } from "../spaced-repetition"

const PENDING_ANON_MERGE_KEY = "ceocompass_pending_anon_merge"
const LAST_MERGE_STATUS_KEY = "ceocompass_last_merge_status"

/** Subtrees under users/{uid} that carry learning data */
const USER_DATA_KEYS = [
  "journal",
  "reviews",
  "progress",
  "viewed",
  "quizResults",
  "scenarioHistory",
  "favoriteQuotes",
  "_meta",
] as const

export type MergeUsersResult = {
  fromUid: string
  toUid: string
  mergedKeys: string[]
  /** True if anon tree was removed or marked tombstoned under fromUid (rare under tight rules). */
  tombstoned: boolean
  /** Always records merge provenance on the destination when possible. */
  recordedOnTarget: boolean
}

export type MergeStatus = {
  state: "success" | "error" | "partial"
  message: string
  fromUid?: string
  toUid?: string
  mergedKeys?: string[]
  at: number
}

export type PendingAnonMerge = {
  fromUid: string
  snapshot: Record<string, unknown> | null
  at: number
}

/**
 * Copy legacy top-level device trees into users/{uid}/ once per deviceId.
 * Re-entry: if deviceId ∉ migrated_device_ids, merge again (second browser/device).
 */
export async function migrateDeviceDataToUser(uid: string): Promise<void> {
  if (typeof window === "undefined") return
  const database = getDb()
  const deviceId = getDeviceId()
  if (!deviceId || deviceId === "server") return

  const metaPath = userPath(uid, "_meta")
  const metaSnap = await get(ref(database, metaPath))
  const meta = metaSnap.exists() ? metaSnap.val() : {}
  const migrated: string[] = Array.isArray(meta.migrated_device_ids)
    ? meta.migrated_device_ids
    : []

  if (migrated.includes(deviceId)) return

  // journal/{deviceId}/entries → users/{uid}/journal/entries
  const journalSnap = await get(ref(database, `journal/${deviceId}/entries`))
  if (journalSnap.exists()) {
    const existing = await get(ref(database, userPath(uid, "journal", "entries")))
    const merged = { ...(existing.exists() ? existing.val() : {}), ...journalSnap.val() }
    await set(ref(database, userPath(uid, "journal", "entries")), merged)
  }

  // reviews/{deviceId} → users/{uid}/reviews
  const reviewsSnap = await get(ref(database, `reviews/${deviceId}`))
  if (reviewsSnap.exists()) {
    const existing = await get(ref(database, userPath(uid, "reviews")))
    const merged = { ...(existing.exists() ? existing.val() : {}), ...reviewsSnap.val() }
    await set(ref(database, userPath(uid, "reviews")), merged)
  }

  // progress/{deviceId} → users/{uid}/progress
  const progressSnap = await get(ref(database, `progress/${deviceId}`))
  if (progressSnap.exists()) {
    const existing = await get(ref(database, userPath(uid, "progress")))
    const cur = existing.exists() ? existing.val() : {}
    const leg = progressSnap.val()
    const completed = Array.from(
      new Set([...(cur.completed_ids || []), ...(leg.completed_ids || [])]),
    )
    await set(ref(database, userPath(uid, "progress")), {
      completed_ids: completed,
      current_module_id: cur.current_module_id || leg.current_module_id || null,
    })
  }

  // viewed/{deviceId} → users/{uid}/viewed
  const viewedSnap = await get(ref(database, `viewed/${deviceId}`))
  if (viewedSnap.exists()) {
    const existing = await get(ref(database, userPath(uid, "viewed")))
    const merged = deepMerge(
      existing.exists() ? existing.val() : {},
      viewedSnap.val(),
    )
    await set(ref(database, userPath(uid, "viewed")), merged)
  }

  // quizResults, scenarioHistory, favoriteQuotes — merge by key
  for (const root of ["quizResults", "scenarioHistory", "favoriteQuotes"] as const) {
    const snap = await get(ref(database, `${root}/${deviceId}`))
    if (!snap.exists()) continue
    const dest = userPath(uid, root)
    const existing = await get(ref(database, dest))
    const merged = deepMerge(existing.exists() ? existing.val() : {}, snap.val())
    await set(ref(database, dest), merged)
  }

  await update(ref(database, metaPath), {
    migrated_device_ids: [...migrated, deviceId],
    last_migrated_device: deviceId,
    last_migrated_at: Date.now(),
  })

  // Silence unused import warning for documentation of roots
  void LEGACY_DEVICE_ROOTS
}

/**
 * Snapshot users/{uid} while still authenticated as that uid (required by RTDB rules).
 * Call this BEFORE signInWithCredential when handling credential-already-in-use.
 */
export async function snapshotUserTree(uid: string): Promise<Record<string, unknown> | null> {
  if (!uid) return null
  const database = getDb()
  try {
    const snap = await get(ref(database, userPath(uid)))
    if (!snap.exists()) return null
    const val = snap.val()
    if (!val || typeof val !== "object") return null
    return val as Record<string, unknown>
  } catch (err) {
    console.warn("[migrate] snapshotUserTree failed", uid, err)
    return null
  }
}

/**
 * Merge learning data from one user tree into another.
 *
 * RTDB rules only allow read/write when auth.uid === path uid, so after Google sign-in
 * the client cannot re-read users/{fromUid}. Prefer passing `fromSnapshot` taken while
 * still signed in as the anonymous user. When `fromSnapshot` is omitted, attempts a live
 * read of users/{fromUid} (only works if still that user or rules are open).
 *
 * After merge, attempts to delete/tombstone the anon tree (usually fails under tight rules);
 * always records provenance on the destination `_meta`.
 */
export async function mergeUsersData(
  fromUid: string,
  toUid: string,
  fromSnapshot?: Record<string, unknown> | null,
): Promise<MergeUsersResult> {
  if (!fromUid || !toUid) {
    throw new Error("mergeUsersData requires fromUid and toUid")
  }
  if (fromUid === toUid) {
    return {
      fromUid,
      toUid,
      mergedKeys: [],
      tombstoned: false,
      recordedOnTarget: false,
    }
  }

  const database = getDb()
  let source = fromSnapshot ?? null
  if (!source) {
    try {
      const snap = await get(ref(database, userPath(fromUid)))
      if (snap.exists()) source = snap.val() as Record<string, unknown>
    } catch (err) {
      console.warn("[migrate] cannot read source user tree; need preloaded snapshot", err)
    }
  }

  if (!source || typeof source !== "object") {
    // Nothing to merge — still record attempt so UI can clear pending state
    const recorded = await recordMergeProvenance(toUid, fromUid, [])
    return {
      fromUid,
      toUid,
      mergedKeys: [],
      tombstoned: false,
      recordedOnTarget: recorded,
    }
  }

  const mergedKeys: string[] = []

  // journal/entries — union by entry id (source fills missing keys only for conflicts? prefer keep both)
  if (source.journal && typeof source.journal === "object") {
    const srcJournal = source.journal as Record<string, unknown>
    const srcEntries =
      srcJournal.entries && typeof srcJournal.entries === "object"
        ? (srcJournal.entries as Record<string, unknown>)
        : null
    if (srcEntries && Object.keys(srcEntries).length) {
      const destPath = userPath(toUid, "journal", "entries")
      const existing = await get(ref(database, destPath))
      const merged = {
        ...(existing.exists() ? (existing.val() as object) : {}),
        ...srcEntries,
      }
      await set(ref(database, destPath), merged)
      mergedKeys.push("journal")
    }
  }

  // reviews — prefer higher reviewCount, else later lastReviewedAt
  if (source.reviews && typeof source.reviews === "object") {
    const srcReviews = source.reviews as Record<string, ReviewRecord>
    const destPath = userPath(toUid, "reviews")
    const existing = await get(ref(database, destPath))
    const dest: Record<string, ReviewRecord> = existing.exists()
      ? { ...(existing.val() as Record<string, ReviewRecord>) }
      : {}
    let changed = false
    for (const [conceptId, r] of Object.entries(srcReviews)) {
      if (!r || typeof r !== "object") continue
      const prev = dest[conceptId]
      if (!prev) {
        dest[conceptId] = r
        changed = true
        continue
      }
      if ((r.reviewCount || 0) > (prev.reviewCount || 0)) {
        dest[conceptId] = r
        changed = true
      } else if (
        (r.reviewCount || 0) === (prev.reviewCount || 0) &&
        new Date(r.lastReviewedAt || 0) > new Date(prev.lastReviewedAt || 0)
      ) {
        dest[conceptId] = r
        changed = true
      }
    }
    if (changed || Object.keys(srcReviews).length) {
      await set(ref(database, destPath), dest)
      mergedKeys.push("reviews")
    }
  }

  // progress — union completed_ids; keep existing current_module_id if set
  if (source.progress && typeof source.progress === "object") {
    const leg = source.progress as {
      completed_ids?: string[]
      current_module_id?: string | null
    }
    const destPath = userPath(toUid, "progress")
    const existing = await get(ref(database, destPath))
    const cur = existing.exists() ? existing.val() : {}
    await set(ref(database, destPath), {
      completed_ids: Array.from(
        new Set([...(cur.completed_ids || []), ...(leg.completed_ids || [])]),
      ),
      current_module_id: cur.current_module_id || leg.current_module_id || null,
    })
    mergedKeys.push("progress")
  }

  // viewed, quizResults, scenarioHistory, favoriteQuotes — deep merge (source fills gaps)
  for (const key of ["viewed", "quizResults", "scenarioHistory", "favoriteQuotes"] as const) {
    const src = source[key]
    if (!src || typeof src !== "object") continue
    const destPath = userPath(toUid, key)
    const existing = await get(ref(database, destPath))
    const merged = deepMerge(
      existing.exists() ? (existing.val() as Record<string, unknown>) : {},
      src as Record<string, unknown>,
    )
    await set(ref(database, destPath), merged)
    mergedKeys.push(key)
  }

  // Merge migrated_device_ids from source _meta into destination
  if (source._meta && typeof source._meta === "object") {
    const srcMeta = source._meta as { migrated_device_ids?: string[] }
    if (Array.isArray(srcMeta.migrated_device_ids) && srcMeta.migrated_device_ids.length) {
      const metaPath = userPath(toUid, "_meta")
      const metaSnap = await get(ref(database, metaPath))
      const meta = metaSnap.exists() ? metaSnap.val() : {}
      const existing: string[] = Array.isArray(meta.migrated_device_ids)
        ? meta.migrated_device_ids
        : []
      const union = Array.from(new Set([...existing, ...srcMeta.migrated_device_ids]))
      await update(ref(database, metaPath), { migrated_device_ids: union })
      if (!mergedKeys.includes("_meta")) mergedKeys.push("_meta")
    }
  }

  const recordedOnTarget = await recordMergeProvenance(toUid, fromUid, mergedKeys)

  // Tombstone / delete source tree. After Google sign-in this usually fails
  // (auth.uid !== fromUid). Best-effort only — never drop destination data if this fails.
  let tombstoned = false
  try {
    await set(ref(database, userPath(fromUid, "_meta", "tombstone")), {
      merged_into: toUid,
      at: Date.now(),
      merged_keys: mergedKeys,
    })
    // Prefer full remove after tombstone marker is set (atomic-ish intent)
    await remove(ref(database, userPath(fromUid)))
    tombstoned = true
  } catch {
    // Expected under production rules — orphan anon tree remains until admin purge
    tombstoned = false
  }

  void USER_DATA_KEYS
  return { fromUid, toUid, mergedKeys, tombstoned, recordedOnTarget }
}

async function recordMergeProvenance(
  toUid: string,
  fromUid: string,
  mergedKeys: string[],
): Promise<boolean> {
  try {
    const database = getDb()
    const metaPath = userPath(toUid, "_meta")
    const metaSnap = await get(ref(database, metaPath))
    const meta = metaSnap.exists() ? metaSnap.val() : {}
    const prev: unknown[] = Array.isArray(meta.merged_from_anon)
      ? meta.merged_from_anon
      : []
    const entry = {
      uid: fromUid,
      at: Date.now(),
      keys: mergedKeys,
    }
    // Dedup by uid — keep latest
    const filtered = prev.filter(
      (e) => !(e && typeof e === "object" && (e as { uid?: string }).uid === fromUid),
    )
    await update(ref(database, metaPath), {
      merged_from_anon: [...filtered, entry],
      last_anon_merge_at: Date.now(),
      last_anon_merge_from: fromUid,
    })
    return true
  } catch (err) {
    console.warn("[migrate] recordMergeProvenance failed", err)
    return false
  }
}

// --- sessionStorage helpers for credential-in-use flow (popup + redirect) ---

export function stashPendingAnonMerge(
  fromUid: string,
  snapshot: Record<string, unknown> | null,
): void {
  if (typeof window === "undefined") return
  const payload: PendingAnonMerge = { fromUid, snapshot, at: Date.now() }
  try {
    sessionStorage.setItem(PENDING_ANON_MERGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.warn("[migrate] failed to stash pending anon merge (quota?)", err)
  }
}

/** Read pending merge without clearing (for UI). */
export function peekPendingAnonMerge(): PendingAnonMerge | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(PENDING_ANON_MERGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingAnonMerge
    if (!parsed?.fromUid) return null
    return parsed
  } catch {
    return null
  }
}

/** Read and clear pending merge (call once after Google sign-in). */
export function takePendingAnonMerge(): PendingAnonMerge | null {
  const pending = peekPendingAnonMerge()
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(PENDING_ANON_MERGE_KEY)
    } catch {
      /* ignore */
    }
  }
  return pending
}

export function setLastMergeStatus(status: MergeStatus): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(LAST_MERGE_STATUS_KEY, JSON.stringify(status))
  } catch {
    /* ignore */
  }
}

export function getLastMergeStatus(): MergeStatus | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(LAST_MERGE_STATUS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as MergeStatus
  } catch {
    return null
  }
}

export function clearLastMergeStatus(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(LAST_MERGE_STATUS_KEY)
  } catch {
    /* ignore */
  }
}

function deepMerge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a }
  for (const [k, v] of Object.entries(b || {})) {
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      out[k] &&
      typeof out[k] === "object" &&
      !Array.isArray(out[k])
    ) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v as Record<string, unknown>)
    } else if (out[k] === undefined) {
      out[k] = v
    }
  }
  return out
}
