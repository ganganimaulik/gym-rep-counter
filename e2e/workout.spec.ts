import { test, expect } from '@playwright/test'

test.describe('Workout Screen Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8081')
    await page.waitForTimeout(3000)
  })

  test('should render workout selector and exercise card', async ({ page }) => {
    await expect(page.locator('text=Current Workout').first()).toBeVisible()
    await expect(page.locator('text=Edit').first()).toBeVisible()
    await expect(page.locator('text=Select a workout...').first()).toBeVisible()
  })

  test('should jump reps using RepJumper', async ({ page }) => {
    // Select workout
    await page.click('text=Select a workout...')
    await page.click('text=Day 1 (Lower)')

    // Click rep number 5 in Rep Jumper to jump reps
    const repButton = page
      .locator('[data-testid="rep-jumper-container"]')
      .locator('text=5')
      .first()
    await repButton.scrollIntoViewIfNeeded()
    await repButton.click()

    // The workout should start, and the active phase should be "Concentric"
    await expect(page.locator('text=Concentric').first()).toBeVisible()

    // The active rep display (an input containing "5") should be visible
    const repInput = page.locator('input[value="5"]').first()
    await expect(repInput).toBeVisible()
  })

  test('should jump sets using SetTracker', async ({ page }) => {
    // Select workout
    await page.click('text=Select a workout...')
    await page.click('text=Day 1 (Lower)')

    // Start workout
    await page.click('text=Start Workout')

    // End Set 1 immediately
    await page.click('text=End Set')

    // Fill Modal
    await page.locator('[data-testid="reps-input"]').fill('10')
    await page.locator('[data-testid="weight-input"]').fill('80')
    await page.getByRole('button', { name: 'Save' }).click()

    // Now we should be on Rest phase or Set 2
    // Click the set tracker button "1" (which is now completed) to jump back to Set 1
    await page.locator('[data-testid="set-tracker-button-1"]').click()

    // Since we jumped back to Set 1, it triggers countdown, so the phase becomes "Get Ready"
    await expect(page.locator('text=Get Ready').first()).toBeVisible()
  })

  test('should restore active workout after page reload', async ({ page }) => {
    // Select a workout
    await page.click('text=Select a workout...')
    await page.click('text=Day 1 (Lower)')

    // Verify the workout is selected — exercise name should be visible
    await expect(page.locator('text=Leg Press').first()).toBeVisible()

    // Verify activeWorkoutSession is saved in AsyncStorage
    const sessionBefore = await page.evaluate(() => {
      return localStorage.getItem('activeWorkoutSession')
    })
    expect(sessionBefore).not.toBeNull()

    // Reload the page (simulates app restart)
    await page.reload()
    await page.waitForTimeout(3000)

    // After reload, the same workout and exercise should be restored
    await expect(page.locator('text=Leg Press').first()).toBeVisible()
  })
})
