import { ref, get, set, update } from "../firebase"
import { getDb, getDeviceId, userPath, LEGACY_DEVICE_ROOTS } from "./scope"

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
