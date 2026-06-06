"use client"

import { useState, useEffect } from "react"
import { getFrameworks } from "@/lib/api"
import { StaticModeBanner } from "@/components/StaticModeBanner"
import { BackendGuard } from "@/components/RequiresBackend"
import { staticFrameworks } from "@/lib/staticData"
import type { FrameworkListItem } from "@/lib/types"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:50128/api"
const isStaticHosting = typeof window !== "undefined" && !window.location.hostname.includes("localhost") && !window.location.hostname.includes("127.0.0.1")

interface QuizQuestion {
  id: string
  question: string
  type: string
  options: string[]
  correct_answer: string
  explanation: string
  framework_concept: string
}

interface EvalResult {
  is_correct: boolean
  score: number
  explanation: string
  correct_answer: string
}

export default function QuizPage() {
  const [frameworks, setFrameworks] = useState<FrameworkListItem[]>([])
  const [selectedFramework, setSelectedFramework] = useState<string>("")
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentQ, setCurrentQ] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string>("")
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null)
  const [score, setScore] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isStaticHosting) {
      setFrameworks(staticFrameworks as unknown as FrameworkListItem[])
      return
    }
    getFrameworks().then(setFrameworks).catch(console.error)
  }, [])

  const handleGenerate = async () => {
    if (!selectedFramework) return
    setIsLoading(true)
    try {
      const res = await fetch(`${API}/quiz/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          framework_id: selectedFramework,
          num_questions: 5,
          difficulty: "medium",
        }),
      })
      const data = await res.json()
      setQuestions(data)
      setCurrentQ(0)
      setScore(0)
      setEvalResult(null)
      setSelectedAnswer("")
    } catch (err) {
      console.error(err)
    }
    setIsLoading(false)
  }

  const handleAnswer = async () => {
    if (!selectedAnswer) return
    const q = questions[currentQ]
    const isCorrect = selectedAnswer.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()
    
    setEvalResult({
      is_correct: isCorrect,
      score: isCorrect ? 1 : 0,
      explanation: q.explanation,
      correct_answer: q.correct_answer,
    })
    if (isCorrect) setScore((s) => s + 1)
  }

  const handleNext = () => {
    if (currentQ + 1 < questions.length) {
      setCurrentQ((q) => q + 1)
      setSelectedAnswer("")
      setEvalResult(null)
    }
  }

  const handleRestart = () => {
    setQuestions([])
    setCurrentQ(0)
    setScore(0)
    setEvalResult(null)
    setSelectedAnswer("")
    setSelectedFramework("")
  }

  const isLastQ = currentQ === questions.length - 1
  const isComplete = isLastQ && evalResult !== null

  if (!questions.length) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="mb-2 text-3xl sm:text-4xl font-bold text-dark-900 dark:text-dark-100">Quiz</h1>
        <p className="mb-4 text-dark-500 dark:text-dark-300">Test your knowledge of CEO frameworks with AI-generated questions.</p>

        <StaticModeBanner
          feature="AI-Generated Quizzes"
          description="Real-time LLM-generated questions with answer evaluation"
        />

        <div className="rounded-xl border border-dark-200 p-6 dark:border-dark-700">
          <label className="mb-2 block text-sm font-medium text-dark-700 dark:text-dark-300">Select a framework</label>
          <select
            value={selectedFramework}
            onChange={(e) => setSelectedFramework(e.target.value)}
            className="mb-4 w-full rounded-lg border border-dark-200 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none dark:border-dark-700"
          >
            <option value="">Choose a framework...</option>
            {frameworks.map((fw) => (
              <option key={fw.id} value={fw.id}>{fw.title}</option>
            ))}
          </select>
          <BackendGuard feature="AI Quiz Generator">
            <button
            onClick={handleGenerate}
            disabled={!selectedFramework || isLoading}
            className="w-full rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {isLoading ? "Generating..." : "Generate Quiz"}
          </button>
          </BackendGuard>
        </div>
      </div>
    )
  }

  if (isComplete) {
    const pct = Math.round((score / questions.length) * 100)
    const emoji = pct >= 80 ? "🏆" : pct >= 50 ? "✅" : "📚"
    const msg = pct >= 80 ? "Excellent!" : pct >= 50 ? "Good effort!" : "Keep learning!"

    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-xl border border-dark-200 p-8 text-center dark:border-dark-700">
          <div className="mb-4 text-5xl">{emoji}</div>
          <h2 className="mb-2 text-2xl font-bold text-dark-900 dark:text-dark-100">{msg}</h2>
          <div className="mb-6 rounded-lg bg-primary-50 p-4">
            <p className="text-3xl font-bold text-primary-600">{score}/{questions.length}</p>
            <p className="text-sm text-primary-700">{pct}% correct</p>
          </div>

          {/* Review all answers */}
          <div className="mb-6 space-y-3 text-left">
            {questions.map((q, i) => {
              const isCorrect = score > i // simple heuristic
              return (
                <div key={q.id} className={`rounded-lg border p-3 text-sm ${isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                  <p className="font-medium text-dark-800 dark:text-dark-200">{i + 1}. {q.question}</p>
                  <p className="mt-1 text-dark-600 dark:text-dark-300">Your answer: <span className={isCorrect ? "text-green-700" : "text-red-700"}>{isCorrect ? "Correct" : "Incorrect"}</span></p>
                  {!isCorrect && <p className="mt-1 text-dark-500 dark:text-dark-300">Correct: {q.correct_answer}</p>}
                  <p className="mt-1 text-dark-500 text-xs dark:text-dark-300">{q.explanation}</p>
                </div>
              )
            })}
          </div>

          <button
            onClick={handleRestart}
            className="rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700"
          >
            Try Another Quiz
          </button>
        </div>
      </div>
    )
  }

  const q = questions[currentQ]

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      {/* Progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-dark-500 dark:text-dark-300">Question {currentQ + 1} of {questions.length}</span>
          <span className="text-dark-500 dark:text-dark-300">Score: {score}/{currentQ + (evalResult ? 1 : 0)}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-dark-100 dark:bg-dark-800">
          <div
            className="h-full rounded-full bg-primary-500 transition-all"
            style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="mb-6 rounded-xl border border-dark-200 p-6 dark:border-dark-700">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
            {q.framework_concept}
          </span>
          {q.type && (
            <span className="rounded-full bg-dark-100 px-2 py-0.5 text-xs text-dark-500 dark:bg-dark-800 dark:text-dark-300">
              {q.type}
            </span>
          )}
        </div>
        <h3 className="mb-4 text-lg font-semibold text-dark-900 dark:text-dark-100">{q.question}</h3>

        {!evalResult ? (
          <div>
            <div className="mb-4 space-y-2">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSelectedAnswer(opt)}
                  className={`w-full rounded-lg border p-3 text-left text-sm transition ${ selectedAnswer === opt ? "border-primary-400 bg-primary-50" : "border-dark-200 hover:border-dark-300 dark:border-dark-700" }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <button
              onClick={handleAnswer}
              disabled={!selectedAnswer}
              className="w-full rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              Submit
            </button>
          </div>
        ) : (
          <div className="animate-slide-up space-y-4">
            <div className={`rounded-lg border p-4 ${evalResult.is_correct ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
              <p className={`text-sm font-semibold ${evalResult.is_correct ? "text-green-700" : "text-red-700"}`}>
                {evalResult.is_correct ? "Correct!" : "Incorrect"}
              </p>
              {!evalResult.is_correct && (
                <p className="mt-1 text-sm text-dark-600 dark:text-dark-300">
                  Correct answer: <strong className="text-dark-800 dark:text-dark-200">{evalResult.correct_answer}</strong>
                </p>
              )}
            </div>
            <div className="rounded-lg border border-primary-100 bg-primary-50/50 p-4">
              <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide mb-1">Explanation</p>
              <p className="text-sm text-dark-600 leading-relaxed dark:text-dark-300">{evalResult.explanation || q.explanation}</p>
            </div>
            <button
              onClick={isLastQ ? undefined : handleNext}
              className="w-full rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700"
            >
              {isLastQ ? "See Results" : "Next Question"}
            </button>
            {isLastQ && (
              <button
                onClick={handleNext}
                className="w-full rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700 mt-2"
              >
                See Results
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}