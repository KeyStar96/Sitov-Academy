import { defineConfig, devices } from '@playwright/test'

/**
 * Phase 7 gegen einen Produktions-Build (`npm run build && npm run start -- -p 3100`).
 * Der Server braucht dieselben Env-Werte wie der Test (CANONICAL_SITE_URL / NEXT_PUBLIC_SITE_URL).
 */
export default defineConfig({
  testDir: '.', testMatch: ['phase7-seo.spec.ts', 'accessibility.spec.ts', 'mobile-safe-area.spec.ts'],
  timeout: 60000, workers: 2, retries: 0, reporter: 'list',
  use: { baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3100', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'Pixel 7', testMatch: ['phase7-seo.spec.ts'], use: { ...devices['Pixel 7'] } },
  ],
})
