import { defineConfig, devices } from '@playwright/test'

/** Explicitly invoked only after the owner provisions temporary live fixtures.
 * Credentials stay in the private fixture JSON; traces are disabled. */
export default defineConfig({
  testDir: '.', testMatch: 'phase5-media.live.ts', timeout: 300000, workers: 1, retries: 0,
  reporter: 'list', outputDir: 'test-results/phase5-media',
  use: { ...devices['Desktop Chrome'], channel: 'chrome', ignoreHTTPSErrors: true, screenshot: 'only-on-failure', trace: 'off' },
})
