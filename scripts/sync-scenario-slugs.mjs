#!/usr/bin/env node
/**
 * Keep frontend/src/data/slugs.json scenarios[] in sync with scenarios.json.
 * Also fails if they diverge (for CI / pre-commit).
 *
 *   node scripts/sync-scenario-slugs.mjs          # write + verify
 *   node scripts/sync-scenario-slugs.mjs --check  # verify only
 */

import { readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const checkOnly = process.argv.includes("--check")

const scenariosPath = join(root, "frontend/src/data/scenarios.json")
const slugsPath = join(root, "frontend/src/data/slugs.json")

const scenarios = JSON.parse(readFileSync(scenariosPath, "utf8"))
const slugs = JSON.parse(readFileSync(slugsPath, "utf8"))

const fromScenarios = scenarios
  .map((s) => s.slug)
  .filter((s) => typeof s === "string" && s.length > 0)
const fromSlugs = slugs.scenarios || []

const a = JSON.stringify(fromScenarios)
const b = JSON.stringify(fromSlugs)

if (a === b) {
  console.log(`scenario slugs in sync (${fromScenarios.length})`)
  process.exit(0)
}

if (checkOnly) {
  console.error("slugs.json scenarios[] out of date vs scenarios.json")
  console.error(`  scenarios.json: ${fromScenarios.length}  slugs.json: ${fromSlugs.length}`)
  const missing = fromScenarios.filter((s) => !fromSlugs.includes(s))
  const extra = fromSlugs.filter((s) => !fromScenarios.includes(s))
  if (missing.length) console.error("  missing in slugs:", missing.join(", "))
  if (extra.length) console.error("  extra in slugs:", extra.join(", "))
  console.error("  Fix: node scripts/sync-scenario-slugs.mjs")
  process.exit(1)
}

slugs.scenarios = fromScenarios
writeFileSync(slugsPath, JSON.stringify(slugs, null, 2) + "\n")
console.log(`updated slugs.json scenarios[] → ${fromScenarios.length}`)
