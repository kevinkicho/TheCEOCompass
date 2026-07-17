/**
 * Cloud AI Functions:
 * - processAIRequest — RTDB onCreate for provider === "cloud"
 * - generateAI — HTTPS callable (preferred cloud path from static frontend)
 */

import * as admin from "firebase-admin"
import { onValueCreated } from "firebase-functions/v2/database"
import { onCall, HttpsError } from "firebase-functions/v2/https"
import { defineSecret, defineString } from "firebase-functions/params"
import { generateText } from "./llm"
import { handleCloudRequest } from "./handler"
import { runCallableGenerate } from "./callable-core"
import { recordAiMetric } from "./metrics"
import type { AiRequestData } from "./response-path"

const DEFAULT_DATABASE_URL =
  "https://theceocompass-default-rtdb.firebaseio.com"

if (!admin.apps.length) {
  admin.initializeApp({
    databaseURL:
      process.env.FIREBASE_DATABASE_URL ||
      process.env.DATABASE_URL ||
      DEFAULT_DATABASE_URL,
  })
}

const openaiApiKey = defineSecret("OPENAI_API_KEY")
const openaiApiBase = defineString("OPENAI_API_BASE", {
  // Ollama Cloud OpenAI-compatible endpoint (override for OpenAI/Groq/etc.)
  default: "https://ollama.com/v1",
  description: "OpenAI-compatible API base URL (no trailing slash required)",
})
const cloudAiModel = defineString("CLOUD_AI_MODEL", {
  default: "gemma4:31b-cloud",
  description: "Default model when request.payload.model is absent",
})

function llmConfigFromParams() {
  return {
    apiKey: openaiApiKey.value(),
    apiBase: openaiApiBase.value(),
    model: cloudAiModel.value(),
  }
}

export const processAIRequest = onValueCreated(
  {
    ref: "/requests/{requestId}",
    // Match RTDB region + default instance (theceocompass-default-rtdb.firebaseio.com)
    region: "us-central1",
    instance: "theceocompass-default-rtdb",
    secrets: [openaiApiKey],
    memory: "256MiB",
    timeoutSeconds: 120,
    // Prefer single attempt: claim transaction is the source of truth; retries can still
    // re-enter but claim fails closed if status is no longer pending.
    retry: false,
  },
  async (event) => {
    const requestId = event.params.requestId as string
    const data = event.data.val() as AiRequestData | null

    await handleCloudRequest(requestId, data, {
      // Admin Database matches DbLike (ref/update/set/transaction)
      db: admin.database() as unknown as import("./handler").DbLike,
      generateText,
      llmConfig: llmConfigFromParams(),
      llmTimeoutMs: 100_000,
    })
  },
)

/**
 * HTTPS callable cloud AI — auth required, rate-limited, no RTDB request bus.
 * Frontend cloud provider prefers this path.
 */
export const generateAI = onCall(
  {
    region: "us-central1",
    secrets: [openaiApiKey],
    memory: "256MiB",
    timeoutSeconds: 120,
    // Allow GitHub Pages origin; tighten in Console if needed
    invoker: "public",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in required for cloud AI")
    }
    const data = (request.data || {}) as {
      prompt?: string
      model?: string
      temperature?: number
    }
    try {
      const rtdb = admin.database()
      const result = await runCallableGenerate(
        {
          prompt: data.prompt || "",
          model: data.model,
          temperature: data.temperature,
          uid: request.auth.uid,
        },
        {
          db: rtdb as unknown as import("./rate-limit").RateDbLike,
          generateText,
          llmConfig: llmConfigFromParams(),
          llmTimeoutMs: 100_000,
          writeHeartbeat: async (payload) => {
            await rtdb.ref("_meta/cloud_worker_heartbeat").set(payload)
          },
        },
      )
      recordAiMetric(rtdb as unknown as import("./metrics").MetricsDbLike, "callable_ok").catch(
        () => {},
      )
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const rtdb = admin.database()
      if (/rate limit/i.test(message)) {
        recordAiMetric(rtdb as unknown as import("./metrics").MetricsDbLike, "rate_limited").catch(
          () => {},
        )
        throw new HttpsError("resource-exhausted", message)
      }
      recordAiMetric(rtdb as unknown as import("./metrics").MetricsDbLike, "callable_err").catch(
        () => {},
      )
      if (message.startsWith("UNAUTHENTICATED")) {
        throw new HttpsError("unauthenticated", message)
      }
      if (message.startsWith("INVALID_ARGUMENT")) {
        throw new HttpsError("invalid-argument", message)
      }
      throw new HttpsError("internal", message)
    }
  },
)
