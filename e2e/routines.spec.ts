import { test, expect } from '@playwright/test';

test.describe('Routines Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8081');
    await page.waitForTimeout(2000);
    await page.click('div[data-testid="tab-routines"]');
  });

  test('should render and create routine structure', async ({ page }) => {
    await expect(page.locator('text=Create Routine').first()).toBeVisible();
    await expect(page.locator('text=Create').first()).toBeVisible();
    // Validate default routine is rendered
    await expect(page.locator('text=Day 1 (Lower)').first()).toBeVisible();
  });
});
