/**
 * processAIRequest — Firebase Function (v2 RTDB trigger)
 *
 * On create of /requests/{requestId}, if provider === "cloud":
 *   1. Mark request processing
 *   2. Call OpenAI-compatible chat API (server-side secrets)
 *   3. Write result to the same response path the local agent uses
 *   4. Mark request done | error
 *
 * Agent-mode requests (no provider / provider === "agent") are ignored.
 */

import * as admin from "firebase-admin"
import { onValueCreated } from "firebase-functions/v2/database"
import { defineSecret, defineString } from "firebase-functions/params"
import { generateText } from "./llm"
import {
  getResponsePath,
  isCloudProviderRequest,
  type AiRequestData,
} from "./response-path"

if (!admin.apps.length) {
  admin.initializeApp()
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

async function writeError(
  requestId: string,
  data: AiRequestData,
  errorMessage: string,
): Promise<void> {
  const db = admin.database()
  const errorData = { error: errorMessage, created_at: Date.now() }
  const path = getResponsePath(requestId, data)
  if (path) {
    await db.ref(path).set(errorData)
  }
  await db.ref(`requests/${requestId}`).update({ status: "error" })
}

export const processAIRequest = onValueCreated(
  {
    ref: "/requests/{requestId}",
    // Match RTDB region (us-central1 for *.firebaseio.com default instances)
    region: "us-central1",
    secrets: [openaiApiKey],
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async (event) => {
    const requestId = event.params.requestId as string
    const data = event.data.val() as AiRequestData | null

    if (!isCloudProviderRequest(data)) {
      // Local agent or other providers own this request
      return
    }
    if (!data || data.status !== "pending") {
      return
    }

    const db = admin.database()
    const requestRef = db.ref(`requests/${requestId}`)
    const responsePath = getResponsePath(requestId, data)

    console.log(`[processAIRequest] ${requestId} type=${data.type || "generate"}`)

    try {
      await requestRef.update({ status: "processing", started_at: Date.now() })

      const prompt = data.payload?.prompt
      if (!prompt || typeof prompt !== "string") {
        throw new Error("Request payload.prompt is required for cloud AI")
      }

      const temperature = data.payload?.options?.temperature
      const payloadModel = data.payload?.model

      const { text, model } = await generateText(
        {
          apiKey: openaiApiKey.value(),
          apiBase: openaiApiBase.value(),
          model: cloudAiModel.value(),
        },
        {
          prompt,
          model: payloadModel,
          temperature,
        },
      )

      const responseData: Record<string, unknown> = {
        result: text,
        model,
        prompt: prompt,
        created_at: Date.now(),
      }

      if (responsePath) {
        if (data.category === "quote") {
          await db.ref(responsePath).set({
            ...responseData,
            category: data.category || "",
          })
        } else if (data.category === "scenario") {
          await db.ref(responsePath).set({
            ...responseData,
            stage_id: data.stage_id || "",
          })
        } else {
          await db.ref(responsePath).set(responseData)
        }
      }

      await requestRef.update({ status: "done" })
      console.log(
        `[processAIRequest] ${requestId} done (${text.length} chars) → ${responsePath || "(no path)"}`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[processAIRequest] ${requestId} error: ${message}`)
      await writeError(requestId, data, message)
    }
  },
)
