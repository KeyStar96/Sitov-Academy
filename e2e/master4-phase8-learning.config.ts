import { defineConfig, devices } from '@playwright/test'

/** Full first path against the current production build and real PostgreSQL. */
export default defineConfig({
  testDir: '.', testMatch: 'master4-phase4.spec.ts', timeout: 180000,
  workers: 1, retries: 0, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3107', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'Pixel 7', use: { ...devices['Pixel 7'], channel: 'chromium' } }],
})
