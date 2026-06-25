import { test, expect } from '@playwright/test'

test.describe('Journal Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8081')
    await page.waitForTimeout(2000)
    await page.click('div[data-testid="tab-journal"]')
    await page.waitForTimeout(1000)
  })

  test('should render journal screen and add entry', async ({ page }) => {
    await expect(page.locator('text=JOURNAL').first()).toBeVisible()

    // Click the add note button
    await page.locator('[data-testid="add-journal-note-button"]').click()
    await expect(page.locator('text=Save').first()).toBeVisible()

    // The modal should appear. We can type a note.
    await page.fill('textarea', 'My new test note')
    await page.click('text=Save')

    // Check if the note is added. Wait for the text to appear.
    await expect(page.locator('text=My new test note').first()).toBeVisible()
  })

  test('should filter supplement suggestions and add custom supplement', async ({
    page,
  }) => {
    // Open note modal
    await page.locator('[data-testid="add-journal-note-button"]').click()
    await expect(page.locator('text=Save').first()).toBeVisible()

    const searchInput = page.getByPlaceholder('Search/Add Supp...')

    // Focus/click search bar to show suggestion box
    await searchInput.click()
    await expect(page.locator('text=Popular Supplements').first()).toBeVisible()

    // Type partial supplement name to test autocomplete filter
    await searchInput.fill('Creat')

    // Suggestions box should show suggestions and show Creatine
    const suggestionsHeader = page.locator('text=Suggestions').first()
    await expect(suggestionsHeader).toBeVisible()
    await expect(page.locator('text=Creatine').first()).toBeVisible()

    // Type a non-existent supplement to test custom creation & no match message
    await searchInput.fill('MySpecialSupp')
    await expect(page.locator('text=No match.').first()).toBeVisible()

    // Fill dosage and click the "+" button to add custom
    await page.getByPlaceholder('Dosage').fill('1 pill')
    await page.locator('[data-testid="add-supplement-button"]').click()

    // Verify custom supplement tag is added to note modal
    await expect(page.locator('text=MySpecialSupp').first()).toBeVisible()
  })
})
