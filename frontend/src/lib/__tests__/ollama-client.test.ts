import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { generateWithOllamaFallback, hasOllamaApiKey } from "../ai/ollama-client"

describe("generateWithOllamaFallback", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("uses local generate when /api/tags is healthy", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true }) // tags
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: "local-answer" }),
      })

    const r = await generateWithOllamaFallback({
      prompt: "hi",
      temperature: 0.2,
      model: "m",
      localUrl: "http://localhost:11434",
      apiKey: null,
      fetchImpl: fetchMock as unknown as typeof fetch,
    })
    expect(r.source).toBe("local")
    expect(r.text).toBe("local-answer")
  })

  it("falls back to cloud chat when local is down and apiKey set", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("connection refused")) // tags
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "cloud-answer" } }],
          model: "gemma-cloud",
        }),
      })

    const r = await generateWithOllamaFallback({
      prompt: "hi",
      apiKey: "test-key",
      apiBase: "https://ollama.com/v1",
      model: "gemma4:31b-cloud",
      fetchImpl: fetchMock as unknown as typeof fetch,
    })
    expect(r.source).toBe("cloud")
    expect(r.text).toBe("cloud-answer")
    expect(String(fetchMock.mock.calls[1][0])).toContain("/chat/completions")
  })

  it("throws when local down and no api key", async () => {
    fetchMock.mockRejectedValue(new Error("down"))
    await expect(
      generateWithOllamaFallback({
        prompt: "hi",
        apiKey: null,
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/AI unavailable|OLLAMA_API_KEY/)
  })
})

describe("hasOllamaApiKey", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("detects NEXT_PUBLIC_OLLAMA_API_KEY", () => {
    vi.stubEnv("NEXT_PUBLIC_OLLAMA_API_KEY", "abc")
    expect(hasOllamaApiKey()).toBe(true)
  })
})
