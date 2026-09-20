import { defineConfig, devices } from '@playwright/test'

/** Requires the isolated clone gateway, never production credentials. */
export default defineConfig({
  testDir: '.', testMatch: 'registration-identity.live.ts',
  timeout: 90000, workers: 1, retries: 0, reporter: 'list',
  use: { baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.E2E_BROWSER_CHANNEL || 'chrome' } }],
})
