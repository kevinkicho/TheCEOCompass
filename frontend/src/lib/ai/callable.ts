/**
 * Cloud AI via Firebase HTTPS callable `generateAI`.
 * Prefer for provider === "cloud" (lower latency than RTDB request bus).
 */

import { functions, httpsCallable, auth } from "../firebase"

export type CallableAiResult = {
  text: string
  model: string
  source: "callable"
  latencyMs?: number
}

/**
 * When false, cloud uses RTDB processAIRequest only.
 * Default true (callable preferred). Set NEXT_PUBLIC_AI_CALLABLE=0 to disable.
 */
export function isCallableAiEnabled(): boolean {
  try {
    const v = process.env.NEXT_PUBLIC_AI_CALLABLE
    if (v === "0" || v === "false") return false
    return true
  } catch {
    return true
  }
}

export async function callGenerateAI(args: {
  prompt: string
  model?: string
  temperature?: number
}): Promise<CallableAiResult> {
  if (!functions) {
    throw new Error("Firebase Functions not configured")
  }
  if (!auth?.currentUser) {
    throw new Error("Not signed in — wait for auth session before using cloud AI")
  }

  const fn = httpsCallable(functions, "generateAI")
  const res = await fn({
    prompt: args.prompt,
    model: args.model,
    temperature: args.temperature,
  })
  const data = res.data as {
    text?: string
    model?: string
    source?: string
    latencyMs?: number
  }
  if (!data?.text) {
    throw new Error("Callable generateAI returned empty text")
  }
  return {
    text: data.text,
    model: data.model || args.model || "unknown",
    source: "callable",
    latencyMs: data.latencyMs,
  }
}
