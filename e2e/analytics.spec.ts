import { test, expect } from '@playwright/test';

test.describe('Analytics Screen', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage for a clean setup
    await page.addInitScript(() => {
        window.localStorage.clear();
    });
    await page.goto('http://localhost:8081');
    await page.waitForTimeout(2000);
    await page.click('div[data-testid="tab-analytics"]');
    await page.waitForTimeout(1000);
  });

  test('should render analytics screen and setup TDEE', async ({ page }) => {
    await expect(page.locator('text=Workout Trends').first()).toBeVisible();
    await expect(page.locator('text=Health & TDEE').first()).toBeVisible();

    // Switch to Health & TDEE tab
    await page.click('text=Health & TDEE');
    await page.waitForTimeout(1000);

    // Default state: Start Tracking
    await expect(page.locator('text=Start Tracking').first()).toBeVisible();

    // Fill setup inputs
    const inputs = page.locator('input');
    await inputs.nth(0).fill('180');
    await inputs.nth(1).fill('80');
    await page.click('text=Start Tracking');

    // Should now show TDEE UI, which contains something like 'Log Weight'
    await expect(page.locator('text=Log').first()).toBeVisible();
  });
});
