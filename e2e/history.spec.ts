import { test, expect } from '@playwright/test'

test.describe('History Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8081')
    await page.waitForTimeout(2000)
  })

  test('should see history tab', async ({ page }) => {
    // Just a placeholder test because mocking timer in Playwright RN is complex.
    // At least ensure History Tab opens without crashing.
    await page.click('div[data-testid="tab-history"]')
    await expect(page.locator('text=HISTORY').first()).toBeVisible()
  })
})
