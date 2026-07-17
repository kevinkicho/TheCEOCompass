import { test, expect } from "@playwright/test"

/**
 * Scenario / frameworks smoke under the Google auth gate.
 * Without sign-in, asserts flash-login. With session, asserts product shells.
 * Uses relative paths (playwright.config baseURL on :33221).
 */

async function landed(page: import("@playwright/test").Page) {
  await expect
    .poll(
      async () => {
        const flash = (await page.getByTestId("flash-login").count()) > 0
        const google =
          (await page.getByRole("button", { name: /Continue with Google/i }).count()) > 0
        const boot = (await page.getByTestId("app-shell-status").count()) > 0
        const content =
          (await page.getByRole("heading").count()) > 0 ||
          (await page.locator("main").count()) > 0
        return flash || google || boot || content ? 1 : 0
      },
      { timeout: 45_000 },
    )
    .toBe(1)
}

test("scenario deep link: gate or scenario shell", async ({ page }) => {
  await page.goto("/scenarios/runway-unit-economics-crisis")
  await landed(page)

  const flash = page.getByTestId("flash-login")
  if ((await flash.count()) > 0) {
    await expect(flash).toBeVisible()
    return
  }

  // Signed-in: context or start affordance
  await expect
    .poll(async () => {
      return (
        (await page.getByText(/Context|Start Scenario|Stage/i).count()) +
        (await page.getByRole("heading").count())
      )
    }, { timeout: 30_000 })
    .toBeGreaterThan(0)
})

test("frameworks page: gate or framework list", async ({ page }) => {
  await page.goto("/frameworks")
  await landed(page)

  if ((await page.getByTestId("flash-login").count()) > 0) {
    await expect(page.getByTestId("flash-login")).toBeVisible()
    return
  }

  await expect(page.getByText(/Frameworks/i).first()).toBeVisible({ timeout: 30_000 })
})

test("home: gate or product home", async ({ page }) => {
  await page.goto("/")
  await landed(page)

  if ((await page.getByTestId("flash-login").count()) > 0) {
    await expect(
      page.getByRole("button", { name: /Continue with Google/i }),
    ).toBeVisible()
    return
  }

  await expect(
    page.getByText(/Navigate Every|Think Like|Scenario|Framework/i).first(),
  ).toBeVisible({ timeout: 30_000 })
})
