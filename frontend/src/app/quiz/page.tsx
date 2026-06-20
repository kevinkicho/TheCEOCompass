"use client"

import { useState, useEffect, useRef } from "react"
import { getFrameworks } from "@/lib/api"
import { generateQuiz } from "@/lib/ollama"
import { StaticModeBanner } from "@/components/StaticModeBanner"
import type { FrameworkListItem } from "@/lib/types"


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
  const [freeResponseText, setFreeResponseText] = useState("")
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null)
  const [correctAnswers, setCorrectAnswers] = useState<boolean[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [quizError, setQuizError] = useState("")
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    getFrameworks().then(setFrameworks).catch((err) => setQuizError("Failed to load frameworks"))
  }, [])

  useEffect(() => {
    if (isLoading) {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isLoading])

  const handleGenerate = async () => {
    if (!selectedFramework) return
    setQuizError("")
    setIsLoading(true)
    setElapsed(0)
    try {
      const fw = frameworks.find((f) => f.id === selectedFramework)
      if (!fw) throw new Error("Selected framework not found")
      const data = await generateQuiz(fw.slug, 5, "medium")
      setQuestions(data)
      setCurrentQ(0)
      setCorrectAnswers([])
      setEvalResult(null)
      setSelectedAnswer("")
      setFreeResponseText("")
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : "Failed to generate quiz")
    }
    setIsLoading(false)
  }

  const isFreeResponse = (q: QuizQuestion) =>
    q.type === "free_response" || q.type === "calculation" || !q.options || q.options.length === 0

  const handleAnswer = () => {
    const q = questions[currentQ]
    if (isFreeResponse(q)) {
      const userAns = freeResponseText.trim().toLowerCase()
      const correct = q.correct_answer.trim().toLowerCase()
      const isCorrect = userAns === correct || userAns.includes(correct) || correct.includes(userAns)
      setEvalResult({
        is_correct: isCorrect,
        score: isCorrect ? 1 : 0,
        explanation: q.explanation,
        correct_answer: q.correct_answer,
      })
      setCorrectAnswers((prev) => [...prev, isCorrect])
      return
    }
    if (!selectedAnswer) return
    const isCorrect = selectedAnswer.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()
    setEvalResult({
      is_correct: isCorrect,
      score: isCorrect ? 1 : 0,
      explanation: q.explanation,
      correct_answer: q.correct_answer,
    })
    setCorrectAnswers((prev) => [...prev, isCorrect])
  }

  const goToQuestion = (idx: number) => {
    if (idx < 0 || idx >= questions.length) return
    setCurrentQ(idx)
    setSelectedAnswer("")
    setFreeResponseText("")
    setEvalResult(null)
  }

  const handleNext = () => goToQuestion(currentQ + 1)
  const handlePrev = () => goToQuestion(currentQ - 1)

  const handleRestart = () => {
    setQuestions([])
    setCurrentQ(0)
    setCorrectAnswers([])
    setEvalResult(null)
    setSelectedAnswer("")
    setFreeResponseText("")
    setSelectedFramework("")
  }

  const isLastQ = currentQ === questions.length - 1
  const isFirstQ = currentQ === 0
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

        {quizError && <p className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3">{quizError}</p>}

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
          <button
            onClick={handleGenerate}
            disabled={!selectedFramework || isLoading}
            className="w-full rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {isLoading ? `Generating... ${elapsed}s` : "Generate Quiz"}
          </button>
        </div>
      </div>
    )
  }

  if (isComplete) {
    const score = correctAnswers.filter(Boolean).length
    const pct = Math.round((score / questions.length) * 100)

    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-xl border border-dark-200 p-8 text-center dark:border-dark-700">
          <div className="mb-4 text-5xl">{pct >= 80 ? "🏆" : pct >= 50 ? "✅" : "📚"}</div>
          <h2 className="mb-2 text-2xl font-bold text-dark-900 dark:text-dark-100">{pct >= 80 ? "Excellent!" : pct >= 50 ? "Good effort!" : "Keep learning!"}</h2>
          <div className="mb-6 rounded-lg bg-primary-50 p-4 dark:bg-primary-900/20">
            <p className="text-3xl font-bold text-primary-600">{score}/{questions.length}</p>
            <p className="text-sm text-primary-700 dark:text-primary-300">{pct}% correct</p>
          </div>

          <div className="mb-6 space-y-3 text-left">
            {questions.map((q, i) => {
              const isCorrect = correctAnswers[i]
              return (
                <div key={q.id} className={`rounded-lg border p-3 text-sm ${isCorrect ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20" : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"}`}>
                  <p className="font-medium text-dark-800 dark:text-dark-200">{i + 1}. {q.question}</p>
                  <p className="mt-1 text-dark-600 dark:text-dark-300">Your answer: <span className={isCorrect ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}>{isCorrect ? "Correct" : "Incorrect"}</span></p>
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
  const isFR = isFreeResponse(q)

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      {/* Progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-dark-500 dark:text-dark-300">Question {currentQ + 1} of {questions.length}</span>
          <span className="text-dark-500 dark:text-dark-300">Score: {correctAnswers.filter(Boolean).length}/{currentQ + (evalResult ? 1 : 0)}</span>
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
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            {q.framework_concept}
          </span>
          <span className="rounded-full bg-dark-100 px-2 py-0.5 text-xs text-dark-500 dark:bg-dark-800 dark:text-dark-300">
            {q.type}
          </span>
        </div>
        <h3 className="mb-4 text-lg font-semibold text-dark-900 dark:text-dark-100">{q.question}</h3>

        {!evalResult ? (
          <div>
            {isFR ? (
              <div className="mb-4">
                <textarea
                  value={freeResponseText}
                  onChange={(e) => setFreeResponseText(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-900 px-4 py-3 text-sm text-dark-900 dark:text-dark-100 placeholder:text-dark-400 focus:border-primary-400 focus:outline-none"
                  placeholder="Type your answer here..."
                />
              </div>
            ) : (
              <div className="mb-4 space-y-2">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSelectedAnswer(opt)}
                    className={`w-full rounded-lg border p-3 text-left text-sm transition ${
                      selectedAnswer === opt
                        ? "border-primary-400 bg-primary-50 dark:bg-primary-900/20"
                        : "border-dark-200 hover:border-dark-300 dark:border-dark-700"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={handleAnswer}
              disabled={isFR ? !freeResponseText.trim() : !selectedAnswer}
              className="w-full rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              Submit
            </button>
          </div>
        ) : (
          <div className="animate-slide-up space-y-4">
            <div className={`rounded-lg border p-4 ${evalResult.is_correct ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20" : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"}`}>
              <p className={`text-sm font-semibold ${evalResult.is_correct ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
                {evalResult.is_correct ? "Correct!" : "Incorrect"}
              </p>
              {!evalResult.is_correct && (
                <p className="mt-1 text-sm text-dark-600 dark:text-dark-300">
                  Correct answer: <strong className="text-dark-800 dark:text-dark-200">{evalResult.correct_answer}</strong>
                </p>
              )}
            </div>
            <div className="rounded-lg border border-primary-100 bg-primary-50/50 p-4 dark:bg-primary-900/20 dark:border-primary-900/30">
              <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide mb-1 dark:text-primary-300">Explanation</p>
              <p className="text-sm text-dark-600 leading-relaxed dark:text-dark-300">{evalResult.explanation || q.explanation}</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={handlePrev}
          disabled={isFirstQ}
          className="flex items-center gap-1 rounded-lg border border-dark-200 dark:border-dark-700 px-4 py-2 text-sm font-medium text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-800 disabled:opacity-30"
        >
          <span className="text-lg leading-none">&larr;</span> Previous
        </button>

        {evalResult && !isLastQ && (
          <button
            onClick={handleNext}
            className="flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Next <span className="text-lg leading-none">&rarr;</span>
          </button>
        )}

        {evalResult && isLastQ && (
          <button
            onClick={handleNext}
            className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            See Results
          </button>
        )}

        {!evalResult && currentQ < questions.length - 1 && (
          <span className="text-xs text-dark-400 dark:text-dark-500">Submit your answer to continue</span>
        )}
      </div>
    </div>
  )
}
