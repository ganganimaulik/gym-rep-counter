import { test, expect } from '@playwright/test';

test.describe('Global Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8081');
    await page.waitForTimeout(3000);
  });

  test('should navigate between tabs', async ({ page }) => {
    await expect(page.locator('text=Current Workout').first()).toBeVisible();

    await page.click('div[data-testid="tab-routines"]');
    await expect(page.locator('text=Create Routine').first()).toBeVisible();

    await page.click('div[data-testid="tab-history"]');
    await expect(page.locator('text=HISTORY').first()).toBeVisible();

    await page.click('div[data-testid="tab-analytics"]');
    await expect(page.locator('text=Workout Trends').first()).toBeVisible();

    await page.click('div[data-testid="tab-journal"]');
    await expect(page.locator('text=JOURNAL').first()).toBeVisible();

    await page.click('div[data-testid="tab-settings"]');
    await expect(page.locator('text=Sync Account').first()).toBeVisible();
  });
});
