import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import de from '../dictionaries/de.json'
import uk from '../dictionaries/uk.json'
import pronunciation from '../lib/pronunciation-translations.json'
import { studentsAdminCopy } from '../lib/students-admin-i18n'

/** Master-Prompt Phase 2 gegen das synthetische Loopback-Backend (nie Live-Daten): 2×-Wiedergabe, Aufnahmen aus der Lehreransicht entfernen, Profile löschen. */
const fixture = 'http://127.0.0.1:54331'
const TEACHER = '00000000-0000-4000-8000-000000000002'
/** Olena Kovalenko: Oberflächensprache Ukrainisch, eine Einreichung mit Gespräch, eine Kursbuchung. */
const STUDENT = '00000000-0000-4000-8000-000000000100'
const SUBMISSION = '00000000-0000-4000-8000-000000000800'
const FOLLOW_UP = '00000000-0000-4000-8000-000000000861'
const base64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
const p = pronunciation.de
const s = studentsAdminCopy('de')
const errors = new WeakMap<Page, string[]>()

async function signIn(page: Page, uid: string) {
  const expires = Math.floor(Date.now() / 1000) + 3600
  const email = uid === TEACHER ? 'teacher@example.invalid' : 'student@example.invalid'
  const user = { id: uid, aud: 'authenticated', role: 'authenticated', email, email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: {} }
  const session = { access_token: `${base64({ alg: 'HS256', typ: 'JWT' })}.${base64({ sub: uid, aud: 'authenticated', role: 'authenticated', exp: expires })}.local-fixture-only`, refresh_token: 'local-fixture-only', token_type: 'bearer', expires_in: 3600, expires_at: expires, user }
  await page.context().addCookies([{ name: 'sb-sitov-auth-token', value: `base64-${base64(session)}`, domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' }])
  await page.addInitScript(() => { localStorage.setItem('theme', 'light'); localStorage.setItem('sitov-consent', JSON.stringify({ version: 1, marketing: false, decidedAt: new Date().toISOString() })) })
  // R3: nur Loopback – keine externen Dienste.
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
}
async function screenshot(page: Page, name: string) {
  await mkdir('/tmp/sitov-teacher-dashboard-qa', { recursive: true })
  await page.screenshot({ path: `/tmp/sitov-teacher-dashboard-qa/${test.info().project.name}-phase2-${name}.png`, caret: 'initial' })
}
/** Touch-Ziele ≥ 48 px (R13). */
async function touchTarget(page: Page, name: string | RegExp, scope = page.locator('body')) {
  const box = await scope.getByRole('button', { name }).first().boundingBox()
  expect(Math.min(box?.width ?? 0, box?.height ?? 0)).toBeGreaterThanOrEqual(47.5)
}
const state = async (request: APIRequestContext) => (await request.get(`${fixture}/__teacher/phase2-state`)).json() as Promise<{
  storage: string[]; hidden: { submissions: string[]; messages: string[] }; submissions: { id: string; messages: string[]; status: string }[]; profiles: string[]
  people: { id: string; auth_user_id: string | null; display_name: string }[]; bookings: number
}>

test.beforeEach(async ({ page, request }) => {
  await request.get(`${fixture}/__teacher/reset`)
  const list: string[] = []
  errors.set(page, list)
  page.on('pageerror', error => list.push(error.message))
  page.on('console', message => { if (message.type() === 'error') list.push(message.text()) })
})
test.afterEach(async ({ page }) => { expect(errors.get(page) ?? []).toEqual([]) })

test('corrections: 2× playback on learner recordings; a voice message leaves only the staff view', async ({ page, request }) => {
  await signIn(page, TEACHER)
  const before = await state(request)
  await page.goto('/de/admin/submissions')
  await page.getByRole('button', { name: /^Olena Kovalenko/ }).click()
  const thread = page.getByRole('dialog', { name: 'Olena Kovalenko' })
  await expect(thread).toBeVisible()

  // Jede Aufnahme hat den 2×-Schalter; einmal eingeschaltet gilt er für alle.
  const toggles = thread.getByRole('button', { name: p.fast_playback })
  await expect(toggles).toHaveCount(2)
  await expect(thread.getByRole('combobox')).toHaveCount(0)
  await touchTarget(page, p.fast_playback, thread)
  await toggles.first().click()
  await expect(toggles.nth(0)).toHaveAttribute('aria-pressed', 'true')
  await expect(toggles.nth(1)).toHaveAttribute('aria-pressed', 'true')
  expect(await thread.locator('audio').evaluateAll(players => players.map(player => (player as HTMLAudioElement).playbackRate))).toEqual([2, 2])
  await thread.getByRole('button', { name: 'Aufnahme anhören' }).first().click()
  await expect.poll(() => thread.locator('audio').first().evaluate(player => (player as HTMLAudioElement).playbackRate)).toBe(2)
  await thread.getByRole('button', { name: 'Wiedergabe anhalten' }).first().click()
  await noOverflow(page)
  await screenshot(page, 'conversation-fast')

  // Nur Nachrichten der Lernenden lassen sich entfernen; die Antwort der Lehrkraft nicht.
  await expect(thread.getByRole('button', { name: p.remove_message })).toHaveCount(1)
  await touchTarget(page, p.remove_message, thread)
  await thread.getByRole('button', { name: p.remove_message }).click()
  const confirm = page.getByRole('dialog', { name: p.remove_message_title })
  await expect(confirm).toContainText(p.remove_message_text)
  await expect(confirm.getByRole('button', { name: p.remove_cancel })).toBeFocused()
  await screenshot(page, 'confirm-message')
  await confirm.getByRole('button', { name: p.remove_cancel }).click()
  await expect(confirm).toBeHidden()
  expect((await state(request)).hidden.messages).toEqual([])

  await thread.getByRole('button', { name: p.remove_message }).click()
  await confirm.getByRole('button', { name: p.remove_confirm }).click()
  await expect(thread.getByText(p.message_removed)).toBeVisible()
  await expect(thread.getByText('Danke, hier ist mein zweiter Versuch.')).toHaveCount(0)
  await expect(thread.getByText(/Schön gelesen/)).toBeVisible()
  await expect(toggles).toHaveCount(1)
  await screenshot(page, 'message-removed')
  // Nichts wurde gelöscht: Nachricht, Aufnahmen und gespeicherter Status sind für die Schülerin unverändert.
  const after = await state(request)
  expect(after.hidden).toEqual({ submissions: [], messages: [FOLLOW_UP] })
  expect(after.submissions).toEqual(before.submissions)
  expect(after.storage).toEqual(before.storage)

  // Rückgängig holt die Nachricht zurück.
  await thread.getByRole('button', { name: p.undo }).click()
  await expect(thread.getByText('Danke, hier ist mein zweiter Versuch.')).toBeVisible()
  await expect(thread.getByText(p.message_restored)).toBeVisible()
  expect((await state(request)).hidden.messages).toEqual([])
})

test('corrections: a submission removed from the queue stays with the learner and can be brought back', async ({ page, request }) => {
  await signIn(page, TEACHER)
  const before = await state(request)
  await page.goto('/de/admin/submissions')
  const name = p.remove_submission_of.replace('{name}', 'Olena Kovalenko')
  await touchTarget(page, name)
  await noOverflow(page)
  await screenshot(page, 'queue')
  await page.getByRole('button', { name }).click()
  const confirm = page.getByRole('dialog', { name: p.remove_submission_title })
  await expect(confirm).toContainText('Olena Kovalenko')
  await expect(confirm).toContainText(p.remove_submission_text)
  await screenshot(page, 'confirm-submission')
  await confirm.getByRole('button', { name: p.remove_confirm }).click()
  await expect(page.getByText(p.submission_removed)).toBeVisible()
  await expect(page.getByRole('button', { name: /^Olena Kovalenko/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Dmitri Petrov/ })).toBeVisible()
  await screenshot(page, 'submission-removed')
  const after = await state(request)
  expect(after.hidden).toEqual({ submissions: [SUBMISSION], messages: [] })
  expect(after.submissions).toEqual(before.submissions)
  expect(after.storage).toEqual(before.storage)
  // Auch im Schülerprofil der Lehrkraft erscheint das Gespräch nicht mehr; ein Neuladen bringt es nicht zurück.
  await page.goto(`/de/admin/students/${STUDENT}?tab=pronunciation`)
  await expect(page.getByRole('link', { name: 'Gespräch öffnen' })).toHaveCount(0)
  await page.goto('/de/admin/submissions')
  await expect(page.getByRole('button', { name: /^Dmitri Petrov/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Olena Kovalenko/ })).toHaveCount(0)

  // Rückgängig direkt nach dem Entfernen.
  await page.getByRole('button', { name: p.remove_submission_of.replace('{name}', 'Dmitri Petrov') }).click()
  await page.getByRole('dialog', { name: p.remove_submission_title }).getByRole('button', { name: p.remove_confirm }).click()
  await expect(page.getByRole('button', { name: /^Dmitri Petrov/ })).toHaveCount(0)
  await page.getByRole('button', { name: p.undo }).click()
  await expect(page.getByText(p.submission_restored)).toBeVisible()
  await expect(page.getByRole('button', { name: /^Dmitri Petrov/ })).toBeVisible()
  expect((await state(request)).hidden.submissions).toEqual([SUBMISSION])
})

test('learner still sees and plays what staff removed from their view', async ({ page, request, browser }) => {
  await signIn(page, TEACHER)
  await page.goto('/de/admin/submissions')
  await page.getByRole('button', { name: p.remove_submission_of.replace('{name}', 'Olena Kovalenko') }).click()
  await page.getByRole('dialog', { name: p.remove_submission_title }).getByRole('button', { name: p.remove_confirm }).click()
  await expect(page.getByText(p.submission_removed)).toBeVisible()
  expect((await state(request)).hidden.submissions).toEqual([SUBMISSION])

  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3102', reducedMotion: 'reduce' })
  const learner = await context.newPage()
  try {
    await signIn(learner, STUDENT)
    await learner.goto('/uk/dashboard/level/A1.1/pronunciation?tab=mailbox')
    await learner.waitForLoadState('networkidle')
    // Das Gespräch liegt wie zuvor im Briefkasten-Archiv; Antwort und beide eigenen Aufnahmen sind da und abspielbar.
    const problems: string[] = []
    learner.on('pageerror', error => problems.push(error.message))
    await learner.getByRole('button', { name: /Архів/ }).click()
    await learner.getByRole('button', { name: /Lektion 1/ }).click()
    const thread = learner.getByRole('dialog', { name: 'Lektion 1' })
    await expect(thread.getByText(/Schön gelesen/)).toBeVisible()
    await expect(thread.getByText('Danke, hier ist mein zweiter Versuch.')).toBeVisible()
    await expect(thread.locator('audio')).toHaveCount(2)
    // Lernende haben weder den 2×-Schalter noch Entfernen-Knöpfe.
    await expect(thread.getByRole('combobox')).toHaveCount(2)
    await expect(thread.getByRole('button', { name: pronunciation.uk.remove_message })).toHaveCount(0)
    await expect(thread.getByRole('button', { name: pronunciation.uk.fast_playback })).toHaveCount(0)
    await screenshot(learner, 'learner-keeps-conversation')
    expect(problems).toEqual([])
  } finally { await context.close() }
})

test('student detail: deleting the learning profile keeps the person and the booking', async ({ page, request }) => {
  await signIn(page, TEACHER)
  const before = await state(request)
  await page.goto(`/de/admin/students/${STUDENT}`)
  await expect(page.getByRole('heading', { name: s.deleteProfileTitle })).toBeVisible()
  await page.getByRole('heading', { name: s.deleteProfileTitle }).scrollIntoViewIfNeeded()
  await touchTarget(page, s.deleteProfileButton)
  await noOverflow(page)
  await screenshot(page, 'student-danger')
  await page.getByRole('button', { name: s.deleteProfileButton }).click()
  const confirm = page.getByRole('dialog', { name: s.deleteProfileDialogTitle.replace('{name}', 'Olena Kovalenko') })
  await expect(confirm).toContainText(s.deleteProfileKept)
  const destroy = confirm.getByRole('button', { name: s.deleteProfileButton })
  await expect(destroy).toBeDisabled()
  await screenshot(page, 'confirm-profile')
  await confirm.getByRole('checkbox', { name: s.deleteProfileAcknowledge }).check()
  await destroy.click()
  await page.waitForURL('**/de/admin/students?deleted=1')
  await expect(page.getByText(s.profileDeleted)).toBeVisible()
  await expect(page.getByRole('link', { name: /Olena Kovalenko/ })).toHaveCount(0)
  await screenshot(page, 'profile-deleted')
  const after = await state(request)
  expect(after.profiles).not.toContain(STUDENT)
  expect(after.submissions.map(row => row.id)).not.toContain(SUBMISSION)
  expect(after.storage).toEqual([])
  // People-Daten und Buchungen bleiben: nur die Verknüpfung zum Konto ist gelöst.
  expect(after.people.find(person => person.display_name === 'Olena Kovalenko')).toMatchObject({ auth_user_id: null })
  expect(after.people).toHaveLength(before.people.length)
  expect(after.bookings).toBe(before.bookings)
})

test('learner: deleting the own profile needs an acknowledgement and ends signed out', async ({ page, request }) => {
  await signIn(page, STUDENT)
  const t = uk.profile_delete
  await page.goto('/uk/dashboard/profile')
  await expect(page.getByRole('heading', { name: t.title })).toBeVisible()
  await expect(page.getByRole('heading', { name: uk.progress_reset.title })).toBeVisible()
  await page.getByRole('heading', { name: t.title }).scrollIntoViewIfNeeded()
  await touchTarget(page, t.button)
  await noOverflow(page)
  await screenshot(page, 'learner-danger')
  await page.getByRole('button', { name: t.button }).click()
  const confirm = page.getByRole('dialog', { name: t.dialog_title })
  await expect(confirm).toContainText(t.scope)
  await expect(confirm.getByRole('button', { name: t.cancel })).toBeFocused()
  const destroy = confirm.getByRole('button', { name: t.confirm })
  await expect(destroy).toBeDisabled()
  await screenshot(page, 'learner-confirm')
  await page.keyboard.press('Escape')
  await expect(confirm).toBeHidden()
  expect((await state(request)).profiles).toContain(STUDENT)

  await page.getByRole('button', { name: t.button }).click()
  await confirm.getByRole('checkbox', { name: t.acknowledge }).check()
  await destroy.click()
  await page.waitForURL('**/uk/login?status=profile_deleted')
  await expect(page.getByText(uk.auth.status_profile_deleted)).toBeVisible()
  await screenshot(page, 'learner-deleted')
  const after = await state(request)
  expect(after.profiles).not.toContain(STUDENT)
  expect(after.people.find(person => person.display_name === 'Olena Kovalenko')).toMatchObject({ auth_user_id: null })
  expect(de.auth.status_profile_deleted).toBeTruthy()
})
