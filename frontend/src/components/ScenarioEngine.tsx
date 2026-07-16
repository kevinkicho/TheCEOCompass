"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { evaluateScenarioStage } from "@/lib/ollama"
import {
  saveScenarioAttempt,
  loadScenarioHistory,
  shouldOfferConceptReview,
  ratingForWeakStages,
  resolveConceptsForReview,
  seedConceptsToReview,
} from "@/lib/firebase-crud"
import { canUseFirebasePersistence } from "@/lib/capabilities"
import { getCachedFrameworks, loadFrameworks } from "@/lib/rtdb-cache"
import { ScenarioDecisionPrompt } from "@/components/ScenarioDecisionPrompt"
import { ScenarioFeedbackPanel } from "@/components/ScenarioFeedbackPanel"
import { ScenarioPastAttempts } from "@/components/ScenarioPastAttempts"
import type { Scenario, FeedbackResponse } from "@/lib/types"

interface Props {
  scenario: Scenario
}

type StageHistoryEntry = { stageId: string; choice: string; score: number }

/** Map final-stage quality to outcome_branches keys (optimal | acceptable | failure).
 *  - MC option scores in catalog are 0–1 (also accept legacy 0–10).
 *  - AI free-response scores are 0–10.
 */
export function resolveOutcomeBranch(
  optionScore: number | undefined,
  aiScore0to10: number,
): "optimal" | "acceptable" | "failure" {
  if (optionScore !== undefined && !Number.isNaN(optionScore)) {
    const normalized = optionScore > 1 ? optionScore / 10 : optionScore
    if (normalized >= 0.8) return "optimal"
    if (normalized >= 0.5) return "acceptable"
    return "failure"
  }
  if (aiScore0to10 >= 8) return "optimal"
  if (aiScore0to10 >= 5) return "acceptable"
  return "failure"
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
  const [stageHistory, setStageHistory] = useState<StageHistoryEntry[]>([])
  const [completedStages, setCompletedStages] = useState<StageHistoryEntry[]>([])
  const [pastAttempts, setPastAttempts] = useState<{ attemptId: string; stages: StageHistoryEntry[]; completed_at: string }[]>([])
  const [showReviewOffer, setShowReviewOffer] = useState(false)
  const [reviewStatus, setReviewStatus] = useState<"idle" | "saving" | "done" | "failed">("idle")
  const [reviewSeededCount, setReviewSeededCount] = useState(0)

  useEffect(() => {
    if (canUseFirebasePersistence()) {
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
        setStageHistory(allStages)
        setCompletedStages(allStages)
        setIsComplete(true)
        const option = choiceId
          ? currentStage.options.find((o) => o.id === choiceId)
          : undefined
        // Catalog option scores are 0–1; AI free-response scores are 0–10.
        // outcome_branches keys: optimal | acceptable | failure
        setFinalOutcomeBranch(resolveOutcomeBranch(option?.score, thisScore))
        if (
          canUseFirebasePersistence() &&
          shouldOfferConceptReview(allStages, scenario.concept_ids)
        ) {
          setShowReviewOffer(true)
          setReviewStatus("idle")
          setReviewSeededCount(0)
        } else {
          setShowReviewOffer(false)
        }
        if (canUseFirebasePersistence()) {
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

  const handleAddConceptsToReview = async () => {
    if (reviewStatus === "saving" || reviewStatus === "done") return
    const conceptIds = scenario.concept_ids
    if (!conceptIds?.length) return

    setReviewStatus("saving")
    try {
      let frameworks = getCachedFrameworks()
      if (!frameworks) {
        try {
          frameworks = await loadFrameworks()
        } catch {
          frameworks = null
        }
      }
      const targets = resolveConceptsForReview(
        conceptIds,
        scenario.framework_slugs,
        frameworks,
      )
      const rating = ratingForWeakStages(completedStages) ?? 3
      const { seeded } = await seedConceptsToReview(targets, rating)
      if (seeded > 0) {
        setReviewSeededCount(seeded)
        setReviewStatus("done")
      } else {
        setReviewStatus("failed")
      }
    } catch {
      // Non-blocking: auth/persistence failures must not break completion UI
      setReviewStatus("failed")
    }
  }

  const resetAttempt = () => {
    setCurrentStageIdx(0)
    setFeedback(null)
    setIsComplete(false)
    setFinalOutcomeBranch(null)
    setStageHistory([])
    setCompletedStages([])
    setShowReviewOffer(false)
    setReviewStatus("idle")
    setReviewSeededCount(0)
    setError("")
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
      <ScenarioPastAttempts pastAttempts={pastAttempts} />
      </div>
    )
  }

  if (isComplete) {
    const outcomeBranch = scenario.outcome_branches[finalOutcomeBranch || "acceptable"]
    const relatedLabels = (scenario.concept_ids ?? []).map((id) =>
      id.split("-").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
    )
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

        {showReviewOffer && (
          <div
            className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-900/20"
            data-testid="scenario-review-offer"
          >
            <p className="mb-1 text-sm font-semibold text-amber-900 dark:text-amber-200">
              Reinforce weak stages
            </p>
            <p className="mb-3 text-xs text-amber-800 dark:text-amber-300">
              Some stages scored low. Add related concepts to your spaced-repetition queue to practice them soon.
            </p>
            {relatedLabels.length > 0 && (
              <ul className="mb-3 flex flex-wrap gap-1.5">
                {relatedLabels.map((label) => (
                  <li
                    key={label}
                    className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            )}
            {reviewStatus === "done" ? (
              <p className="text-xs font-medium text-green-700 dark:text-green-400" data-testid="scenario-review-done">
                Added {reviewSeededCount} concept{reviewSeededCount === 1 ? "" : "s"} to review.
              </p>
            ) : reviewStatus === "failed" ? (
              <p className="text-xs text-dark-500 dark:text-dark-400" data-testid="scenario-review-failed">
                Could not add reviews right now. You can still continue.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleAddConceptsToReview}
                  disabled={reviewStatus === "saving"}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                  data-testid="add-concepts-to-review"
                >
                  {reviewStatus === "saving" ? "Adding…" : "Add related concepts to review"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReviewOffer(false)}
                  disabled={reviewStatus === "saving"}
                  className="rounded-lg border border-amber-300 px-4 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/40"
                >
                  Skip
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={resetAttempt}
            className="flex-1 rounded-lg border border-dark-300 px-6 py-3 font-medium text-dark-700 hover:bg-dark-50 dark:hover:bg-dark-800 dark:text-dark-300 dark:border-dark-600"
          >Try Again</button>
          <button onClick={() => router.push("/journal")}
            className="flex-1 rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700"
          >Save to Journal &rarr;</button>
        </div>
      </div>
      <ScenarioPastAttempts pastAttempts={pastAttempts} />
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
          <ScenarioDecisionPrompt stage={currentStage} onSubmit={handleSubmitChoice} isLoading={isLoading} />
        ) : (
          <ScenarioFeedbackPanel feedback={feedback} onNext={handleNextStage} isLastStage={currentStageIdx >= scenario.stages.length - 1} />
        )}
      </div>
    </div>
    <ScenarioPastAttempts pastAttempts={pastAttempts} />
    </div>
  )
}
