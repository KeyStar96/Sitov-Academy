import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import ru from '../dictionaries/ru.json'
import { readingSelection } from '../lib/learning-catalog'
import { authenticateBrowser } from './helpers/authenticated-session'

for (const theme of ['light', 'dark'] as const) {
  test(`recording remains visible and clickable after reading a long text (${theme})`, async ({ page, request }, testInfo) => {
    const api = process.env.E2E_SUPABASE_URL
    const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY
    expect(api, 'Start the isolated VPS gateway and load its private test env').toBeTruthy()
    expect(key).toBeTruthy()
    const marker = await request.get(`${api}/__phase2/health`)
    expect(await marker.json()).toEqual({ database: 'sitov_phase2_verify', mail: 'discard', isolated: true })
    expect(marker.headers()['x-sitov-test-database']).toBe('sitov_phase2_verify')
    await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
    await page.addInitScript(value => {
      localStorage.setItem('theme', value)
      localStorage.setItem('academy-contrast', 'standard')
    }, theme)
    const admin = createClient(api!, key!, { auth: { persistSession: false, autoRefreshToken: false } })
    const token = randomUUID(), unitId = randomUUID(), promptId = randomUUID()
    const email = `phase5-${token}@test.invalid`, password = `Test-${token}!`
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: 'Aufnahmetest', native_language: 'ru', ui_language: 'ru' } })
    expect(created.error).toBeNull()
    const userId = created.data.user!.id
    const people = await admin.from('people').select('id').eq('auth_user_id', userId)
    expect(people.error).toBeNull()
    try {
      expect((await admin.from('profiles').update({ native_language: 'ru', ui_language: 'ru' }).eq('id', userId)).error).toBeNull()
      expect((await admin.from('learning_units').insert({ id: unitId, level: 'A1.1', trainer: 'pronunciation', label: `Aufnahmetest ${token}` })).error).toBeNull()
      expect((await admin.from('learning_reading_texts').insert({ id: promptId, unit_id: unitId, sentence_de: Array.from({ length: 18 }, (_, index) => `Abschnitt ${index + 1}. Heute lerne ich Deutsch. Ich lese langsam und mache eine kurze Pause. Dann spreche ich den nächsten Satz.`).join('\n\n') })).error).toBeNull()
      expect((await admin.from('student_level_access').insert({ auth_user_id: userId, level: 'A1.1' })).error).toBeNull()
      expect((await admin.from('learning_trainer_grants').upsert({ auth_user_id: userId, level: 'A1.1', trainer: 'pronunciation', enabled: true, unit_mode: 'selected' })).error).toBeNull()
      expect((await admin.from('learning_unit_grants').insert({ auth_user_id: userId, level: 'A1.1', trainer: 'pronunciation', unit_id: unitId })).error).toBeNull()
      const student = createClient(api!, key!, { auth: { persistSession: false, autoRefreshToken: false } })
      expect((await student.auth.signInWithPassword({ email, password })).error).toBeNull()
      const readable = await student.from('learning_reading_texts').select(readingSelection).eq('unit.level', 'A1.1').eq('unit.is_active', true).order('sort_order', { referencedTable: 'unit' })
      expect(readable.error).toBeNull()
      expect(readable.data?.map(prompt => prompt.id)).toEqual([promptId])
      await authenticateBrowser(page, { api: api!, key: key!, email, password })
      // Die schwebende Aufnahme-Bedienung gibt es nur unterhalb des lg-Breakpoints.
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto('/ru/dashboard/level/A1.1/pronunciation')
      // The prototype keeps the permission fixture across native MediaDevices
      // wrappers in WebKit. App recording logic and browser clicks stay real.
      await page.evaluate(() => {
        Object.defineProperty(Object.getPrototypeOf(navigator.mediaDevices), 'getUserMedia', {
          configurable: true,
          value: async () => { throw new DOMException('Test microphone permission denied', 'NotAllowedError') },
        })
      })
      const end = page.getByTestId('pronunciation-text-end')
      await expect(page.getByTestId('pronunciation-reading-text')).toContainText('Abschnitt 18.')
      await end.scrollIntoViewIfNeeded()
      const bar = page.getByTestId('pronunciation-recording-bar')
      const record = bar.getByRole('button', { name: ru.pronunciation.start_recording, exact: true })
      // Im Ruhezustand traegt ein schwebender Knopf die Aufnahme – keine Leiste im Textfluss.
      await expect(bar).toHaveCSS('position', 'fixed')
      await expect(record).toBeInViewport({ ratio: 1 })
      await expect(record).toBeEnabled()
      const bounds = await record.boundingBox()
      expect(bounds!.width).toBeGreaterThanOrEqual(56)
      expect(bounds!.height).toBeGreaterThanOrEqual(56)
      // Am Seitenende bleibt der Lesetext vollstaendig ueber dem Knopf lesbar.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      const ending = await end.boundingBox()
      const dock = await record.boundingBox()
      expect(ending!.y + ending!.height).toBeLessThanOrEqual(dock!.y)
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
      await page.screenshot({ path: testInfo.outputPath('reading-end-recording-bar.png') })
      await record.click()
      await expect(bar.getByRole('status')).toContainText(ru.pronunciation.mic_denied)
      await expect(record).toBeInViewport({ ratio: 1 })
      await page.screenshot({ path: testInfo.outputPath('microphone-permission-feedback.png') })
    } finally {
      expect((await admin.auth.admin.deleteUser(userId)).error).toBeNull()
      expect((await admin.from('learning_reading_texts').delete().eq('id', promptId)).error).toBeNull()
      expect((await admin.from('learning_units').delete().eq('id', unitId)).error).toBeNull()
      for (const person of people.data ?? []) expect((await admin.from('people').delete().eq('id', person.id)).error).toBeNull()
    }
  })
}
