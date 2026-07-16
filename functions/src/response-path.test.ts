import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { getResponsePath, isCloudProviderRequest } from "./response-path"

describe("getResponsePath", () => {
  const id = "req-abc"

  it("routes framework category responses", () => {
    assert.equal(
      getResponsePath(id, {
        category: "explain_further",
        framework_slug: "okr",
        concept_slug: "objectives",
      }),
      `framework/okr/objectives/explain_further/${id}`,
    )
  })

  it("routes compare_response_path", () => {
    assert.equal(
      getResponsePath(id, {
        compare_response_path: "comparisons/okr/a/b/compare",
        type: "compare_concepts",
      }),
      `comparisons/okr/a/b/compare/${id}`,
    )
  })

  it("routes compare_concepts fallback", () => {
    assert.equal(
      getResponsePath(id, { type: "compare_concepts" }),
      `comparisons/${id}`,
    )
  })

  it("routes concept_chat", () => {
    assert.equal(
      getResponsePath(id, { type: "concept_chat" }),
      `conceptChats/${id}`,
    )
  })

  it("routes quote category", () => {
    assert.equal(
      getResponsePath(id, { category: "quote", type: "quote" }),
      `quotes/generated/${id}`,
    )
  })

  it("routes scenario category", () => {
    assert.equal(
      getResponsePath(id, { category: "scenario", type: "scenario" }),
      `scenario-evaluations/${id}`,
    )
  })

  it("returns null when no path applies", () => {
    assert.equal(getResponsePath(id, { type: "unknown" }), null)
  })
})

describe("isCloudProviderRequest", () => {
  it("is true only when provider === cloud", () => {
    assert.equal(isCloudProviderRequest({ provider: "cloud" }), true)
    assert.equal(isCloudProviderRequest({ provider: "agent" }), false)
    assert.equal(isCloudProviderRequest({}), false)
    assert.equal(isCloudProviderRequest(null), false)
  })
})
