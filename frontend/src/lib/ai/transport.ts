import { db, auth, ref, set, onValue, get } from "../firebase"
import type { Database } from "firebase/database"
import { getFrameworkBySlug } from "../api"
import type { AiProviderId } from "./provider"
import { CLOUD_PROVIDER_NOT_CONFIGURED } from "./provider"
import { resolveAiProvider, getEnvAiProvider } from "./router"

export function generateId(): string {
  return crypto.randomUUID()
}

/** Push an AI request with auth.uid for RTDB create-only owner rules. */
export async function pushAiRequest(
  database: Database,
  requestId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const uid = auth?.currentUser?.uid
  if (!uid) {
    throw new Error("Not signed in — wait for auth session before using AI")
  }
  await set(ref(database, `requests/${requestId}`), {
    ...data,
    uid,
    status: data.status ?? "pending",
    created_at: data.created_at ?? Date.now(),
  })
}

export function waitForFirebaseResponse<T = any>(
  database: Database,
  requestId: string,
  responsePath: string,
  timeoutMs = 60000,
  onProgress?: (elapsed: number) => void,
): Promise<{ result: string; data: T | null }> {
  return new Promise((resolve, reject) => {
    const responseRef = ref(database, responsePath)
    const statusRef = ref(database, `requests/${requestId}/status`)
    let done = false
    const start = Date.now()

    const progressInterval = setInterval(() => {
      if (done) return
      const elapsed = Math.floor((Date.now() - start) / 1000)
      onProgress?.(elapsed)
    }, 1000)

    const timeout = setTimeout(() => {
      if (done) return
      done = true; clearInterval(progressInterval); unsubStatus(); unsubResp()
      reject(new Error("Request timed out after " + (timeoutMs / 1000) + "s — agent may not be running"))
    }, timeoutMs)

    let unsubStatus = () => {}
    let unsubResp = () => {}

    unsubStatus = onValue(statusRef, (snap) => {
      if (done) return
      if (snap.val() === "error") {
        done = true; clearTimeout(timeout); clearInterval(progressInterval); unsubStatus(); unsubResp()
        get(responseRef).then((s) => {
          const d = s.val()
          reject(new Error(d?.error || "Request failed"))
        })
      }
    })

    unsubResp = onValue(responseRef, (snap) => {
      if (done) return
      const data = snap.val()
      if (!data?.result) return
      done = true; clearTimeout(timeout); clearInterval(progressInterval); unsubStatus(); unsubResp()
      let parsed: T | null = null
      try { parsed = JSON.parse(data.result) } catch {}
      resolve({ result: data.result, data: parsed })
    })
  })
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export function loadSettings(): Record<string, any> {
  try {
    const raw = localStorage.getItem("ceocompass_settings")
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function isLocalAiMode(): boolean {
  const settings = loadSettings()
  return settings.localAiMode === true
}

/**
 * Resolve the active AI provider from settings + env.
 * localAiMode always wins (preserves today's Local AI Mode behavior).
 */
export function getActiveAiProvider(): AiProviderId {
  const settings = loadSettings()
  return resolveAiProvider({
    localAiMode: settings.localAiMode === true,
    aiProvider: settings.aiProvider ?? null,
    envProvider: getEnvAiProvider(),
  })
}

export async function callOllamaDirect(
  prompt: string,
  temperature: number,
  systemType: string = "explain_further",
): Promise<string> {
  const settings = loadSettings()
  const ollamaUrl = settings.ollamaUrl || "http://localhost:11434"
  const model = settings.ollamaModel || "gemma4:31b-cloud"
  const fullPrompt = `${buildSystemPrompt(systemType as any)}\n\n${prompt}`

  const res = await fetch(`${ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: fullPrompt, stream: false, options: { temperature } }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama error (${res.status}): ${text.substring(0, 200)}`)
  }

  const data = await res.json()
  let result = data.response?.trim() || ""
  if (result.startsWith("```")) result = result.split("\n").slice(1).join("\n")
  if (result.endsWith("```")) result = result.slice(0, -3).trim()
  return result
}

function getFrameworkMeta(slug: string) {
  // Returns cached meta synchronously. For RTDB, we use a sync import approach.
  // This function is only used for AI prompt building, so it's fine to return null
  // and let the caller handle missing data.
  return null
}

export function buildSystemPrompt(type: string): string {
  const prompts: Record<string, string> = {
    explain_further: "You are a CEO coach explaining a specific framework concept to a busy executive. Be concise and actionable. Respond only with valid JSON.",
    why_it_matters: "You are a CEO coach writing a concise explanation of why a concept matters to a CEO. Respond only with valid JSON.",
    how_to_apply: "You are a CEO coach writing actionable steps for applying a concept. Respond only with valid JSON.",
    common_pitfalls: "You are a CEO coach identifying common mistakes CEOs make with a concept. Respond only with valid JSON.",
    connected_concepts: "You are a CEO coach connecting related concepts for strategic context. Respond only with valid JSON.",
    case_study: "You are a business educator writing a case study about a company that applied a specific framework concept. Be factual and specific. Respond only with valid JSON.",
    test_yourself: "You are a business school professor creating a self-test exercise for students learning about a specific concept. Respond only with valid JSON.",
    real_world_examples: "You are a CEO coach providing real-world examples of a concept in action. Each example must mention actual companies or situations. Respond only with valid JSON.",
  }
  return prompts[type] || "You are a business school professor creating an assessment for MBA students. Questions should test understanding, not recall. Respond only with valid JSON."
}

export type CacheRecord = {
  result: string
  prompt?: string
  model?: string
  created_at: number
}

export async function checkCacheAt(
  frameworkSlug: string, conceptSlug: string | null, cachePath: string,
): Promise<CacheRecord | null> {
  if (!db) return null
  const database = db!
  try {
    const snap = await get(ref(database, cachePath))
    if (!snap.exists()) {
      console.log(`[AI] Cache miss: ${cachePath}`)
      return null
    }
    const now = Date.now()
    const valid: any[] = Object.values((snap.val() || {}) as any).filter((e: any) => e?.result && now - (e.created_at || 0) <= 86400000)
    if (valid.length === 0) return null
    const latest = valid.reduce((a: any, b: any) => (a.created_at || 0) > (b.created_at || 0) ? a : b)
    console.log(`[AI] Cache hit: ${cachePath} (${valid.length} entries, ${latest.result.length} chars)`)
    return {
      result: latest.result,
      prompt: latest.prompt,
      model: latest.model,
      created_at: latest.created_at,
    }
  } catch {
    return null
  }
}

export async function checkCache(
  frameworkSlug: string,
  conceptSlug: string | null,
  category: string = "explain_further",
): Promise<CacheRecord | null> {
  if (conceptSlug) {
    return checkCacheAt(frameworkSlug, conceptSlug, `framework/${frameworkSlug}/${conceptSlug}/${category}`)
  }
  return checkCacheAt(frameworkSlug, null, `framework/${frameworkSlug}/quiz`)
}

export async function loadCategoryEntries(
  frameworkSlug: string, conceptSlug: string, category: string,
): Promise<CacheRecord[]> {
  if (!db) return []
  const database = db!
  try {
    const snap = await get(ref(database, `framework/${frameworkSlug}/${conceptSlug}/${category}`))
    if (!snap.exists()) return []
    const entries = snap.val()
    const results: CacheRecord[] = []
    for (const entry of Object.values(entries) as any[]) {
      if (entry?.result) {
        results.push({
          result: entry.result,
          prompt: entry.prompt,
          model: entry.model,
          created_at: entry.created_at,
        })
      } else if (entry?.real_world_example || entry?.ceo_insight || entry?.common_mistake || entry?.related_tip) {
        results.push({
          result: JSON.stringify({
            real_world_example: entry.real_world_example || "",
            ceo_insight: entry.ceo_insight || "",
            common_mistake: entry.common_mistake || "",
            related_tip: entry.related_tip || "",
          }),
          prompt: entry.prompt || "",
          model: entry.model || "legacy",
          created_at: entry.created_at || 0,
        })
      }
    }
    results.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
    return results
  } catch {
    return []
  }
}

export async function callOllamaViaFirebase(
  model: string,
  prompt: string,
  temperature: number,
  frameworkSlug: string,
  conceptSlug: string | null,
  category: string,
  systemType: string = "explain_further",
  skipCache: boolean = false,
): Promise<{ result: string; cached: boolean; prompt: string }> {
  const settings = loadSettings()
  const actualModel = model || settings.ollamaModel || "gemma4:31b-cloud"
  const fullPrompt = `${buildSystemPrompt(systemType as any)}\n\n${prompt}`
  const provider = getActiveAiProvider()

  // Local AI Mode — call Ollama directly from browser
  if (provider === "local") {
    console.log(`[AI] Local mode: calling Ollama directly for ${category}`)
    if (!skipCache) {
      const cached = await checkCache(frameworkSlug, conceptSlug, category)
      if (cached) return { result: cached.result, cached: true, prompt: fullPrompt }
    }
    const result = await callOllamaDirect(prompt, temperature, systemType)
    return { result, cached: false, prompt: fullPrompt }
  }

  // Cloud path — not wired until later PR
  if (provider === "cloud") {
    throw new Error(CLOUD_PROVIDER_NOT_CONFIGURED)
  }

  // Agent mode — route through Firebase + local agent
  if (!db) {
    throw new Error("Firebase not configured. Set NEXT_PUBLIC_FIREBASE_* env vars or add them to .env.local")
  }
  const database = db!

  if (!skipCache) {
    const cached = await checkCache(frameworkSlug, conceptSlug, category)
    if (cached) return { result: cached.result, cached: true, prompt: fullPrompt }
  }

  const requestId = generateId()

  const payload = {
    model: actualModel,
    prompt: fullPrompt,
    stream: false,
    options: { temperature },
  }

  console.log(`[AI] Pushing request ${requestId} (provider=${provider}) for ${frameworkSlug}/${conceptSlug}/${category}`)
  await pushAiRequest(database, requestId, {
    type: systemType,
    category,
    framework_slug: frameworkSlug,
    concept_slug: conceptSlug,
    provider,
    payload,
  })

  const responsePath = `framework/${frameworkSlug}/${conceptSlug}/${category}/${requestId}`
  const { result } = await waitForFirebaseResponse(database, requestId, responsePath)
  console.log(`[AI] Response ${requestId} received (${result.length} chars) for ${category}`)
  return { result, cached: false, prompt: fullPrompt }
}

/**
 * Shared dispatch for generators that do not use callOllamaViaFirebase
 * (quotes, scenarios, comparisons, concept chat, etc.).
 *
 * - local → browser Ollama via callOllamaDirect
 * - cloud → throws CLOUD_PROVIDER_NOT_CONFIGURED
 * - agent → pushAiRequest with provider field + waitForFirebaseResponse
 */
export async function runWithAiProvider(args: {
  /** User prompt (system preamble applied via systemType for local + default agent payload). */
  prompt: string
  temperature: number
  systemType?: string
  model?: string
  /**
   * Fields merged into the RTDB request (type, category, paths, optional payload).
   * When payload is omitted, a standard { model, prompt, stream, options } is built
   * using full system+user prompt (same as callOllamaViaFirebase agent path).
   */
  agentRequest: Record<string, unknown>
  responsePath: string | ((requestId: string) => string)
  timeoutMs?: number
  onProgress?: (elapsed: number) => void
}): Promise<{ result: string; data: any | null; prompt: string }> {
  const provider = getActiveAiProvider()
  if (provider === "cloud") {
    throw new Error(CLOUD_PROVIDER_NOT_CONFIGURED)
  }

  const settings = loadSettings()
  const model = args.model || settings.ollamaModel || "gemma4:31b-cloud"
  const systemType = args.systemType ?? "explain_further"
  const fullPrompt = `${buildSystemPrompt(systemType as any)}\n\n${args.prompt}`

  if (provider === "local") {
    const result = await callOllamaDirect(args.prompt, args.temperature, systemType)
    let data: any = null
    try {
      data = JSON.parse(result)
    } catch {
      /* plain text */
    }
    return { result, data, prompt: fullPrompt }
  }

  // provider === "agent"
  if (!db) {
    throw new Error("Firebase not configured. Set NEXT_PUBLIC_FIREBASE_* env vars or add them to .env.local")
  }
  const database = db!
  const requestId = generateId()
  const { payload: customPayload, ...rest } = args.agentRequest
  const payload =
    customPayload && typeof customPayload === "object"
      ? customPayload
      : {
          model,
          prompt: fullPrompt,
          stream: false,
          options: { temperature: args.temperature },
        }

  await pushAiRequest(database, requestId, {
    ...rest,
    payload,
    provider,
  })

  const path =
    typeof args.responsePath === "function" ? args.responsePath(requestId) : args.responsePath
  const { result, data } = await waitForFirebaseResponse(
    database,
    requestId,
    path,
    args.timeoutMs,
    args.onProgress,
  )
  return { result, data, prompt: fullPrompt }
}

