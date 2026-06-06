"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { getScenario } from "@/lib/api"
import { ScenarioEngine } from "@/components/ScenarioEngine"
import { StaticModeBanner } from "@/components/StaticModeBanner"
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
        <p className="text-dark-500 dark:text-dark-300">Loading scenario...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-10">
        <h1 className="mb-2 text-3xl sm:text-4xl font-bold text-dark-900 dark:text-dark-100">{scenario.title}</h1>
        <p className="mb-4 text-lg text-dark-500 dark:text-dark-300">{scenario.description}</p>
      </div>
      <StaticModeBanner
        feature="AI Feedback"
        description="This scenario requires the backend for LLM-powered coaching and evaluation"
      />
      <ScenarioEngine scenario={scenario} />
    </div>
  )
}