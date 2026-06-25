"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { loadFrameworks } from "@/lib/rtdb-cache"
import { getScenarios } from "@/lib/api"
import type { FrameworkListItem, ScenarioListItem } from "@/lib/types"

export default function Home() {
  const router = useRouter()
  const [frameworks, setFrameworks] = useState<FrameworkListItem[]>([])
  const [scenarioCount, setScenarioCount] = useState(0)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  useEffect(() => {
    loadFrameworks()
      .then((fws) => setFrameworks(fws as FrameworkListItem[]))
      .catch(console.error)
    getScenarios().then((s) => setScenarioCount(s.length)).catch(console.error)
  }, [])

  const categories = [...new Set(frameworks.map((f) => f.category))]
  const displayedFrameworks = activeCategory
    ? frameworks.filter((f) => f.category === activeCategory)
    : frameworks

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 pt-8 sm:pt-24 pb-12 sm:pb-24 text-center">
        <h1 className="mb-6 text-3xl sm:text-5xl font-bold tracking-tight text-dark-900 dark:text-dark-100">
          Navigate Every <span className="text-primary-600">Leadership Decision</span>
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-dark-500 dark:text-dark-300">
          Your compass through 57 frameworks across 12 domains: decision-making, financial analysis,
          negotiation, competitive strategy, operations, innovation, and more.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/scenarios"
            className="rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700"
          >
            Start a Scenario
          </Link>
          <Link
            href="/frameworks"
            className="rounded-lg border border-dark-300 px-6 py-3 font-medium text-dark-700 hover:bg-dark-50 dark:hover:bg-dark-800 dark:text-dark-300 dark:border-dark-600"
          >
            Explore Frameworks
          </Link>
        </div>
      </section>

      {/* Stats — clickable */}
      <section className="border-t border-dark-100 bg-dark-50 dark:bg-dark-900 dark:border-dark-800">
        <div className="mx-auto grid max-w-4xl grid-cols-3 divide-x divide-dark-200 px-4 py-10 dark:divide-dark-700">
          <button
            onClick={() => setActiveCategory(null)}
            className="text-center hover:bg-white/50 transition rounded-lg py-2 dark:hover:bg-dark-700"
          >
            <p className="text-3xl font-bold text-primary-600">{frameworks.length}</p>
            <p className="text-sm text-dark-500 dark:text-dark-300">Frameworks</p>
          </button>
          <button
            onClick={() => setActiveCategory(activeCategory ? null : categories[0] || null)}
            className="text-center hover:bg-white/50 transition rounded-lg py-2 dark:hover:bg-dark-700"
          >
            <p className="text-3xl font-bold text-primary-600">{categories.length}</p>
            <p className="text-sm text-dark-500 dark:text-dark-300">Domains</p>
          </button>
          <Link href="/scenarios" className="text-center hover:bg-white/50 transition rounded-lg py-2 block dark:hover:bg-dark-700">
            <p className="text-3xl font-bold text-primary-600">{scenarioCount}</p>
            <p className="text-sm text-dark-500 dark:text-dark-300">Scenarios</p>
          </Link>
        </div>
      </section>

      {/* Domain filters */}
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${ !activeCategory ? "bg-primary-600 text-white" : "bg-dark-100 text-dark-600 hover:bg-dark-200 dark:bg-dark-800 dark:text-dark-300 dark:hover:bg-dark-600" }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${ activeCategory === cat ? "bg-primary-600 text-white" : "bg-dark-100 text-dark-600 hover:bg-dark-200 dark:bg-dark-800 dark:text-dark-300 dark:hover:bg-dark-600" }`}
            >
              {cat.replace(/-/g, " ")}
            </button>
          ))}
        </div>
      </section>

      {/* Framework Grid */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {displayedFrameworks.map((fw) => (
            <Link
              key={fw.id}
              href={`/frameworks/${fw.slug}`}
              className="rounded-xl border border-dark-200 p-6 transition hover:border-primary-300 hover:shadow-md dark:border-dark-700"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                  {fw.category.replace(/-/g, " ")}
                </span>
                <span className="rounded-full bg-dark-100 px-2 py-0.5 text-xs text-dark-600 dark:bg-dark-800 dark:text-dark-300">
                  {fw.difficulty}/5
                </span>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-dark-900 dark:text-dark-100">{fw.title}</h3>
              <p className="mb-4 text-sm text-dark-500 dark:text-dark-300">{fw.description}</p>
              <p className="text-xs text-dark-400 dark:text-dark-300">{fw.estimated_time_minutes} min estimated</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}