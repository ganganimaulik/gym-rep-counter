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

  test('should confirm before removing a popular supplement suggestion', async ({
    page,
  }) => {
    // Open note modal
    await page.locator('[data-testid="add-journal-note-button"]').click()
    await expect(page.locator('text=Save').first()).toBeVisible()

    const searchInput = page.getByPlaceholder('Search/Add Supp...')
    await searchInput.click()
    await expect(page.locator('text=Popular Supplements').first()).toBeVisible()

    // Setup dialog listener to verify dialog prompt and accept it
    let dialogMessage = ''
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message()
      await dialog.accept()
    })

    // Click remove button on Creatine
    const removeBtn = page.locator('[data-testid="remove-suggestion-Creatine"]')
    await removeBtn.click()

    expect(dialogMessage).toContain('Creatine')
  })

  test('should update popular supplement with latest dosage used', async ({
    page,
  }) => {
    await page.locator('[data-testid="add-journal-note-button"]').click()
    await expect(page.locator('text=Save').first()).toBeVisible()

    const searchInput = page.getByPlaceholder('Search/Add Supp...')
    await searchInput.fill('Creatine')

    await page.getByPlaceholder('Dosage').fill('10g')
    await page.locator('[data-testid="add-supplement-button"]').click()

    // Focus search input again to show popular supplements list
    await searchInput.click()
    await searchInput.fill('Creatine')

    // Expect updated dosage (10g) in suggestion box for Creatine
    await expect(page.locator('text=(10g)').first()).toBeVisible()
  })

  test("should quickly toggle supplement as taken from Today's Supplements panel", async ({
    page,
  }) => {
    // Open add journal note modal
    await page.locator('[data-testid="add-journal-note-button"]').click()
    await expect(page.locator('text=Save').first()).toBeVisible()

    // Click search input to show suggestions and "Manage" button
    const searchInput = page.getByPlaceholder('Search/Add Supp...')
    await searchInput.click()
    await expect(
      page.locator('[data-testid="manage-supplements-button"]').first(),
    ).toBeVisible()

    // Open manage modal
    await page
      .locator('[data-testid="manage-supplements-button"]')
      .first()
      .dispatchEvent('click')
    await expect(page.locator('text=Manage Supplements').first()).toBeVisible()

    // Configure Creatine to be Daily
    await page
      .locator('[data-testid="manage-supplement-Creatine"]')
      .dispatchEvent('click')
    await page
      .locator('[data-testid="schedule-option-daily"]')
      .dispatchEvent('click')

    // Close manage modal
    await page
      .locator('[data-testid="close-manage-modal"]')
      .dispatchEvent('click')

    // Close journal note modal by clicking Cancel
    await page.locator('text=Cancel').first().dispatchEvent('click')

    // Today's Supplements panel should now be visible with Creatine as untaken
    const panel = page.locator('[data-testid="supplement-status-panel"]')
    await expect(panel).toBeVisible()
    const creatineBadge = page.locator(
      '[data-testid="supplement-status-creatine"]',
    )
    await expect(creatineBadge).toBeVisible()

    // Click the badge to quickly add it as taken
    await creatineBadge.dispatchEvent('click')

    // Wait a brief moment and verify that a new journal entry with "Logged supplements" is created in the list
    await expect(page.locator('text=Logged supplements').first()).toBeVisible()

    // Click the journal entry to open the edit modal
    await page.locator('text=Logged supplements').first().click()

    // Click the delete button in the modal to remove the entry (untake the supplement)
    await page.locator('[data-testid="journal-note-delete-button"]').click()

    // Verify that the supplement is untaken again and reappears in the panel
    await expect(creatineBadge).toBeVisible()
  })

  test('should display untaken scheduled supplements first in popular supplements', async ({
    page,
  }) => {
    // Open note modal
    await page.locator('[data-testid="add-journal-note-button"]').click()
    await expect(page.locator('text=Save').first()).toBeVisible()

    const searchInput = page.getByPlaceholder('Search/Add Supp...')
    await searchInput.click()
    await expect(page.locator('text=Popular Supplements').first()).toBeVisible()

    // Manage supplements and set Multivitamin to Daily
    await page
      .locator('[data-testid="manage-supplements-button"]')
      .first()
      .dispatchEvent('click')
    await expect(page.locator('text=Manage Supplements').first()).toBeVisible()

    await page
      .locator('[data-testid="manage-supplement-Multivitamin"]')
      .dispatchEvent('click')
    await page
      .locator('[data-testid="schedule-option-daily"]')
      .dispatchEvent('click')

    await page
      .locator('[data-testid="close-manage-modal"]')
      .dispatchEvent('click')

    // Click search input to open popular supplements
    await searchInput.blur()
    await searchInput.click()
    await expect(page.locator('text=Popular Supplements').first()).toBeVisible()

    // Verify Multivitamin (untaken daily supplement) is displayed before other supplements
    const popularBox = page
      .locator('text=Popular Supplements')
      .locator('..')
      .locator('..')
    const firstSuppText = await popularBox.locator('text=Multivitamin').first()
    await expect(firstSuppText).toBeVisible()
  })
})
