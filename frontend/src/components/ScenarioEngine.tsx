"use client"

import { useState } from "react"
import { startScenario, evaluateChoice } from "@/lib/api"
import { BackendGuard } from "@/components/RequiresBackend"
import type { Scenario, ScenarioStage, StageResult, FeedbackResponse, ScenarioAttempt } from "@/lib/types"

interface Props {
  scenario: Scenario
}

export function ScenarioEngine({ scenario }: Props) {
  const [attempt, setAttempt] = useState<ScenarioAttempt | null>(null)
  const [currentStage, setCurrentStage] = useState<ScenarioStage>(scenario.stages[0])
  const [feedback, setFeedback] = useState<FeedbackResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [finalOutcome, setFinalOutcome] = useState<StageResult | null>(null)

  const handleStart = async () => {
    setIsLoading(true)
    try {
      const att = await startScenario(scenario.id)
      setAttempt(att)
      setCurrentStage(scenario.stages[0])
    } catch (err) {
      console.error(err)
    }
    setIsLoading(false)
  }

  const handleSubmitChoice = async (choiceId?: string, freeResponse?: string) => {
    setIsLoading(true)
    try {
      const result = await evaluateChoice(
        scenario.id,
        currentStage.id,
        choiceId,
        freeResponse,
      )
      setFeedback(result.feedback || null)

      if (result.is_complete) {
        setIsComplete(true)
        setFinalOutcome(result)
      } else if (result.next_stage_id) {
        const nextStage = scenario.stages.find((s) => s.id === result.next_stage_id)
        if (nextStage) {
          setCurrentStage(nextStage)
        }
      }
    } catch (err) {
      console.error(err)
    }
    setIsLoading(false)
  }

  const handleNextStage = () => {
    setFeedback(null)
  }

  if (!attempt) {
    return (
      <div className="rounded-xl border border-dark-200 p-8">
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-dark-800">Context</h2>
          <div className="space-y-3 text-sm text-dark-600">
            <p><strong>Company:</strong> {scenario.context.company}</p>
            <p><strong>Situation:</strong> {scenario.context.situation}</p>
            <p><strong>Pressure:</strong> {scenario.context.time_pressure}</p>
          </div>
        </div>
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-dark-700">Available Data</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-dark-600">
            {scenario.context.data_provided.map((data, i) => (
              <li key={i}>{data}</li>
            ))}
          </ul>
        </div>
        <BackendGuard feature="AI Scenario Engine">
          <button
          onClick={handleStart}
          disabled={isLoading}
          className="w-full rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {isLoading ? "Starting..." : "Start Scenario"}
        </button>
        </BackendGuard>
      </div>
    )
  }

  if (isComplete && finalOutcome) {
    const outcomeBranch = scenario.outcome_branches[finalOutcome.outcome_branch || "acceptable"]
    return (
      <div className="animate-fade-in rounded-xl border border-dark-200 p-8">
        <div className="mb-6 text-center">
          <div className="mb-4 text-5xl">
            {finalOutcome.outcome_branch === "optimal" ? "🏆" : finalOutcome.outcome_branch === "acceptable" ? "✅" : "⚠️"}
          </div>
          <h2 className="mb-2 text-2xl font-bold text-dark-900">{outcomeBranch?.title || "Complete"}</h2>
          <p className="text-dark-500">{outcomeBranch?.description}</p>
        </div>

        {finalOutcome.final_score !== undefined && (
          <div className="mb-6 rounded-lg bg-dark-50 p-4 text-center">
            <p className="text-sm text-dark-500">Final Score</p>
            <p className="text-3xl font-bold text-primary-600">
              {Math.round(finalOutcome.final_score * 100)}%
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => {
              setAttempt(null)
              setCurrentStage(scenario.stages[0])
              setFeedback(null)
              setIsComplete(false)
              setFinalOutcome(null)
            }}
            className="flex-1 rounded-lg border border-dark-300 px-6 py-3 font-medium text-dark-700 hover:bg-dark-50"
          >
            Try Again
          </button>
          <button
            onClick={() => {/* navigate to journal */}}
            className="flex-1 rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700"
          >
            Save to Journal &rarr;
          </button>
        </div>
      </div>
    )
  }

  const stage = currentStage
  const stageNumber = scenario.stages.findIndex((s) => s.id === stage.id) + 1

  return (
    <div className="animate-fade-in rounded-xl border border-dark-200 p-8">
      {/* Progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-dark-500">Stage {stageNumber} of {scenario.stages.length}</span>
          <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
            {stage.type}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-dark-100">
          <div
            className="h-full rounded-full bg-primary-500 transition-all"
            style={{ width: `${(stageNumber / scenario.stages.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Prompt */}
      <div className="mb-6">
        <h3 className="mb-4 text-lg font-semibold text-dark-800">{stage.prompt}</h3>

        {!feedback ? (
          <DecisionPrompt
            stage={stage}
            onSubmit={handleSubmitChoice}
            isLoading={isLoading}
          />
        ) : (
          <FeedbackPanel
            feedback={feedback}
            onNext={handleNextStage}
          />
        )}
      </div>
    </div>
  )
}

function DecisionPrompt({
  stage,
  onSubmit,
  isLoading,
}: {
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
        <textarea
          value={freeResponse}
          onChange={(e) => setFreeResponse(e.target.value)}
          rows={6}
          className="mb-4 w-full resize-none rounded-lg border border-dark-200 p-4 text-sm text-dark-800 placeholder:text-dark-400 focus:border-primary-400 focus:outline-none"
          placeholder="Type your analysis, calculation, or response..."
        />
        
        {stage.sample_answer && (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowAnswer(!showAnswer)}
              className="text-xs text-primary-600 hover:text-primary-700 underline underline-offset-2"
            >
              {showAnswer ? "Hide Model Answer" : "Show Model Answer"}
            </button>
            {showAnswer && (
              <div className="mt-2 animate-slide-up rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-medium text-amber-800 mb-1">Model Answer</p>
                <p className="text-sm text-dark-700 whitespace-pre-wrap">{stage.sample_answer}</p>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => onSubmit(undefined, freeResponse)}
          disabled={isLoading || !freeResponse.trim()}
          className="w-full rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {isLoading ? "Evaluating..." : "Submit for Feedback"}
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 space-y-3">
        {stage.options.map((option) => (
          <button
            key={option.id}
            onClick={() => setSelectedChoice(option.id)}
            className={`w-full rounded-lg border p-4 text-left transition ${
              selectedChoice === option.id
                ? "border-primary-400 bg-primary-50 shadow-sm"
                : "border-dark-200 hover:border-dark-300"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                selectedChoice === option.id
                  ? "border-primary-500 bg-primary-500 text-white"
                  : "border-dark-300 text-dark-400"
              }`}>
                {option.id.toUpperCase()}
              </span>
              <span className="text-sm text-dark-700">{option.label}</span>
            </div>
          </button>
        ))}
      </div>
      
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowAnswer(!showAnswer)}
          className="text-xs text-primary-600 hover:text-primary-700 underline underline-offset-2"
        >
          {showAnswer ? "Hide Hint" : "Show Hint"}
        </button>
        {showAnswer && stage.options.find(o => o.rationale) && (
          <div className="mt-2 animate-slide-up rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-medium text-amber-800 mb-2">Best Approach</p>
            {stage.options.map(o => (
              <div key={o.id} className="mb-2 last:mb-0">
                <span className="text-sm font-medium text-dark-800">{o.label}</span>
                <p className="text-xs text-dark-600">{o.rationale}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <button
        onClick={() => selectedChoice && onSubmit(selectedChoice)}
        disabled={isLoading || !selectedChoice}
        className="w-full rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {isLoading ? "Evaluating..." : "Submit"}
      </button>
    </div>
  )
}

function FeedbackPanel({
  feedback,
  onNext,
}: {
  feedback: FeedbackResponse
  onNext: () => void
}) {
  return (
    <div className="animate-slide-up space-y-4">
      {/* Score */}
      <div className="rounded-lg bg-primary-50 p-4 text-center">
        <p className="text-sm text-primary-700">Score</p>
        <p className="text-2xl font-bold text-primary-600">{Math.round(feedback.score * 100)}%</p>
      </div>

      {/* Feedback */}
      <div className="rounded-lg border border-dark-200 p-4">
        <p className="text-sm font-semibold text-dark-700 mb-1">AI Coach Feedback</p>
        <p className="text-sm text-dark-600">{feedback.feedback}</p>
      </div>

      {/* Insights */}
      {feedback.key_insights.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-dark-700">Key Insights</p>
          <ul className="space-y-1">
            {feedback.key_insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-dark-600">
                <span className="mt-0.5 text-primary-500">&bull;</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Framework */}
      {feedback.next_framework_suggestion && (
        <div className="rounded-lg bg-dark-50 p-3 text-sm text-dark-500">
          <strong>Suggested next framework:</strong> {feedback.next_framework_suggestion}
        </div>
      )}

      <button
        onClick={onNext}
        className="w-full rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700"
      >
        Continue &rarr;
      </button>
    </div>
  )
}