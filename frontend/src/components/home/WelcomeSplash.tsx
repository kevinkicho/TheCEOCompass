"use client"

import React from "react"
import Link from "next/link"
import { useAuthSession } from "@/lib/AuthSessionProvider"

const features = [
  {
    title: "57+ frameworks",
    body: "Decision-making, finance, strategy, ops, and crisis — structured for CEOs and operators.",
    href: "/frameworks",
  },
  {
    title: "Live scenarios",
    body: "Multi-stage decisions under pressure with coaching feedback — practice before the real boardroom.",
    href: "/scenarios",
  },
  {
    title: "Your learning loop",
    body: "Spaced review, pathway, and journal — progress saves so you build judgment over time.",
    href: "/pathway",
  },
]

/**
 * Marketing / onboarding surface for guests and empty first-time sessions.
 * Replaces the personal "Today's plan" + next-actions shells that look unfinished.
 */
export function WelcomeSplash({
  frameworkCount,
  domainCount,
  scenarioCount,
}: {
  frameworkCount: number
  domainCount: number
  scenarioCount: number
}) {
  const { ready, user, isAnonymous, signInWithGoogle, ensureAnonymous } = useAuthSession()
  const showSignIn = ready && (!user || isAnonymous)

  return (
    <section
      className="mx-auto max-w-4xl px-4 pb-12"
      data-testid="welcome-splash"
      aria-label="Welcome"
    >
      <div className="rounded-2xl border border-primary-200/60 dark:border-primary-800/40 bg-gradient-to-br from-primary-50 via-white to-dark-50 dark:from-primary-950/40 dark:via-dark-900 dark:to-dark-950 p-6 sm:p-8 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400 mb-2">
          Welcome to CEO Compass
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-dark-900 dark:text-dark-100 mb-2">
          Build judgment before the next high-stakes call
        </h2>
        <p className="text-sm text-dark-600 dark:text-dark-300 max-w-2xl mb-6">
          Explore frameworks, run scenarios, and keep a decision journal.
          {showSignIn
            ? " Sign in to keep progress across devices — or start free on this browser."
            : " Your plan and reviews appear here once you begin learning."}
        </p>

        <div className="flex flex-wrap gap-3 mb-8">
          <Link
            href="/scenarios"
            className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition"
          >
            Try a scenario
          </Link>
          <Link
            href="/frameworks"
            className="rounded-lg border border-dark-300 dark:border-dark-600 px-5 py-2.5 text-sm font-medium text-dark-700 dark:text-dark-200 hover:bg-white/80 dark:hover:bg-dark-800 transition"
          >
            Browse frameworks
          </Link>
          {showSignIn && (
            <button
              type="button"
              onClick={() => {
                void signInWithGoogle().catch(() => {})
              }}
              className="rounded-lg border border-primary-300 dark:border-primary-700 bg-white/70 dark:bg-dark-900/60 px-5 py-2.5 text-sm font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition"
            >
              Sign in with Google
            </button>
          )}
          {ready && !user && (
            <button
              type="button"
              onClick={() => {
                void ensureAnonymous().catch(() => {})
              }}
              className="text-sm text-dark-500 dark:text-dark-400 hover:text-primary-600 dark:hover:text-primary-400 underline-offset-2 hover:underline px-1"
            >
              Continue as guest
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3 mb-6">
          {features.map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className="rounded-xl border border-dark-200/80 dark:border-dark-700 bg-white/70 dark:bg-dark-900/50 p-4 hover:border-primary-300 dark:hover:border-primary-700 transition"
            >
              <p className="text-sm font-semibold text-dark-900 dark:text-dark-100 mb-1">{f.title}</p>
              <p className="text-xs text-dark-500 dark:text-dark-400 leading-relaxed">{f.body}</p>
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-8 text-center sm:text-left border-t border-dark-200/70 dark:border-dark-700 pt-5">
          <Stat value={frameworkCount || "—"} label="Frameworks" />
          <Stat value={domainCount || "—"} label="Domains" />
          <Stat value={scenarioCount || "—"} label="Scenarios" />
          <p className="text-[11px] text-dark-400 dark:text-dark-500 sm:ml-auto max-w-xs">
            Personalized reviews and today&apos;s plan unlock after you open a concept or finish a scenario.
          </p>
        </div>
      </div>
    </section>
  )
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{value}</p>
      <p className="text-xs text-dark-500 dark:text-dark-400">{label}</p>
    </div>
  )
}
