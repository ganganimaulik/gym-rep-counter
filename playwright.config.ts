import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on',
    viewport: { width: 450, height: 800 }, // Set standard mobile-like viewport for mobile-first layout
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'EXPO_PUBLIC_PLAYWRIGHT=1 EXPO_PUBLIC_API_KEY=test-api-key EXPO_PUBLIC_AUTH_DOMAIN=test-domain EXPO_PUBLIC_PROJECT_ID=test-project npm run web',
    url: 'http://localhost:8081',
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // Metro bundling might take some time on CI, so increase timeout to 2 minutes
  },
});
