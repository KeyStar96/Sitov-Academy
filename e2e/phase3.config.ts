import { defineConfig, devices } from '@playwright/test'

/** Entire browser suite against the isolated, already-built test application. */
export default defineConfig({
  testDir: '.', testMatch: '*.spec.ts', timeout: 90000, workers: 1, retries: 0,
  reporter: 'list',
  use: { baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3100', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.E2E_BROWSER_CHANNEL || 'chrome' } }],
})
