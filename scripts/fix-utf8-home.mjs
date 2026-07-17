import { execSync } from "child_process"
import { writeFileSync, readFileSync } from "fs"

const specs = [
  ["3ef611a:frontend/src/components/home/NextActionsDashboard.tsx", "frontend/src/components/home/NextActionsDashboard.tsx"],
  ["3ef611a:frontend/src/components/home/TodaysPlanCard.tsx", "frontend/src/components/home/TodaysPlanCard.tsx"],
  ["3ef611a:frontend/src/lib/learning/todays-plan.ts", "frontend/src/lib/learning/todays-plan.ts"],
  ["3ef611a:frontend/src/lib/__tests__/todays-plan.test.ts", "frontend/src/lib/__tests__/todays-plan.test.ts"],
]

for (const [spec, out] of specs) {
  let t = execSync(`git show ${spec}`, { encoding: "utf8" })
  t = t.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  t = t.replace(/\u2018|\u2019/g, "'").replace(/\u201C|\u201D/g, '"')
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1)
  writeFileSync(out, t, "utf8")
  // Validate
  const buf = readFileSync(out)
  const decoded = buf.toString("utf8")
  if (decoded.includes("\uFFFD")) throw new Error(`replacement char in ${out}`)
  console.log("OK", out, buf.length)
}
