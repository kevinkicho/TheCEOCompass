"use client"

import React, { useState } from "react"
import { chatWithConcept, socraticTutor, teachBackEvaluate, generateAnalogy } from "@/lib/ollama"
import { db } from "@/lib/firebase"
import { canUseFirebasePersistence } from "@/lib/capabilities"
import { ChatPanel } from "@/components/ChatPanel"
import type { FrameworkConcept, Framework } from "@/lib/types"

interface Props {
  framework: Framework
  concept: FrameworkConcept
  frameworkSlug: string
  conceptSlug: string
}

export function LearningToolsPanel({ framework, concept, frameworkSlug, conceptSlug }: Props) {
  const [learningMode, setLearningMode] = useState<"ask" | "socratic" | "teachback" | "analogy">("ask")
  const [teachBackInput, setTeachBackInput] = useState("")
  const [teachBackResult, setTeachBackResult] = useState<{
    clarity: number
    depth: number
    gaps: string[]
    improvement: string
  } | null>(null)
  const [teachBackLoading, setTeachBackLoading] = useState(false)
  const [analogyDomain, setAnalogyDomain] = useState("chef")
  const [analogyResult, setAnalogyResult] = useState("")
  const [analogyLoading, setAnalogyLoading] = useState(false)
  const [learningError, setLearningError] = useState("")

  if (!canUseFirebasePersistence()) return null

  const conceptCtx = { ...concept, framework: framework.title }

  return (
    <>
      <div className="mt-8 mb-4">
        <p className="text-xs font-semibold text-dark-400 dark:text-dark-400 uppercase tracking-wide mb-3">
          AI Learning Tools
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "ask" as const, label: "Ask AI" },
              { id: "socratic" as const, label: "Socratic Tutor" },
              { id: "teachback" as const, label: "Teach Back" },
              { id: "analogy" as const, label: "Analogy" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setLearningMode(m.id)
                setLearningError("")
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                learningMode === m.id
                  ? "bg-primary-600 text-white shadow-sm"
                  : "border border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-400 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/10"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {learningError && (
        <p className="mb-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
          {learningError}
        </p>
      )}

      {learningMode === "ask" && (
        <ChatPanel
          title="Concept Tutor"
          subtitle="Ask follow-up questions about this concept"
          storageKey={`tutor:${frameworkSlug}/${conceptSlug}`}
          sendMessage={async (messages, userMessage) => {
            const allMessages = [...messages, { role: "user" as const, content: userMessage }].map((m) => ({
              role: m.role,
              content: m.content,
            }))
            return await chatWithConcept(conceptCtx, allMessages)
          }}
          disabled={!db}
          placeholder="Ask about this concept..."
        />
      )}

      {learningMode === "socratic" && (
        <ChatPanel
          title="Socratic Tutor"
          subtitle="AI asks questions to test your understanding"
          storageKey={`socratic:${frameworkSlug}/${conceptSlug}`}
          sendMessage={async (messages, userMessage) => {
            const allMessages = [...messages, { role: "user" as const, content: userMessage }].map((m) => ({
              role: m.role,
              content: m.content,
            }))
            return await socraticTutor(conceptCtx, allMessages)
          }}
          disabled={!db}
          placeholder="Type your answer..."
        />
      )}

      {learningMode === "teachback" && (
        <div className="rounded-xl border border-dark-200 dark:border-dark-700 overflow-hidden">
          <div className="bg-primary-50 dark:bg-primary-900/20 px-4 py-2.5 border-b border-primary-200 dark:border-primary-800/40">
            <p className="text-sm font-semibold text-primary-700 dark:text-primary-300">Teach Back</p>
            <p className="text-xs text-dark-500 dark:text-dark-400">
              Explain this concept in your own words — AI scores your understanding
            </p>
          </div>
          <div className="p-4 bg-white dark:bg-dark-900">
            <textarea
              value={teachBackInput}
              onChange={(e) => setTeachBackInput(e.target.value)}
              placeholder={`Explain "${concept.name}" in your own words as if teaching a peer...`}
              rows={5}
              className="w-full resize-none rounded-lg border border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-800 px-3 py-2 text-sm text-dark-700 dark:text-dark-200 placeholder-dark-300 dark:placeholder-dark-500 focus:border-primary-400 dark:focus:border-primary-600 focus:outline-none"
            />
            <button
              onClick={async () => {
                if (!teachBackInput.trim() || teachBackLoading) return
                setTeachBackLoading(true)
                setLearningError("")
                setTeachBackResult(null)
                try {
                  const r = await teachBackEvaluate(conceptCtx, teachBackInput)
                  setTeachBackResult(r)
                } catch (err: unknown) {
                  setLearningError(err instanceof Error ? err.message : "Failed to evaluate")
                }
                setTeachBackLoading(false)
              }}
              disabled={!teachBackInput.trim() || teachBackLoading}
              className="mt-3 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-700 transition disabled:opacity-50"
            >
              {teachBackLoading ? "Evaluating..." : "Submit Explanation"}
            </button>

            {teachBackResult && (
              <div className="mt-4 space-y-3">
                <div className="flex gap-4">
                  <div className="flex-1 rounded-lg bg-dark-50 dark:bg-dark-800 p-3 text-center">
                    <p className="text-lg font-bold text-primary-600">
                      {teachBackResult.clarity}
                      <span className="text-xs text-dark-400">/10</span>
                    </p>
                    <p className="text-[10px] text-dark-500 dark:text-dark-400">Clarity</p>
                  </div>
                  <div className="flex-1 rounded-lg bg-dark-50 dark:bg-dark-800 p-3 text-center">
                    <p className="text-lg font-bold text-violet-600">
                      {teachBackResult.depth}
                      <span className="text-xs text-dark-400">/10</span>
                    </p>
                    <p className="text-[10px] text-dark-500 dark:text-dark-400">Depth</p>
                  </div>
                </div>
                {teachBackResult.gaps.length > 0 && (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 p-3">
                    <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">
                      Gaps
                    </p>
                    <ul className="space-y-1">
                      {teachBackResult.gaps.map((g, i) => (
                        <li key={i} className="text-xs text-dark-600 dark:text-dark-400">
                          • {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/40 p-3">
                  <p className="text-[10px] font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide mb-1">
                    Improved Version
                  </p>
                  <p className="text-sm text-dark-700 dark:text-dark-300 leading-relaxed">{teachBackResult.improvement}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {learningMode === "analogy" && (
        <div className="rounded-xl border border-dark-200 dark:border-dark-700 overflow-hidden">
          <div className="bg-primary-50 dark:bg-primary-900/20 px-4 py-2.5 border-b border-primary-200 dark:border-primary-800/40">
            <p className="text-sm font-semibold text-primary-700 dark:text-primary-300">Analogy Engine</p>
            <p className="text-xs text-dark-500 dark:text-dark-400">See the concept through a different lens</p>
          </div>
          <div className="p-4 bg-white dark:bg-dark-900">
            <div className="flex items-center gap-3 mb-3">
              <p className="text-xs text-dark-500 dark:text-dark-400">Explain like I&apos;m a</p>
              <select
                value={analogyDomain}
                onChange={(e) => setAnalogyDomain(e.target.value)}
                className="rounded-lg border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-900 px-3 py-1.5 text-xs text-dark-700 dark:text-dark-200 focus:border-primary-400 focus:outline-none"
              >
                {["chef", "military general", "jazz musician", "gardener", "architect", "sports coach", "ship captain", "parent"].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <button
                onClick={async () => {
                  if (analogyLoading) return
                  setAnalogyLoading(true)
                  setLearningError("")
                  setAnalogyResult("")
                  try {
                    setAnalogyResult(await generateAnalogy(conceptCtx, analogyDomain))
                  } catch (err: unknown) {
                    setLearningError(err instanceof Error ? err.message : "Failed to generate")
                  }
                  setAnalogyLoading(false)
                }}
                disabled={analogyLoading}
                className="rounded-lg bg-primary-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition disabled:opacity-50"
              >
                {analogyLoading ? "..." : "Generate"}
              </button>
            </div>
            {analogyResult && (
              <div className="rounded-lg bg-dark-50 dark:bg-dark-800 p-4">
                <p className="text-sm text-dark-700 dark:text-dark-300 leading-relaxed whitespace-pre-line">{analogyResult}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
