"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"

export type ChatMessage = {
  role: "user" | "assistant"
  content: string
  timestamp: number
}

export type SendMessageFn = (
  messages: ChatMessage[],
  userMessage: string,
) => Promise<string>

const MAX_MESSAGES = 30

function loadMessages(storageKey: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.slice(-MAX_MESSAGES)
  } catch {
    return []
  }
}

function saveMessages(storageKey: string, messages: ChatMessage[]) {
  try {
    const trimmed = messages.slice(-MAX_MESSAGES)
    localStorage.setItem(storageKey, JSON.stringify(trimmed))
  } catch {}
}

export function ChatPanel({
  title,
  subtitle,
  storageKey,
  sendMessage,
  disabled,
  placeholder,
}: {
  title: string
  subtitle?: string
  storageKey: string
  sendMessage: SendMessageFn
  disabled?: boolean
  placeholder?: string
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setMessages(loadMessages(storageKey))
  }, [storageKey])

  useEffect(() => {
    saveMessages(storageKey, messages)
  }, [storageKey, messages])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading || disabled) return

    const userMsg: ChatMessage = { role: "user", content: text, timestamp: Date.now() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput("")
    setLoading(true)
    setError("")

    try {
      const response = await sendMessage(messages, text)
      const aiMsg: ChatMessage = { role: "assistant", content: response, timestamp: Date.now() }
      setMessages((prev) => [...prev, aiMsg])
    } catch (err: any) {
      setError(err.message || "Failed to get response")
    }

    setLoading(false)
    if (inputRef.current) inputRef.current.focus()
  }, [input, loading, disabled, messages, sendMessage])

  const handleClear = () => {
    setMessages([])
    setError("")
    try { localStorage.removeItem(storageKey) } catch {}
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-dark-200 dark:border-dark-700 overflow-hidden">
      <div className="flex items-center justify-between bg-primary-50 dark:bg-primary-900/20 px-4 py-2.5 border-b border-primary-200 dark:border-primary-800/40">
        <div>
          <p className="text-sm font-semibold text-primary-700 dark:text-primary-300">{title}</p>
          {subtitle && <p className="text-xs text-dark-500 dark:text-dark-400">{subtitle}</p>}
        </div>
        {messages.length > 0 && (
          <button onClick={handleClear}
            className="text-xs text-dark-400 hover:text-red-500 dark:text-dark-500 dark:hover:text-red-400 transition"
          >Clear</button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800/40 px-4 py-2 text-xs text-red-600 dark:text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={handleSend}
            className="ml-3 shrink-0 rounded bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 transition"
          >Retry</button>
        </div>
      )}

      <div ref={scrollRef} className="max-h-80 min-h-[120px] overflow-y-auto p-4 space-y-3 bg-white dark:bg-dark-900">
        {messages.length === 0 && !loading && (
          <p className="text-xs text-dark-400 dark:text-dark-500 text-center py-6">
            {disabled ? "Run the app locally (not GitHub Pages) to use AI chat." : "Ask a follow-up question about this concept..."}
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-primary-600 text-white"
                : "bg-dark-100 dark:bg-dark-800 text-dark-700 dark:text-dark-200"
            }`}>
              {msg.content.split("\n").map((line, j) => (
                <React.Fragment key={j}>
                  {line}
                  {j < msg.content.split("\n").length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-dark-100 dark:bg-dark-800 rounded-lg px-4 py-2.5">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-primary-400 animate-pulse" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 rounded-full bg-primary-400 animate-pulse" style={{ animationDelay: "200ms" }} />
                <span className="h-2 w-2 rounded-full bg-primary-400 animate-pulse" style={{ animationDelay: "400ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-dark-200 dark:border-dark-700 p-3 bg-dark-50 dark:bg-dark-800/50">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || loading}
            placeholder={placeholder || "Type your question..."}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-900 px-3 py-2 text-sm text-dark-700 dark:text-dark-200 placeholder-dark-300 dark:placeholder-dark-500 focus:border-primary-400 dark:focus:border-primary-600 focus:outline-none disabled:opacity-50"
            style={{ maxHeight: "100px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading || disabled}
            className="shrink-0 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  )
}