"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { evaluateScenarioStage } from "@/lib/ollama"
import { saveScenarioAttempt, loadScenarioHistory } from "@/lib/firebase-crud"
import { isStaticHosting } from "@/components/RequiresBackend"
import type { Scenario, ScenarioStage, StageResult, FeedbackResponse } from "@/lib/types"

interface Props {
  scenario: Scenario
}

export function ScenarioEngine({ scenario }: Props) {
  const router = useRouter()
  const [attempt, setAttempt] = useState(true)
  const [currentStageIdx, setCurrentStageIdx] = useState(0)
  const [feedback, setFeedback] = useState<FeedbackResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [finalOutcomeBranch, setFinalOutcomeBranch] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [stageHistory, setStageHistory] = useState<{ stageId: string; choice: string; score: number }[]>([])
  const [pastAttempts, setPastAttempts] = useState<any[]>([])

  useEffect(() => {
    if (!isStaticHosting) {
      loadScenarioHistory(scenario.slug).then(setPastAttempts)
    }
  }, [scenario.slug])

  const currentStage = scenario.stages[currentStageIdx]

  const handleSubmitChoice = async (choiceId?: string, freeResponse?: string) => {
    setError("")
    setIsLoading(true)
    try {
      const { parsed } = await evaluateScenarioStage(
        currentStage,
        scenario.title,
        choiceId,
        freeResponse,
      )

      const fb: FeedbackResponse = {
        feedback: parsed.feedback,
        score: parsed.score / 10,
        key_insights: parsed.key_insights || [],
        next_framework_suggestion: parsed.next_framework_suggestion || undefined,
      }
      setFeedback(fb)

      const thisChoice = choiceId || freeResponse || ""
      const thisScore = parsed.score

      if (currentStageIdx >= scenario.stages.length - 1) {
        const allStages = [...stageHistory, { stageId: currentStage.id, choice: thisChoice, score: thisScore }]
        setIsComplete(true)
        const option = scenario.stages[currentStageIdx].options.find((o) => o.id === choiceId)
        let branch = "poor"
        if (option && option.score >= 8) branch = "optimal"
        else if (option && option.score >= 5) branch = "acceptable"
        setFinalOutcomeBranch(branch)
        if (!isStaticHosting) {
          saveScenarioAttempt(scenario.slug, allStages)
          loadScenarioHistory(scenario.slug).then(setPastAttempts)
        }
      } else {
        setStageHistory((prev) => [...prev, { stageId: currentStage.id, choice: thisChoice, score: thisScore }])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to evaluate choice")
    }
    setIsLoading(false)
  }

  const handleNextStage = () => {
    if (currentStageIdx < scenario.stages.length - 1) {
      setCurrentStageIdx((i) => i + 1)
      setFeedback(null)
    }
  }

  if (!attempt) {
    return (
      <div>
      <div className="rounded-xl border border-dark-200 p-8 dark:border-dark-700">
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-dark-800 dark:text-dark-200">Context</h2>
          <div className="space-y-3 text-sm text-dark-600 dark:text-dark-300">
            <p><strong>Company:</strong> {scenario.context.company}</p>
            <p><strong>Situation:</strong> {scenario.context.situation}</p>
            <p><strong>Pressure:</strong> {scenario.context.time_pressure}</p>
          </div>
        </div>
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-dark-700 dark:text-dark-300">Available Data</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-dark-600 dark:text-dark-300">
            {scenario.context.data_provided.map((data, i) => (<li key={i}>{data}</li>))}
          </ul>
        </div>
        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
        <button onClick={() => setAttempt(true)} disabled={isLoading}
          className="w-full rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >{isLoading ? "Starting..." : "Start Scenario"}</button>
      </div>
      <PastAttempts pastAttempts={pastAttempts} />
      </div>
    )
  }

  if (isComplete) {
    const outcomeBranch = scenario.outcome_branches[finalOutcomeBranch || "acceptable"]
    return (
      <div>
      <div className="animate-fade-in rounded-xl border border-dark-200 p-8 dark:border-dark-700">
        <div className="mb-6 text-center">
          <div className="mb-4 text-5xl">
            {finalOutcomeBranch === "optimal" ? "🏆" : finalOutcomeBranch === "acceptable" ? "✅" : "⚠️"}
          </div>
          <h2 className="mb-2 text-2xl font-bold text-dark-900 dark:text-dark-100">{outcomeBranch?.title || "Complete"}</h2>
          <p className="text-dark-500 dark:text-dark-300">{outcomeBranch?.description}</p>
        </div>

        <div className="flex gap-3">
          <button onClick={() => { setCurrentStageIdx(0); setFeedback(null); setIsComplete(false); setFinalOutcomeBranch(null) }}
            className="flex-1 rounded-lg border border-dark-300 px-6 py-3 font-medium text-dark-700 hover:bg-dark-50 dark:hover:bg-dark-800 dark:text-dark-300 dark:border-dark-600"
          >Try Again</button>
          <button onClick={() => router.push("/journal")}
            className="flex-1 rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700"
          >Save to Journal &rarr;</button>
        </div>
      </div>
      <PastAttempts pastAttempts={pastAttempts} />
      </div>
    )
  }

  const stageNumber = currentStageIdx + 1

  return (
    <div>
    <div className="animate-fade-in rounded-xl border border-dark-200 p-8 dark:border-dark-700">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-dark-500 dark:text-dark-300">Stage {stageNumber} of {scenario.stages.length}</span>
          <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            {currentStage.type}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-dark-100 dark:bg-dark-800">
          <div className="h-full rounded-full bg-primary-500 transition-all"
            style={{ width: `${(stageNumber / scenario.stages.length) * 100}%` }} />
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}

      <div className="mb-6">
        <h3 className="mb-4 text-lg font-semibold text-dark-800 dark:text-dark-200">{currentStage.prompt}</h3>
        {!feedback ? (
          <DecisionPrompt stage={currentStage} onSubmit={handleSubmitChoice} isLoading={isLoading} />
        ) : (
          <FeedbackPanel feedback={feedback} onNext={handleNextStage} isLastStage={currentStageIdx >= scenario.stages.length - 1} />
        )}
      </div>
    </div>
    <PastAttempts pastAttempts={pastAttempts} />
    </div>
  )
}

function DecisionPrompt({ stage, onSubmit, isLoading }: {
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

function FeedbackPanel({ feedback, onNext, isLastStage }: {
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
                <span className="mt-0.5 text-primary-500">&bull;</span>{insight}
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
      >{isLastStage ? "See Results" : "Continue &rarr;"}</button>
    </div>
  )
}

function PastAttempts({ pastAttempts }: { pastAttempts: any[] }) {
  if (pastAttempts.length === 0) return null
  return (
    <div className="mt-8">
      <h3 className="mb-3 text-sm font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wide">Past Attempts ({pastAttempts.length})</h3>
      <div className="space-y-2">
        {pastAttempts.map((a) => (
          <div key={a.attemptId} className="rounded-lg border border-dark-200 dark:border-dark-700 p-3">
            <p className="text-xs text-dark-500 dark:text-dark-400">
              {new Date(a.completed_at).toLocaleDateString()} &middot; {a.stages.length} stages
            </p>
            <p className="text-xs text-dark-400 dark:text-dark-500 mt-1">
              {a.stages.map((s: any) => `${s.stageId}: ${Math.round(s.score * 10)}%`).join(" → ")}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
