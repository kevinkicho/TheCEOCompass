import admin from "firebase-admin"
import { readFileSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const files = readdirSync(__dirname).filter((f) => f.endsWith(".json") && f !== "package.json" && f !== "package-lock.json")
const key = JSON.parse(readFileSync(join(__dirname, files[0]), "utf8"))
admin.initializeApp({ credential: admin.credential.cert(key), databaseURL: "https://theceocompass-default-rtdb.firebaseio.com" })
const db = admin.database()

const frameworks = JSON.parse(readFileSync("/tmp/frameworks.json", "utf8"))

async function main() {
  let count = 0
  const slugList = []
  for (const fw of frameworks) {
    const { concepts, ...fwData } = fw
    await db.ref(`frameworks/${fw.slug}`).set(fwData)
    slugList.push(fw.slug)
    if (concepts?.length > 0) {
      const updates = {}
      for (const c of concepts) {
        updates[c.id] = c
      }
      await db.ref(`frameworks/${fw.slug}/concepts`).update(updates)
    }
    count++
    if (count % 10 === 0) console.log(`${count} frameworks pushed...`)
  }
  // Store slugs index for fast listing
  await db.ref("_meta/framework_slugs").set(slugList)
  console.log(`Done! ${count} frameworks with concepts pushed to RTDB.`)
}

main().catch(console.error).then(() => process.exit(0))
