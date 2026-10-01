import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { learningProgressCopy } from '../lib/learning-progress-i18n'
import { vocabularyFocusCopy } from '../lib/vocabulary-focus-i18n'
import { teacherAnalyticsCopy } from '../lib/teacher-analytics-i18n'

/** Phase 11.3 gegen das synthetische Loopback-Backend (nie Live-Daten): Lernanalyse, „Mein Fortschritt", Problemwörter. */
const fixture = 'http://127.0.0.1:54331'
const TEACHER = '00000000-0000-4000-8000-000000000002'
const STUDENT = '00000000-0000-4000-8000-000000000100'
const OTHER = '00000000-0000-4000-8000-000000000101'
/** Dmitri Petrov: Oberflächensprache Russisch, A1.1 und A1.2 freigeschaltet. */
const LEARNER = OTHER
const base64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
const errors = new WeakMap<Page, string[]>()

async function signIn(page: Page, uid: string) {
  const expires = Math.floor(Date.now() / 1000) + 3600
  const email = uid === TEACHER ? 'teacher@example.invalid' : 'student@example.invalid'
  const user = { id: uid, aud: 'authenticated', role: 'authenticated', email, email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: {} }
  const session = { access_token: `${base64({ alg: 'HS256', typ: 'JWT' })}.${base64({ sub: uid, aud: 'authenticated', role: 'authenticated', exp: expires })}.local-fixture-only`, refresh_token: 'local-fixture-only', token_type: 'bearer', expires_in: 3600, expires_at: expires, user }
  await page.context().addCookies([{ name: 'sb-sitov-auth-token', value: `base64-${base64(session)}`, domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' }])
  await page.addInitScript(() => { localStorage.setItem('theme', 'light'); localStorage.setItem('sitov-consent', JSON.stringify({ version: 1, marketing: false, decidedAt: new Date().toISOString() })) })
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
}
async function screenshot(page: Page, name: string) {
  await mkdir('/tmp/sitov-teacher-dashboard-qa', { recursive: true })
  await page.screenshot({ path: `/tmp/sitov-teacher-dashboard-qa/${test.info().project.name}-${name}.png`, fullPage: true, caret: 'initial' })
}
async function rpcCalls(page: Page, name: string) {
  const calls = await (await page.request.get(`${fixture}/__teacher/rpc-calls`)).json() as { name: string; payload: Record<string, unknown> }[]
  return calls.filter(call => call.name === name).map(call => call.payload)
}

test.beforeEach(async ({ page, request }) => {
  await request.get(`${fixture}/__teacher/reset`)
  const list: string[] = []
  errors.set(page, list)
  page.on('pageerror', error => list.push(error.message))
  page.on('console', message => { if (message.type() === 'error') list.push(message.text()) })
})
/**
 * Das Fixture bildet die Lernbox (readWordBox) nicht nach. Der bestehende
 * Lernstand der Startseite/Modusleiste meldet das serverseitig – nur diese
 * bekannte Lücke ist erlaubt, jede andere Konsolenmeldung lässt den Test scheitern.
 */
const FIXTURE_GAPS = ['[learning-status] vocabulary_unavailable', '[mode-dock] vocabulary_unavailable']
test.afterEach(async ({ page }) => { expect((errors.get(page) ?? []).filter(message => !FIXTURE_GAPS.some(gap => message.includes(gap)))).toEqual([]) })

test.describe('Lehrkraft', () => {
  test.beforeEach(async ({ page }) => signIn(page, TEACHER))

  test('Lernanalyse: Tageswerte in Prozent, Verlauf und je Lernmodus eigene Diagramme', async ({ page }) => {
    const p = learningProgressCopy('de'), a = teacherAnalyticsCopy('de')
    await page.goto(`/de/admin/analytics?student=${OTHER}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { level: 1, name: a.title })).toBeVisible()
    await expect(page.getByRole('combobox', { name: a.student })).toHaveValue(OTHER)
    const today = page.getByRole('region', { name: p('today') })
    await expect(today.getByRole('img', { name: /Prozent richtig|Noch keine Antworten/ })).toBeVisible()
    const overview = page.getByRole('region', { name: p('overview_title') })
    await expect(overview.locator('rect.trend-chart__bar').first()).toBeVisible()
    const chart = overview.getByRole('group', { name: p('overview_title') })
    await chart.focus()
    await page.keyboard.press('End')
    await expect(chart).toHaveAccessibleDescription(/Richtig: \d+/)
    const tabs = page.getByRole('tablist', { name: p('modes_label') })
    await expect(tabs.getByRole('tab')).toHaveText([p('mode_vocabulary'), p('mode_path'), p('mode_pronunciation'), p('mode_media')])
    await expect(page.getByRole('region', { name: p('focus_title') })).toContainText('Tisch')
    await screenshot(page, 'analytics-vocabulary')
    await tabs.getByRole('tab', { name: p('mode_path') }).click()
    await expect(page.getByRole('region', { name: p('tests') })).toContainText('Einkaufen im kleinen Laden')
    await tabs.getByRole('tab', { name: p('mode_pronunciation') }).click()
    await expect(page.getByText(p('texts_practiced'))).toBeVisible()
    await tabs.getByRole('tab', { name: p('mode_media') }).click()
    await expect(page.getByRole('region', { name: p('media_recent') })).toContainText('Begrüßung und Vorstellung')
    await screenshot(page, 'analytics-media')
    await page.getByRole('button', { name: p('range_days', { count: 7 }) }).click()
    await expect.poll(async () => (await rpcCalls(page, 'get_learning_progress')).some(call => call.p_days === 7 && call.p_student_id === OTHER)).toBe(true)
    await expect(page.getByText(/Im Zeitraum \(7 Tage\)/)).toBeVisible()
    await noOverflow(page)
  })

  test('Schülerprofil: heute und die letzten 7 Tage mit Sprung in die Lernanalyse', async ({ page }) => {
    const p = learningProgressCopy('de')
    await page.goto(`/de/admin/students/${STUDENT}`)
    await page.waitForLoadState('networkidle')
    const snapshot = page.getByRole('region', { name: p('snapshot_title') })
    await expect(snapshot.getByRole('img', { name: /Prozent richtig|Noch keine Antworten/ })).toBeVisible()
    await expect(snapshot.getByRole('link', { name: p('snapshot_link') })).toHaveAttribute('href', `/de/admin/analytics?student=${STUDENT}`)
    await noOverflow(page)
    await screenshot(page, 'student-snapshot')
  })
})

test.describe('Lernende', () => {
  test.beforeEach(async ({ page }) => signIn(page, LEARNER))
  // Die letzte Brotkrume ist auf Schülerseiten ebenfalls eine h1 – die Seitenüberschrift steht im Inhalt.
  const content = (page: Page) => page.locator('.academy-student-content')

  test('Mein Fortschritt: heute in Prozent, Zeitraum wechseln, Modus-Reiter', async ({ page }) => {
    const p = learningProgressCopy('ru')
    await page.goto('/ru/dashboard/progress')
    await page.waitForLoadState('networkidle')
    await expect(content(page).getByRole('heading', { level: 1, name: p('student_title') })).toBeVisible()
    await expect(page.getByRole('region', { name: p('today') }).getByRole('img', { name: /Верно: \d+ %|Ответов пока нет/ })).toBeVisible()
    await page.getByRole('button', { name: p('range_days', { count: 90 }) }).click()
    await expect(page.getByRole('button', { name: p('range_days', { count: 90 }) })).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(async () => (await rpcCalls(page, 'get_learning_progress')).some(call => call.p_days === 90 && call.p_student_id === null)).toBe(true)
    await page.getByRole('tab', { name: p('mode_path') }).click()
    await expect(page.getByRole('region', { name: p('tests') })).toBeVisible()
    await page.getByRole('tab', { name: p('mode_vocabulary') }).click()
    await expect(page.getByRole('link', { name: p('focus_cta') })).toHaveAttribute('href', '/ru/dashboard/level/A1.1/vocabulary/focus')
    await noOverflow(page)
    await screenshot(page, 'student-progress')
  })

  test('Startseite: der Tag in Zahlen führt zu „Mein Fortschritt" und zu den Problemwörtern', async ({ page }) => {
    const p = learningProgressCopy('ru')
    await page.goto('/ru/dashboard')
    await page.waitForLoadState('networkidle')
    const teaser = page.getByRole('region', { name: p('teaser_title') })
    await expect(teaser.getByRole('link', { name: p('progress_link') })).toHaveAttribute('href', '/ru/dashboard/progress')
    await expect(teaser.getByRole('link', { name: /Тренировать проблемные слова \(4\)/ })).toBeVisible()
    await noOverflow(page)
    await screenshot(page, 'student-home')
  })

  test('Problemwörter: vier Aufgabenformate, Rückmeldung und Auswertung', async ({ page }) => {
    const f = vocabularyFocusCopy('ru')
    await page.goto('/ru/dashboard/level/A1.1/vocabulary/focus')
    await page.waitForLoadState('networkidle')
    await expect(content(page).getByRole('heading', { level: 1, name: f('title') })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Слова: раздел' }).getByRole('link', { name: 'Проблемные слова' })).toHaveAttribute('aria-current', 'page')
    await noOverflow(page)
    await screenshot(page, 'focus-overview')
    await page.getByRole('button', { name: f('start_count', { count: 4 }) }).click()
    await expect(page.getByRole('heading', { name: f('format_article') })).toBeFocused()
    await page.getByRole('button', { name: 'der', exact: true }).click()
    await expect(page.getByText(f('correct'))).toBeVisible()
    await screenshot(page, 'focus-article')
    await page.getByRole('button', { name: f('next') }).click()
    await expect(page.getByRole('heading', { name: f('format_choice') })).toBeVisible()
    await page.getByRole('button', { name: 'die Lampe' }).click()
    await expect(page.getByText(f('wrong'))).toBeVisible()
    await expect(page.getByText(f('again_later'))).toBeVisible()
    await page.getByRole('button', { name: f('next') }).click()
    await expect(page.getByRole('heading', { name: f('format_build') })).toBeVisible()
    for (const letter of 'Fenster') await page.getByRole('button', { name: f('add_letter', { letter }) }).first().click()
    await screenshot(page, 'focus-build')
    await page.getByRole('button', { name: f('check') }).click()
    await expect(page.getByText(f('correct'))).toBeVisible()
    await page.getByRole('button', { name: f('next') }).click()
    await expect(page.getByRole('heading', { name: f('format_type') })).toBeVisible()
    await page.getByRole('textbox', { name: f('answer_label') }).fill('schnell')
    await page.getByRole('button', { name: f('check') }).click()
    await expect(page.getByText(f('correct'))).toBeVisible()
    await page.getByRole('button', { name: f('next') }).click()
    // Das falsch gewählte Wort kommt einmal zurück – jetzt richtig.
    await expect(page.getByRole('heading', { name: f('format_choice') })).toBeVisible()
    await page.getByRole('button', { name: 'das Haus' }).click()
    await page.getByRole('button', { name: f('finish') }).click()
    await expect(page.getByRole('heading', { name: f('done_title') })).toBeVisible()
    await expect(page.getByText(f('done_score', { correct: 4, total: 5 }))).toBeVisible()
    await noOverflow(page)
    await screenshot(page, 'focus-summary')
    await page.getByRole('button', { name: f('back') }).click()
    await expect(content(page).getByRole('heading', { level: 1, name: f('title') })).toBeVisible()
    const answers = await rpcCalls(page, 'submit_vocabulary_focus_answer')
    expect(answers.map(call => call.p_format)).toEqual(['article', 'choice', 'build', 'type', 'choice'])
    expect(new Set(answers.map(call => call.p_request_id)).size).toBe(5)
  })
})
