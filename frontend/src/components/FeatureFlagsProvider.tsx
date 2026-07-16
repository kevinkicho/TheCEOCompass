"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { db, ref, onValue } from "@/lib/firebase"
import {
  DEFAULT_FEATURE_FLAGS,
  FEATURE_FLAGS_PATH,
  parseFeatureFlags,
  setCachedFeatureFlags,
  type FeatureFlags,
} from "@/lib/feature-flags"

type FeatureFlagsContextValue = {
  flags: FeatureFlags
  /** True after first RTDB snapshot (or immediately if no Firebase / on error). */
  ready: boolean
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue>({
  flags: DEFAULT_FEATURE_FLAGS,
  ready: false,
})

export function useFeatureFlags(): FeatureFlagsContextValue {
  return useContext(FeatureFlagsContext)
}

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!db) {
      setCachedFeatureFlags(DEFAULT_FEATURE_FLAGS)
      setFlags(DEFAULT_FEATURE_FLAGS)
      setReady(true)
      return
    }

    const unsub = onValue(
      ref(db, FEATURE_FLAGS_PATH),
      (snap) => {
        const next = snap.exists()
          ? parseFeatureFlags(snap.val())
          : { ...DEFAULT_FEATURE_FLAGS }
        setCachedFeatureFlags(next)
        setFlags(next)
        setReady(true)
      },
      () => {
        // permission denied / permanent failure → stay on safe defaults
        setCachedFeatureFlags(DEFAULT_FEATURE_FLAGS)
        setFlags({ ...DEFAULT_FEATURE_FLAGS })
        setReady(true)
      },
    )

    return () => unsub()
  }, [])

  const value = useMemo(() => ({ flags, ready }), [flags, ready])

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  )
}
