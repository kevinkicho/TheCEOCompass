import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  generateText,
  loadLlmConfigFromEnv,
  stripCodeFences,
  DEFAULT_LLM_TIMEOUT_MS,
  type LlmConfig,
} from "./llm"

describe("stripCodeFences", () => {
  it("strips leading and trailing fences", () => {
    const input = "```json\n{\"a\":1}\n```"
    assert.equal(stripCodeFences(input), '{"a":1}')
  })

  it("returns plain text unchanged", () => {
    assert.equal(stripCodeFences("  hello  "), "hello")
  })
})

describe("loadLlmConfigFromEnv", () => {
  it("throws when OPENAI_API_KEY and OLLAMA_API_KEY are missing", () => {
    assert.throws(
      () => loadLlmConfigFromEnv({}),
      /OPENAI_API_KEY|OLLAMA_API_KEY/,
    )
  })

  it("applies defaults for base and model", () => {
    const cfg = loadLlmConfigFromEnv({ OPENAI_API_KEY: "sk-test" })
    assert.equal(cfg.apiKey, "sk-test")
    assert.equal(cfg.apiBase, "https://api.openai.com/v1")
    assert.equal(cfg.model, "gpt-4o-mini")
  })

  it("accepts OLLAMA_API_KEY alias and Ollama base", () => {
    const cfg = loadLlmConfigFromEnv({
      OLLAMA_API_KEY: "ollama-key",
      OLLAMA_API_BASE: "https://ollama.com/v1",
      OLLAMA_MODEL: "gemma4:31b-cloud",
    })
    assert.equal(cfg.apiKey, "ollama-key")
    assert.equal(cfg.apiBase, "https://ollama.com/v1")
    assert.equal(cfg.model, "gemma4:31b-cloud")
  })

  it("reads custom base and model", () => {
    const cfg = loadLlmConfigFromEnv({
      OPENAI_API_KEY: "sk-x",
      OPENAI_API_BASE: "https://example.com/v1/",
      CLOUD_AI_MODEL: "my-model",
    })
    assert.equal(cfg.apiBase, "https://example.com/v1/")
    assert.equal(cfg.model, "my-model")
  })
})

describe("generateText (mock HTTP)", () => {
  const config: LlmConfig = {
    apiKey: "sk-test-key",
    apiBase: "https://api.example.com/v1",
    model: "default-model",
  }

  it("POSTs chat/completions and returns stripped content", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.toString()
      calls.push({ url, init: init || {} })
      return new Response(
        JSON.stringify({
          model: "echo-model",
          choices: [
            {
              message: {
                content: "```json\n{\"ok\":true}\n```",
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }

    const result = await generateText(config, {
      prompt: "Say hello as JSON",
      temperature: 0.2,
      model: "override-model",
      fetchImpl,
    })

    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, "https://api.example.com/v1/chat/completions")
    assert.equal(calls[0].init.method, "POST")

    const headers = calls[0].init.headers as Record<string, string>
    assert.equal(headers.Authorization, "Bearer sk-test-key")
    assert.equal(headers["Content-Type"], "application/json")

    const body = JSON.parse(String(calls[0].init.body))
    assert.equal(body.model, "override-model")
    assert.equal(body.temperature, 0.2)
    assert.deepEqual(body.messages, [
      { role: "user", content: "Say hello as JSON" },
    ])

    assert.equal(result.text, '{"ok":true}')
    assert.equal(result.model, "echo-model")
  })

  it("throws on non-2xx with status in message", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("rate limited", { status: 429 })

    await assert.rejects(
      () =>
        generateText(config, {
          prompt: "x",
          fetchImpl,
        }),
      /Cloud LLM error \(429\).*rate limited/,
    )
  })

  it("throws when choices are empty", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ choices: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })

    await assert.rejects(
      () => generateText(config, { prompt: "x", fetchImpl }),
      /empty completion/,
    )
  })

  it("passes AbortSignal to fetch and maps abort to timeout error", async () => {
    let seenSignal: AbortSignal | undefined
    const fetchImpl: typeof fetch = async (_input, init) => {
      seenSignal = init?.signal
      const err = new Error("aborted")
      err.name = "AbortError"
      throw err
    }

    await assert.rejects(
      () =>
        generateText(config, {
          prompt: "x",
          fetchImpl,
          timeoutMs: 1234,
        }),
      /Cloud LLM timed out after 1234ms/,
    )
    assert.ok(seenSignal)
    assert.equal(DEFAULT_LLM_TIMEOUT_MS, 100_000)
  })
})
