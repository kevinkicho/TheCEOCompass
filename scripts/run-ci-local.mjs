/**
 * Cross-platform CI gate (Windows / macOS / Linux).
 * Mirrors .github/workflows/ci.yml + pre-commit-check.sh
 *
 * Usage (repo root):
 *   node scripts/run-ci-local.mjs
 *   node scripts/run-ci-local.mjs --skip-build
 *   npm run ci
 */
import { spawnSync } from "child_process"
import { existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const skipBuild = process.argv.includes("--skip-build")

function run(label, cmd, args, cwd = root, env = process.env) {
  console.log(`\n>>> ${label}`)
  console.log(`    $ ${cmd} ${args.join(" ")}`)
  const r = spawnSync(cmd, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  })
  if (r.status !== 0) {
    console.error(`\nFAILED: ${label} (exit ${r.status})`)
    process.exit(r.status || 1)
  }
  console.log(`  OK`)
}

console.log("==============================================")
console.log("  CEO Compass — Local CI (matches GitHub CI)")
console.log("==============================================")
console.log("See docs/CI.md for full requirements.")

run("UTF-8 source encoding", "node", [
  "scripts/check-utf8.mjs",
  "frontend/src",
  "functions/src",
  "agent",
  "scripts",
])

run("Mastery seed validation", "node", ["scripts/validate-mastery-seed.mjs"])
run("Scenario slug sync check", "node", ["scripts/sync-scenario-slugs.mjs", "--check"])

const frontend = join(root, "frontend")
if (!existsSync(join(frontend, "node_modules"))) {
  run("Install frontend deps", "npm", ["ci", "--legacy-peer-deps"], frontend)
}

run("TypeScript", "npx", ["tsc", "--noEmit"], frontend)
run("ESLint (max-warnings 0)", "npx", ["next", "lint", "--max-warnings", "0"], frontend)
run("Unit tests (vitest)", "npx", ["vitest", "run"], frontend)

if (!skipBuild) {
  const buildEnv = {
    ...process.env,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:50128",
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-key",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo.firebaseapp.com",
    NEXT_PUBLIC_FIREBASE_DATABASE_URL:
      process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
      "https://demo-default-rtdb.firebaseio.com",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo",
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo.appspot.com",
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "0",
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "demo",
  }
  run("Next.js build", "npx", ["next", "build"], frontend, buildEnv)
} else {
  console.log("\n>>> Next.js build SKIPPED (--skip-build)")
}

const functions = join(root, "functions")
if (existsSync(join(functions, "package.json"))) {
  if (!existsSync(join(functions, "node_modules"))) {
    run("Install functions deps", "npm", ["ci"], functions)
  }
  run("Functions unit tests", "npm", ["test"], functions)
}

console.log("\n==============================================")
console.log("  All CI gates passed — safe to push")
console.log("==============================================\n")
