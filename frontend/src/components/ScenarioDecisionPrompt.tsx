"use client"

import { useState } from "react"
import type { ScenarioStage } from "@/lib/types"

export function ScenarioDecisionPrompt({ stage, onSubmit, isLoading }: {
  stage: ScenarioStage
  onSubmit: (choiceId?: string, freeResponse?: string) => void
  isLoading: boolean
}) {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const [freeResponse, setFreeResponse] = useState("")
  const [showAnswer, setShowAnswer] = useState(false)

  if (stage.free_response) {
    return (
      <div>
        <textarea value={freeResponse} onChange={(e) => setFreeResponse(e.target.value)} rows={6}
          className="mb-4 w-full resize-none rounded-lg border border-dark-200 p-4 text-sm text-dark-800 placeholder:text-dark-400 focus:border-primary-400 focus:outline-none dark:text-dark-200 dark:border-dark-700"
          placeholder="Type your analysis, calculation, or response..." />
        {stage.sample_answer && (
          <div className="mb-4">
            <button type="button" onClick={() => setShowAnswer(!showAnswer)}
              className="text-xs text-primary-600 hover:text-primary-700 underline underline-offset-2"
            >{showAnswer ? "Hide Model Answer" : "Show Model Answer"}</button>
            {showAnswer && (
              <div className="mt-2 animate-slide-up rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-medium text-amber-800 mb-1">Model Answer</p>
                <p className="text-sm text-dark-700 whitespace-pre-wrap dark:text-dark-300">{stage.sample_answer}</p>
              </div>
            )}
          </div>
        )}
        <button onClick={() => onSubmit(undefined, freeResponse)} disabled={isLoading || !freeResponse.trim()}
          className="w-full rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >{isLoading ? "Evaluating..." : "Submit for Feedback"}</button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 space-y-3">
        {stage.options.map((option) => (
          <button key={option.id} onClick={() => setSelectedChoice(option.id)}
            className={`w-full rounded-lg border p-4 text-left transition ${selectedChoice === option.id ? "border-primary-400 bg-primary-50 shadow-sm dark:bg-primary-900/20" : "border-dark-200 hover:border-dark-300 dark:border-dark-700"}`}>
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${selectedChoice === option.id ? "border-primary-500 bg-primary-500 text-white" : "border-dark-300 text-dark-400 dark:text-dark-300 dark:border-dark-600"}`}>
                {option.id.toUpperCase()}
              </span>
              <div>
                <span className="text-sm text-dark-700 dark:text-dark-300">{option.label}</span>
                <span className="ml-2 text-[10px] text-dark-400 dark:text-dark-500">Score: {option.score}/10</span>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="mb-4">
        <button type="button" onClick={() => setShowAnswer(!showAnswer)}
          className="text-xs text-primary-600 hover:text-primary-700 underline underline-offset-2"
        >{showAnswer ? "Hide Hint" : "Show Hint"}</button>
        {showAnswer && stage.options.find((o) => o.rationale) && (
          <div className="mt-2 animate-slide-up rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-medium text-amber-800 mb-2">Best Approach</p>
            {stage.options.map((o) => (
              <div key={o.id} className="mb-2 last:mb-0">
                <span className="text-sm font-medium text-dark-800 dark:text-dark-200">{o.label}</span>
                <p className="text-xs text-dark-600 dark:text-dark-300">{o.rationale}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <button onClick={() => selectedChoice && onSubmit(selectedChoice)} disabled={isLoading || !selectedChoice}
        className="w-full rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >{isLoading ? "Evaluating..." : "Submit"}</button>
    </div>
  )
}
