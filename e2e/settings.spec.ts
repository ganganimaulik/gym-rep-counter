import { test, expect } from '@playwright/test';

test.describe('Settings Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8081');
    await page.waitForTimeout(3000);
    await page.click('div[data-testid="tab-settings"]');
    await page.waitForTimeout(1000);
  });

  test('should render settings screen components', async ({ page }) => {
    await expect(page.locator('text=Sync Account').first()).toBeVisible();
    await expect(page.locator('text=Sign in with Google').first()).toBeVisible();
    await expect(page.locator('text=Timer Intervals').first()).toBeVisible();
    await expect(page.locator('text=Save Changes').first()).toBeVisible();
  });
});
