/**
 * Bootstrap admins/{uid} = true for RTDB rules.
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json node scripts/bootstrap-admins.mjs <uid>
 * Or place service account JSON in agent/ and:
 *   node scripts/bootstrap-admins.mjs <uid>
 */
import { readFileSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const uid = process.argv[2]
if (!uid) {
  console.error("Usage: node scripts/bootstrap-admins.mjs <firebase-auth-uid>")
  process.exit(1)
}

const agentDir = join(root, "agent")
const require = createRequire(import.meta.url)

function loadKey() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"))
  }
  const files = readdirSync(agentDir).filter((f) => f.endsWith(".json") && f !== "package.json" && f !== "package-lock.json")
  if (!files.length) throw new Error("No service account key")
  return JSON.parse(readFileSync(join(agentDir, files[0]), "utf8"))
}

const key = loadKey()
const admin = require(join(agentDir, "node_modules", "firebase-admin"))
const databaseURL = `https://${key.project_id}-default-rtdb.firebaseio.com`
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(key), databaseURL })
}
await admin.database().ref(`admins/${uid}`).set(true)
console.log(`✓ admins/${uid} = true`)
process.exit(0)
