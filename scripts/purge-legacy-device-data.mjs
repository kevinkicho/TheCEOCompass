/**
 * Delete top-level device-scoped trees after migration to users/{uid}.
 * Usage: node scripts/purge-legacy-device-data.mjs [--yes]
 */
import { readFileSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const yes = process.argv.includes("--yes")

const ROOTS = [
  "journal",
  "reviews",
  "progress",
  "viewed",
  "quizResults",
  "scenarioHistory",
  "favoriteQuotes",
]

if (!yes) {
  console.error("Refusing to purge without --yes")
  console.error("Usage: node scripts/purge-legacy-device-data.mjs --yes")
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
const db = admin.database()
for (const r of ROOTS) {
  await db.ref(r).remove()
  console.log(`✓ purged /${r}`)
}
console.log("Done.")
process.exit(0)
