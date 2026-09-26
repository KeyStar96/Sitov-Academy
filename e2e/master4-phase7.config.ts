import { defineConfig, devices } from '@playwright/test'

/** Requires the local Phase-7 PostgreSQL harness and an app built with its env. */
export default defineConfig({
  testDir: '.', testMatch: 'master4-phase7.spec.ts', timeout: 90000,
  workers: 1, retries: 0, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3107', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'local-postgres', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
})
