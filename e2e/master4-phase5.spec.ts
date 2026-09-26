import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'

const sessionFile = process.env.PHASE5_SESSION_FILE
if (!sessionFile) throw new Error('Set PHASE5_SESSION_FILE from phase5-local-carryover.py --serve')
const session = JSON.parse(readFileSync(sessionFile, 'utf8'))
const backend = 'http://127.0.0.1:54341'
const target = '/en/dashboard/level/A1.2/vocabulary'
const bread = '00000000-0000-4000-8000-000000000100'

async function rpc(page: Page, name: string, data: object) {
  const response = await page.request.post(`${backend}/rest/v1/rpc/${name}`, {
    headers: { Authorization: `Bearer ${session.access_token}` }, data,
  })
  expect(response.ok()).toBe(true)
  return response.json()
}

async function progress(page: Page) {
  const response = await page.request.get(`${backend}/rest/v1/vocabulary_direction_progress?card_id=eq.${bread}&select=id,card_id,direction,box_number,next_review_date&order=direction`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  expect(response.ok()).toBe(true)
  return response.json() as Promise<Array<{ id: string; card_id: string; direction: string; box_number: number; next_review_date: string }>>
}

async function signIn(page: Page, theme = 'light') {
  expect((await page.request.post(`${backend}/__phase5/reset`)).ok()).toBe(true)
  await page.context().addCookies([{ name: 'sb-sitov-auth-token',
    value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,
    domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' }])
  await page.addInitScript(value => {
    localStorage.setItem('theme', value)
    localStorage.setItem('academy-contrast', 'standard')
    localStorage.setItem('sitov-consent', JSON.stringify({ version: 1, marketing: false, decidedAt: new Date().toISOString() }))
  }, theme)
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  await page.emulateMedia({ reducedMotion: 'reduce' })
}

test('first A1.2 round carries A1.1 words in the same box and updates the original progress', async ({ page }, info) => {
  await signIn(page)
  const before = await progress(page)
  expect(before.map(row => row.box_number)).toEqual([3, 3])
  await page.goto(`${target}/lessons`)
  await expect(page.getByRole('heading', { name: 'From earlier levels' })).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Include words from earlier levels' })).not.toBeChecked()
  expect((await rpc(page, 'get_vocabulary_carryover', { p_target_level: 'A1.2' })).startedAt).toBeNull()
  await page.goto(`${target}/train`)
  const dialog = page.getByRole('dialog', { name: 'Bring along 2 unfinished words from A1.1?' })
  await expect(dialog).toBeVisible()
  const buttons = dialog.getByRole('button')
  const names = await buttons.allTextContents()
  expect(names.indexOf('No, thanks')).toBeLessThan(names.indexOf('Bring along'))
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.screenshot({ path: info.outputPath('carryover-question.png'), fullPage: true })
  await dialog.getByRole('button', { name: 'Bring along', exact: true }).click()
  await expect(page.getByTestId('carryover-origin')).toHaveText('From A1.1')
  await expect(page.getByText('3/6', { exact: true })).toBeVisible()
  expect(await progress(page)).toEqual(before)
  await page.screenshot({ path: info.outputPath('original-box.png'), fullPage: true })
  // The app chooses its existing mode; both grading paths use real PostgreSQL.
  const answer = page.locator('#vocabulary-answer')
  if (await answer.isVisible()) {
    const prompt = await page.locator('.learning-card h2').innerText()
    await answer.fill(prompt === 'Brot' ? 'bread' : 'Brot')
    await page.getByRole('button', { name: 'Check answer', exact: true }).click()
  } else {
    await page.getByRole('button', { name: 'Reveal the answer' }).click()
    await page.getByRole('button', { name: 'I knew it', exact: true }).click()
  }
  await expect.poll(async () => (await progress(page)).map(row => row.box_number).sort()).toEqual([3, 4])
  const after = await progress(page)
  expect(after.map(row => row.id)).toEqual(before.map(row => row.id))
  expect(after.every(row => row.card_id === bread)).toBe(true)
  await page.goto(`${target}/lessons`)
  await expect(page.getByRole('switch', { name: 'Include words from earlier levels' })).toBeChecked()
  await page.getByRole('switch', { name: 'Include words from earlier levels' }).click()
  await expect(page.getByRole('switch', { name: 'Include words from earlier levels' })).not.toBeChecked()
  const disabled = await rpc(page, 'get_vocabulary_carryover', { p_target_level: 'A1.2' })
  expect(disabled.enabled).toBe(false)
  // Candidates remain available for the station's preview while disabled.
  expect(disabled.cards).toHaveLength(2)
  const denied = await rpc(page, 'submit_vocabulary_answer', {
    p_progress_id: before[0].id, p_is_correct: null, p_typed_answer: 'bread', p_ui_language: 'en', p_target_level: 'A1.2',
  })
  expect(denied.error).toBeTruthy()
  expect(await progress(page)).toEqual(after)
  await page.goto(`${target}/train`)
  await expect(page.getByRole('dialog', { name: /Bring along/ })).toHaveCount(0)
  await expect(page.getByTestId('carryover-origin')).toHaveCount(0)
  await info.attach('same-progress', { body: JSON.stringify({ before, after, denied }), contentType: 'application/json' })
})

test('first assessment records decline once and the station can later enable carryover', async ({ page }) => {
  await signIn(page)
  await page.goto(`${target}/assess?lesson=Lektion%201`)
  const dialog = page.getByRole('dialog', { name: 'Bring along 2 unfinished words from A1.1?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'No, thanks' }).click()
  await expect(dialog).toHaveCount(0)
  const declined = await rpc(page, 'get_vocabulary_carryover', { p_target_level: 'A1.2' })
  expect(declined.enabled).toBe(false)
  expect(declined.decidedAt).toBeTruthy()
  await page.reload()
  await expect(page.getByRole('dialog', { name: /Bring along/ })).toHaveCount(0)
  await page.goto(`${target}/lessons`)
  await page.getByRole('switch', { name: 'Include words from earlier levels' }).click()
  await expect(page.getByRole('switch', { name: 'Include words from earlier levels' })).toBeChecked()
  await page.goto(target)
  await expect(page.getByText('Also included: 2 words from earlier levels. They do not count towards this level’s progress.')).toBeVisible()
  await expect(page.getByRole('list', { name: 'From earlier levels' })).toContainText('A1.1')
})

test('switching off in another tab discards an already open carried session', async ({ page }) => {
  await signIn(page)
  await page.goto(`${target}/train`)
  await page.getByRole('dialog').getByRole('button', { name: 'Bring along', exact: true }).click()
  await expect(page.getByTestId('carryover-origin')).toBeVisible()
  const other = await page.context().newPage()
  await other.goto(`${target}/lessons`)
  await expect(other.getByRole('switch', { name: 'Include words from earlier levels' })).toBeChecked()
  const reload = page.waitForEvent('framenavigated', frame => frame === page.mainFrame())
  await other.getByRole('switch', { name: 'Include words from earlier levels' }).click()
  await reload
  await expect(page.getByTestId('carryover-origin')).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: /Bring along/ })).toHaveCount(0)
  expect((await rpc(page, 'get_vocabulary_carryover', { p_target_level: 'A1.2' })).enabled).toBe(false)
  await other.close()
})

test('an empty direct round does not consume the first-start question', async ({ page }) => {
  await signIn(page)
  for (const unit of ['00000000-0000-4000-8000-000000000091', '00000000-0000-4000-8000-000000000094']) {
    expect((await rpc(page, 'set_vocabulary_lesson_paused', { p_unit_id: unit, p_paused: true })).error).toBeUndefined()
  }
  await page.goto(`${target}/train`)
  await expect(page.getByRole('dialog', { name: /Bring along/ })).toHaveCount(0)
  expect((await rpc(page, 'get_vocabulary_carryover', { p_target_level: 'A1.2' })).startedAt).toBeNull()
  await rpc(page, 'set_vocabulary_lesson_paused', { p_unit_id: '00000000-0000-4000-8000-000000000091', p_paused: false })
  await page.reload()
  await expect(page.getByRole('dialog', { name: 'Bring along 1 unfinished word from A1.1?' })).toBeVisible()
})

for (const theme of ['light', 'dark']) {
  test(`mobile station and first-start question are accessible (${theme})`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, theme)
    await page.goto(`${target}/lessons`)
    const toggle = page.getByRole('switch', { name: 'Include words from earlier levels' })
    await expect(toggle).toBeVisible()
    const bounds = await toggle.boundingBox()
    expect(bounds!.height).toBeGreaterThanOrEqual(48)
    expect(bounds!.width).toBeGreaterThanOrEqual(48)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.screenshot({ path: info.outputPath(`carryover-station-${theme}.png`), fullPage: true })
    await page.goto(`${target}/train`)
    const dialog = page.getByRole('dialog', { name: 'Bring along 2 unfinished words from A1.1?' })
    await expect(dialog).toBeVisible()
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    for (const name of ['No, thanks', 'Bring along']) {
      const bounds = await dialog.getByRole('button', { name, exact: true }).boundingBox()
      expect(bounds!.height).toBeGreaterThanOrEqual(48)
      expect(bounds!.width).toBeGreaterThanOrEqual(48)
    }
    await page.screenshot({ path: info.outputPath(`carryover-question-${theme}.png`), fullPage: true })
  })
}
