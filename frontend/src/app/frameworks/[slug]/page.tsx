"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { getFrameworkBySlug, getScenarios } from "@/lib/api"
import { explainConcept } from "@/lib/ollama"
import type { Framework, FrameworkConcept, ScenarioListItem } from "@/lib/types"

export default function FrameworkDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const [framework, setFramework] = useState<Framework | null>(null)
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([])
  const [modalConcept, setModalConcept] = useState<FrameworkConcept | null>(null)
  const [aiExplanation, setAiExplanation] = useState<Record<string, string> | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiElapsed, setAiElapsed] = useState(0)
  const aiTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (aiLoading) {
      setAiElapsed(0)
      aiTimerRef.current = setInterval(() => setAiElapsed((e) => e + 1), 1000)
    } else {
      if (aiTimerRef.current) clearInterval(aiTimerRef.current)
      aiTimerRef.current = null
    }
    return () => { if (aiTimerRef.current) clearInterval(aiTimerRef.current) }
  }, [aiLoading])

  useEffect(() => {
    getFrameworkBySlug(slug).then((fw) => {
      if (!fw) return
      setFramework(fw)
      getScenarios(fw.id).then(setScenarios).catch(console.error)
    }).catch(console.error)
  }, [slug])

  if (!framework) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <p className="text-dark-500 dark:text-dark-300">Loading...</p>
      </div>
    )
  }

  const handleExplain = async () => {
    if (!modalConcept || !framework) return
    setAiLoading(true)
    setAiExplanation(null)
    try {
      const data = await explainConcept(modalConcept.name, modalConcept.definition, slug)
      setAiExplanation(data)
    } catch (err) {
      console.error(err)
    }
    setAiLoading(false)
  }

  const conceptMap = new Map<string, FrameworkConcept>()
  if (framework.concepts) {
    for (const c of framework.concepts) {
      const normalized = c.name.toLowerCase().replace(/[ /-]+/g, "")
      conceptMap.set(normalized, c)
    }
  }

  return (
    <>
    <div className="mx-auto max-w-4xl px-4 py-16">
      {/* Back button */}
      <button
        onClick={() => router.push("/frameworks")}
        className="mb-6 inline-flex items-center gap-1 text-sm text-dark-500 hover:text-primary-600 transition dark:text-dark-300"
      >
        <span className="text-lg leading-none">&larr;</span> Back to Frameworks
      </button>

      {/* Header */}
      <div className="mb-10">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            {framework.category.replace(/-/g, " ")}
          </span>
          <span className="text-sm text-dark-400 dark:text-dark-300">
            {framework.estimated_time_minutes} min &middot; Difficulty {framework.difficulty}/5
          </span>
        </div>
        <h1 className="mb-3 text-3xl sm:text-4xl font-bold text-dark-900 dark:text-dark-100">{framework.title}</h1>
        <p className="text-lg text-dark-500 dark:text-dark-300">{framework.description}</p>
      </div>

      {/* Key Concepts — responsive grid with modal */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-dark-900 dark:text-dark-100">Key Concepts</h2>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {framework.key_concepts?.map((name) => {
            const normalized = name.toLowerCase().replace(/[ /-]+/g, "")
            const concept = conceptMap.get(normalized)
            return (
              <button
                key={name}
                onClick={() => concept && setModalConcept(concept)}
                className={`rounded-lg border px-3.5 py-3 text-center w-full transition hover:border-primary-300 hover:shadow-sm ${ concept ? "border-dark-200 cursor-pointer hover:bg-primary-50 dark:border-dark-700 dark:hover:bg-primary-900/20" : "border-dark-100 bg-dark-50 cursor-default opacity-60 dark:bg-dark-900 dark:border-dark-800" }`}
              >
                <span className="text-[13px] sm:text-sm font-medium text-dark-700 leading-snug break-words dark:text-dark-300">
                  {name}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Use Cases */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-dark-900 dark:text-dark-100">When to Use</h2>
        <div className="flex flex-wrap gap-2">
          {framework.use_cases?.map((useCase) => (
            <span key={useCase} className="rounded-full bg-dark-100 px-3 py-1 text-sm text-dark-700 dark:bg-dark-800 dark:text-dark-300">
              {useCase}
            </span>
          ))}
        </div>
      </div>

      {/* Scenarios */}
      {scenarios.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-dark-900 dark:text-dark-100">Practice Scenarios</h2>
          <div className="grid gap-4">
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => router.push(`/scenarios/${scenario.slug}`)}
                className="flex items-center justify-between rounded-xl border border-primary-200 bg-primary-50 p-5 text-left transition hover:bg-primary-100 dark:bg-primary-900/20 dark:hover:bg-primary-900/30 dark:border-primary-800/40"
              >
                <div>
                  <h3 className="font-semibold text-primary-900 dark:text-primary-200">{scenario.title}</h3>
                  <p className="text-sm text-primary-700 dark:text-primary-300">{scenario.description}</p>
                </div>
                <span className="text-primary-600">&rarr;</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
    
    {/* Concept Modal */}
    {modalConcept && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModalConcept(null)}>
        <div
          className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl bg-white p-6 shadow-2xl animate-slide-up dark:bg-dark-900"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-dark-900 dark:text-dark-100">{modalConcept.name}</h3>
            <button
              onClick={() => setModalConcept(null)}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-dark-100 text-dark-400 dark:hover:bg-dark-700 dark:text-dark-300"
            >
              ✕
            </button>
          </div>
          
          <p className="mb-5 text-base leading-relaxed text-dark-800 font-medium bg-primary-50 rounded-lg p-4 border-l-4 border-primary-400 dark:text-dark-200 dark:bg-primary-900/20">
            {modalConcept.definition}
          </p>
          
          {modalConcept.formula && (
            <div className="mb-4 rounded-lg bg-dark-800 px-4 py-3 font-mono text-sm text-green-300">
              {modalConcept.formula}
            </div>
          )}

          {/* Why It Matters */}
          {modalConcept.why_it_matters && (
            <div className="mb-4 rounded-lg border border-primary-200 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/10 p-4">
              <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wide mb-2">Why It Matters for CEOs</p>
              <p className="text-sm text-dark-700 dark:text-dark-300 leading-relaxed">{modalConcept.why_it_matters}</p>
            </div>
          )}

          {/* Steps */}
          {modalConcept.steps && modalConcept.steps.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-dark-400 dark:text-dark-400 uppercase tracking-wide mb-3">How to Apply</p>
              <ol className="space-y-2.5">
                {modalConcept.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 text-xs font-bold text-primary-700 dark:text-primary-300 mt-0.5">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-dark-800 dark:text-dark-200">{step.title}</p>
                      <p className="text-dark-600 dark:text-dark-400">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Pitfalls */}
          {modalConcept.pitfalls && modalConcept.pitfalls.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-dark-400 dark:text-dark-400 uppercase tracking-wide mb-3">Common Pitfalls</p>
              <div className="space-y-2">
                {modalConcept.pitfalls.map((pf, i) => (
                  <div key={i} className="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 p-3">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">{pf.title}</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400/80 leading-relaxed">{pf.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Concepts */}
          {modalConcept.related_concepts && modalConcept.related_concepts.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-dark-400 dark:text-dark-400 uppercase tracking-wide mb-3">Connected Concepts</p>
              <div className="space-y-1.5">
                {modalConcept.related_concepts.map((rc, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-primary-500 mt-0.5">&#8594;</span>
                    <div>
                      <span className="font-medium text-dark-800 dark:text-dark-200">{rc.name}</span>
                      <span className="text-dark-500 dark:text-dark-400"> &mdash; {rc.relationship}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Case Study */}
          {modalConcept.case_study && (
            <div className="mb-4 rounded-lg border border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-800/50 p-4">
              <p className="text-xs font-semibold text-dark-400 dark:text-dark-400 uppercase tracking-wide mb-3">Case Study: {modalConcept.case_study.company}</p>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="font-medium text-dark-700 dark:text-dark-300">Situation</p>
                  <p className="text-dark-600 dark:text-dark-400">{modalConcept.case_study.situation}</p>
                </div>
                <div>
                  <p className="font-medium text-dark-700 dark:text-dark-300">Application</p>
                  <p className="text-dark-600 dark:text-dark-400">{modalConcept.case_study.application}</p>
                </div>
                <div>
                  <p className="font-medium text-dark-700 dark:text-dark-300">Result</p>
                  <p className="text-dark-600 dark:text-dark-400">{modalConcept.case_study.result}</p>
                </div>
              </div>
            </div>
          )}

          {/* Exercise */}
          {modalConcept.exercise && (
            <div className="mb-4 rounded-lg border border-primary-200 dark:border-primary-800/40 bg-primary-50/30 dark:bg-primary-900/10 p-4">
              <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wide mb-3">Test Yourself</p>
              <p className="text-sm text-dark-700 dark:text-dark-300 mb-3 leading-relaxed">{modalConcept.exercise.scenario}</p>
              <div className="space-y-1.5 mb-3">
                {modalConcept.exercise.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      const el = document.getElementById(`exercise-feedback-${modalConcept.name.replace(/\s+/g, '-')}`)
                      if (el) {
                        const isCorrect = i === modalConcept.exercise!.correct
                        el.innerHTML = isCorrect
                          ? '<span class="text-green-600 dark:text-green-400 font-medium">&#10003; Correct!</span>'
                          : '<span class="text-red-600 dark:text-red-400 font-medium">&#10007; Not quite.</span>'
                        el.className = `mt-2 text-xs ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`
                      }
                    }}
                    className="w-full text-left rounded-lg border border-dark-200 dark:border-dark-700 px-3 py-2 text-xs text-dark-600 dark:text-dark-400 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition"
                  >
                    {String.fromCharCode(65 + i)}. {opt}
                  </button>
                ))}
              </div>
              <div id={`exercise-feedback-${modalConcept.name.replace(/\s+/g, '-')}`} className="text-xs"></div>
            </div>
          )}

          {modalConcept.example && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-dark-400 uppercase tracking-wide mb-3 dark:text-dark-300">Real-World Examples</p>
              <ul className="space-y-3">
                {modalConcept.example.split(" | ").map((ex, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-dark-700 bg-dark-50 rounded-lg p-3 dark:bg-dark-900 dark:text-dark-300">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{ex}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {modalConcept.tags && modalConcept.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {modalConcept.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-primary-100 px-2.5 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                  {tag}
                </span>
              ))}
            </div>
          )}
          
          {/* AI Explain */}
          <div className="mb-4 mt-4">
            <button
              onClick={handleExplain}
              disabled={aiLoading}
              className="w-full rounded-lg border border-primary-200 dark:border-primary-800/40 bg-primary-50/30 dark:bg-primary-900/10 px-4 py-3 text-sm font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-100/50 dark:hover:bg-primary-900/20 transition disabled:opacity-50"
            >
              {aiLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating AI explanation... {aiElapsed}s
                </span>
              ) : "Explain Further with AI"}
            </button>

            {aiExplanation && (
              <div className="mt-3 space-y-3 animate-slide-up">
                {aiExplanation.real_world_example && (
                  <div className="rounded-lg border border-dark-200 dark:border-dark-700 p-3">
                    <p className="text-xs font-semibold text-dark-400 dark:text-dark-400 uppercase tracking-wide mb-1">Real-World Example</p>
                    <p className="text-sm text-dark-700 dark:text-dark-300">{aiExplanation.real_world_example}</p>
                  </div>
                )}
                {aiExplanation.ceo_insight && (
                  <div className="rounded-lg border border-primary-200 dark:border-primary-800/40 bg-primary-50/30 dark:bg-primary-900/10 p-3">
                    <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wide mb-1">CEO Insight</p>
                    <p className="text-sm text-dark-700 dark:text-dark-300">{aiExplanation.ceo_insight}</p>
                  </div>
                )}
                {aiExplanation.common_mistake && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-900/10 p-3">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">Common Mistake</p>
                    <p className="text-sm text-dark-700 dark:text-dark-300">{aiExplanation.common_mistake}</p>
                  </div>
                )}
                {aiExplanation.related_tip && (
                  <div className="rounded-lg border border-green-200 dark:border-green-800/40 bg-green-50/30 dark:bg-green-900/10 p-3">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide mb-1">Quick Tip</p>
                    <p className="text-sm text-dark-700 dark:text-dark-300">{aiExplanation.related_tip}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  )
}