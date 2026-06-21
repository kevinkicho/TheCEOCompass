"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { getFrameworkBySlug, getScenarios } from "@/lib/api"
import { slugify } from "@/lib/ollama"
import { loadFrameworkProgress } from "@/lib/firebase-crud"
import { isStaticHosting } from "@/components/RequiresBackend"
import type { Framework, ScenarioListItem } from "@/lib/types"

export default function FrameworkDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const [framework, setFramework] = useState<Framework | null>(null)
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([])
  const [viewedIds, setViewedIds] = useState<string[]>([])

  useEffect(() => {
    getFrameworkBySlug(slug).then((fw) => {
      if (!fw) return
      setFramework(fw)
      getScenarios(fw.id).then(setScenarios).catch(console.error)
    }).catch(console.error)
  }, [slug])

  useEffect(() => {
    if (!slug || isStaticHosting) return
    loadFrameworkProgress(slug).then(setViewedIds).catch(() => {})
  }, [slug])

  if (!framework) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <p className="text-dark-500 dark:text-dark-300">Loading...</p>
      </div>
    )
  }

  const totalConcepts = framework.concepts?.length || framework.key_concepts?.length || 0
  const completedConcepts = viewedIds.length
  const pct = totalConcepts > 0 ? Math.round((completedConcepts / totalConcepts) * 100) : 0

  const conceptMap = new Map<string, { name: string }>()
  if (framework.key_concepts) {
    for (const name of framework.key_concepts) {
      const normalized = name.toLowerCase().replace(/[ /-]+/g, "")
      conceptMap.set(normalized, { name })
    }
  }

  return (
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
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            {framework.category.replace(/-/g, " ")}
          </span>
          <span className="text-sm text-dark-400 dark:text-dark-300">
            {framework.estimated_time_minutes} min &middot; Difficulty {framework.difficulty}/5
          </span>
          {totalConcepts > 0 && (
            <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
              {completedConcepts}/{totalConcepts} concepts
            </span>
          )}
        </div>
        <h1 className="mb-3 text-3xl sm:text-4xl font-bold text-dark-900 dark:text-dark-100">{framework.title}</h1>
        <p className="text-lg text-dark-500 dark:text-dark-300">{framework.description}</p>

        {totalConcepts > 0 && (
          <div className="mt-4 h-2 w-full max-w-sm rounded-full bg-dark-100 dark:bg-dark-800">
            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      {/* Key Concepts — clickable cards linking to concept pages */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-dark-900 dark:text-dark-100">Key Concepts</h2>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {framework.key_concepts?.map((name) => {
            const cs = slugify(name)
            const hasConcept = conceptMap.has(name.toLowerCase().replace(/[ /-]+/g, ""))
            const matchedConcept = framework.concepts?.find((c) => slugify(c.name) === cs)
            const isViewed = matchedConcept ? viewedIds.includes(matchedConcept.id) : false
            return (
              <button
                key={name}
                onClick={() => hasConcept && router.push(`/frameworks/${framework.slug}/${cs}`)}
                className={`rounded-lg border px-3.5 py-3 text-center w-full transition hover:border-primary-300 hover:shadow-sm ${isViewed ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20" : hasConcept ? "border-dark-200 cursor-pointer hover:bg-primary-50 dark:border-dark-700 dark:hover:bg-primary-900/20" : "border-dark-100 bg-dark-50 cursor-default opacity-60 dark:bg-dark-900 dark:border-dark-800" }`}
              >
                <span className="text-[13px] sm:text-sm font-medium text-dark-700 leading-snug break-words dark:text-dark-300">
                  {isViewed && <span className="text-green-600 dark:text-green-400 mr-1">&#10003;</span>}
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
  )
}
