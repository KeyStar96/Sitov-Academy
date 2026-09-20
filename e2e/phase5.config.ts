import { defineConfig, devices } from '@playwright/test'

/** Use a built application connected to the isolated self-hosted test gateway. */
export default defineConfig({
  testDir: '.', testMatch: ['accessibility.spec.ts', 'pronunciation-mobile.spec.ts', 'phase5-calendar.spec.ts', 'phase5-analytics.spec.ts'],
  timeout: 90000, workers: 1, retries: 0, reporter: 'list',
  use: { baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3100', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', testMatch: ['accessibility.spec.ts', 'phase5-calendar.spec.ts', 'phase5-analytics.spec.ts'], use: { ...devices['Desktop Chrome'], channel: process.env.E2E_BROWSER_CHANNEL || 'chrome' } },
    { name: 'Pixel 7', use: { ...devices['Pixel 7'], channel: process.env.E2E_BROWSER_CHANNEL || 'chrome' } },
    { name: 'iPhone 14', use: { ...devices['iPhone 14'] } },
  ],
})
