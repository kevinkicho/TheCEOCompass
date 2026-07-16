/**
 * processAIRequest — Firebase Function (v2 RTDB trigger)
 *
 * On create of /requests/{requestId}, if provider === "cloud":
 *   1. Claim pending → processing (transaction; retry-safe)
 *   2. Per-uid rate limit via Admin SDK `_rate/{uid}` (20 / 10 min sliding window)
 *   3. Call OpenAI-compatible chat API (server-side secrets)
 *   4. Write result to the same response path the local agent uses
 *   5. Mark request done | error (rate-limit errors surface a clear message)
 *
 * Agent-mode requests (no provider / provider === "agent") are ignored.
 */

import * as admin from "firebase-admin"
import { onValueCreated } from "firebase-functions/v2/database"
import { defineSecret, defineString } from "firebase-functions/params"
import { generateText } from "./llm"
import { handleCloudRequest } from "./handler"
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
  default: "https://api.openai.com/v1",
  description: "OpenAI-compatible API base URL (no trailing slash required)",
})
const cloudAiModel = defineString("CLOUD_AI_MODEL", {
  default: "gpt-4o-mini",
  description: "Default model when request.payload.model is absent",
})

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
      llmConfig: {
        apiKey: openaiApiKey.value(),
        apiBase: openaiApiBase.value(),
        model: cloudAiModel.value(),
      },
      llmTimeoutMs: 100_000,
    })
  },
)
