import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, act } from "@testing-library/react"


const { mockState, mockOnValue, mockRef, unsubFn } = vi.hoisted(() => {
  const unsubFn = vi.fn()
  return {
    mockState: { db: { __isDb: true } as object | null, app: { name: "[DEFAULT]" } as object | null },
    mockOnValue: vi.fn(),
    mockRef: vi.fn((_db: unknown, path: string) => ({ _path: path })),
    unsubFn,
  }
})

vi.mock("@/lib/firebase", () => ({
  get db() {
    return mockState.db
  },
  get app() {
    return mockState.app
  },
  ref: (...args: unknown[]) => (mockRef as Function)(...args),
  onValue: (...args: unknown[]) => (mockOnValue as Function)(...args),
}))

const { initAppCheckIfConfigured } = vi.hoisted(() => ({
  initAppCheckIfConfigured: vi.fn(() => null),
}))

vi.mock("@/lib/app-check", () => ({
  initAppCheckIfConfigured,
}))

import { FeatureFlagsProvider, useFeatureFlags } from "../FeatureFlagsProvider"
import {
  DEFAULT_FEATURE_FLAGS,
  FEATURE_FLAGS_PATH,
  getFlag,
  resetFeatureFlagsCache,
} from "@/lib/feature-flags"

function Probe() {
  const { flags, ready } = useFeatureFlags()
  return (
    <div>
      <span data-testid="ready">{String(ready)}</span>
      <span data-testid="cloud">{String(flags.cloud_ai_enabled)}</span>
      <span data-testid="provider">{flags.ai_provider_default}</span>
    </div>
  )
}

describe("FeatureFlagsProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetFeatureFlagsCache()
    mockState.db = { __isDb: true }
    mockOnValue.mockImplementation(() => unsubFn)
  })

  afterEach(() => {
    resetFeatureFlagsCache()
  })

  it("marks ready with defaults when db is null", async () => {
    mockState.db = null

    render(
      <FeatureFlagsProvider>
        <Probe />
      </FeatureFlagsProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("ready").textContent).toBe("true")
    })
    expect(screen.getByTestId("cloud").textContent).toBe(String(DEFAULT_FEATURE_FLAGS.cloud_ai_enabled))
    expect(screen.getByTestId("provider").textContent).toBe(DEFAULT_FEATURE_FLAGS.ai_provider_default)
    expect(mockOnValue).not.toHaveBeenCalled()
    expect(getFlag("cloud_ai_enabled")).toBe(DEFAULT_FEATURE_FLAGS.cloud_ai_enabled)
    expect(initAppCheckIfConfigured).toHaveBeenCalledWith(mockState.app)
  })

  it("calls initAppCheckIfConfigured with app on mount", async () => {
    render(
      <FeatureFlagsProvider>
        <Probe />
      </FeatureFlagsProvider>,
    )

    await waitFor(() => {
      expect(initAppCheckIfConfigured).toHaveBeenCalledWith(mockState.app)
    })
  })

  it("subscribes to FEATURE_FLAGS_PATH and updates on snapshot", async () => {
    mockOnValue.mockImplementation((_ref: unknown, onOk: (snap: unknown) => void) => {
      Promise.resolve().then(() => {
        onOk({
          exists: () => true,
          val: () => ({ cloud_ai_enabled: true, ai_provider_default: "cloud" }),
        })
      })
      return unsubFn
    })

    render(
      <FeatureFlagsProvider>
        <Probe />
      </FeatureFlagsProvider>,
    )

    expect(mockRef).toHaveBeenCalledWith(mockState.db, FEATURE_FLAGS_PATH)
    expect(mockOnValue).toHaveBeenCalled()

    await waitFor(() => {
      expect(screen.getByTestId("ready").textContent).toBe("true")
      expect(screen.getByTestId("cloud").textContent).toBe("true")
      expect(screen.getByTestId("provider").textContent).toBe("cloud")
    })
    expect(getFlag("cloud_ai_enabled")).toBe(true)
    expect(getFlag("ai_provider_default")).toBe("cloud")
  })

  it("marks ready with defaults on permission error callback", async () => {
    mockOnValue.mockImplementation(
      (_ref: unknown, _onOk: unknown, onErr?: (err: unknown) => void) => {
        Promise.resolve().then(() => {
          onErr?.(new Error("PERMISSION_DENIED"))
        })
        return unsubFn
      },
    )

    render(
      <FeatureFlagsProvider>
        <Probe />
      </FeatureFlagsProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("ready").textContent).toBe("true")
    })
    expect(screen.getByTestId("cloud").textContent).toBe(String(DEFAULT_FEATURE_FLAGS.cloud_ai_enabled))
    expect(getFlag("cloud_ai_enabled")).toBe(DEFAULT_FEATURE_FLAGS.cloud_ai_enabled)
  })

  it("unsubscribes on unmount", () => {
    mockOnValue.mockImplementation(() => unsubFn)

    const { unmount } = render(
      <FeatureFlagsProvider>
        <Probe />
      </FeatureFlagsProvider>,
    )

    expect(unsubFn).not.toHaveBeenCalled()
    act(() => {
      unmount()
    })
    expect(unsubFn).toHaveBeenCalledTimes(1)
  })
})
