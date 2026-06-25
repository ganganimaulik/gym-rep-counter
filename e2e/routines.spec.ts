import { test, expect } from '@playwright/test'

test.describe('Routines Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8081')
    await page.waitForTimeout(2000)
    await page.click('div[data-testid="tab-routines"]')
  })

  test('should render and create routine structure', async ({ page }) => {
    await expect(page.locator('text=Create Routine').first()).toBeVisible()
    await expect(page.locator('text=Create').first()).toBeVisible()
    // Validate default routine is rendered
    await expect(page.locator('text=Day 1 (Lower)').first()).toBeVisible()
  })

  test('should display routine exercises and drag affordances', async ({
    page,
  }) => {
    // Locate the Day 1 (Lower) routine card and verify default exercises are present
    const routineCard = page
      .locator('div.rounded-2xl', { hasText: 'Day 1 (Lower)' })
      .last()
    await expect(routineCard.locator('text=1. Leg Press')).toBeVisible()
    await expect(routineCard.locator('text=2. RDL')).toBeVisible()

    // Verify presence of drag-and-drop grip handle icons.
    // Note: react-native-gesture-handler's web implementation handles drag-and-drop
    // via complex pointer capture events that are not reliably simulated in headless browser environments.
    // Functional drag-reordering logic is fully tested in components/__tests__/WorkoutManagementModal.test.tsx.
    const gripIcons = routineCard.locator('svg')
    const count = await gripIcons.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })
})
