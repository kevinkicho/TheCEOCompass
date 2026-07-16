"use client"

import { useEffect, useState } from "react"
import { useFeatureFlags } from "@/components/FeatureFlagsProvider"
import { useAuthSession } from "@/lib/AuthSessionProvider"
import {
  loadMasteryRecommendations,
  DEFAULT_RECOMMENDATION_LIMIT,
} from "./recommendations"
import type { NextAction } from "./next-action"

export type MasteryRecommendationsState =
  | { status: "disabled"; actions: NextAction[] }
  | { status: "loading"; actions: NextAction[] }
  | { status: "ready"; actions: NextAction[] }
  | { status: "error"; actions: NextAction[]; message: string }

/**
 * Graph-driven next concepts when mastery_graph_enabled is true.
 * Flag off → status "disabled", empty actions (no network for mastery).
 * Hooks are always called in the same order (no early return before hooks).
 */
export function useMasteryRecommendations(
  limit: number = DEFAULT_RECOMMENDATION_LIMIT,
): MasteryRecommendationsState & { retry: () => void } {
  const { flags, ready: flagsReady } = useFeatureFlags()
  const { ready: authReady } = useAuthSession()
  const [tick, setTick] = useState(0)
  const [state, setState] = useState<MasteryRecommendationsState>({
    status: "loading",
    actions: [],
  })

  const enabled = flags.mastery_graph_enabled

  useEffect(() => {
    if (!flagsReady) {
      setState({ status: "loading", actions: [] })
      return
    }
    if (!enabled) {
      setState({ status: "disabled", actions: [] })
      return
    }
    // Wait for auth so tryUid() is reliable; still allow load with empty progress.
    if (!authReady) {
      setState({ status: "loading", actions: [] })
      return
    }

    let cancelled = false
    setState({ status: "loading", actions: [] })

    loadMasteryRecommendations(limit)
      .then((actions) => {
        if (!cancelled) setState({ status: "ready", actions })
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            status: "error",
            actions: [],
            message: err instanceof Error ? err.message : "Failed to load recommendations",
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [flagsReady, enabled, authReady, limit, tick])

  return { ...state, retry: () => setTick((t) => t + 1) }
}
