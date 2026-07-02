import { test, expect } from '@playwright/test'

test.describe('Analytics Screen', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage for a clean setup
    await page.addInitScript(() => {
      window.localStorage.clear()
    })
    await page.goto('http://localhost:8081')
    await page.waitForTimeout(2000)
    await page.click('div[data-testid="tab-analytics"]')
    await page.waitForTimeout(1000)
  })

  test('should render analytics screen and setup TDEE (Male)', async ({
    page,
  }) => {
    await expect(page.locator('text=Workout Trends').first()).toBeVisible()
    await expect(page.locator('text=Health & TDEE').first()).toBeVisible()

    // Switch to Health & TDEE tab
    await page.click('text=Health & TDEE')
    await page.waitForTimeout(1000)

    // Default state: Start Tracking
    await expect(page.locator('text=Start Tracking').first()).toBeVisible()

    // Fill setup inputs using testIDs
    await page.locator('[data-testid="setup-height"]').fill('180')
    await page.locator('[data-testid="setup-waist"]').fill('80')
    await page.locator('[data-testid="setup-neck"]').fill('37')
    await page.click('text=Start Tracking')

    // Should now show TDEE UI, which contains something like 'Log'
    await expect(page.locator('text=Log').first()).toBeVisible()
  })

  test('should setup TDEE with female gender (which requires hips)', async ({
    page,
  }) => {
    await page.click('text=Health & TDEE')
    await page.waitForTimeout(1000)

    // Toggle gender to Female
    await page.locator('[data-testid="setup-gender"]').selectOption('female')

    // Check that Hips input is visible
    await expect(page.locator('[data-testid="setup-hips"]')).toBeVisible()

    // Fill setup inputs for female
    await page.locator('[data-testid="setup-height"]').fill('165')
    await page.locator('[data-testid="setup-waist"]').fill('75')
    await page.locator('[data-testid="setup-neck"]').fill('34')
    await page.locator('[data-testid="setup-hips"]').fill('95')

    await page.click('text=Start Tracking')

    // Verify it started tracking (should see "Your TDEE" or "Log Weight / Calories")
    await expect(page.locator('text=Your TDEE').first()).toBeVisible()
  })

  test('should log, edit, and delete daily stats', async ({ page }) => {
    // 1. Setup TDEE first
    await page.click('text=Health & TDEE')
    await page.waitForTimeout(1000)
    await page.locator('[data-testid="setup-height"]').fill('175')
    await page.locator('[data-testid="setup-waist"]').fill('82')
    await page.locator('[data-testid="setup-neck"]').fill('38')
    await page.click('text=Start Tracking')

    // 2. Open Log Modal
    await page.click('text=Log Weight / Calories')
    await expect(page.locator('text=Log Daily Stats')).toBeVisible()

    // 3. Fill and Save stats
    await page.locator('[data-testid="health-weight-input"]').fill('78.5')
    await page.locator('[data-testid="health-calories-input"]').fill('2200')
    await page.click('text=Save')

    // 4. Verify they appear in the log list
    await expect(page.locator('text=78.5 kg').first()).toBeVisible()
    await expect(page.locator('text=2200 Cal').first()).toBeVisible()

    // 5. Click the entry to edit it (opens modal in edit mode)
    await page.locator('text=78.5 kg').first().click()
    await expect(page.locator('text=Edit Daily Stats')).toBeVisible()

    // 6. Change weight and save
    await page.locator('[data-testid="health-weight-input"]').fill('79.2')
    await page.click('[data-testid="save-health-button"]')

    // Verify updated weight appears
    await expect(page.locator('text=79.2 kg').first()).toBeVisible()

    // 7. Click again to delete the log
    await page.locator('text=79.2 kg').first().click()
    await page.click('[data-testid="delete-health-button"]')

    // Verify it is removed
    await expect(page.locator('text=79.2 kg')).not.toBeVisible()
  })

  test('should support switching chart timeframes and display appropriate warnings', async ({
    page,
  }) => {
    // 1. Setup TDEE first
    await page.click('text=Health & TDEE')
    await page.waitForTimeout(1000)
    await page.locator('[data-testid="setup-height"]').fill('175')
    await page.locator('[data-testid="setup-waist"]').fill('82')
    await page.locator('[data-testid="setup-neck"]').fill('38')
    await page.click('text=Start Tracking')

    // 2. Since TDEE tab is active by default, verify weekly timeframe buttons are visible
    await expect(page.locator('[data-testid="timeframe-4w"]')).toBeVisible()
    await expect(page.locator('[data-testid="timeframe-12w"]')).toBeVisible()
    await expect(page.locator('[data-testid="timeframe-6m"]')).toBeVisible()
    await expect(
      page.locator('[data-testid="timeframe-all-weekly"]'),
    ).toBeVisible()

    // 3. Switch to Weight chart tab
    await page.locator('[data-testid="chart-tab-weight"]').click()

    // 4. Verify daily timeframe buttons are visible
    await expect(page.locator('[data-testid="timeframe-7d"]')).toBeVisible()
    await expect(page.locator('[data-testid="timeframe-30d"]')).toBeVisible()
    await expect(page.locator('[data-testid="timeframe-90d"]')).toBeVisible()
    await expect(page.locator('[data-testid="timeframe-all"]')).toBeVisible()

    // 5. By default (7 Days selected), since we have 0 logs, it should show the warning
    await expect(
      page
        .locator(
          'text=Need at least 2 entries in the selected timeframe to display weight progress chart.',
        )
        .first(),
    ).toBeVisible()

    // 6. Switch timeframes and verify warning still displays properly
    await page.locator('[data-testid="timeframe-30d"]').click()
    await expect(
      page
        .locator(
          'text=Need at least 2 entries in the selected timeframe to display weight progress chart.',
        )
        .first(),
    ).toBeVisible()

    // 7. Switch to Calories tab and verify warning
    await page.locator('[data-testid="chart-tab-calories"]').click()
    await expect(
      page
        .locator(
          'text=Need at least 2 entries in the selected timeframe to display calorie progress chart.',
        )
        .first(),
    ).toBeVisible()

    // 8. Switch to TDEE tab and verify warning
    await page.locator('[data-testid="chart-tab-tdee"]').click()
    await expect(
      page
        .locator(
          'text=Need at least 2 weeks of calculation data in the selected timeframe to display TDEE trend chart.',
        )
        .first(),
    ).toBeVisible()
  })
})
