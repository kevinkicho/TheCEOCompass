"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { slugify } from "@/lib/rtdb-cache"
import type { Framework, FrameworkConcept } from "@/lib/types"

interface Props {
  framework: Framework
  concept: FrameworkConcept
  frameworkSlug: string
  conceptSlug: string
}

export function ConceptHeader({ framework, concept, frameworkSlug, conceptSlug }: Props) {
  const router = useRouter()
  const allConcepts = (framework.concepts || []).map((c) => ({
    name: c.name,
    slug: slugify(c.name),
  }))
  const currentIdx = allConcepts.findIndex((c) => c.slug === conceptSlug)
  const prevConcept = currentIdx > 0 ? allConcepts[currentIdx - 1] : null
  const nextConcept = currentIdx < allConcepts.length - 1 ? allConcepts[currentIdx + 1] : null

  return (
    <>
      <button
        onClick={() => router.push(`/frameworks/${frameworkSlug}`)}
        className="mb-6 inline-flex items-center gap-1 text-sm text-dark-500 hover:text-primary-600 transition dark:text-dark-300"
      >
        <span className="text-lg leading-none">&larr;</span> Back to {framework.title}
      </button>

      <div className="mb-6 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {allConcepts.length > 1 && prevConcept && (
            <button
              onClick={() => router.push(`/frameworks/${frameworkSlug}/${prevConcept.slug}`)}
              className="inline-flex items-center gap-1 text-dark-500 hover:text-primary-600 transition dark:text-dark-300"
            >
              <span>&larr;</span> {prevConcept.name}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {allConcepts.length > 1 && (
            <span className="text-dark-400 dark:text-dark-500">
              {currentIdx + 1} / {allConcepts.length}
            </span>
          )}
          {allConcepts.length > 1 && nextConcept && (
            <button
              onClick={() => router.push(`/frameworks/${frameworkSlug}/${nextConcept.slug}`)}
              className="inline-flex items-center gap-1 text-dark-500 hover:text-primary-600 transition dark:text-dark-300"
            >
              {nextConcept.name} <span>&rarr;</span>
            </button>
          )}
        </div>
      </div>

      <h1 className="mb-2 text-2xl sm:text-3xl font-bold text-dark-900 dark:text-dark-100">{concept.name}</h1>
      <p className="mb-6 text-base leading-relaxed text-dark-800 font-medium bg-primary-50 rounded-lg p-4 border-l-4 border-primary-400 dark:text-dark-200 dark:bg-primary-900/20">
        {concept.definition}
      </p>
      {concept.formula && (
        <div className="mb-4 rounded-lg bg-dark-800 px-4 py-3 font-mono text-sm text-green-300">{concept.formula}</div>
      )}
    </>
  )
}
