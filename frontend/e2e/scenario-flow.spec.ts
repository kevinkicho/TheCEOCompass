import { test, expect } from "@playwright/test"

test("scenario flow: start, choose, see feedback", async ({ page }) => {
  await page.goto("http://localhost:3000/scenarios/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")

  // Should see context
  await expect(page.locator("text=Context")).toBeVisible()
  await expect(page.locator("text=Start Scenario")).toBeVisible()

  // Start scenario
  await page.click("text=Start Scenario")

  // Should see stage 1 with options
  await expect(page.locator("text=Stage 1")).toBeVisible()
  await expect(page.locator("text=Porter's Five Forces")).toBeVisible()

  // Select and submit
  await page.click("text=Porter's Five Forces")
  await page.click("text=Submit")

  // Should see feedback
  await expect(page.locator("text=AI Coach Feedback")).toBeVisible()
  await expect(page.locator("text=Continue")).toBeVisible()
})

test("frameworks page lists all frameworks", async ({ page }) => {
  await page.goto("http://localhost:3000/frameworks")

  await expect(page.locator("text=Frameworks")).toBeVisible()
  // Should have at least one framework card
  const cards = page.locator("text=min to learn")
  await expect(cards.first()).toBeVisible()
})

test("home page shows hero and frameworks", async ({ page }) => {
  await page.goto("http://localhost:3000")

  await expect(page.locator("text=Think Like a")).toBeVisible()
  await expect(page.locator("text=Try a Scenario")).toBeVisible()
  await expect(page.locator("text=Browse Frameworks")).toBeVisible()
})