import admin from "firebase-admin"
import { readFileSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadServiceAccount() {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (fromEnv) return JSON.parse(readFileSync(fromEnv, "utf8"))
  const files = readdirSync(__dirname).filter((f) => f.endsWith(".json") && f !== "package.json" && f !== "package-lock.json")
  if (files.length > 0) return JSON.parse(readFileSync(join(__dirname, files[0]), "utf8"))
  throw new Error("No service account key found.")
}

const serviceAccount = loadServiceAccount()
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://theceocompass-default-rtdb.firebaseio.com",
})
const db = admin.database()

// Read the static data by importing the TypeScript module
// We use a dynamic import of the compiled output
const frontendSrc = join(__dirname, "..", "frontend", "src", "lib", "staticData.ts")
console.log(`Reading static data from ${frontendSrc}`)

// Since we can't import TS directly, we parse the export
const tsContent = readFileSync(frontendSrc, "utf8")

// Extract the frameworks array by evaluating it
// The file exports: export const staticFrameworks = [...]
// We need to extract just the array
import { createRequire } from "module"
const require = createRequire(import.meta.url)

// Build the data by writing a temp ESM wrapper
import { writeFileSync, unlinkSync } from "fs"
const tmpFile = join(__dirname, ".seed-tmp.mjs")
const wrapped = `
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mod = require('./static-data-proxy.cjs');
export const staticFrameworks = mod.staticFrameworks;
`
// Actually, let's just use the JSON file if it exists, or parse the data from the source
// The staticData.ts exports a large array. Let's use the pre-built JSON

import { execSync } from "child_process"

console.log("Building static data to JSON...")
execSync("npx tsx -e \"import { staticFrameworks } from './src/lib/staticData.ts'; console.log(JSON.stringify(staticFrameworks));\"", {
  cwd: join(__dirname, "..", "frontend"),
  stdio: ["pipe", "pipe", "pipe"],
  timeout: 30000,
})
