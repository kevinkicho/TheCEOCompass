#!/usr/bin/env node
/**
 * CEO Compass — Agent CLI
 *
 * Machine-friendly commands for coding agents and ops pipelines.
 * Uses Firebase Admin (service account in agent/ or GOOGLE_APPLICATION_CREDENTIALS).
 *
 * Usage (repo root):
 *   node agent/cli/index.js help
 *   npm run agent:cli -- help
 *   npm run agent:cli -- context --uid <UID> --json
 */

import { parseArgs, requireFlag, flagInt, out } from "./lib/args.js"
import { listUsers, loadUserContext } from "./lib/context.js"
import { listFrameworks, getFramework, listScenarios, getScenario } from "./lib/catalog.js"
import { listJournal, draftJournalFromContext, createJournalEntry } from "./lib/journal.js"
import { buildNavigationPlan } from "./lib/navigate.js"
import { runDailyPipeline } from "./lib/pipeline.js"

const HELP = `
CEO Compass Agent CLI
=====================

Auth: place Firebase Admin JSON in agent/ or set GOOGLE_APPLICATION_CREDENTIALS.
JSON mode: pass --json on any command (or AGENT_CLI_JSON=1).

Commands
--------
  help
  users list [--max N] [--json]
  context --uid <UID> [--limit N] [--json]
  catalog frameworks [--json]
  catalog framework --slug <slug> [--json]
  catalog scenarios [--json]
  catalog scenario --slug <slug> [--json]
  journal list --uid <UID> [--json]
  journal draft-from-context --uid <UID> [--limit N] [--notes "..."] [--apply] [--json]
  navigate plan --uid <UID> [--json]
  pipeline daily --uid <UID> [--apply-journal] [--limit N] [--notes "..."] [--json]

Examples
--------
  # What should an agent do next for this learner?
  node agent/cli/index.js pipeline daily --uid <UID> --json

  # Dry-run AI journal drafts from RTDB activity (needs Ollama or OLLAMA_API_KEY)
  node agent/cli/index.js journal draft-from-context --uid <UID> --limit 3 --json

  # Write those drafts to the user's journal
  node agent/cli/index.js journal draft-from-context --uid <UID> --limit 3 --apply --json

  # Navigation routes + follow-up CLI steps
  node agent/cli/index.js navigate plan --uid <UID> --json

Notes
-----
  - This CLI does NOT drive a browser. It reads/writes RTDB and suggests routes.
  - Frontend journal AI also loads learner context automatically (same signals).
  - For CI requirements see docs/CI.md
`

async function main() {
  const { flags, positionals, command, sub } = parseArgs()
  const json = Boolean(flags.json)

  try {
    switch (command) {
      case "help":
      case undefined:
        out(HELP.trim(), { json: false })
        break

      case "users": {
        if (sub !== "list") throw new Error("Usage: users list [--max N]")
        const max = flagInt(flags, "max", 50)
        const users = await listUsers(max)
        out({ users, count: users.length }, { json })
        break
      }

      case "context": {
        const uid = requireFlag(flags, "uid", "Firebase Auth uid")
        const limit = flagInt(flags, "limit", 8)
        const ctx = await loadUserContext(uid, limit)
        out(ctx, { json: true })
        break
      }

      case "catalog": {
        if (sub === "frameworks") {
          out({ frameworks: await listFrameworks() }, { json: true })
        } else if (sub === "framework") {
          const slug = requireFlag(flags, "slug")
          const fw = await getFramework(slug)
          if (!fw) throw new Error(`Framework not found: ${slug}`)
          out(fw, { json: true })
        } else if (sub === "scenarios") {
          out({ scenarios: await listScenarios() }, { json: true })
        } else if (sub === "scenario") {
          const slug = requireFlag(flags, "slug")
          const s = await getScenario(slug)
          if (!s) throw new Error(`Scenario not found: ${slug}`)
          out(s, { json: true })
        } else {
          throw new Error("Usage: catalog frameworks|framework|scenarios|scenario ...")
        }
        break
      }

      case "journal": {
        if (sub === "list") {
          const uid = requireFlag(flags, "uid")
          out({ entries: await listJournal(uid) }, { json: true })
        } else if (sub === "draft-from-context") {
          const uid = requireFlag(flags, "uid")
          const limit = flagInt(flags, "limit", 3)
          const notes = flags.notes === true ? "" : String(flags.notes || "")
          const apply = Boolean(flags.apply)
          const result = await draftJournalFromContext(uid, { notes, limit, apply })
          out(result, { json: true })
        } else {
          throw new Error("Usage: journal list|draft-from-context ...")
        }
        break
      }

      case "navigate": {
        if (sub !== "plan") throw new Error("Usage: navigate plan --uid <UID>")
        const uid = requireFlag(flags, "uid")
        const ctx = await loadUserContext(uid, 8)
        const scenarios = await listScenarios()
        out(buildNavigationPlan(ctx, { scenarios }), { json: true })
        break
      }

      case "pipeline": {
        if (sub !== "daily") throw new Error("Usage: pipeline daily --uid <UID> [--apply-journal]")
        const uid = requireFlag(flags, "uid")
        const limit = flagInt(flags, "limit", 3)
        const notes = flags.notes === true ? "" : String(flags.notes || "")
        const applyJournal = Boolean(flags["apply-journal"] || flags.apply)
        const result = await runDailyPipeline(uid, {
          applyJournal,
          journalLimit: limit,
          notes,
        })
        out(result, { json: true })
        break
      }

      default:
        throw new Error(`Unknown command: ${command}\n\n${HELP}`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (json || flags.json) {
      out({ ok: false, error: msg }, { json: true })
    } else {
      process.stderr.write(`Error: ${msg}\n`)
    }
    process.exit(1)
  }
}

main()
