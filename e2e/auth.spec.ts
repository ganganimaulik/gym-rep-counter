import { test, expect } from '@playwright/test'

test.describe('Authenticated User State', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate and inject mock user to window object instead of localStorage
    // because localStorage might be cleared or not read in time by useAuth
    await page.goto('http://localhost:8081')
    await page.waitForTimeout(3000)
    await page.evaluate(() => {
      if ((window as any).setMockUser) {
        ;(window as any).setMockUser({
          uid: 'test-user-id',
          email: 'testuser@playwright.com',
          displayName: 'Playwright Tester',
          photoURL: 'https://example.com/photo.png',
        })
      }
    })
    await page.waitForTimeout(1000)
  })

  test('should show user profile in Settings when authenticated', async ({
    page,
  }) => {
    // Navigate to settings
    await page.click('div[data-testid="tab-settings"]')
    await page.waitForTimeout(1000)

    // Should see the user name
    await expect(page.locator('text=Playwright Tester')).toBeVisible()
    await expect(page.locator('text=testuser@playwright.com')).toBeVisible()
  })
})
