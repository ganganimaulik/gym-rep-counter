import { test, expect } from '@playwright/test';

test.describe('Journal Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8081');
    await page.waitForTimeout(1000);
    await page.click('div[data-testid="tab-journal"]');
    await page.waitForTimeout(500);
  });

  test('should render journal screen and add entry', async ({ page }) => {
    await expect(page.locator('text=JOURNAL').first()).toBeVisible();

    // Find the Plus button SVG and click its parent
    await page.evaluate(() => {
      const svgs = Array.from(document.querySelectorAll('svg'));
      for (const s of svgs) {
        if (s.getAttribute('stroke') === '#0ea5e9') {
          (s.parentElement || s).click();
          break;
        }
      }
    });

    await expect(page.locator('text=Save').first()).toBeVisible();

    // The modal should appear. We can type a note.
    await page.fill('textarea', 'My new test note');
    await page.click('text=Save');

    // Check if the note is added. Wait for the text to appear.
    await expect(page.locator('text=My new test note').first()).toBeVisible();
  });
});
