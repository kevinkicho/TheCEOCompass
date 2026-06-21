"use client"

import { useState, useMemo } from "react"
import type { Framework, FrameworkConcept } from "@/lib/types"
import { staticFrameworks } from "@/lib/staticData"

export default function CheatsheetPage() {
  const [activeTab, setActiveTab] = useState("all")
  const [modalConcept, setModalConcept] = useState<FrameworkConcept | null>(null)

  const frameworks = staticFrameworks as unknown as Framework[]

  const tabs = useMemo(() => [
    { key: "all", label: "All" },
    ...frameworks.map((fw) => ({
      key: fw.id,
      label: fw.title.slice(0, 18) + (fw.title.length > 18 ? "…" : ""),
    })),
  ], [frameworks])

  const filteredFrameworks = useMemo(() =>
    activeTab === "all"
      ? frameworks
      : frameworks.filter((f) => f.id === activeTab),
  [activeTab, frameworks])

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="mb-2 text-3xl sm:text-4xl font-bold text-dark-900 dark:text-dark-100">Quick Reference</h1>
      <p className="mb-8 text-dark-500 dark:text-dark-300">Compact definitions and real-world examples. Click &ldquo;Examples&rdquo; to see full details.</p>

      {/* Tabs */}
      <div className="mb-8 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${activeTab === tab.key ? "bg-primary-600 text-white" : "bg-dark-100 text-dark-600 hover:bg-dark-200 dark:bg-dark-800 dark:text-dark-300 dark:hover:bg-dark-600"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Concepts */}
      <div className="space-y-10">
        {filteredFrameworks.map((fw) => (
          <div key={fw.id}>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-dark-900 dark:text-dark-100">{fw.title}</h2>
              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                {fw.category}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-200 text-left dark:border-dark-700">
                    <th className="py-2 pr-4 font-medium text-dark-500 w-48 dark:text-dark-300">Concept</th>
                    <th className="py-2 pr-4 font-medium text-dark-500 dark:text-dark-300">One-Liner</th>
                    <th className="py-2 font-medium text-dark-500 w-24 dark:text-dark-300">Examples</th>
                  </tr>
                </thead>
                <tbody>
                  {fw.concepts?.map((concept) => (
                    <tr key={concept.id} className="border-b border-dark-100 hover:bg-dark-50/50 dark:border-dark-800">
                      <td className="py-2.5 pr-4 font-medium text-dark-800 dark:text-dark-200">{concept.name}</td>
                      <td className="py-2.5 pr-4 text-dark-600 dark:text-dark-300">{concept.definition}</td>
                      <td className="py-2.5">
                        <button
                          onClick={() => setModalConcept(concept)}
                          className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100 transition dark:bg-primary-900/20 dark:hover:bg-primary-900/30 dark:text-primary-300"
                        >
                          {concept.example
                            ? `${concept.example.split(" | ").length} examples`
                            : "—"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Examples Modal */}
      {modalConcept && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setModalConcept(null)}
        >
          <div
            className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-xl bg-white p-6 shadow-2xl animate-slide-up dark:bg-dark-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-dark-900 dark:text-dark-100">{modalConcept.name}</h3>
              <button
                onClick={() => setModalConcept(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-dark-100 text-dark-400 dark:hover:bg-dark-700 dark:text-dark-300"
              >
                ✕
              </button>
            </div>

            <p className="mb-5 text-base leading-relaxed text-dark-800 font-medium bg-primary-50 rounded-lg p-4 border-l-4 border-primary-400 dark:text-dark-200 dark:bg-primary-900/20">
              {modalConcept.definition}
            </p>

            {modalConcept.formula && (
              <div className="mb-4 rounded-lg bg-dark-800 px-4 py-3 font-mono text-sm text-green-300">
                {modalConcept.formula}
              </div>
            )}

            {modalConcept.why_it_matters && (
              <div className="mb-4 rounded-lg border border-primary-200 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/10 p-4">
                <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wide mb-2">Why It Matters for CEOs</p>
                <p className="text-sm text-dark-700 dark:text-dark-300 leading-relaxed">{modalConcept.why_it_matters}</p>
              </div>
            )}

            {modalConcept.steps && modalConcept.steps.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-dark-400 dark:text-dark-400 uppercase tracking-wide mb-3">How to Apply</p>
                <ol className="space-y-2.5">
                  {modalConcept.steps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 text-xs font-bold text-primary-700 dark:text-primary-300 mt-0.5">{i + 1}</span>
                      <div>
                        <p className="font-semibold text-dark-800 dark:text-dark-200">{step.title}</p>
                        <p className="text-dark-600 dark:text-dark-400">{step.description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {modalConcept.case_study && (
              <div className="mb-4 rounded-lg border border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-800/50 p-4">
                <p className="text-xs font-semibold text-dark-400 dark:text-dark-400 uppercase tracking-wide mb-3">Case Study: {modalConcept.case_study.company}</p>
                <div className="space-y-2 text-sm">
                  <div><p className="font-medium text-dark-700 dark:text-dark-300">Situation</p><p className="text-dark-600 dark:text-dark-400">{modalConcept.case_study.situation}</p></div>
                  <div><p className="font-medium text-dark-700 dark:text-dark-300">Application</p><p className="text-dark-600 dark:text-dark-400">{modalConcept.case_study.application}</p></div>
                  <div><p className="font-medium text-dark-700 dark:text-dark-300">Result</p><p className="text-dark-600 dark:text-dark-400">{modalConcept.case_study.result}</p></div>
                </div>
              </div>
            )}

            {modalConcept.example && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-dark-400 uppercase tracking-wide mb-3 dark:text-dark-300">
                  Real-World Examples
                </p>
                <ul className="space-y-3">
                  {modalConcept.example.split(" | ").map((ex, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm text-dark-700 bg-dark-50 rounded-lg p-3 dark:bg-dark-900 dark:text-dark-300"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{ex}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {modalConcept.tags && modalConcept.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {modalConcept.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="rounded-full bg-primary-100 px-2.5 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
