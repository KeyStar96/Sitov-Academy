import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'

const sessionFile = process.env.PHASE7_SESSION_FILE
if (!sessionFile) throw new Error('Set PHASE7_SESSION_FILE from phase7-local-dashboard.py --serve')
const teacher = JSON.parse(readFileSync(sessionFile, 'utf8'))
const learner = JSON.parse(readFileSync(join(dirname(sessionFile), 'learner-session.json'), 'utf8'))
const backend = 'http://127.0.0.1:54345'
const studentId = learner.user.id
const detail = `/en/admin/students/${studentId}`
const tabs = ['overview', 'vocabulary', 'path', 'pronunciation', 'activity', 'notes'] as const

async function rpc(page: Page, name: string, data: object = {}, session = teacher) {
  const response = await page.request.post(`${backend}/rest/v1/rpc/${name}`, {
    headers: { Authorization: `Bearer ${session.access_token}` }, data,
  })
  expect(response.ok()).toBe(true)
  return response.json()
}

async function signIn(page: Page, theme = 'light', session = teacher) {
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

async function pathData(page: Page) {
  const result = await rpc(page, 'get_teacher_student_detail', { p_student_id: studentId, p_tab: 'path', p_locale: 'en' })
  expect(result.error).toBeUndefined()
  return result.data
}

async function audit(page: Page) {
  const report = await new AxeBuilder({ page }).analyze()
  if (report.violations.length) await test.info().attach('axe-violations', {
    body: JSON.stringify(report.violations), contentType: 'application/json',
  })
  expect(report.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.length }))).toEqual([])
}

