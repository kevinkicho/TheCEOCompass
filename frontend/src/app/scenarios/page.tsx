"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { getScenarios } from "@/lib/api"
import { PersistenceUnavailableBanner } from "@/components/RequiresBackend"
import type { ScenarioListItem } from "@/lib/types"

export default function ScenariosPage() {
  const router = useRouter()
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([])
  const [activePack, setActivePack] = useState<string | null>(null)

  useEffect(() => {
    getScenarios().then(setScenarios).catch(console.error)
  }, [])

  const packs = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of scenarios) {
      const id = s.pack_id ?? "core"
      const title = s.pack_title ?? "Core"
      if (!map.has(id)) map.set(id, title)
    }
    // Stable-ish order: Core first, then alpha by title
    return Array.from(map.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => {
        if (a.id === "core") return -1
        if (b.id === "core") return 1
        return a.title.localeCompare(b.title)
      })
  }, [scenarios])

  const filtered = useMemo(() => {
    if (!activePack) return scenarios
    return scenarios.filter((s) => (s.pack_id ?? "core") === activePack)
  }, [scenarios, activePack])

  const difficultyLabel = (d: number) => {
    if (d <= 2) {
      return {
        text: "Beginner",
        color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
      }
    }
    if (d <= 3) {
      return {
        text: "Intermediate",
        color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      }
    }
    return {
      text: "Advanced",
      color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    }
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

      {packs.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActivePack(null)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
              !activePack
                ? "bg-primary-600 text-white"
                : "bg-dark-100 text-dark-600 hover:bg-dark-200 dark:bg-dark-800 dark:text-dark-300 dark:hover:bg-dark-600"
            }`}
          >
            All packs
          </button>
          {packs.map((pack) => (
            <button
              key={pack.id}
              type="button"
              onClick={() => setActivePack(pack.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                activePack === pack.id
                  ? "bg-primary-600 text-white"
                  : "bg-dark-100 text-dark-600 hover:bg-dark-200 dark:bg-dark-800 dark:text-dark-300 dark:hover:bg-dark-600"
              }`}
            >
              {pack.title}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-6">
        {filtered.map((scenario) => {
          const diff = difficultyLabel(scenario.difficulty)
          const packTitle = scenario.pack_title ?? "Core"
          return (
            <div
              key={scenario.id}
              className="cursor-pointer rounded-xl border border-dark-200 p-6 transition hover:border-primary-300 hover:shadow-md dark:border-dark-700"
              onClick={() => router.push(`/scenarios/${scenario.slug}`)}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${diff.color}`}>
                  {diff.text}
                </span>
                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                  {packTitle}
                </span>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-dark-900 dark:text-dark-100">{scenario.title}</h3>
              <p className="text-dark-500 dark:text-dark-300">{scenario.description}</p>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-dark-500 dark:text-dark-400">No scenarios in this pack yet.</p>
        )}
      </div>
    </div>
  )
}
