// Generate UUIDs for concepts with empty IDs and write to backend seed & frontend staticData
// Usage: node scripts/generate-concept-ids.mjs

import { readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import crypto from "crypto"

const __dirname = dirname(fileURLToPath(import.meta.url))
const BACKEND_SEED = join(__dirname, "..", "backend", "seed", "frameworks.json")
const FRONTEND_STATIC = join(__dirname, "..", "frontend", "src", "lib", "staticData.ts")

function uuid() { return crypto.randomUUID() }

// ── Backend seed ──
console.log("Processing backend seed...")
const backend = JSON.parse(readFileSync(BACKEND_SEED, "utf8"))
let backCount = 0
for (const fw of backend) {
  for (const c of (fw.concepts || [])) {
    if (!c.id) {
      c.id = uuid()
      backCount++
    }
  }
}
writeFileSync(BACKEND_SEED, JSON.stringify(backend, null, 2), "utf8")
console.log(`  Backend: ${backCount} UUIDs generated`)

// ── Frontend staticData.ts ──
console.log("Processing frontend staticData.ts...")
let content = readFileSync(FRONTEND_STATIC, "utf8")

const startMarker = "export const staticFrameworks = ["
const startIdx = content.indexOf(startMarker)
if (startIdx === -1) throw new Error("Could not find export const staticFrameworks = [")
const arrayOpen = startIdx + startMarker.length - 1
let depth = 1
let end = -1
for (let i = arrayOpen + 1; i < content.length; i++) {
  if (content[i] === "[") depth++
  else if (content[i] === "]") { depth--; if (depth === 0) { end = i; break } }
}
if (end === -1) throw new Error("Could not find closing bracket")

const frontend = JSON.parse(content.slice(arrayOpen, end + 1))
let frontCount = 0
for (const fw of frontend) {
  for (const c of (fw.concepts || [])) {
    if (!c.id) {
      c.id = uuid()
      frontCount++
    }
  }
}
const header = content.slice(0, arrayOpen)
const footer = content.slice(end + 1)
const newJson = JSON.stringify(frontend, null, 2)
writeFileSync(FRONTEND_STATIC, header + newJson + footer, "utf8")
console.log(`  Frontend: ${frontCount} UUIDs generated`)

console.log(`\nDone! Backend: ${backCount}, Frontend: ${frontCount}`)
