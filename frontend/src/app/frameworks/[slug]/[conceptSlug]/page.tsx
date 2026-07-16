"use client"

import React, { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { loadFrameworks, getCachedFrameworks, slugify } from "@/lib/rtdb-cache"
import { markConceptViewed } from "@/lib/firebase-crud"
import { SkeletonCard } from "@/components/SkeletonCard"
import { ConceptHeader } from "@/components/concept/ConceptHeader"
import { ConceptEnrichmentPanel } from "@/components/concept/ConceptEnrichmentPanel"
import { ConceptComparePanel } from "@/components/concept/ConceptComparePanel"
import { SpacedReviewBar } from "@/components/concept/SpacedReviewBar"
import { LearningToolsPanel } from "@/components/concept/LearningToolsPanel"
import type { FrameworkConcept, Framework } from "@/lib/types"

function findConcept(slug: string, conceptSlug: string): { framework: Framework; concept: FrameworkConcept } | null {
  const frameworks = getCachedFrameworks()
  if (!frameworks) return null
  const fw = frameworks.find((f) => f.slug === slug) as Framework | undefined
  if (!fw) return null
  const concept = fw.concepts?.find((c) => slugify(c.name) === conceptSlug)
  if (!concept) return null
  return { framework: fw, concept }
}

export default function ConceptDetailPage() {
  const { slug, conceptSlug } = useParams<{ slug: string; conceptSlug: string }>()
  const [frameworksReady, setFrameworksReady] = useState(!!getCachedFrameworks())
  const [pageError, setPageError] = useState("")
  const [aiError, setAiError] = useState("")

  useEffect(() => {
    if (getCachedFrameworks()) { setFrameworksReady(true); return }
    loadFrameworks()
      .then(() => setFrameworksReady(true))
      .catch((err) => { setPageError(err.message || "Failed to load frameworks"); setFrameworksReady(true) })
  }, [])

  const result = findConcept(slug, conceptSlug)

  useEffect(() => {
    if (slug && result?.concept?.id) markConceptViewed(slug, result.concept.id)
  }, [slug, result?.concept?.id])

  if (!frameworksReady) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <SkeletonCard lines={4} />
      </div>
    )
  }

  if (!result) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <p className="text-red-600 dark:text-red-400">
          Concept not found: {pageError || "Check that Firebase is configured and frameworks are seeded to RTDB"}
        </p>
      </div>
    )
  }

  const { framework, concept } = result

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <ConceptHeader framework={framework} concept={concept} frameworkSlug={slug} conceptSlug={conceptSlug} />
      <ConceptEnrichmentPanel framework={framework} concept={concept} frameworkSlug={slug} conceptSlug={conceptSlug} />
      {aiError && (
        <p className="mb-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{aiError}</p>
      )}
      <ConceptComparePanel framework={framework} concept={concept} frameworkSlug={slug} conceptSlug={conceptSlug} />
      <SpacedReviewBar
        frameworkSlug={slug}
        conceptId={concept.id}
        conceptName={concept.name}
        conceptSlug={conceptSlug}
        onError={setAiError}
      />
      <LearningToolsPanel framework={framework} concept={concept} frameworkSlug={slug} conceptSlug={conceptSlug} />
    </div>
  )
}
