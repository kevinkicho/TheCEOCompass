"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { getFrameworks } from "@/lib/api"
import type { FrameworkListItem } from "@/lib/types"

export default function FrameworksPage() {
  const [frameworks, setFrameworks] = useState<FrameworkListItem[]>([])
  const [category, setCategory] = useState<string>("all")

  useEffect(() => {
    getFrameworks().then(setFrameworks).catch(console.error)
  }, [])

  const filtered = category === "all"
    ? frameworks
    : frameworks.filter((fw) => fw.category === category)

  const categories = ["all", ...new Set(frameworks.map((fw) => fw.category))]

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="mb-2 text-3xl sm:text-4xl font-bold text-dark-900 dark:text-dark-100">Frameworks</h1>
      <p className="mb-8 text-dark-500 dark:text-dark-300">
        Master the analytical tools that world-class CEOs rely on.
      </p>

      {/* Category filter */}
      <div className="mb-8 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${ category === cat ? "bg-primary-600 text-white" : "bg-dark-100 text-dark-600 hover:bg-dark-200 dark:bg-dark-800 dark:text-dark-300 dark:hover:bg-dark-600" }`}
          >
            {cat === "all" ? "All" : cat.replace(/-/g, " ")}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {filtered.map((fw) => (
          <Link
            key={fw.id}
            href={`/frameworks/${fw.slug}`}
            className="group rounded-xl border border-dark-200 p-6 transition hover:border-primary-300 hover:shadow-md dark:border-dark-700"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                {fw.category.replace(/-/g, " ")}
              </span>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${ i < fw.difficulty ? "bg-primary-400" : "bg-dark-200 dark:bg-dark-700" }`}
                  />
                ))}
              </div>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-dark-900 group-hover:text-primary-600 dark:text-dark-100">
              {fw.title}
            </h3>
            <p className="mb-4 text-sm text-dark-500 dark:text-dark-300">{fw.description}</p>
            <div className="flex items-center justify-between text-xs text-dark-400 dark:text-dark-300">
              <span>{fw.estimated_time_minutes} min to learn</span>
              <span className="text-primary-600 opacity-0 group-hover:opacity-100 transition">
                Open &rarr;
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}