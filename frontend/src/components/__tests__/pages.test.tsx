import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({ slug: "strategic-decision-making", conceptSlug: "first-principles-thinking" }),
  usePathname: () => "/frameworks/strategic-decision-making",
  redirect: vi.fn(),
}))

// Mock the API
vi.mock("@/lib/api", () => ({
  getFrameworks: vi.fn().mockResolvedValue([
    {
      id: "11111111-1111-1111-1111-111111111111",
      slug: "strategic-decision-making",
      title: "Strategic Decision-Making",
      description: "Core frameworks for making high-stakes decisions",
      category: "decision-making",
      difficulty: 2,
      estimated_time_minutes: 45,
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      slug: "financial-mastery",
      title: "Financial Mastery",
      description: "Read financial statements, value companies",
      category: "financial",
      difficulty: 3,
      estimated_time_minutes: 60,
    },
  ]),
  getFrameworkBySlug: vi.fn().mockResolvedValue({
    id: "11111111-1111-1111-1111-111111111111",
    slug: "strategic-decision-making",
    title: "Strategic Decision-Making",
    description: "Core frameworks for making high-stakes decisions",
    category: "decision-making",
    difficulty: 2,
    estimated_time_minutes: 45,
    key_concepts: ["First Principles Thinking", "Inversion", "OODA Loop"],
    use_cases: ["Major strategic bets", "M&A decisions"],
    concepts: [
      {
        id: "c1",
        name: "First Principles Thinking",
        definition: "Decompose problems to fundamental truths",
        example: "SpaceX example | Elon Musk example | Airbnb example",
        tags: ["decision-making", "innovation"],
      },
      {
        id: "c2",
        name: "Inversion",
        definition: "Solve problems by thinking backward",
        example: "Charlie Munger example | Investment example | Product launch example",
        tags: ["decision-making", "risk"],
      },
      {
        id: "c3",
        name: "OODA Loop",
        definition: "Observe, Orient, Decide, Act",
        example: "Air Force example | Startup example | COVID example",
        tags: ["decision-making", "speed"],
      },
    ],
  }),
  getScenarios: vi.fn().mockResolvedValue([]),
  getProgress: vi.fn().mockResolvedValue({
    user_id: "u1",
    scenarios_completed: 3,
    scenarios_in_progress: 1,
    total_scenario_score: 2.5,
    average_scenario_score: 0.8,
    framework_mastery: {},
    current_streak_days: 5,
    longest_streak_days: 12,
    modules_completed: [],
    current_module_id: null,
  }),
  getCalibration: vi.fn().mockResolvedValue({
    total_predictions: 5,
    average_confidence: 0.7,
    accuracy: 0.6,
    average_brier_score: 0.18,
    calibration_by_confidence: {},
    calibration_by_domain: {},
    trend: [],
  }),
  getJournalEntries: vi.fn().mockResolvedValue([]),
}))

// Mock Firebase modules (needed by review, calibration, concept detail, quotes pages)
vi.mock("@/lib/firebase", () => ({
  db: { ref: vi.fn(), get: vi.fn() },
  ref: vi.fn(() => ({ key: "mock-ref" })),
  get: vi.fn(() => Promise.resolve({ exists: () => false, val: () => null })),
  set: vi.fn(() => Promise.resolve()),
  update: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
}))

vi.mock("@/lib/firebase-crud", () => ({
  loadPathwayProgress: vi.fn().mockResolvedValue({ completedIds: [], inProgressId: null }),
  buildPathway: vi.fn().mockReturnValue([]),
  getDeviceId: vi.fn().mockReturnValue("mock-device-id"),
  loadDueReviews: vi.fn().mockResolvedValue([]),
  loadAllReviews: vi.fn().mockResolvedValue([]),
  loadReviewRecord: vi.fn().mockResolvedValue(null),
  markConceptReviewed: vi.fn().mockResolvedValue({
    conceptId: "c1", frameworkSlug: "test", conceptName: "Test", conceptSlug: "test",
    reviewCount: 1, interval: 1, easeFactor: 2.6,
    lastReviewedAt: new Date().toISOString(), nextReviewAt: new Date().toISOString(),
  }),
  loadJournalEntries: vi.fn().mockResolvedValue([]),
  loadFrameworkProgress: vi.fn().mockResolvedValue([]),
  loadFavoriteQuotes: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/lib/spaced-repetition", () => ({
  getReviewStatus: vi.fn(() => "ok"),
  getDaysUntilReview: vi.fn(() => 5),
  ReviewRecord: {},
  sm2: vi.fn(() => ({ interval: 1, easeFactor: 2.6, reviewCount: 1 })),
  getNextReviewDate: vi.fn(() => new Date().toISOString()),
  isDueForReview: vi.fn(() => false),
}))

vi.mock("@/components/RequiresBackend", () => ({
  isStaticHosting: false,
  StaticHostingBanner: () => null,
  PersistenceUnavailableBanner: () => null,
  BackendRequiredModal: () => null,
  AiSetupModal: () => null,
  BackendGuard: ({ children }: { children: React.ReactNode }) => children,
  AiGuard: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/lib/capabilities", () => ({
  canUseFirebasePersistence: () => true,
  canUseAIFromHeartbeat: () => true,
  getAiAvailability: () => ({ status: "available", mode: "local", ollamaOk: true }),
  AGENT_HEARTBEAT_PATH: "_meta/agent_heartbeat",
  AGENT_HEARTBEAT_STALE_MS: 90000,
  AGENT_HEARTBEAT_SKEW_MS: 120000,
}))

vi.mock("@/lib/AuthSessionProvider", () => ({
  AuthSessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuthSession: () => ({
    user: { uid: "test", isAnonymous: true },
    ready: true,
    isAdmin: false,
    isAnonymous: true,
    ensureAnonymous: async () => {},
    linkGoogle: async () => {},
    signInWithGoogle: async () => {},
    signOut: async () => {},
  }),
}))

