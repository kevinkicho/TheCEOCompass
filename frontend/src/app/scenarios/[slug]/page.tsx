"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { getScenario } from "@/lib/api"
import { ScenarioEngine } from "@/components/ScenarioEngine"
import { PersistenceUnavailableBanner } from "@/components/RequiresBackend"
import { SkeletonCard } from "@/components/SkeletonCard"
import type { Scenario } from "@/lib/types"

export default function ScenarioPage() {
  const { slug } = useParams<{ slug: string }>()
  const [scenario, setScenario] = useState<Scenario | null>(null)

  useEffect(() => {
    getScenario(slug).then(setScenario).catch(console.error)
  }, [slug])

  if (!scenario) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <SkeletonCard lines={3} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-10">
        <h1 className="mb-2 text-3xl sm:text-4xl font-bold text-dark-900 dark:text-dark-100">{scenario.title}</h1>
        <p className="mb-4 text-lg text-dark-500 dark:text-dark-300">{scenario.description}</p>
      </div>
      <PersistenceUnavailableBanner
        feature="AI Feedback"
        description="AI coaching needs Firebase + local agent/Ollama; history saves under your signed-in account"
      />
      <ScenarioEngine scenario={scenario} />
    </div>
  )
}