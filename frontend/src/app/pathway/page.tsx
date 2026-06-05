"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getFrameworks, getProgress } from "@/lib/api"
import type { FrameworkListItem, Progress } from "@/lib/types"

const PATHWAY_STEPS = [
  { id: "11111111-1111-1111-1111-111111111111", slug: "strategic-decision-making", title: "Strategic Decision-Making", category: "decision-making" },
  { id: "33333333-3333-3333-3333-333333333333", slug: "competitive-market-analysis", title: "Competitive & Market Analysis", category: "strategy" },
  { id: "22222222-2222-2222-2222-222222222222", slug: "financial-mastery", title: "Financial Mastery", category: "financial" },
  { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaa00000001", slug: "business-model-strategy", title: "Business Model & Strategy", category: "strategy" },
  { id: "88888888-8888-8888-8888-888888888888", slug: "negotiation-deal-making", title: "Negotiation & Deal-Making", category: "negotiation" },
  { id: "cc000001-0000-4000-8000-000000000001", slug: "decision-tree-analysis", title: "Decision Tree Analysis", category: "analysis" },
  { id: "cc000001-0000-4000-8000-000000000002", slug: "sensitivity-analysis", title: "Sensitivity Analysis", category: "analysis" },
  { id: "cc000001-0000-4000-8000-000000000003", slug: "stakeholder-analysis", title: "Stakeholder Analysis", category: "analysis" },
  { id: "cc000001-0000-4000-8000-000000000004", slug: "cohort-analysis", title: "Cohort Analysis", category: "analysis" },
  { id: "77777777-7777-7777-7777-777777777777", slug: "cause-analysis-methods", title: "Cause Analysis Methods", category: "analysis" },
  { id: "cc000001-0000-4000-8000-000000000005", slug: "monte-carlo-simulation", title: "Monte Carlo Simulation", category: "analysis" },
  { id: "cc000001-0000-4000-8000-000000000006", slug: "value-driver-tree", title: "Value Driver Tree", category: "analysis" },
  { id: "cc000001-0000-4000-8000-000000000007", slug: "ab-testing-experiments", title: "A/B Testing & Experiments", category: "analysis" },
  { id: "cc000001-0000-4000-8000-000000000008", slug: "force-field-analysis", title: "Force Field Analysis", category: "analysis" },
  { id: "55555555-5555-5555-5555-555555555555", slug: "engineering-product-leadership", title: "Eng & Product Leadership", category: "engineering" },
  { id: "99999999-9999-9999-9999-999999999999", slug: "innovation-rd-management", title: "Innovation & R&D", category: "innovation" },
  { id: "44444444-4444-4444-4444-444444444444", slug: "organizational-people", title: "Organizational & People", category: "org" },
  { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbb00000001", slug: "operations-quality-management", title: "Ops & Quality Management", category: "operations" },
  { id: "66666666-6666-6666-6666-666666666666", slug: "risk-governance-crisis", title: "Risk, Governance & Crisis", category: "risk" },
]

export default function PathwayPage() {
  const router = useRouter()
  const [frameworks, setFrameworks] = useState<FrameworkListItem[]>([])
  const [progress, setProgress] = useState<Progress | null>(null)

  useEffect(() => {
    getFrameworks().then(setFrameworks).catch(console.error)
    getProgress().then(setProgress).catch(console.error)
  }, [])

  const completedIds = progress?.modules_completed || []
  const inProgressId = progress?.current_module_id
  const frameworkMap = new Map(frameworks.map((f) => [f.id, f]))

  const getStepStatus = (id: string) => {
    if (completedIds.includes(id)) return "completed"
    if (inProgressId === id) return "in-progress"
    return "locked"
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-dark-900">Learning Pathway</h1>
        <p className="mt-2 text-dark-500">Structured curriculum from strategic thinking to crisis management.</p>
      </div>

      {/* Progress Summary */}
      <div className="mb-8 rounded-xl bg-primary-50 p-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-3xl font-bold text-primary-600">{completedIds.length}</p>
            <p className="text-sm text-primary-700">Completed</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-primary-600">{PATHWAY_STEPS.length - completedIds.length}</p>
            <p className="text-sm text-primary-700">Remaining</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-primary-600">{completedIds.length > 0 ? Math.round((completedIds.length / PATHWAY_STEPS.length) * 100) : 0}%</p>
            <p className="text-sm text-primary-700">Progress</p>
          </div>
        </div>
        <div className="mt-4 h-2 w-full rounded-full bg-primary-100">
          <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${completedIds.length > 0 ? (completedIds.length / PATHWAY_STEPS.length) * 100 : 0}%` }} />
        </div>
      </div>

      {/* Pathway Steps */}
      <div className="space-y-4">
        {PATHWAY_STEPS.map((step, index) => {
          const framework = frameworkMap.get(step.id)
          const status = getStepStatus(step.id)
          const isAvailable = index === 0 || completedIds.includes(PATHWAY_STEPS[index - 1]?.id) || completedIds.includes(step.id)

          return (
            <div
              key={step.id}
              className={`rounded-xl border p-5 transition ${isAvailable ? "border-dark-200 bg-white" : "border-dark-100 bg-dark-50 opacity-60"}`}
            >
              <div className="flex items-center gap-4">
                {/* Step Number */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  status === "completed" ? "bg-green-500 text-white"
                  : status === "in-progress" ? "bg-primary-500 text-white"
                  : isAvailable ? "bg-dark-100 text-dark-600"
                  : "bg-dark-100 text-dark-300"
                }`}>
                  {status === "completed" ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (index + 1)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold ${isAvailable ? "text-dark-900" : "text-dark-400"}`}>{step.title}</h3>
                    {framework && <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">{framework.category}</span>}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${status === "completed" ? "bg-green-100 text-green-700" : status === "in-progress" ? "bg-primary-100 text-primary-700" : "bg-dark-100 text-dark-500"}`}>
                      {status === "completed" ? "Done" : status === "in-progress" ? "Active" : isAvailable ? "Start" : "Locked"}
                    </span>
                  </div>
                  {framework && <p className="mt-1 text-sm text-dark-500">{framework.description}</p>}
                </div>

                {/* Action */}
                {isAvailable && (
                  <button
                    onClick={() => router.push(`/frameworks/${step.slug}`)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      status === "completed" ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : status === "in-progress" ? "bg-primary-600 text-white hover:bg-primary-700"
                      : "bg-primary-600 text-white hover:bg-primary-700"
                    }`}
                  >
                    {status === "completed" ? "Review" : status === "in-progress" ? "Continue" : "Start"}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}