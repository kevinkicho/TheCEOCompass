"use client"

import { useEffect, useState } from "react"
import { canUseFirebasePersistence } from "@/lib/capabilities"
import { useAuthSession } from "@/lib/AuthSessionProvider"
import { useFeatureFlags } from "@/components/FeatureFlagsProvider"
import {
  loadDueReviews,
  loadPathwayProgress,
  loadJournalEntries,
  buildPathway,
  tryUid,
  userPath,
} from "@/lib/user-data"
import { loadFrameworks } from "@/lib/rtdb-cache"
import { db, ref, get } from "@/lib/firebase"
import type { ReviewRecord } from "@/lib/spaced-repetition"
import type { FrameworkListItem } from "@/lib/types"
import {
  loadMasteryRecommendations,
  type NextAction,
} from "@/lib/mastery"

export type RecommendedConcept = Pick<
  NextAction,
  "kind" | "conceptId" | "frameworkSlug" | "conceptSlug" | "reason" | "score"
>

export type NextActionsState =
  | { status: "loading" }
  | { status: "no_firebase" }
  | { status: "error"; message: string }
  | {
      status: "ready"
      dueReviewCount: number
      dueReviews: ReviewRecord[]
      pathway: { pct: number; nextSlug: string | null; nextTitle: string | null }
      journalOutcomesDue: number
      lastViewed: { frameworkSlug: string; conceptId: string } | null
      isAnonymous: boolean
      /** Graph-driven recommendations; empty when mastery_graph_enabled is false. */
      recommendedConcepts: RecommendedConcept[]
    }

export function useNextActions(): NextActionsState & { retry: () => void } {
  const { ready: authReady, isAnonymous } = useAuthSession()
  const { flags, ready: flagsReady } = useFeatureFlags()
  const [tick, setTick] = useState(0)
  const [state, setState] = useState<NextActionsState>({ status: "loading" })

  const masteryEnabled = flags.mastery_graph_enabled

  useEffect(() => {
    if (!canUseFirebasePersistence()) {
      setState({ status: "no_firebase" })
      return
    }
    if (!authReady || !flagsReady) {
      setState({ status: "loading" })
      return
    }

    let cancelled = false
    setState({ status: "loading" })

    ;(async () => {
      try {
        const [dueReviews, pathwayProgress, journal, frameworks, recommendedConcepts] =
          await Promise.all([
            loadDueReviews().catch(() => [] as ReviewRecord[]),
            loadPathwayProgress().catch(() => ({
              completedIds: [] as string[],
              inProgressId: null as string | null,
            })),
            loadJournalEntries().catch(() => []),
            loadFrameworks().catch(() => [] as FrameworkListItem[]),
            masteryEnabled
              ? loadMasteryRecommendations(4).catch(() => [] as NextAction[])
              : Promise.resolve([] as NextAction[]),
          ])

        const steps = buildPathway(frameworks as FrameworkListItem[])
        const pct =
          steps.length > 0
            ? Math.round((pathwayProgress.completedIds.length / steps.length) * 100)
            : 0
        const nextStep = steps.find((s) => !pathwayProgress.completedIds.includes(s.slug))

        const now = new Date()
        const journalOutcomesDue = journal.filter((e) => {
          if (e.outcome_captured) return false
          try {
            return new Date(e.review_date) <= now
          } catch {
            return false
          }
        }).length

        let lastViewed: { frameworkSlug: string; conceptId: string } | null = null
        const uid = tryUid()
        if (uid && db) {
          const snap = await get(ref(db, userPath(uid, "viewed")))
          if (snap.exists()) {
            let latest = 0
            const val = snap.val() as Record<string, Record<string, { viewed_at?: string }>>
            for (const fw of Object.keys(val)) {
              for (const cid of Object.keys(val[fw] || {})) {
                const t = new Date(val[fw][cid]?.viewed_at || 0).getTime()
                if (t > latest) {
                  latest = t
                  lastViewed = { frameworkSlug: fw, conceptId: cid }
                }
              }
            }
          }
        }

        if (cancelled) return
        setState({
          status: "ready",
          dueReviewCount: dueReviews.length,
          dueReviews: dueReviews.slice(0, 5),
          pathway: {
            pct,
            nextSlug: nextStep?.slug || null,
            nextTitle: nextStep?.title || null,
          },
          journalOutcomesDue,
          lastViewed,
          isAnonymous,
          recommendedConcepts: recommendedConcepts.map((a) => ({
            kind: a.kind,
            conceptId: a.conceptId,
            frameworkSlug: a.frameworkSlug,
            conceptSlug: a.conceptSlug,
            reason: a.reason,
            score: a.score,
          })),
        })
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load next actions",
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authReady, flagsReady, isAnonymous, masteryEnabled, tick])

  return { ...state, retry: () => setTick((t) => t + 1) }
}
