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
  /** Keys that failed mid-merge (partial success possible). */
  failedKeys: string[]
  /** True if anon tree was removed or marked tombstoned under fromUid (rare under tight rules). */
  tombstoned: boolean
  /** Always records merge provenance on the destination when possible. */
  recordedOnTarget: boolean
  /**
   * True when source was confirmed empty (snapshot ok + no mergeable data).
   * False when empty because snapshot failed / missing — callers must not claim "no data".
   */
  sourceConfirmedEmpty: boolean
}

export type MergeStatus = {
  state: "success" | "error" | "partial"
  message: string
  fromUid?: string
  toUid?: string
  mergedKeys?: string[]
  at: number
  /** True when a re-stashed pending merge can be retried while signed in as Google. */
  canRetry?: boolean
}

/** Discriminated snapshot outcome — empty tree ≠ failed read. */
export type SnapshotResult =
  | { ok: true; data: Record<string, unknown> | null }
  | { ok: false; error: string }

export type PendingAnonMerge = {
  fromUid: string
  snapshot: Record<string, unknown> | null
  /** True only when snapshotUserTree succeeded (empty tree is still ok: true). */
  snapshotOk: boolean
  at: number
}

export type PrepareAnonMergeResult =
  | { ok: true; empty: boolean; fromUid: string }
  | { ok: false; reason: "snapshot_failed" | "stash_failed"; message: string; fromUid: string }

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
    const merged = deepMergePreferDest(
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
    const merged = deepMergePreferDest(existing.exists() ? existing.val() : {}, snap.val())
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
 * Distinguishes empty tree (ok) from read failure (not ok).
 */
export async function snapshotUserTree(uid: string): Promise<SnapshotResult> {
  if (!uid) return { ok: false, error: "Missing uid for snapshot" }
  try {
    const database = getDb()
    const snap = await get(ref(database, userPath(uid)))
    if (!snap.exists()) return { ok: true, data: null }
    const val = snap.val()
    if (!val || typeof val !== "object") return { ok: true, data: null }
    return { ok: true, data: val as Record<string, unknown> }
  } catch (err) {
    const message = err instanceof Error ? err.message : "RTDB snapshot failed"
    console.warn("[migrate] snapshotUserTree failed", uid, err)
    return { ok: false, error: message }
  }
}

function hasMergeableData(source: Record<string, unknown> | null): boolean {
  if (!source) return false
  for (const key of USER_DATA_KEYS) {
    if (key === "_meta") {
      const meta = source._meta
      if (
        meta &&
        typeof meta === "object" &&
        Array.isArray((meta as { migrated_device_ids?: string[] }).migrated_device_ids) &&
        (meta as { migrated_device_ids: string[] }).migrated_device_ids.length > 0
      ) {
        return true
      }
      continue
    }
    const v = source[key]
    if (v == null) continue
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0) continue
    return true
  }
  return false
}

/**
 * Merge learning data from one user tree into another.
 *
 * RTDB rules only allow read/write when auth.uid === path uid, so after Google sign-in
 * the client cannot re-read users/{fromUid}. Prefer passing `fromSnapshot` taken while
 * still signed in as the anonymous user.
 *
 * Map-shaped trees (journal, viewed, quiz, scenarios, favorites): union by id;
 * anonymous (source) overwrites destination on same id (source-wins).
 * Reviews: higher reviewCount, else later lastReviewedAt.
 * Progress: union completed_ids; prefer existing current_module_id.
 *
 * Per-key errors are collected in failedKeys (partial merge) instead of aborting mid-way
 * without reporting what landed.
 */
