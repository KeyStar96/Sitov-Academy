import { resolve } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

/**
 * Phase 2 (Navigation und Design-System): gebaute App gegen das künstliche
 * Loopback-Fixture `e2e/helpers/phase2-fixture.mjs` (vorher `npm run build`
 * mit NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329).
 *
 * Geräte: Desktop, Pixel 7, iPhone 14. Ohne installierten Playwright-Browser
 * lässt sich ein vorhandenes Chromium über E2E_CHROMIUM_PATH oder ein Kanal
 * über E2E_BROWSER_CHANNEL nutzen; „iPhone 14" läuft dann als
 * Geräteemulation (Viewport, DPR, Touch, User-Agent) in Chromium.
 */
const browser = {
  ...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {}),
  ...(process.env.E2E_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH } } : {}),
}
const fixture = 'http://127.0.0.1:54329'
const root = resolve(__dirname, '..')

export default defineConfig({
  testDir: '.',
  testMatch: ['phase2-navigation.spec.ts', 'navigation-scroll.spec.ts', 'mobile-safe-area.spec.ts', 'accessibility.spec.ts'],
  timeout: 90000, workers: 1, retries: 0, reporter: 'list',
  use: { baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3100', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...browser } },
    { name: 'Pixel 7', use: { ...devices['Pixel 7'], ...browser } },
    { name: 'iPhone 14', use: { ...devices['iPhone 14'], ...(process.env.E2E_CHROMIUM_PATH ? { browserName: 'chromium' as const } : {}), ...browser } },
  ],
  webServer: [
    { command: 'node e2e/helpers/phase2-fixture.mjs', cwd: root, url: `${fixture}/__phase2/health`, reuseExistingServer: true, timeout: 30000 },
    {
      command: 'npx next start -p 3100 -H 127.0.0.1', cwd: root, url: 'http://127.0.0.1:3100/de', reuseExistingServer: true, timeout: 120000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: fixture, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'phase2-local-placeholder',
        SUPABASE_INTERNAL_URL: fixture, SUPABASE_SERVICE_ROLE_KEY: 'phase2-local-placeholder',
        NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3100', SITE_URL: 'http://127.0.0.1:3100', NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  ],
})
