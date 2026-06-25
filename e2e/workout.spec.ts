import { test, expect } from '@playwright/test';

test.describe('Workout Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage for a clean state
    await page.addInitScript(() => {
        window.localStorage.clear();
    });
    await page.goto('http://localhost:8081');
    await page.waitForTimeout(2000);
  });

  test('should test basic UI interactions', async ({ page }) => {
    // Current Workout is the header
    await expect(page.locator('text=Current Workout').first()).toBeVisible();

    // Test the workout picker opens
    const selectWorkout = page.locator('text=Select a workout...');
    if (await selectWorkout.isVisible()) {
      await selectWorkout.click();
      await page.waitForTimeout(500);
      await expect(page.locator('text=Day 1').first()).toBeVisible();
      await page.click('text=Cancel');
    }
  });
});
