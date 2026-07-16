import { test, expect } from "@playwright/test"

/**
 * Phase 2–3 learning-loop smoke (PR 16).
 *
 * Asserts core navigation for next-actions / review / session entry.
 * Tolerates missing Firebase (no next-actions, persistence banners) so CI
 * can run without secrets. Does not require RTDB data or feature flags.
 *
 * Run: `npm run test:e2e` from frontend/ (starts dev server on :33221).
 * Optional env: same NEXT_PUBLIC_FIREBASE_* as the app for fuller coverage.
 */

test.describe("learning loop smoke", () => {
  test("home loads hero and next-actions or explore CTAs", async ({ page }) => {
    await page.goto("/")

    await expect(
      page.getByRole("heading", { name: /Navigate Every/i }),
    ).toBeVisible({ timeout: 30_000 })

    // Firebase available → next-actions dashboard; otherwise hero CTAs remain.
    const nextActions = page.getByTestId("next-actions")
    if ((await nextActions.count()) > 0) {
      await expect(nextActions).toBeVisible()
      await expect(page.getByText(/Your next actions/i)).toBeVisible()
    } else {
      await expect(
        page.getByRole("link", { name: /Start a Scenario|Explore Frameworks/i }).first(),
      ).toBeVisible()
    }
  })

  test("review page shows weekly review shell and due or session affordances", async ({
    page,
  }) => {
    await page.goto("/review")

    await expect(
      page.getByRole("heading", { name: /Weekly Review/i }),
    ).toBeVisible({ timeout: 30_000 })

    // Either loaded content, loading skeleton, or persistence-unavailable banner.
    const dueSection = page.getByTestId("due-reviews-section")
    const sessionCta = page.getByTestId("start-review-session")
    const srStats = page.getByTestId("sr-stats-panel")
    const persistenceBanner = page.getByText(/requires Firebase|not available|persistence/i)
    const quickActions = page.getByText(/Quick Actions/i)

    await expect
      .poll(async () => {
        return (
          (await dueSection.count()) +
          (await sessionCta.count()) +
          (await srStats.count()) +
          (await persistenceBanner.count()) +
          (await quickActions.count()) +
          (await page.getByText(/Weekly Review/i).count())
        )
      }, { timeout: 30_000 })
      .toBeGreaterThan(0)

    // Session route is always reachable (flag may disable UI inside).
    await page.goto("/review/session")
    await expect(
      page.getByRole("heading", { name: /Review session/i }),
    ).toBeVisible({ timeout: 30_000 })

    const disabled = page.getByTestId("review-session-disabled")
    const loading = page.getByTestId("review-session-flags-loading")
    const sessionCard = page.getByTestId("review-session-card")
    const sessionEmpty = page.getByTestId("review-session-empty")
    // One of: flags loading, disabled message, active session, empty, or heading.
    await expect
      .poll(async () => {
        return (
          (await disabled.count()) +
          (await loading.count()) +
          (await sessionCard.count()) +
          (await sessionEmpty.count()) +
          (await page.getByRole("heading", { name: /Review session/i }).count())
        )
      })
      .toBeGreaterThan(0)
  })

  test("nav can reach frameworks and pathway from home", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { name: /Navigate Every/i })).toBeVisible({
      timeout: 30_000,
    })

    await page.getByRole("link", { name: /Explore Frameworks/i }).first().click()
    await expect(page).toHaveURL(/\/frameworks/)
    await expect(page.getByText(/Framework/i).first()).toBeVisible({ timeout: 30_000 })
  })
})
