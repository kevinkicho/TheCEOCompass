#!/usr/bin/env node
/**
 * Fail if any source file is not valid UTF-8 (breaks Next/webpack on Linux CI).
 *
 *   node scripts/check-utf8.mjs
 *   node scripts/check-utf8.mjs frontend
 */

import { readFileSync, readdirSync, statSync } from "fs"
import { join, relative } from "path"
import { TextDecoder } from "util"

const roots = process.argv.slice(2)
const scanRoots = roots.length > 0 ? roots : ["frontend/src", "functions/src", "agent", "scripts"]
const EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|css|yml|yaml|sh)$/i
const SKIP = new Set(["node_modules", ".next", "out", "lib", "coverage", "dist", ".git"])

const decoder = new TextDecoder("utf-8", { fatal: true })
const bad = []

function walk(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (EXT.test(e.name)) {
      const buf = readFileSync(p)
      try {
        decoder.decode(buf)
      } catch {
        bad.push(relative(process.cwd(), p))
      }
    }
  }
}

for (const r of scanRoots) {
  try {
    if (statSync(r).isDirectory() || statSync(r).isFile()) walk(r)
  } catch {
    /* missing root ok */
  }
}

if (bad.length) {
  console.error("Invalid UTF-8 in source files (fix encoding to UTF-8 without BOM):\n")
  bad.forEach((f) => console.error("  -", f))
  process.exit(1)
}
console.log(`UTF-8 OK (${scanRoots.join(", ")})`)
