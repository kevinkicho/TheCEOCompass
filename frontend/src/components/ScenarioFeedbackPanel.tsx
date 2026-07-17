"use client"

import type { FeedbackResponse } from "@/lib/types"

export function ScenarioFeedbackPanel({ feedback, onNext, isLastStage }: {
  feedback: FeedbackResponse
  onNext: () => void
  isLastStage: boolean
}) {
  return (
    <div className="animate-slide-up space-y-4">
      <div className="rounded-lg bg-primary-50 p-4 text-center dark:bg-primary-900/20">
        <p className="text-sm text-primary-700 dark:text-primary-300">Score</p>
        <p className="text-2xl font-bold text-primary-600">{Math.round(feedback.score * 100)}%</p>
      </div>
      <div className="rounded-lg border border-dark-200 p-4 dark:border-dark-700">
        <p className="text-sm text-dark-600 dark:text-dark-300 leading-relaxed">{feedback.feedback}</p>
      </div>
      {feedback.key_insights.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-dark-700 dark:text-dark-300">Key Insights</p>
          <ul className="space-y-1">
            {feedback.key_insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-dark-600 dark:text-dark-300">
                <span className="mt-0.5 text-primary-500">•</span>{insight}
              </li>
            ))}
          </ul>
        </div>
      )}
      {feedback.next_framework_suggestion && (
        <div className="rounded-lg bg-dark-50 p-3 text-sm text-dark-500 dark:bg-dark-900 dark:text-dark-300">
          <strong>Suggested next framework:</strong> {feedback.next_framework_suggestion}
        </div>
      )}
      <button onClick={onNext}
        className="w-full rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700"
      >{isLastStage ? "See Results" : "Continue →"}</button>
    </div>
  )
}