export async function mergeUsersData(
  fromUid: string,
  toUid: string,
  fromSnapshot?: Record<string, unknown> | null,
  opts?: { snapshotOk?: boolean },
): Promise<MergeUsersResult> {
  if (!fromUid || !toUid) {
    throw new Error("mergeUsersData requires fromUid and toUid")
  }
  if (fromUid === toUid) {
    return {
      fromUid,
      toUid,
      mergedKeys: [],
      failedKeys: [],
      tombstoned: false,
      recordedOnTarget: false,
      sourceConfirmedEmpty: true,
    }
  }

  const snapshotOk = opts?.snapshotOk !== false
  const database = getDb()
  let source = fromSnapshot ?? null
  let liveReadFailed = false
  if (fromSnapshot === undefined) {
    try {
      const snap = await get(ref(database, userPath(fromUid)))
      if (snap.exists()) source = snap.val() as Record<string, unknown>
    } catch (err) {
      console.warn("[migrate] cannot read source user tree; need preloaded snapshot", err)
      liveReadFailed = true
    }
  }

  // Snapshot failed and no usable source → do not claim empty success
  if (!snapshotOk || liveReadFailed) {
    if (!source || typeof source !== "object") {
      return {
        fromUid,
        toUid,
        mergedKeys: [],
        failedKeys: ["*"],
        tombstoned: false,
        recordedOnTarget: false,
        sourceConfirmedEmpty: false,
      }
    }
  }

  if (!source || typeof source !== "object" || !hasMergeableData(source)) {
    const recorded = await recordMergeProvenance(toUid, fromUid, [])
    return {
      fromUid,
      toUid,
      mergedKeys: [],
      failedKeys: [],
      tombstoned: false,
      recordedOnTarget: recorded,
      sourceConfirmedEmpty: snapshotOk && !liveReadFailed,
    }
  }

  const mergedKeys: string[] = []
  const failedKeys: string[] = []

  const tryKey = async (key: string, fn: () => Promise<void>) => {
    try {
      await fn()
      if (!mergedKeys.includes(key)) mergedKeys.push(key)
    } catch (err) {
      console.warn(`[migrate] merge key failed: ${key}`, err)
      if (!failedKeys.includes(key)) failedKeys.push(key)
    }
  }

  // journal/entries — union by entry id; anonymous entry overwrites destination on same id
  if (source.journal && typeof source.journal === "object") {
    const srcJournal = source.journal as Record<string, unknown>
    const srcEntries =
      srcJournal.entries && typeof srcJournal.entries === "object"
        ? (srcJournal.entries as Record<string, unknown>)
        : null
    if (srcEntries && Object.keys(srcEntries).length) {
      await tryKey("journal", async () => {
        const destPath = userPath(toUid, "journal", "entries")
        const existing = await get(ref(database, destPath))
        const merged = {
          ...(existing.exists() ? (existing.val() as object) : {}),
          ...srcEntries,
        }
        await set(ref(database, destPath), merged)
      })
    }
  }

  // reviews — prefer higher reviewCount, else later lastReviewedAt
  if (source.reviews && typeof source.reviews === "object") {
    const srcReviews = source.reviews as Record<string, ReviewRecord>
    if (Object.keys(srcReviews).length) {
      await tryKey("reviews", async () => {
        const destPath = userPath(toUid, "reviews")
        const existing = await get(ref(database, destPath))
        const dest: Record<string, ReviewRecord> = existing.exists()
          ? { ...(existing.val() as Record<string, ReviewRecord>) }
          : {}
        for (const [conceptId, r] of Object.entries(srcReviews)) {
          if (!r || typeof r !== "object") continue
          const prev = dest[conceptId]
          if (!prev) {
            dest[conceptId] = r
            continue
          }
          if ((r.reviewCount || 0) > (prev.reviewCount || 0)) {
            dest[conceptId] = r
          } else if (
            (r.reviewCount || 0) === (prev.reviewCount || 0) &&
            new Date(r.lastReviewedAt || 0) > new Date(prev.lastReviewedAt || 0)
          ) {
            dest[conceptId] = r
          }
        }
        await set(ref(database, destPath), dest)
      })
    }
  }

  // progress — union completed_ids; keep existing current_module_id if set
  if (source.progress && typeof source.progress === "object") {
    const leg = source.progress as {
      completed_ids?: string[]
      current_module_id?: string | null
    }
    await tryKey("progress", async () => {
      const destPath = userPath(toUid, "progress")
      const existing = await get(ref(database, destPath))
      const cur = existing.exists() ? existing.val() : {}
      await set(ref(database, destPath), {
        completed_ids: Array.from(
          new Set([...(cur.completed_ids || []), ...(leg.completed_ids || [])]),
        ),
        current_module_id: cur.current_module_id || leg.current_module_id || null,
      })
    })
  }

  // viewed, quizResults, scenarioHistory, favoriteQuotes —
  // union by id; anonymous (source) overwrites destination on leaf conflicts (source-wins)
  for (const key of ["viewed", "quizResults", "scenarioHistory", "favoriteQuotes"] as const) {
    const src = source[key]
    if (!src || typeof src !== "object") continue
    if (Object.keys(src as object).length === 0) continue
    await tryKey(key, async () => {
      const destPath = userPath(toUid, key)
      const existing = await get(ref(database, destPath))
      const merged = deepMergePreferSource(
        existing.exists() ? (existing.val() as Record<string, unknown>) : {},
        src as Record<string, unknown>,
      )
      await set(ref(database, destPath), merged)
    })
  }

  // Merge migrated_device_ids from source _meta into destination
  if (source._meta && typeof source._meta === "object") {
    const srcMeta = source._meta as { migrated_device_ids?: string[] }
    const srcMigrated = Array.isArray(srcMeta.migrated_device_ids)
      ? srcMeta.migrated_device_ids
      : []
    if (srcMigrated.length) {
      await tryKey("_meta", async () => {
        const metaPath = userPath(toUid, "_meta")
        const metaSnap = await get(ref(database, metaPath))
        const meta = metaSnap.exists() ? metaSnap.val() : {}
        const existing: string[] = Array.isArray(meta.migrated_device_ids)
          ? meta.migrated_device_ids
          : []
        const union = Array.from(new Set([...existing, ...srcMigrated]))
        await update(ref(database, metaPath), { migrated_device_ids: union })
      })
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
    await remove(ref(database, userPath(fromUid)))
    tombstoned = true
  } catch {
    tombstoned = false
  }

  return {
    fromUid,
    toUid,
    mergedKeys,
    failedKeys,
    tombstoned,
    recordedOnTarget,
    sourceConfirmedEmpty: false,
  }
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

/**
 * Persist pending anon merge. Returns false if storage write failed or verify read-back failed.
 * Callers MUST NOT proceed with Google sign-in recovery when this returns false and data exists.
 */
export function stashPendingAnonMerge(
  fromUid: string,
  snapshot: Record<string, unknown> | null,
  snapshotOk: boolean,
): boolean {
  if (typeof window === "undefined") return false
  const payload: PendingAnonMerge = { fromUid, snapshot, snapshotOk, at: Date.now() }
  try {
    sessionStorage.setItem(PENDING_ANON_MERGE_KEY, JSON.stringify(payload))
    const peeked = peekPendingAnonMerge()
    if (!peeked || peeked.fromUid !== fromUid || peeked.snapshotOk !== snapshotOk) {
      console.warn("[migrate] stash verify failed after write")
      return false
    }
    return true
  } catch (err) {
    console.warn("[migrate] failed to stash pending anon merge (quota?)", err)
    return false
  }
}

/** Snapshot + stash while still anonymous. Aborts sign-in recovery when this fails. */
export async function prepareAnonMerge(anonUid: string): Promise<PrepareAnonMergeResult> {
  const snap = await snapshotUserTree(anonUid)
  if (!snap.ok) {
    return {
      ok: false,
      reason: "snapshot_failed",
      message: `Could not read anonymous learning data before account switch: ${snap.error}. Stay on this session, export JSON from Profile if needed, then retry Link Google.`,
      fromUid: anonUid,
    }
  }
  const empty = !hasMergeableData(snap.data)
  const stashed = stashPendingAnonMerge(anonUid, snap.data, true)
  if (!stashed) {
    // Empty snapshot still needs a stash marker so redirect resume knows we prepared.
    // If even empty stash fails, abort only when we had real data to protect.
    if (!empty) {
      return {
        ok: false,
        reason: "stash_failed",
        message:
          "Could not save a temporary copy of your anonymous progress (browser storage full or blocked). Export JSON from Profile first, free storage, then retry Link Google. Your Google sign-in was not completed so data remains on this anonymous session.",
        fromUid: anonUid,
      }
    }
    // Empty + stash failed: still risky for redirect path identity, treat as hard fail
    return {
      ok: false,
      reason: "stash_failed",
      message:
        "Could not prepare account merge (browser storage blocked). Allow sessionStorage for this site and retry.",
      fromUid: anonUid,
    }
  }
  return { ok: true, empty, fromUid: anonUid }
}

/** Read pending merge without clearing (for UI / mid-merge resume). */
export function peekPendingAnonMerge(): PendingAnonMerge | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(PENDING_ANON_MERGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingAnonMerge
    if (!parsed?.fromUid) return null
    // Back-compat: older stashes without snapshotOk treated as ok if snapshot present or null
    if (typeof parsed.snapshotOk !== "boolean") {
      parsed.snapshotOk = true
    }
    return parsed
  } catch {
    return null
  }
}

/** Clear pending merge only after successful completion (or intentional abort). */
export function clearPendingAnonMerge(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(PENDING_ANON_MERGE_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * @deprecated Prefer peek + clearPendingAnonMerge after success so mid-merge crashes keep the stash.
 * Kept for tests/callers that expect take semantics.
 */
export function takePendingAnonMerge(): PendingAnonMerge | null {
  const pending = peekPendingAnonMerge()
  clearPendingAnonMerge()
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

/**
 * Apply a stashed pending anon merge into googleUid.
 * Does NOT clear stash until merge completes successfully (or confirmed empty success).
 * On failure, stash remains for Retry merge.
 */
export async function runPendingAnonMerge(googleUid: string): Promise<MergeStatus | null> {
  const pending = peekPendingAnonMerge()
  if (!pending?.fromUid) return null
  if (pending.fromUid === googleUid) {
    clearPendingAnonMerge()
    return null
  }

  if (pending.snapshotOk === false) {
    const status: MergeStatus = {
      state: "error",
      message:
        "Anonymous data could not be snapshotted before sign-in. Progress may still exist on the old anonymous account. Export is unavailable after the switch — contact support or use a device that still has the anonymous session.",
      fromUid: pending.fromUid,
      toUid: googleUid,
      at: Date.now(),
      canRetry: false,
    }
    // Drop bad stash so we do not loop
    clearPendingAnonMerge()
    setLastMergeStatus(status)
    return status
  }

  try {
    const result = await mergeUsersData(pending.fromUid, googleUid, pending.snapshot, {
      snapshotOk: pending.snapshotOk,
    })

    if (!result.sourceConfirmedEmpty && result.mergedKeys.length === 0 && result.failedKeys.length > 0) {
      // Snapshot was bad / all keys failed
      const status: MergeStatus = {
        state: "error",
        message: `Could not merge anonymous data (failed: ${result.failedKeys.join(", ")}). Use Retry merge or reload the page.`,
        fromUid: pending.fromUid,
        toUid: googleUid,
        mergedKeys: result.mergedKeys,
        at: Date.now(),
        canRetry: true,
      }
      setLastMergeStatus(status)
      return status
    }

    if (result.failedKeys.length > 0 && result.mergedKeys.length > 0) {
      // Partial: keep stash so user can retry remaining? Safer to clear after partial write
      // to avoid double-applying source-wins keys. Report partial; clear stash.
      clearPendingAnonMerge()
      const status: MergeStatus = {
        state: "partial",
        message: `Partially merged anonymous progress (${result.mergedKeys.join(", ")}). Failed: ${result.failedKeys.join(", ")}. Export/import can fill gaps.`,
        fromUid: pending.fromUid,
        toUid: googleUid,
        mergedKeys: result.mergedKeys,
        at: Date.now(),
        canRetry: false,
      }
      setLastMergeStatus(status)
      return status
    }

    const keys = result.mergedKeys
    let status: MergeStatus
    if (keys.length === 0) {
      if (result.sourceConfirmedEmpty) {
        clearPendingAnonMerge()
        status = {
          state: "success",
          message:
            "Signed in with an existing Google account. No anonymous learning data was found to merge.",
          fromUid: pending.fromUid,
          toUid: googleUid,
          mergedKeys: keys,
          at: Date.now(),
          canRetry: false,
        }
      } else {
        // Unconfirmed empty — do not claim success
        status = {
          state: "error",
          message:
            "Could not confirm anonymous learning data before merge. Your Google account is signed in; use Retry merge if available, or export from a device that still has the anonymous session.",
          fromUid: pending.fromUid,
          toUid: googleUid,
          at: Date.now(),
          canRetry: true,
        }
        setLastMergeStatus(status)
        return status
      }
    } else {
      clearPendingAnonMerge()
      status = {
        state: result.recordedOnTarget ? "success" : "partial",
        message: result.recordedOnTarget
          ? `Merged your anonymous progress (${keys.join(", ")}) into this Google account.`
          : `Merged data (${keys.join(", ")}) but could not write merge provenance. Progress should still be present.`,
        fromUid: pending.fromUid,
        toUid: googleUid,
        mergedKeys: keys,
        at: Date.now(),
        canRetry: false,
      }
    }
    setLastMergeStatus(status)
    return status
  } catch (err) {
    console.error("[auth] anon→Google merge failed", err)
    // Keep pending stash for Retry merge
    const status: MergeStatus = {
      state: "error",
      message:
        err instanceof Error
          ? `Could not merge anonymous data: ${err.message}. Your Google account is signed in — use Retry merge on Profile, or reload this page.`
          : "Could not merge anonymous data into this Google account. Use Retry merge on Profile.",
      fromUid: pending.fromUid,
      toUid: googleUid,
      at: Date.now(),
      canRetry: true,
    }
    setLastMergeStatus(status)
    return status
  }
}

/** Device migration: prefer existing user (dest) values; fill gaps from legacy. */
function deepMergePreferDest(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
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
      out[k] = deepMergePreferDest(out[k] as Record<string, unknown>, v as Record<string, unknown>)
    } else if (out[k] === undefined) {
      out[k] = v
    }
  }
  return out
}

/**
 * Anon→Google map merge: union by key; source (anonymous) wins on leaf conflicts.
 * Nested plain objects recurse; arrays and scalars from source replace destination.
 */
function deepMergePreferSource(
  dest: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...dest }
  for (const [k, v] of Object.entries(source || {})) {
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      out[k] &&
      typeof out[k] === "object" &&
      !Array.isArray(out[k])
    ) {
      out[k] = deepMergePreferSource(
        out[k] as Record<string, unknown>,
        v as Record<string, unknown>,
      )
    } else {
      out[k] = v
    }
  }
  return out
}
