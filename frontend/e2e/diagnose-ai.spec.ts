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
  await page.waitForTimeout(300)

  const modal = page.locator(".fixed.inset-0")
  await expect(modal).toBeVisible({ timeout: 5000 })
  console.log("✓ Modal visible")

  const explainButton = modal.getByRole("button", { name: /Explain Further with AI/i })
  await expect(explainButton).toBeVisible({ timeout: 5000 })
  await explainButton.click()
  console.log("✓ Clicked Explain Further with AI")

  await expect(modal.getByText(/Generating/)).toBeVisible({ timeout: 10000 })
  console.log("✓ Request sent to Firebase, waiting for Ollama...")

  // Wait for the AI explanation card with heading "CEO Insight"
  // This is only rendered by the AI result, not static content
  const ceoInsight = page.locator("text=CEO Insight").last()
  await expect(ceoInsight).toBeVisible({ timeout: 90000 })
  console.log("✓ CEO Insight received from AI")

  await expect(page.locator("text=Common Mistake")).toBeVisible({ timeout: 5000 })
  await expect(page.locator("text=Quick Tip")).toBeVisible({ timeout: 5000 })
  console.log("✓ All AI explanation sections present")
})
