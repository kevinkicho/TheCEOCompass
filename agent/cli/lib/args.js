/**
 * Minimal argv parser (no deps).
 * Supports: --flag, --key=value, --key value, positional args.
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const flags = {}
  const positionals = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--")) {
      const body = a.slice(2)
      if (body.includes("=")) {
        const [k, ...rest] = body.split("=")
        flags[k] = rest.join("=")
      } else {
        const next = argv[i + 1]
        if (next && !next.startsWith("--")) {
          flags[body] = next
          i++
        } else {
          flags[body] = true
        }
      }
    } else {
      positionals.push(a)
    }
  }
  return { flags, positionals, command: positionals[0] || "help", sub: positionals[1] }
}

export function requireFlag(flags, name, hint) {
  const v = flags[name]
  if (v === undefined || v === true || v === "") {
    throw new Error(`Missing --${name}${hint ? ` (${hint})` : ""}`)
  }
  return String(v)
}

export function flagInt(flags, name, fallback) {
  if (flags[name] === undefined || flags[name] === true) return fallback
  const n = Number(flags[name])
  return Number.isFinite(n) ? n : fallback
}

export function out(data, { json = false, pretty = true } = {}) {
  if (json || process.env.AGENT_CLI_JSON === "1") {
    process.stdout.write(JSON.stringify(data, null, pretty ? 2 : 0) + "\n")
  } else if (typeof data === "string") {
    process.stdout.write(data + (data.endsWith("\n") ? "" : "\n"))
  } else {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n")
  }
}
