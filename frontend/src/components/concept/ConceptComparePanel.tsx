"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { getCachedFrameworks, slugify } from "@/lib/rtdb-cache"
import { generateComparison, crossPollinate } from "@/lib/ollama"
import { db, ref, get } from "@/lib/firebase"
import type { FrameworkConcept, Framework } from "@/lib/types"

interface Props {
  framework: Framework
  concept: FrameworkConcept
  frameworkSlug: string
  conceptSlug: string
}

export function ConceptComparePanel({ framework, concept, frameworkSlug, conceptSlug }: Props) {
  const [compareTarget, setCompareTarget] = useState("")
  const [compareMode, setCompareMode] = useState<"compare" | "cross">("compare")
  const [compareResult, setCompareResult] = useState<Record<string, string> | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareError, setCompareError] = useState("")
  const [compareElapsed, setCompareElapsed] = useState(0)
  const [compareEntries, setCompareEntries] = useState<{ result: string; created_at?: number }[]>([])
  const [comparePage, setComparePage] = useState(0)

  const allConceptsForCompare = useMemo(
    () =>
      (getCachedFrameworks() || []).flatMap((fw) =>
        (fw.concepts || []).map((c) => ({
          id: `${fw.slug}/${slugify(c.name)}`,
          name: c.name,
          framework: fw.title,
          slug: slugify(c.name),
          definition: c.definition || "",
        })),
      ).filter((c) => c.slug !== conceptSlug),
    [conceptSlug],
  )

  const compareStorageKey = useMemo(() => {
    if (!compareTarget) return null
    const target = allConceptsForCompare.find((c) => c.id === compareTarget)
    if (!target) return null
    const slugs = [conceptSlug, target.slug].sort()
    return `comparisons/${frameworkSlug}/${slugs[0]}/${slugs[1]}/${compareMode}`
  }, [compareTarget, compareMode, frameworkSlug, conceptSlug, allConceptsForCompare])

  const loadCompareEntries = useCallback(async () => {
    if (!db || !compareStorageKey) return
    try {
      const snap = await get(ref(db, compareStorageKey))
      if (!snap.exists()) return
      const entries = Object.values(snap.val() || {}) as { result?: string; created_at?: number }[]
      const valid = entries
        .filter((e) => e?.result)
        .sort((a, b) => (b.created_at || 0) - (a.created_at || 0)) as { result: string; created_at?: number }[]
      setCompareEntries(valid)
      if (valid.length > 0) {
        setComparePage(0)
        try {
          setCompareResult(JSON.parse(valid[0].result))
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }, [compareStorageKey])

  useEffect(() => {
    loadCompareEntries()
  }, [loadCompareEntries])

  const goToComparePage = (idx: number) => {
    if (idx < 0 || idx >= compareEntries.length) return
    setComparePage(idx)
    try {
      setCompareResult(JSON.parse(compareEntries[idx].result))
    } catch {
      /* ignore */
    }
  }

  const handleCompare = async () => {
    if (!compareTarget) return
    setCompareError("")
    setCompareLoading(true)
    setCompareElapsed(0)
    try {
      const target = allConceptsForCompare.find((c) => c.id === compareTarget)
      if (!target) throw new Error("Target concept not found")
      const a = {
        name: concept.name,
        definition: concept.definition,
        framework: framework.title,
        slug: conceptSlug,
      }
      const b = {
        name: target.name,
        definition: target.definition,
        framework: target.framework,
        slug: target.slug,
      }
      const res =
        compareMode === "cross"
          ? await crossPollinate(a, b, frameworkSlug, (elapsed) => setCompareElapsed(elapsed))
          : await generateComparison(a, b, frameworkSlug, (elapsed) => setCompareElapsed(elapsed))
      setCompareResult(res)
      await loadCompareEntries()
    } catch (err: unknown) {
      setCompareError(err instanceof Error ? err.message : "Comparison failed")
    }
    setCompareLoading(false)
  }

  return (
    <div className="mb-6 mt-8 rounded-xl border border-dark-200 dark:border-dark-700 p-4">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-xs font-semibold text-dark-400 dark:text-dark-400 uppercase tracking-wide">
          {compareMode === "cross" ? "Cross-Pollinate" : "Compare"} with another concept
        </p>
        {compareEntries.length > 1 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-dark-400 dark:text-dark-500 ml-2">
            <button
              onClick={() => goToComparePage(comparePage - 1)}
              disabled={comparePage === 0}
              className="hover:text-dark-600 dark:hover:text-dark-300 disabled:opacity-30 transition px-0.5"
            >
              &lt;
            </button>
            <span className="tabular-nums">
              {comparePage + 1}/{compareEntries.length}
            </span>
            <button
              onClick={() => goToComparePage(comparePage + 1)}
              disabled={comparePage >= compareEntries.length - 1}
              className="hover:text-dark-600 dark:hover:text-dark-300 disabled:opacity-30 transition px-0.5"
            >
              &gt;
            </button>
          </span>
        )}
        <button
          onClick={() => {
            setCompareMode(compareMode === "cross" ? "compare" : "cross")
            setCompareResult(null)
            setComparePage(0)
          }}
          className="ml-auto text-[10px] text-primary-600 dark:text-primary-400 hover:underline"
        >
          {compareMode === "cross" ? "Switch to Compare" : "Switch to Cross-Pollinate"}
        </button>
      </div>
      <div className="flex gap-2">
        <select
          value={compareTarget}
          onChange={(e) => setCompareTarget(e.target.value)}
          className="flex-1 rounded-lg border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-900 px-3 py-2 text-xs text-dark-700 dark:text-dark-200"
        >
          <option value="">Select a concept...</option>
          {allConceptsForCompare
            .filter((c) => c.id !== `${frameworkSlug}/${conceptSlug}`)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.framework})
              </option>
            ))}
        </select>
        <button
          onClick={handleCompare}
          disabled={!compareTarget || compareLoading}
          className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-700 transition disabled:opacity-50 shrink-0"
        >
          {compareLoading
            ? compareElapsed >= 30
              ? "Still working..."
              : compareElapsed + "s"
            : compareMode === "cross"
              ? "Cross-Pollinate"
              : "Compare"}
        </button>
      </div>

      {compareError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{compareError}</p>}

      {compareResult && compareMode === "compare" && (
        <div className="mt-4 space-y-3 animate-slide-up">
          <div className="rounded-lg bg-primary-50 dark:bg-primary-900/20 p-3">
            <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wide mb-1">Overview</p>
            <p className="text-sm text-dark-700 dark:text-dark-300">{compareResult.comparison}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-green-200 dark:border-green-800/40 bg-green-50 dark:bg-green-900/10 p-3">
              <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide mb-1">Similarities</p>
              <ul className="space-y-1">
                {(compareResult.similarities || "").split("|").map((s, i) => (
                  <li key={i} className="text-xs text-dark-600 dark:text-dark-400 flex gap-1">
                    <span className="text-green-500 shrink-0">•</span>
                    <span>{s.trim()}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 p-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">Differences</p>
              <ul className="space-y-1">
                {(compareResult.differences || "").split("|").map((d, i) => (
                  <li key={i} className="text-xs text-dark-600 dark:text-dark-400 flex gap-1">
                    <span className="text-amber-500 shrink-0">•</span>
                    <span>{d.trim()}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="rounded-lg border border-violet-200 dark:border-violet-800/40 bg-violet-50 dark:bg-violet-900/10 p-3">
            <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-1">When to Use Each</p>
            <p className="text-sm text-dark-700 dark:text-dark-300">{compareResult.when_to_use_each}</p>
          </div>
        </div>
      )}

      {compareResult && compareMode === "cross" && (
        <div className="mt-4 space-y-3 animate-slide-up">
          <div className="rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/40 p-3">
            <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-1">Synthetic Insight</p>
            <p className="text-sm text-dark-700 dark:text-dark-300">{compareResult.synthetic_insight}</p>
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 p-3">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">Blind Spot Detected</p>
            <p className="text-sm text-dark-700 dark:text-dark-300">{compareResult.blind_spot}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/40 p-3">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide mb-1">Combined Framework</p>
            <p className="text-sm text-dark-700 dark:text-dark-300">{compareResult.combined_framework}</p>
          </div>
        </div>
      )}
    </div>
  )
}
