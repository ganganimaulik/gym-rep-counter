import { test, expect } from '@playwright/test'

test.describe('Gym Rep Counter E2E Tests', () => {
  test.beforeAll(async ({ request }) => {
    // Wait up to 10 seconds for the emulators to become ready
    for (let i = 0; i < 10; i++) {
      try {
        const response = await request.get('http://127.0.0.1:4000/')
        if (response.ok()) {
          break
        }
      } catch (e) {
        // Ignore and wait
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  })

  test.beforeEach(async ({ page, request }) => {
    // Clear Firestore emulator database
    try {
      await request.delete(
        'http://127.0.0.1:8080/emulator/v1/projects/gym-rep-counter/databases/(default)/documents',
      )
    } catch (e) {
      console.warn('Failed to clear firestore emulator', e)
    }

    // Clear Auth emulator database
    try {
      await request.delete(
        'http://127.0.0.1:9099/emulator/v1/projects/gym-rep-counter/accounts',
      )
    } catch (e) {
      console.warn('Failed to clear auth emulator', e)
    }

    // Load page and clear local storage to ensure clean state
    await page.goto('/')
    await page.evaluate(() => window.localStorage.clear())
    await page.reload()
  })

  test('1. Bottom Tab Bar Navigation', async ({ page }) => {
    // We should be on Workout tab initially (shows Select a workout)
    await expect(page.getByText('Current Workout')).toBeVisible()

    // Navigate to Routines
    await page.getByText('Routines', { exact: true }).click()
    await expect(page.getByText('Create Routine')).toBeVisible()

    // Navigate to History
    await page.getByText('History', { exact: true }).click()
    await expect(
      page.getByText('No workout history yet. Complete a set to get started!'),
    ).toBeVisible()

    // Navigate to Analytics
    await page.getByText('Analytics', { exact: true }).click()
    // Default sub-tab is Health & TDEE. Let's switch to Workout Trends
    await page.getByText('Workout Trends').click()
    await expect(page.getByText('Activity Streak')).toBeVisible()

    // Navigate to Journal
    await page.getByText('Journal', { exact: true }).click()
    await expect(page.getByText('JOURNAL', { exact: true })).toBeVisible()

    // Navigate to Settings
    await page.getByText('Settings', { exact: true }).click()
    await expect(page.getByText('Timer Intervals')).toBeVisible()
  })

  test('2. Workout Screen - Routine selection, skipping sets validation, and timers', async ({
    page,
  }) => {
    // 1. Pick a workout
    await page.getByText('Select a workout...').click()
    await page.getByText('Day 1 (Lower)').click()

    // Verify Active Exercise card info
    await expect(page.getByText('Active Exercise')).toBeVisible()
    await expect(page.getByText('Leg Press')).toBeVisible()
    await expect(page.getByText('Target: 10 Reps')).toBeVisible()
    await expect(page.getByText('Exercise 1 of 5')).toBeVisible()

    // 2. Try to tap Set 2 before completing Set 1 to test validation
    await page.getByText('2', { exact: true }).first().click()
    await expect(page.getByText('Cannot Skip Sets')).toBeVisible()

    // 3. Start Workout
    await page.getByText('Start Workout').click()

    // Circle should now show countdown phase
    await expect(page.getByText('Tap circle to add +5 seconds')).toBeVisible()

    // Tap the circle to add time
    await page.getByText('Tap circle to add +5 seconds').click()

    // Test Control Buttons (Pause/Resume/Reset)
    await page.getByText('Pause').click()
    await expect(page.getByText('Resume')).toBeVisible()
    await expect(page.getByText('Reset')).toBeVisible()

    await page.getByText('Resume').click()
    await expect(page.getByText('Pause')).toBeVisible()

    await page.getByText('Reset').click()
    await expect(page.getByText('Start Workout')).toBeVisible()
  })

  test('3. Workout Screen - Logging a completed set', async ({ page }) => {
    // Pick workout
    await page.getByText('Select a workout...').click()
    await page.getByText('Day 1 (Lower)').click()

    // Start workout
    await page.getByText('Start Workout').click()

    // Complete the set immediately
    await page.getByText('End Set').click()

    // Set Complete Modal (AddSetDetailsModal) should pop up
    await expect(page.getByText('Set Complete')).toBeVisible()

    // Fill reps and weight
    await page.locator('[data-testid="reps-input"]').fill('12')
    await page.locator('[data-testid="weight-input"]').fill('80')

    // Save details
    await page.getByRole('button', { name: 'Save' }).click()

    // Verify modal is dismissed
    await expect(page.getByText('Set Complete')).not.toBeVisible()

    // The set circle for 1 should now be styled as completed (no longer clickable set number text 1)
    // Wait, the Rest phase timer should start
    await expect(page.getByText('Skip Rest')).toBeVisible()
  })

  test('4. Routines Screen - Create, Edit, and Delete Routines', async ({
    page,
  }) => {
    await page.getByText('Routines', { exact: true }).click()

    // Create routine
    await page
      .getByPlaceholder('Routine name (e.g. Chest & Triceps)')
      .fill('Chest Day')
    await page.getByText('Create', { exact: true }).click()

    // Verify routine card exists
    await expect(page.getByText('Chest Day')).toBeVisible()

    // Add exercise to routine
    const chestDayCard = page
      .locator('div.rounded-2xl', { hasText: 'Chest Day' })
      .last()
    await chestDayCard.getByPlaceholder('Exercise name').fill('Bench Press')
    await chestDayCard.getByText('Add Exercise').click()

    // Verify exercise is added to the routine
    await expect(page.getByText('1. Bench Press')).toBeVisible()

    // Open Edit Exercise modal by tapping the exercise card
    await page.getByText('1. Bench Press').click()
    await expect(page.getByText('Edit Exercise')).toBeVisible()

    // Change name, sets to 4, and reps to 10
    await page
      .locator('[data-testid="edit-exercise-name"]')
      .fill('Incline Bench Press')
    await page.locator('[data-testid="edit-exercise-sets"]').fill('4')
    await page.locator('[data-testid="edit-exercise-reps"]').fill('10')
    await page.getByText('Save', { exact: true }).click()

    // Verify updated values in the list
    await expect(chestDayCard.getByText('1. Incline Bench Press')).toBeVisible()
    await expect(chestDayCard.getByText('4 sets × 10 reps')).toBeVisible()

    // Delete Exercise
    await chestDayCard.locator('[data-testid="delete-exercise-button"]').click()

    // Verify it is gone
    await expect(page.getByText('1. Incline Bench Press')).not.toBeVisible()
  })

  test('5. History Screen - Edit and delete entries', async ({ page }) => {
    // First, let's log a set so we have something in the history
    await page.getByText('Select a workout...').click()
    await page.getByText('Day 1 (Lower)').click()
    await page.getByText('Start Workout').click()
    await page.getByText('End Set').click()
    await page.locator('[data-testid="reps-input"]').fill('10')
    await page.locator('[data-testid="weight-input"]').fill('95')
    await page.getByRole('button', { name: 'Save' }).click()

    // Navigate to History screen
    await page.getByText('History', { exact: true }).click()

    // Log card should be visible
    await expect(page.getByText('Leg Press')).toBeVisible()
    await expect(page.getByText('10 reps @ 95 kg')).toBeVisible()

    // Click the log card to open Edit History modal
    await page.getByText('10 reps @ 95 kg').click()
    await expect(page.getByText('Edit Set Log')).toBeVisible()

    // Modify reps and weight inside the Edit Set Log modal
    await page.locator('[data-testid="edit-log-reps"]').fill('12')
    await page.locator('[data-testid="edit-log-weight"]').fill('100')
    await page.getByTestId('edit-log-save-button').click()

    // Check if values updated in History
    await expect(page.getByText('12 reps @ 100 kg')).toBeVisible()

    // Reopen modal to delete entry
    await page.getByText('12 reps @ 100 kg').click()
    await page.getByText('Delete Entry').click()

    // Verify it is gone
    await expect(page.getByText('12 reps @ 100 kg')).not.toBeVisible()
  })

  test('6. Analytics Screen - Health & TDEE setup and daily stats logging', async ({
    page,
  }) => {
    await page.getByText('Analytics', { exact: true }).click()

    // Switch to Health & TDEE sub-tab
    await page.getByText('Health & TDEE').click()

    // Config form should be visible since TDEE config doesn't exist yet
    await expect(page.getByText('Weight Unit')).toBeVisible()

    // Fill measurements using testIDs
    await page.locator('[data-testid="setup-height"]').fill('175')
    await page.locator('[data-testid="setup-waist"]').fill('82')
    await page.locator('[data-testid="setup-neck"]').fill('38')

    // Click Start Tracking
    await page.getByText('Start Tracking').click()

    // Dashboard metrics card should be visible now
    await expect(page.getByText('Your TDEE')).toBeVisible()

    // Log Daily Stats
    await page.getByText('Log Weight / Calories', { exact: true }).click()
    await expect(page.getByText('Log Daily Stats')).toBeVisible()

    await page.locator('[data-testid="health-weight-input"]').fill('76.5')
    await page.locator('[data-testid="health-calories-input"]').fill('2450')
    await page.getByText('Save', { exact: true }).click()

    // Verify stats appear in breakdown table
    await expect(page.getByText('76.5 kg')).toBeVisible()
    await expect(page.getByText('2450 Cal')).toBeVisible()
  })

  test('7. Journal Screen - Diary and supplements tracking', async ({
    page,
  }) => {
    await page.getByText('Journal', { exact: true }).click()

    // Open note modal
    await page.locator('[data-testid="add-journal-note-button"]').click()
    await expect(page.getByPlaceholder('How did you feel today?')).toBeVisible()

    // Enter note body
    await page
      .getByPlaceholder('How did you feel today?')
      .fill('Smashed heavy squats!')

    // Add supplement details
    await page.getByPlaceholder('Search/Add Supp...').fill('Protein Shake')
    await page.getByPlaceholder('Dosage').fill('30g')
    await page.locator('[data-testid="add-supplement-button"]').click()

    // Suggestions box fill test: Focus input first to show popular list
    await page.getByPlaceholder('Search/Add Supp...').click()
    await page.locator('text=Creatine').first().click()
    await page.locator('[data-testid="add-supplement-button"]').click()

    // Save note
    await page.getByText('Save').click()

    // Verify note is created
    await expect(page.getByText('Smashed heavy squats!')).toBeVisible()
    await expect(page.getByText('Protein Shake')).toBeVisible()
    await expect(page.getByText('Creatine')).toBeVisible()
  })

  test('8. Settings Screen - Timer settings and Firebase Emulator Cloud Sync', async ({
    page,
  }) => {
    await page.getByText('Settings', { exact: true }).click()

    // Test Interval Settings Inputs
    await page.locator('[data-testid="setting-countdown"]').fill('5')
    await page.locator('[data-testid="setting-rest"]').fill('15')
    await page.getByText('Save Changes').click()

    // Verify settings updated and saved locally (by reloading page and navigating back)
    await page.reload()
    await page.getByText('Settings', { exact: true }).click()
    await expect(page.locator('[data-testid="setting-countdown"]')).toHaveValue(
      '5',
    )
    await expect(page.locator('[data-testid="setting-rest"]')).toHaveValue('15')

    // Test Mock Cloud Sync Backdoor
    await expect(page.getByTestId('mock-login-button')).toBeVisible()
    await page.getByTestId('mock-login-button').click()

    // User profile card should now be visible and display logged-in test user credentials
    await expect(page.getByText('test@example.com')).toBeVisible()
    await expect(page.getByTestId('disconnect-button')).toBeVisible()
  })

  test('9. Routines Screen - Deleting Workout Routine', async ({ page }) => {
    await page.getByText('Routines', { exact: true }).click()

    // Create routine
    await page
      .getByPlaceholder('Routine name (e.g. Chest & Triceps)')
      .fill('Leg Day')
    await page.getByText('Create', { exact: true }).click()

    // Verify routine card exists
    await expect(page.getByText('Leg Day')).toBeVisible()

    // Delete the routine using the delete-workout-button
    const legDayCard = page
      .locator('div.rounded-2xl', { hasText: 'Leg Day' })
      .last()
    await legDayCard.locator('[data-testid="delete-workout-button"]').click()

    // Verify it is deleted
    await expect(page.getByText('Leg Day')).not.toBeVisible()
  })

  test('10. Analytics Screen - Workout Trends, PR Table, and Exercise Trends Picker', async ({
    page,
  }) => {
    // 1. Log a set so we have records in Workout Trends
    await page.getByText('Select a workout...').click()
    await page.getByText('Day 1 (Lower)').click()
    await page.getByText('Start Workout').click()
    await page.getByText('End Set').click()
    await page.locator('[data-testid="reps-input"]').fill('8')
    await page.locator('[data-testid="weight-input"]').fill('110')
    await page.getByRole('button', { name: 'Save' }).click()

    // 2. Navigate to Analytics -> Workout Trends
    await page.getByText('Analytics', { exact: true }).click()
    await page.getByText('Workout Trends').click()

    // Verify streak updated
    await expect(page.getByTestId('streak-current-count')).toHaveText('1')

    // Verify Personal Records table shows Leg Press
    const prCard = page
      .locator('div.rounded-2xl', { hasText: 'Personal Records' })
      .last()
    await expect(prCard.getByText('Leg Press')).toBeVisible()
    await expect(prCard.getByText('110 kg')).toBeVisible()

    // Verify Exercise Trends dropdown can select the exercise
    const picker = page.locator('[data-testid="trends-exercise-picker"]')
    await expect(picker).toBeVisible()
    await picker.selectOption({ label: 'Leg Press' })
  })

  test('11. Analytics Screen - Health Goal Projections, Preferences, and Weekly Averages', async ({
    page,
  }) => {
    await page.getByText('Analytics', { exact: true }).click()
    await page.getByText('Health & TDEE').click()

    // Complete physical setup
    await page.locator('[data-testid="setup-height"]').fill('178')
    await page.locator('[data-testid="setup-waist"]').fill('85')
    await page.locator('[data-testid="setup-neck"]').fill('39')
    await page.getByText('Start Tracking').click()

    // Log weight & calories daily stats so we have a current weight
    await page.getByText('Log Weight / Calories', { exact: true }).click()
    await page.locator('[data-testid="health-weight-input"]').fill('80')
    await page.locator('[data-testid="health-calories-input"]').fill('2500')
    await page.getByText('Save', { exact: true }).click()

    // Update goals
    await page.locator('[data-testid="goal-weight-input"]').fill('70')
    await page.locator('[data-testid="goal-rate-input"]').fill('0.5')
    await page.locator('[data-testid="update-goal-button"]').click()

    // Verify calculated projections (e.g. Goal Calories should show up)
    await expect(
      page.getByText('Calculated Targets & Projections'),
    ).toBeVisible()
    await expect(page.getByText('Goal Calories')).toBeVisible()

    // Expand Preferences & Body Fat
    await page.locator('[data-testid="preferences-expand-button"]').click()
    await expect(page.getByText('Save Preferences')).toBeVisible()

    // Modify height in preferences and save
    await page.locator('[data-testid="pref-height"]').fill('180')
    await page.locator('[data-testid="save-preferences-button"]').click()

    // Navigate to Weekly Average tab
    await page.locator('[data-testid="weekly-average-tab"]').click()
    await expect(page.getByText('Weekly Average')).toBeVisible()
  })

  test('12. Journal Screen - Note editing and deletion lifecycle', async ({
    page,
  }) => {
    await page.getByText('Journal', { exact: true }).click()

    // Add note
    await page.locator('[data-testid="add-journal-note-button"]').click()
    await page
      .getByPlaceholder('How did you feel today?')
      .fill('Felt strong today')
    await page.locator('[data-testid="journal-note-save-button"]').click()

    // Verify note is created
    await expect(page.getByText('Felt strong today')).toBeVisible()

    // Click note to edit
    await page.getByText('Felt strong today').click()
    await expect(page.getByPlaceholder('How did you feel today?')).toHaveValue(
      'Felt strong today',
    )

    // Modify note text and add supplement
    await page
      .getByPlaceholder('How did you feel today?')
      .fill('Felt strong today - updated')
    await page.getByPlaceholder('Search/Add Supp...').fill('Omega 3')
    await page.getByPlaceholder('Dosage').fill('1000mg')
    await page.locator('[data-testid="add-supplement-button"]').click()
    await page.locator('[data-testid="journal-note-save-button"]').click()

    // Verify updated details
    await expect(page.getByText('Felt strong today - updated')).toBeVisible()
    await expect(page.getByText('Omega 3')).toBeVisible()

    // Reopen note to delete it
    await page.getByText('Felt strong today - updated').click()
    await page.locator('[data-testid="journal-note-delete-button"]').click()

    // Verify note is deleted
    await expect(
      page.getByText('Felt strong today - updated'),
    ).not.toBeVisible()
  })

  test('13. Settings Screen - Toggles, bedtime adjustment controls, and logout', async ({
    page,
  }) => {
    await page.getByText('Settings', { exact: true }).click()

    // Toggle Eccentric voice switch
    const eccentricSwitch = page.locator(
      '[data-testid="toggle-eccentric-voice"]',
    )
    await expect(eccentricSwitch).toBeVisible()
    await eccentricSwitch.click()

    // Toggle Auto-Sleep off to show manual sleep controls
    const autoSleepSwitch = page.locator('[data-testid="toggle-auto-sleep"]')
    await expect(autoSleepSwitch).toBeVisible()
    await autoSleepSwitch.click()

    // Verify manual sleep settings title is visible
    await expect(page.getByText('Manual Sleep Settings')).toBeVisible()

    // Test quiet bedtime adjustments (+/- buttons)
    const sleepStartText = page.locator('[data-testid="sleep-start-text"]')
    await expect(sleepStartText).toHaveText('11:00 PM')
    await page.locator('[data-testid="sleep-start-minus"]').click()
    await expect(sleepStartText).toHaveText('10:00 PM')

    const sleepEndText = page.locator('[data-testid="sleep-end-text"]')
    await expect(sleepEndText).toHaveText('7:00 AM')
    await page.locator('[data-testid="sleep-end-plus"]').click()
    await expect(sleepEndText).toHaveText('8:00 AM')

    // Click Save changes
    await page.getByText('Save Changes').click()

    // Verify changes persisted after page reload
    await page.reload()
    await page.getByText('Settings', { exact: true }).click()
    await expect(page.locator('[data-testid="sleep-start-text"]')).toHaveText(
      '10:00 PM',
    )
    await expect(page.locator('[data-testid="sleep-end-text"]')).toHaveText(
      '8:00 AM',
    )

    // Sign in and test Disconnect Account
    await page.getByTestId('mock-login-button').click()
    await expect(page.getByText('test@example.com')).toBeVisible()
    await page.getByTestId('disconnect-button').click()
    await expect(page.getByText('test@example.com')).not.toBeVisible()
    await expect(page.getByText('Sign in with Google')).toBeVisible()
  })

  test('14. Journal Screen - Supplement schedule configuration and status panel', async ({
    page,
  }) => {
    await page.getByText('Journal', { exact: true }).click()

    // Initially, no supplement status panel should be visible
    // (default supplements have no schedule set)
    await expect(
      page.locator('[data-testid="supplement-status-panel"]'),
    ).not.toBeVisible()

    // Open note modal to access supplement suggestions
    await page.locator('[data-testid="add-journal-note-button"]').click()
    await expect(page.getByPlaceholder('How did you feel today?')).toBeVisible()

    // Focus the search input to show popular supplements
    await page.getByPlaceholder('Search/Add Supp...').click()
    await expect(page.locator('text=Popular Supplements').first()).toBeVisible()

    // Tap "Manage" to open the Manage Supplements modal
    await page
      .locator('[data-testid="manage-supplements-button"]')
      .dispatchEvent('click')

    // Manage modal should be visible
    await expect(page.getByText('Manage Supplements')).toBeVisible()

    // Tap Creatine to expand its schedule options
    await page
      .locator('[data-testid="manage-supplement-Creatine"]')
      .dispatchEvent('click')
    await expect(
      page.locator('[data-testid="schedule-option-none"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="schedule-option-daily"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="schedule-option-specific_days"]'),
    ).toBeVisible()
    await expect(
      page.locator('[data-testid="schedule-option-every_other_day"]'),
    ).toBeVisible()

    // Select "Daily" schedule
    await page
      .locator('[data-testid="schedule-option-daily"]')
      .dispatchEvent('click')

    // Close the manage modal
    await page
      .locator('[data-testid="close-manage-modal"]')
      .dispatchEvent('click')

    // Close the note modal
    await page.getByText('Cancel').click()

    // Now the supplement status panel should be visible
    await expect(
      page.locator('[data-testid="supplement-status-panel"]'),
    ).toBeVisible()
    await expect(page.getByText("Today's Supplements")).toBeVisible()

    // Creatine should be shown as untaken (since we haven't logged it yet)
    await expect(
      page.locator('[data-testid="supplement-status-creatine"]'),
    ).toBeVisible()

    // Journal reminder badge should be visible (no entry for today yet)
    await expect(
      page.locator('[data-testid="journal-reminder-badge"]'),
    ).toBeVisible()
  })
})
