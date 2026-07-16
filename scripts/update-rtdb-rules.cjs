const { readFileSync, writeFileSync, readdirSync, existsSync } = require("fs")
const { join } = require("path")

const root = join(__dirname, "..")
const rulesPath = join(root, "database.rules.json")
const backupPath = join(root, "database.rules.backup.json")
const rules = JSON.parse(readFileSync(rulesPath, "utf8"))

const dryRun = process.argv.includes("--dry-run")

const agentDir = join(root, "agent")
const files = readdirSync(agentDir).filter((f) => f.endsWith(".json") && f !== "package.json" && f !== "package-lock.json")
if (files.length === 0) throw new Error("No service account key found in agent/")
const key = JSON.parse(readFileSync(join(agentDir, files[0]), "utf8"))

const databaseUrl = `https://${key.project_id}-default-rtdb.firebaseio.com`

async function main() {
  const admin = require(join(agentDir, "node_modules", "firebase-admin"))
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(key), databaseURL: databaseUrl })
  }

  const token = await admin.credential.cert(key).getAccessToken()

  // Backup current remote rules before PUT
  const getRes = await fetch(`${databaseUrl}/.settings/rules.json?access_token=${token.access_token}`)
  if (getRes.ok) {
    const current = await getRes.json()
    writeFileSync(backupPath, JSON.stringify(current, null, 2) + "\n")
    console.log(`✓ Backed up current rules → database.rules.backup.json`)
  } else {
    console.warn(`⚠ Could not fetch current rules for backup: ${getRes.status}`)
  }

  if (dryRun) {
    console.log("✓ Dry run — local rules valid JSON, no PUT")
    console.log(`  Local rules path: ${rulesPath}`)
    console.log(`  Target: ${databaseUrl}`)
    return
  }

  const res = await fetch(`${databaseUrl}/.settings/rules.json?access_token=${token.access_token}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rules),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed: ${res.status} ${err}`)
  }
  console.log("✓ RTDB security rules updated")
  if (existsSync(backupPath)) {
    console.log("  Rollback: copy database.rules.backup.json → database.rules.json and re-run this script")
  }
}

main().catch((err) => { console.error(err.message); process.exit(1) })
