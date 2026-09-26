import { defineConfig, devices } from '@playwright/test'

/** Requires phase5-local-carryover.py --serve and the app built with its environment. */
export default defineConfig({
  testDir: '.', testMatch: 'master4-phase5.spec.ts', timeout: 90000,
  workers: 1, retries: 0, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3105', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'local-postgres', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
})
