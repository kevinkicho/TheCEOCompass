import { test, expect } from "@playwright/test"

/**
 * Phase 2–3 learning-loop smoke.
 *
 * App is gated behind Google flash-login. Without OAuth in CI:
 * - Assert auth gate is healthy, OR
 * - If a session already exists, assert next-actions / review shells.
 *
 * Run: `npm run test:e2e` from frontend/ (dev server :33221).
 */

async function isOnFlashGate(page: import("@playwright/test").Page): Promise<boolean> {
  const flash = page.getByTestId("flash-login")
  const google = page.getByRole("button", { name: /Continue with Google/i })
  return (await flash.count()) > 0 || (await google.count()) > 0
}

async function waitPastBoot(page: import("@playwright/test").Page) {
  await page.goto("/")
  await expect
    .poll(
      async () => {
        if (await isOnFlashGate(page)) return 1
        if ((await page.getByTestId("app-shell-status").count()) > 0) return 1
        if ((await page.getByRole("heading", { name: /Navigate Every|Think Like/i }).count()) > 0)
          return 1
        if ((await page.getByTestId("todays-plan").count()) > 0) return 1
        return 0
      },
      { timeout: 45_000 },
    )
    .toBe(1)
}

test.describe("learning loop smoke", () => {
  test("home: flash gate or hero / next-actions when signed in", async ({ page }) => {
    await waitPastBoot(page)

    if (await isOnFlashGate(page)) {
      await expect(page.getByTestId("flash-login").or(page.getByRole("button", { name: /Continue with Google/i }))).toBeVisible()
      return
    }

    // Signed-in path (local .env with existing session cookies)
    const hero = page.getByRole("heading", { name: /Navigate Every|Think Like/i })
    const todaysPlan = page.getByTestId("todays-plan")
    const nextActions = page.getByTestId("next-actions")
    const explore = page.getByRole("link", { name: /Start a Scenario|Explore Frameworks/i })

    await expect
      .poll(async () => {
        return (
          (await hero.count()) +
          (await todaysPlan.count()) +
          (await nextActions.count()) +
          (await explore.count())
        )
      }, { timeout: 30_000 })
      .toBeGreaterThan(0)
  })

  test("review routes: gate or weekly review shell", async ({ page }) => {
    await page.goto("/review")

    await expect
      .poll(
        async () => {
          if (await isOnFlashGate(page)) return 1
          if ((await page.getByRole("heading", { name: /Weekly Review/i }).count()) > 0) return 1
          if ((await page.getByTestId("app-shell-status").count()) > 0) return 1
          return 0
        },
        { timeout: 45_000 },
      )
      .toBe(1)

    if (await isOnFlashGate(page)) {
      await expect(
        page.getByTestId("flash-login").or(page.getByRole("button", { name: /Continue with Google/i })),
      ).toBeVisible()
      return
    }

    await expect(page.getByRole("heading", { name: /Weekly Review/i })).toBeVisible({
      timeout: 30_000,
    })

    await page.goto("/review/session")
    await expect(
      page.getByRole("heading", { name: /Review session/i }).or(page.getByTestId("flash-login")),
    ).toBeVisible({ timeout: 30_000 })
  })
})