test('200-person list searches, sorts, filters and opens the student page', async ({ page }, info) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await signIn(page)
  const list = await rpc(page, 'get_teacher_dashboard_students')
  expect(list.success).toBe(true)
  expect(list.students.filter((person: { role: string }) => person.role === 'student')).toHaveLength(200)
  await page.goto('/en/admin/students')
  await expect(page.getByRole('link', { name: /Ada Lernende/ }).first()).toBeVisible()
  await page.getByRole('searchbox').fill('Ada')
  await expect(page.getByRole('link', { name: /Ada Lernende/ }).first()).toBeVisible()
  await page.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('due')
  await page.getByText('Column filters', { exact: true }).click()
  await page.getByLabel('Due cards · Minimum', { exact: true }).fill('1000')
  await expect(page.getByRole('link', { name: /Ada Lernende/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await page.getByRole('searchbox').fill('Ada')
  await audit(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: info.outputPath('teacher-list-desktop.png'), fullPage: true })
  await page.getByRole('link', { name: /Ada Lernende/ }).first().click()
  await expect(page).toHaveURL(new RegExp(`/admin/students/${studentId}`))
  await expect(page.getByRole('heading', { name: 'Ada Lernende', exact: true })).toBeVisible()
  await expect(page.getByText('Failed the same test twice', { exact: true }).first()).toBeVisible()
})

test('all six detail tabs expose learning data, preserve private words and pass unfiltered axe', async ({ page }, info) => {
  await signIn(page)
  for (const tab of tabs) {
    await page.goto(`${detail}?tab=${tab}`)
    await expect(page.getByRole('heading', { name: 'Ada Lernende', exact: true })).toBeVisible()
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
    const response = await rpc(page, 'get_teacher_student_detail', { p_student_id: studentId, p_tab: tab, p_locale: 'en' })
    expect(response.success).toBe(true)
    expect(JSON.stringify(response)).not.toContain('PRIVATE-ANSWER-DO-NOT-EXPOSE')
    if (tab === 'vocabulary') {
      await expect(page.getByText('Personal words: 1. Their content stays private.')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Latest 50 answers' })).toBeVisible()
      expect(response.data.recentAnswers.length).toBeLessThanOrEqual(50)
      expect(JSON.stringify(response.data)).not.toContain('Käse')
      await page.locator('summary').filter({ hasText: 'A1.1 · Lektion 1' }).click()
    }
    if (tab === 'path') {
      expect(response.data.paths).toHaveLength(7)
      expect(response.data.attempts.length).toBeGreaterThanOrEqual(2)
      expect(response.data.attempts[0].answers.length).toBeGreaterThan(0)
      await page.getByTestId(`teacher-attempt-${response.data.attempts[0].id}`).locator('summary').click()
      await expect(page.getByTestId(`teacher-attempt-${response.data.attempts[0].id}`).getByText('Submitted answer:', { exact: true }).first()).toBeVisible()
    }
    if (tab === 'pronunciation') await expect(page.getByRole('link', { name: 'Open conversation' }).first()).toBeVisible()
    if (tab === 'activity') expect(response.data.days).toHaveLength(30)
    if (tab === 'notes') await expect(page.getByText('Gemeinsam Artikel üben.').first()).toBeVisible()
    await audit(page)
    await page.screenshot({ path: info.outputPath(`teacher-${tab}-desktop.png`), fullPage: true })
    if (tab === 'pronunciation') {
      await page.getByRole('link', { name: 'Open conversation' }).first().click()
      await expect(page).toHaveURL(/\/admin\/submissions\?conversation=/)
      await page.getByRole('button', { name: /Ada Lernende/ }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('dialog').getByRole('heading', { name: /Ada Lernende/ })).toBeVisible()
    }
  }
})

test('multiple and all levels can be granted in advance', async ({ page }) => {
  await signIn(page)
  await page.goto(detail)
  await page.getByRole('button', { name: 'Select all levels' }).click()
  await page.getByRole('button', { name: 'Save selected levels' }).click()
  await expect.poll(async () => (await rpc(page, 'get_teacher_student_detail', { p_student_id: studentId })).data.allowed_levels.length).toBe(6)
})

test('emergency buttons cancel safely, unlock, archive resets and reject stale attempts', async ({ page }, info) => {
  await signIn(page)
  const initial = await pathData(page)
  const first = initial.paths[0]
  const second = initial.paths[1]
  await page.goto(`${detail}?tab=path`)
  const card = page.getByTestId(`teacher-path-${second.id}`)
  await card.getByRole('button', { name: 'Unlock path', exact: true }).click()
  let dialog = page.getByRole('dialog')
  const buttons = await dialog.getByRole('button').allTextContents()
  expect(buttons.indexOf('Cancel')).toBeLessThan(buttons.indexOf('Confirm'))
  await audit(page)
  await page.screenshot({ path: info.outputPath('teacher-unlock-confirm.png'), fullPage: true })
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect((await pathData(page)).interventions.length).toBe(initial.interventions.length)
  await card.getByRole('button', { name: 'Unlock path', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect.poll(async () => (await pathData(page)).paths[1].available).toBe(true)

  const testNode = first.nodes.find((node: { kind: string }) => node.kind === 'test')
  const started = await rpc(page, 'start_path_test', { p_node_id: testNode.id, p_locale: 'en' }, learner)
  expect(started.error).toBeUndefined()
  await page.reload()
  await page.getByTestId(`teacher-path-${first.id}`).getByRole('button', { name: 'Reset test', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect.poll(async () => (await pathData(page)).attempts.find((attempt: { id: string }) => attempt.id === started.attempt_id)?.isActive).toBe(false)
  expect((await rpc(page, 'finish_path_test', { p_attempt_id: started.attempt_id, p_locale: 'en' }, learner)).error).toBeTruthy()
  const archived = await pathData(page)
  expect(archived.attempts.some((attempt: { id: string }) => attempt.id === initial.attempts[0].id)).toBe(true)

  await page.getByTestId(`teacher-path-${second.id}`).getByRole('button', { name: 'Reset path', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect.poll(async () => (await pathData(page)).paths[1].available).toBe(false)
  const final = await pathData(page)
  expect(final.interventions.length).toBe(initial.interventions.length + 3)
  await audit(page)
  await info.attach('interventions', { body: JSON.stringify(final.interventions), contentType: 'application/json' })
})

for (const theme of ['light', 'dark']) test(`mobile list and path stay accessible in ${theme}`, async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, theme)
  for (const [name, route] of [['list', '/en/admin/students'], ['path', `${detail}?tab=path`]]) {
    await page.goto(route)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await audit(page)
    await page.screenshot({ path: info.outputPath(`teacher-${name}-${theme}-mobile.png`), fullPage: name !== 'list' })
  }
})

test('learners cannot read teacher RPCs, other learners or teacher routes', async ({ page }) => {
  await signIn(page, 'light', learner)
  expect((await rpc(page, 'get_teacher_dashboard_students', {}, learner)).error).toBe('not_authorized')
  for (const tab of tabs) {
    expect((await rpc(page, 'get_teacher_student_detail', { p_student_id: studentId, p_tab: tab }, learner)).error).toBe('not_authorized')
  }
  await page.goto(detail)
  await expect(page).toHaveURL(/\/en\/dashboard/)
})

test('concurrent repeated emergency requests write one audit record and retire old practice runs', async ({ page }) => {
  await signIn(page)
  const before = await pathData(page)
  const second = before.paths[1]
  const request = { p_student_id: studentId, p_unit_id: second.id, p_action: 'unlock', p_node_id: null, p_request_id: randomUUID() }
  const results = await Promise.all(Array.from({ length: 12 }, () => rpc(page, 'manage_learning_path', request)))
  expect(results.every(item => item.success)).toBe(true)
  expect(new Set(results.map(item => item.interventionId)).size).toBe(1)
  expect((await pathData(page)).interventions.length).toBe(before.interventions.length + 1)
  const started = await rpc(page, 'start_path_node', { p_node_id: second.nodes[0].id, p_locale: 'en' }, learner)
  expect(started.run_id).toBeTruthy()
  const reset = { ...request, p_action: 'reset_path', p_request_id: randomUUID() }
  const resets = await Promise.all(Array.from({ length: 8 }, () => rpc(page, 'manage_learning_path', reset)))
  expect(resets.every(item => item.success)).toBe(true)
  expect(new Set(resets.map(item => item.interventionId)).size).toBe(1)
  expect((await pathData(page)).interventions.length).toBe(before.interventions.length + 2)
  const stale = await rpc(page, 'submit_path_answer', { p_run_id: started.run_id,
    p_exercise_id: started.queue[0], p_answer: { text: 'Ja' }, p_request_id: randomUUID(), p_locale: 'en' }, learner)
  expect(stale.error).toBeTruthy()
  expect((await rpc(page, 'manage_learning_path', { ...reset, p_action: 'unlock' })).error).toBe('request_conflict')
})
