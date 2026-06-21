const { readFileSync, readdirSync } = require("fs")
const { join } = require("path")

const rules = JSON.parse(readFileSync(join(__dirname, "..", "database.rules.json"), "utf8"))

const agentDir = join(__dirname, "..", "agent")
const files = readdirSync(agentDir).filter((f) => f.endsWith(".json") && f !== "package.json" && f !== "package-lock.json")
if (files.length === 0) throw new Error("No service account key found in agent/")
const key = JSON.parse(readFileSync(join(agentDir, files[0]), "utf8"))

const databaseUrl = `https://${key.project_id}-default-rtdb.firebaseio.com`

async function main() {
  const admin = require(join(agentDir, "node_modules", "firebase-admin"))
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(key), databaseURL: databaseUrl })
  }

  // Get access token from the internal credential
  const token = await admin.credential.cert(key).getAccessToken()

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
}

main().catch((err) => { console.error(err.message); process.exit(1) })
