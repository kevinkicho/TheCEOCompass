import { db } from "../firebase"
import type { Database } from "firebase/database"

export { getDb, requireUid, tryUid, getDeviceId, userPath, LEGACY_DEVICE_ROOTS } from "./scope"

export function dbOptional(): Database | null {
  return db
}
