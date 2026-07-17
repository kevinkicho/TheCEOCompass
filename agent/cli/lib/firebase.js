/**
 * Shared Firebase Admin bootstrap for Agent CLI.
 */
import admin from "firebase-admin"
import { readFileSync, readdirSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const agentDir = join(__dirname, "..", "..")
const rootDir = join(agentDir, "..")

export function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return
  const text = readFileSync(filePath, "utf8")
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

export function loadServiceAccount() {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (fromEnv) {
    return JSON.parse(readFileSync(fromEnv, "utf8"))
  }
  const files = readdirSync(agentDir).filter(
    (f) => f.endsWith(".json") && f !== "package.json" && f !== "package-lock.json",
  )
  if (!files.length) {
    throw new Error(
      "No service account key. Set GOOGLE_APPLICATION_CREDENTIALS or place a Firebase Admin SDK JSON in agent/.",
    )
  }
  const preferred = files.filter(
    (f) =>
      /firebase.*adminsdk/i.test(f) ||
      /service.?account/i.test(f) ||
      /theceocompass/i.test(f),
  )
  const file = preferred[0] || files[0]
  return JSON.parse(readFileSync(join(agentDir, file), "utf8"))
}

let _db = null

export function getDb() {
  if (_db) return _db
  loadDotEnv(join(agentDir, ".env"))
  loadDotEnv(join(rootDir, ".env"))
  if (!admin.apps.length) {
    const key = loadServiceAccount()
    admin.initializeApp({
      credential: admin.credential.cert(key),
      databaseURL:
        process.env.FIREBASE_DATABASE_URL ||
        process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
        "https://theceocompass-default-rtdb.firebaseio.com",
    })
  }
  _db = admin.database()
  return _db
}

export function userPath(uid, ...segments) {
  return ["users", uid, ...segments.filter(Boolean)].join("/")
}

export { admin, agentDir, rootDir }
