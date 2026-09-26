import { defineConfig, devices } from '@playwright/test'

/** Run against the production build and the isolated Phase-7 PostgreSQL harness. */
export default defineConfig({
  testDir: '.', testMatch: 'master4-phase8.spec.ts', timeout: 60000,
  workers: 2, retries: 0, reporter: [['list'], ['json', { outputFile: '/tmp/sitov-phase8-playwright-matrix.json' }]],
  use: { baseURL: 'http://127.0.0.1:3107', screenshot: 'only-on-failure', trace: 'off' },
  projects: [
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'Pixel 7', use: { ...devices['Pixel 7'], channel: 'chrome' } },
    { name: 'iPhone 14', use: { ...devices['iPhone 14'] } },
  ],
})
