/**
 * Replace fancy punctuation with ASCII in hot-path source files.
 * Avoids Windows PowerShell / bad encoding breaking Next bundles.
 */
import { readFileSync, writeFileSync } from "fs"

const targets = [
  "frontend/src/components/auth/AppShellGate.tsx",
  "frontend/src/components/auth/FlashLogin.tsx",
  "frontend/src/components/home/NextActionsDashboard.tsx",
  "frontend/src/components/home/TodaysPlanCard.tsx",
  "frontend/src/lib/learning/todays-plan.ts",
  "frontend/src/app/page.tsx",
  "frontend/src/app/layout.tsx",
  "frontend/src/lib/AuthSessionProvider.tsx",
]

const replacements = [
  [/\uFEFF/g, ""],
  [/\u2014/g, "-"],
  [/\u2013/g, "-"],
  [/\u2026/g, "..."],
  [/\u2018/g, "'"],
  [/\u2019/g, "'"],
  [/\u201C/g, '"'],
  [/\u201D/g, '"'],
  [/\u00B7/g, "-"],
  // common mojibake for em dash / ellipsis
  [/\u00E2\u20AC\u201D/g, "-"],
  [/\u00E2\u20AC\u201C/g, "-"],
  [/\u00E2\u20AC\u2014/g, "-"],
  [/\u00E2\u20AC\u00A6/g, "..."],
  [/[\u0393\u00C7\u00F6]+/g, "-"],
]

for (const f of targets) {
  let t = readFileSync(f, "utf8")
  const before = t
  for (const [re, to] of replacements) t = t.replace(re, to)
  // normalize newlines
  t = t.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  writeFileSync(f, t, "utf8")
  const high = [...t].filter((c) => c.charCodeAt(0) > 127)
  console.log(f, t === before ? "unchanged" : "scrubbed", "nonAscii=", high.length)
  if (high.length) {
    console.log("  sample", high.slice(0, 6).map((c) => "U+" + c.charCodeAt(0).toString(16)))
  }
}
