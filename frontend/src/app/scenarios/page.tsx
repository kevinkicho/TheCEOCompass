"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getScenarios } from "@/lib/api"
import { PersistenceUnavailableBanner } from "@/components/RequiresBackend"
import type { ScenarioListItem } from "@/lib/types"

export default function ScenariosPage() {
  const router = useRouter()
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([])

  useEffect(() => {
    getScenarios().then(setScenarios).catch(console.error)
  }, [])

  const difficultyLabel = (d: number) => {
    if (d <= 2) return { text: "Beginner", color: "bg-green-100 text-green-700" }
    if (d <= 3) return { text: "Intermediate", color: "bg-amber-100 text-amber-700" }
    return { text: "Advanced", color: "bg-red-100 text-red-700" }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="mb-2 text-3xl sm:text-4xl font-bold text-dark-900 dark:text-dark-100">Scenarios</h1>
      <p className="mb-4 text-dark-500 dark:text-dark-300">
        Apply frameworks to real-world CEO situations. Get AI-powered feedback on your decisions.
      </p>

      <PersistenceUnavailableBanner
        feature="AI Scenarios"
        description="Scenario history saves to Firebase; AI coaching needs the local agent + Ollama"
      />

      <div className="grid gap-6">
        {scenarios.map((scenario) => {
          const diff = difficultyLabel(scenario.difficulty)
          return (
            <div
              key={scenario.id}
              className="cursor-pointer rounded-xl border border-dark-200 p-6 transition hover:border-primary-300 hover:shadow-md dark:border-dark-700"
              onClick={() => router.push(`/scenarios/${scenario.slug}`)}
            >
              <div className="mb-3 flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${diff.color}`}>
                  {diff.text}
                </span>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-dark-900 dark:text-dark-100">{scenario.title}</h3>
              <p className="text-dark-500 dark:text-dark-300">{scenario.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}