/**
 * @deprecated Prefer capability helpers from `@/lib/capabilities`.
 * Hostname-based demo gating incorrectly disabled Firebase persistence on GitHub Pages.
 * Kept for one deprecation cycle for any remaining catalog/API branching.
 */
const isServer = typeof window === "undefined"

/** @deprecated Use canUseFirebasePersistence() or canUseAIFromHeartbeat() instead. */
export const isStaticHosting = isServer || (
  !window.location.hostname.includes("localhost")
  && !window.location.hostname.includes("127.0.0.1")
)

/** Prefer static scenario catalog unless explicitly opting into FastAPI. */
export const useFastApiScenarios =
  process.env.NEXT_PUBLIC_USE_FASTAPI_SCENARIOS === "true"
