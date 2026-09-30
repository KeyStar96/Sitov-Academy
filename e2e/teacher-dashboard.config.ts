import { resolve } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

/** Lehrer-Dashboard (Phase 11.2) gegen ein synthetisches Loopback-Backend – nie gegen Live-Daten. */
const fixture = 'http://127.0.0.1:54331'
const root = resolve(__dirname, '..')
export default defineConfig({
  testDir: '.', testMatch: 'teacher-dashboard.spec.ts', timeout: 120000, workers: 1, retries: 0, reporter: 'list',
  outputDir: '/tmp/sitov-teacher-dashboard-results',
  use: { baseURL: 'http://127.0.0.1:3102', actionTimeout: 15000, screenshot: 'only-on-failure', trace: 'off', contextOptions: { reducedMotion: 'reduce' }, channel: process.env.E2E_BROWSER_CHANNEL ?? 'chrome' },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }, { name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'node e2e/helpers/teacher-dashboard-fixture.mjs', cwd: root, url: `${fixture}/__teacher/health`, reuseExistingServer: true, timeout: 30000 },
    { command: 'npx next dev -p 3102 -H 127.0.0.1', cwd: root, url: 'http://127.0.0.1:3102/de', reuseExistingServer: true, timeout: 240000,
      env: { NEXT_PUBLIC_SUPABASE_URL: fixture, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'teacher-local-placeholder', SUPABASE_INTERNAL_URL: fixture, SUPABASE_SERVICE_ROLE_KEY: 'teacher-local-placeholder', NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3102', SITE_URL: 'http://127.0.0.1:3102', NEXT_TELEMETRY_DISABLED: '1' } },
  ],
})
