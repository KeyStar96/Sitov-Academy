import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.', testMatch: ['sitov-trainer-progress.spec.ts', 'sitov-verb-learning-guide.spec.ts'], fullyParallel: false, workers: 1, reporter: 'list',
  use: { ...devices['Desktop Chrome'], channel: 'chrome', baseURL: 'http://localhost:3107', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --port 3107', url: 'http://localhost:3107', reuseExistingServer: true, timeout: 300000 },
})
