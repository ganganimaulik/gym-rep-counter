import { test, expect } from '@playwright/test';

test.describe('Workout Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8081');
    await page.waitForTimeout(3000);
  });

  test('should render workout selector and exercise card', async ({ page }) => {
    await expect(page.locator('text=Current Workout').first()).toBeVisible();
    await expect(page.locator('text=Edit').first()).toBeVisible();

    // Check if Workout Picker is present
    await expect(page.locator('text=Select a workout...').first()).toBeVisible();
  });
});
