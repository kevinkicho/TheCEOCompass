/**
 * Response path routing — must stay in sync with agent/index.js getResponseRef.
 */

export type AiRequestData = {
  type?: string
  category?: string
  framework_slug?: string
  concept_slug?: string
  compare_response_path?: string
  stage_id?: string
  provider?: string
  status?: string
  payload?: {
    model?: string
    prompt?: string
    stream?: boolean
    options?: { temperature?: number }
  }
  [key: string]: unknown
}

/**
 * Resolve the RTDB path where the AI result (or error) should be written.
 * Mirrors agent/index.js getResponseRef exactly.
 */
export function getResponsePath(
  requestId: string,
  data: AiRequestData,
): string | null {
  const { framework_slug, concept_slug, category } = data
  if (category && framework_slug && concept_slug) {
    return `framework/${framework_slug}/${concept_slug}/${category}/${requestId}`
  }
  if (data.compare_response_path) {
    return `${data.compare_response_path}/${requestId}`
  }
  if (data.type === "compare_concepts") {
    return `comparisons/${requestId}`
  }
  if (data.type === "concept_chat") {
    return `conceptChats/${requestId}`
  }
  if (category === "quote") {
    return `quotes/generated/${requestId}`
  }
  if (category === "scenario") {
    return `scenario-evaluations/${requestId}`
  }
  return null
}

/** Whether this request should be handled by the cloud function (not the local agent). */
export function isCloudProviderRequest(data: AiRequestData | null | undefined): boolean {
  if (!data) return false
  return data.provider === "cloud"
}
