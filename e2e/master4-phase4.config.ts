import { defineConfig, devices } from '@playwright/test'

/** Requires phase4-local-import.py --serve and the built app with its environment. */
export default defineConfig({
  testDir: '.', testMatch: 'master4-phase4.spec.ts', timeout: 180000,
  workers: 1, retries: 0, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3104', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'local-postgres', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
})
