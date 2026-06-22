import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const slugMap = JSON.parse(readFileSync(join(__dirname, "..", "frontend", "src", "data", "slugs.json"), "utf8"))

let totalConcepts = 0
const missingSlugs = []

for (const fwSlug of slugMap.frameworks) {
  const conceptSlugs = slugMap.concepts[fwSlug]
  if (!conceptSlugs || conceptSlugs.length === 0) {
    console.warn(`  ⚠ Framework "${fwSlug}" has no concepts`)
    continue
  }
  for (const cs of conceptSlugs) {
    totalConcepts++
    if (!cs || cs.trim() === "") {
      missingSlugs.push(fwSlug)
    }
  }
}

console.log(`\n✓ ${slugMap.frameworks.length} frameworks`)
console.log(`✓ ${totalConcepts} concepts mapped in slugs.json`)

let errors = 0
if (missingSlugs.length > 0) {
  console.error(`  ✗ ${missingSlugs.length} empty concept slugs found in frameworks: ${missingSlugs.join(", ")}`)
  errors++
}

if (errors > 0) {
  console.error(`\n✗ ${errors} validation errors found`)
  process.exit(1)
}
console.log(`\n✓ All slugs valid`)
