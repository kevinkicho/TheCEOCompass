import { test, expect } from "@playwright/test"

test("diagnose AI concept explanation", async ({ page }) => {
  test.setTimeout(180000)

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      console.log(`[${msg.type()}] ${msg.text()}`)
    }
  })

  await page.goto("/frameworks/strategic-decision-making")
  await expect(page.locator("h1")).toContainText("Strategic Decision-Making")
  console.log("✓ Page loaded")

  const conceptButton = page.getByText("First Principles Thinking").first()
  await expect(conceptButton).toBeVisible({ timeout: 5000 })
  await conceptButton.click()
  console.log("✓ Concept button clicked")
  await page.waitForTimeout(500)

  // The button text may be "Explain Further with AI" or "Re-generate with AI"
  // Wait for any button that starts with "Explain" or "Re-generate"
  const aiButton = page.locator("button").filter({ hasText: /Explain|Re-generate/ }).first()
  await expect(aiButton).toBeVisible({ timeout: 10000 })
  await aiButton.click()
  console.log("✓ Clicked AI button")

  await expect(page.locator("button").filter({ hasText: /Generating/ })).toBeVisible({ timeout: 10000 })
  console.log("✓ Request sent to Firebase, waiting for Ollama...")

  const ceoInsight = page.locator("text=CEO Insight").last()
  await expect(ceoInsight).toBeVisible({ timeout: 90000 })
  console.log("✓ CEO Insight received from AI")

  await expect(page.locator("text=Common Mistake")).toBeVisible({ timeout: 5000 })
  await expect(page.locator("text=Quick Tip")).toBeVisible({ timeout: 5000 })
  console.log("✓ All AI explanation sections present")
})