// Test that imports work for all page components
describe("Page imports are valid", () => {
  it("imports home page without error", async () => {
    const mod = await import("@/app/page")
    expect(mod.default).toBeDefined()
  })

  it("imports frameworks page without error", async () => {
    const mod = await import("@/app/frameworks/page")
    expect(mod.default).toBeDefined()
  })

  it("imports framework detail page without error", async () => {
    const mod = await import("@/app/frameworks/[slug]/page")
    expect(mod.default).toBeDefined()
  })

  it("imports concept detail page without error", async () => {
    const mod = await import("@/app/frameworks/[slug]/[conceptSlug]/page")
    expect(mod.default).toBeDefined()
  })

  it("imports scenarios page without error", async () => {
    const mod = await import("@/app/scenarios/page")
    expect(mod.default).toBeDefined()
  })

  it("imports scenario detail page without error", async () => {
    const mod = await import("@/app/scenarios/[slug]/page")
    expect(mod.default).toBeDefined()
  })

  it("imports quiz page without error", async () => {
    const mod = await import("@/app/quiz/page")
    expect(mod.default).toBeDefined()
  })

  it("imports journal page without error", async () => {
    const mod = await import("@/app/journal/page")
    expect(mod.default).toBeDefined()
  })

  it("imports review page without error", async () => {
    const mod = await import("@/app/review/page")
    expect(mod.default).toBeDefined()
  })

  it("imports calibration page without error", async () => {
    const mod = await import("@/app/calibration/page")
    expect(mod.default).toBeDefined()
  })

  it("imports quotes page without error", async () => {
    const mod = await import("@/app/quotes/page")
    expect(mod.default).toBeDefined()
  })

  it("imports simulator page without error", async () => {
    const mod = await import("@/app/simulator/page")
    expect(mod.default).toBeDefined()
  })

  it("imports pathway page without error", async () => {
    const mod = await import("@/app/pathway/page")
    expect(mod.default).toBeDefined()
  })

  it("imports profile page without error", async () => {
    const mod = await import("@/app/profile/page")
    expect(mod.default).toBeDefined()
  })

  it("imports cheatsheet page without error", async () => {
    const mod = await import("@/app/cheatsheet/page")
    expect(mod.default).toBeDefined()
  })

  it.skip("imports layout without error", async () => {
    // next/font requires Node.js runtime, not testable in jsdom
    const mod = await import("@/app/layout")
    expect(mod.default).toBeDefined()
  })

  it("imports all page modules without error", async () => {
    const pages = [
      "@/app/page",
      "@/app/frameworks/page",
      "@/app/frameworks/[slug]/page",
      "@/app/frameworks/[slug]/[conceptSlug]/page",
      "@/app/scenarios/page",
      "@/app/scenarios/[slug]/page",
      "@/app/simulator/page",
      "@/app/quiz/page",
      "@/app/journal/page",
      "@/app/review/page",
      "@/app/calibration/page",
      "@/app/quotes/page",
      "@/app/pathway/page",
      "@/app/profile/page",
      "@/app/cheatsheet/page",
    ]
    for (const path of pages) {
      const mod = await import(path)
      expect(mod.default).toBeDefined()
    }
  })
})

// Component import validation — all components use named exports
describe("Component imports are valid", () => {
  const componentMap: Record<string, string[]> = {
    ChatPanel: ["ChatPanel"],
    CatPageNav: ["CatPageNav"],
    SparkleBtn: ["SparkleBtn"],
    PromptTooltip: ["PromptTooltip"],
    SkeletonCard: ["SkeletonCard"],
    ErrorBoundary: ["ErrorBoundary"],
    ThemeProvider: ["ThemeProvider"],
    ScenarioEngine: ["ScenarioEngine"],
    ScenarioDecisionPrompt: ["ScenarioDecisionPrompt"],
    ScenarioFeedbackPanel: ["ScenarioFeedbackPanel"],
    ScenarioPastAttempts: ["ScenarioPastAttempts"],
    QuoteCard: ["QuoteCard"],
    Navbar: ["Navbar"],
    AppSidebar: ["AppSidebar"],
    RequiresBackend: ["StaticHostingBanner", "PersistenceUnavailableBanner", "BackendGuard", "BackendRequiredModal", "isStaticHosting"],
    "concept/SpacedReviewBar": ["SpacedReviewBar"],
    "concept/ConceptHeader": ["ConceptHeader"],
    "concept/ConceptComparePanel": ["ConceptComparePanel"],
    "concept/LearningToolsPanel": ["LearningToolsPanel"],
    "home/NextActionsDashboard": ["NextActionsDashboard"],
  }

  for (const [name, exports] of Object.entries(componentMap)) {
    it(`imports ${name} without error`, async () => {
      const mod = await import(`@/components/${name}`)
      for (const exp of exports) {
        expect(mod[exp]).toBeDefined()
      }
    })
  }

  it("imports all components without error", async () => {
    for (const [name, exports] of Object.entries(componentMap)) {
      const mod = await import(`@/components/${name}`)
      for (const exp of exports) {
        expect(mod[exp]).toBeDefined()
      }
    }
  })
})

// Verify that layout modules export generateMetadata for SEO
describe("Page module structure", () => {
  it("generateMetadata is exported from SSG page layouts", async () => {
    const frameworkLayout = await import("@/app/frameworks/[slug]/layout")
    expect(typeof frameworkLayout.generateMetadata).toBe("function")

    const conceptLayout = await import("@/app/frameworks/[slug]/[conceptSlug]/layout")
    expect(typeof conceptLayout.generateMetadata).toBe("function")
  })
})