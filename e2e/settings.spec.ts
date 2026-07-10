import { test, expect } from '@playwright/test'

test.describe('Settings Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8081')
    await page.waitForTimeout(3000)
    await page.click('div[data-testid="tab-settings"]')
    await page.waitForTimeout(1000)
  })

  test('should render settings screen components', async ({ page }) => {
    await expect(page.locator('text=Sync Account').first()).toBeVisible()
    await expect(page.locator('text=Sign in with Google').first()).toBeVisible()
    await expect(page.locator('text=Timer Intervals').first()).toBeVisible()
    await expect(page.locator('text=MCP Server Settings').first()).toBeVisible()
    await expect(
      page.locator('[data-testid="setting-mcp-server-url"]'),
    ).toBeVisible()
    await expect(page.locator('text=Save Changes').first()).toBeVisible()
  })

  test('should modify, save, and persist all settings configurations', async ({
    page,
  }) => {
    // Verify default auto-sleep is visible when stat reminders are enabled (default)
    await expect(
      page.locator('[data-testid="toggle-auto-sleep"]'),
    ).toBeVisible()

    // 1. Fill all remaining inputs
    await page.locator('[data-testid="setting-announcement"]').fill('3')
    await page.locator('[data-testid="setting-max-reps"]').fill('30')
    await page.locator('[data-testid="setting-max-sets"]').fill('8')
    await page.locator('[data-testid="setting-concentric"]').fill('2.5')
    await page.locator('[data-testid="setting-eccentric"]').fill('4.5')
    await page
      .locator('[data-testid="setting-mcp-server-url"]')
      .fill('http://localhost:4000')

    // 2. Toggle off stat reminders
    await page.locator('[data-testid="toggle-stat-reminders"]').click()

    // Verify auto-sleep switch is now hidden
    await expect(
      page.locator('[data-testid="toggle-auto-sleep"]'),
    ).not.toBeVisible()

    // 3. Save Changes
    await page.click('text=Save Changes')
    await page.waitForTimeout(1000)

    // 4. Reload page and navigate back to settings
    await page.reload()
    await page.waitForTimeout(2000)
    await page.click('div[data-testid="tab-settings"]')
    await page.waitForTimeout(1000)

    // 5. Verify all values are persisted correctly
    await expect(
      page.locator('[data-testid="setting-announcement"]'),
    ).toHaveValue('3')
    await expect(page.locator('[data-testid="setting-max-reps"]')).toHaveValue(
      '30',
    )
    await expect(page.locator('[data-testid="setting-max-sets"]')).toHaveValue(
      '8',
    )
    await expect(
      page.locator('[data-testid="setting-concentric"]'),
    ).toHaveValue('2.5')
    await expect(page.locator('[data-testid="setting-eccentric"]')).toHaveValue(
      '4.5',
    )
    await expect(
      page.locator('[data-testid="setting-mcp-server-url"]'),
    ).toHaveValue('http://localhost:4000')

    // Verify stat reminders toggle state is persisted (auto-sleep remains hidden)
    await expect(
      page.locator('[data-testid="toggle-auto-sleep"]'),
    ).not.toBeVisible()
  })
})
