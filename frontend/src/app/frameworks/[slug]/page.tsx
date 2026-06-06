"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { getFrameworkBySlug, getScenarios } from "@/lib/api"
import type { Framework, FrameworkConcept, ScenarioListItem } from "@/lib/types"

export default function FrameworkDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const [framework, setFramework] = useState<Framework | null>(null)
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([])
  const [modalConcept, setModalConcept] = useState<FrameworkConcept | null>(null)

  useEffect(() => {
    getFrameworkBySlug(slug).then((fw) => {
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
          <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
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
                className={`rounded-lg border px-3.5 py-3 text-center w-full transition hover:border-primary-300 hover:shadow-sm ${ concept ? "border-dark-200 cursor-pointer hover:bg-primary-50 dark:border-dark-700" : "border-dark-100 bg-dark-50 cursor-default opacity-60 dark:bg-dark-900 dark:border-dark-800" }`}
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
                className="flex items-center justify-between rounded-xl border border-primary-200 bg-primary-50 p-5 text-left transition hover:bg-primary-100"
              >
                <div>
                  <h3 className="font-semibold text-primary-900">{scenario.title}</h3>
                  <p className="text-sm text-primary-700">{scenario.description}</p>
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
          
          <p className="mb-5 text-base leading-relaxed text-dark-800 font-medium bg-primary-50 rounded-lg p-4 border-l-4 border-primary-400 dark:text-dark-200">
            {modalConcept.definition}
          </p>
          
          {modalConcept.formula && (
            <div className="mb-4 rounded-lg bg-dark-800 px-4 py-3 font-mono text-sm text-green-300">
              {modalConcept.formula}
            </div>
          )}
          
          {modalConcept.example && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-dark-400 uppercase tracking-wide mb-3 dark:text-dark-300">Real-World Examples</p>
              <ul className="space-y-3">
                {modalConcept.example.split(" | ").map((ex, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-dark-700 bg-dark-50 rounded-lg p-3 dark:bg-dark-900 dark:text-dark-300">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
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
                <span key={tag} className="rounded-full bg-primary-100 px-2.5 py-1 text-xs font-medium text-primary-700">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    )}
    </>
  )
}