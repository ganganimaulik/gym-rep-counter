import { test, expect } from '@playwright/test'

test.describe('Export Data Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8081')
    await page.waitForTimeout(2000)
    await page.click('div[data-testid="tab-journal"]')
    await page.waitForTimeout(1000)
  })

  test('should open export modal, allow selecting ranges, and copy data to clipboard', async ({
    page,
  }) => {
    await expect(page.locator('text=JOURNAL').first()).toBeVisible()

    // Click the export button in header
    await page.locator('[data-testid="export-journal-button"]').click()
    await expect(page.locator('text=EXPORT DATA').first()).toBeVisible()

    // Select range options
    await page.locator('[data-testid="export-range-3m"]').click()
    await page.locator('[data-testid="export-range-6m"]').click()
    await page.locator('[data-testid="export-range-custom"]').click()
    await expect(
      page.locator('[data-testid="export-start-date-input"]').first(),
    ).toBeVisible()

    // Switch back to 1m
    await page.locator('[data-testid="export-range-1m"]').click()

    // Click copy button
    await page.locator('[data-testid="copy-export-button"]').click()
    await expect(
      page.locator('text=COPIED TO CLIPBOARD!').first(),
    ).toBeVisible()

    // Close modal
    await page.locator('[data-testid="close-export-modal-button"]').click()
    await expect(page.locator('text=EXPORT DATA')).not.toBeVisible()
  })
})
