import { test, expect, type Page, type TestInfo } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import ru from '../dictionaries/ru.json'
import en from '../dictionaries/en.json'
import { signInPhase2 } from './helpers/phase2-session'
import { readingSelection } from '../lib/learning-catalog'
import { authenticateBrowser } from './helpers/authenticated-session'

function fixtureReferenceWav() {
  const samples = 8000
  const wav = Buffer.alloc(44 + samples * 2)
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
  wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40)
  return wav
}

for (const theme of ['light', 'dark'] as const) {
  test(`recording stays below the reading text and remains clickable (${theme})`, async ({ page, request }, testInfo) => {
    if (testInfo.project.metadata.phase2Fixture) {
      // Local UI contract; the isolated gateway path below still checks real
      // Auth/RLS when invoked with its own config and private credentials.
      const health = await request.get('http://127.0.0.1:54329/__phase2/health')
      expect(await health.json()).toEqual({ fixture: 'phase2', writes: false })
      await signInPhase2(page, theme)
      await page.route('http://127.0.0.1:54329/__phase2/reference.wav', route => route.fulfill({ contentType: 'audio/wav', body: fixtureReferenceWav() }))
      await checkRecording(page, testInfo, 'en', en.pronunciation)
      return
    }
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
      await checkRecording(page, testInfo, 'ru', ru.pronunciation)
    } finally {
      expect((await admin.auth.admin.deleteUser(userId)).error).toBeNull()
      expect((await admin.from('learning_reading_texts').delete().eq('id', promptId)).error).toBeNull()
      expect((await admin.from('learning_units').delete().eq('id', unitId)).error).toBeNull()
      for (const person of people.data ?? []) expect((await admin.from('people').delete().eq('id', person.id)).error).toBeNull()
    }
  })
}

async function checkRecording(page: Page, testInfo: TestInfo, lang: string, copy: typeof en.pronunciation) {
  // Start with the mobile reference controls; recording stays in document flow at every width.
  await page.setViewportSize({ width: 390, height: 844 })
  // The prototype keeps the permission fixture across native MediaDevices
  // wrappers in WebKit. Install on every navigation, including the speed reload.
  // App recording logic and browser clicks stay real.
  await page.addInitScript(() => {
    Object.defineProperty(Object.getPrototypeOf(navigator.mediaDevices), 'getUserMedia', {
      configurable: true,
      value: async () => { throw new DOMException('Test microphone permission denied', 'NotAllowedError') },
    })
  })
  await page.goto(`/${lang}/dashboard/level/A1.1/pronunciation`)
  const end = page.getByTestId('pronunciation-text-end')
  await expect(page.getByTestId('pronunciation-reading-text')).toContainText('Abschnitt 18.')
  await end.scrollIntoViewIfNeeded()
  if (testInfo.project.metadata.phase2Fixture) {
    const reading = page.locator('article.st-reading')
    const speed = reading.locator('select').filter({ has: page.locator('option[value="0.75"]') })
    await expect(speed).toHaveValue('0.85')
    expect(await speed.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value)))
      .toEqual(['0.75', '0.85', '1', '1.25'])
    await speed.selectOption('0.75')
    await expect(speed).toHaveValue('0.75')
    await speed.selectOption('1.25')
    await expect(speed).toHaveValue('1.25')
    await speed.selectOption('0.85')
    await expect(reading.getByRole('combobox')).toHaveCount(1)
    await expect(speed).toHaveValue('0.85')
    await expect(speed).toHaveCSS('min-height', '48px')
    const controlBounds = await speed.boundingBox()
    expect(controlBounds!.height).toBeGreaterThanOrEqual(48)
    expect(controlBounds!.x + controlBounds!.width).toBeLessThanOrEqual(390)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await speed.selectOption('0.75')
    await page.reload()
    await expect(speed).toHaveValue('0.75')
    await speed.selectOption('0.85')
    await expect(speed).toHaveValue('0.85')
    await page.screenshot({ path: testInfo.outputPath('tts-reference-controls.png') })
  }
  const bar = page.getByTestId('pronunciation-recording-card')
  const record = bar.getByRole('button', { name: copy.start_recording, exact: true })
  const text = page.getByTestId('pronunciation-reading-text')
  // The former fixed FAB intersected text midway through a stationary read.
  // Check actual geometry before bringing the normal-flow recording card into view.
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    await text.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }))
    await page.waitForTimeout(900)
    const [readingBounds, recordBounds] = await Promise.all([text.boundingBox(), record.boundingBox()])
    expect(readingBounds).not.toBeNull()
    expect(recordBounds).not.toBeNull()
    expect(recordBounds!.y).toBeGreaterThanOrEqual(readingBounds!.y + readingBounds!.height)
    await record.scrollIntoViewIfNeeded()
    await expect(record).toBeInViewport({ ratio: 1 })
    await expect(record).toBeEnabled()
    const bounds = (await record.boundingBox())!
    expect(bounds.width).toBeGreaterThanOrEqual(56)
    expect(bounds.height).toBeGreaterThanOrEqual(56)
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await record.scrollIntoViewIfNeeded()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('reading-end-recording-bar.png') })
  await record.click()
  await expect(bar.getByRole('status')).toContainText(copy.mic_denied)
  await expect(record).toBeInViewport({ ratio: 1 })
  await page.screenshot({ path: testInfo.outputPath('microphone-permission-feedback.png') })
}
