import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: ['phase7-seo.spec.ts', 'sitov-search-console-seo.spec.ts'],
  timeout: 45000,
  workers: 2,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:3128', ...devices['Desktop Chrome'], trace: 'retain-on-failure',
    channel: process.env.SITOV_E2E_CHANNEL === 'chrome' ? 'chrome' : undefined,
  },
  webServer: { command: 'npm run start -- --port 3128', url: 'http://localhost:3128', timeout: 120000, reuseExistingServer: true },
})
