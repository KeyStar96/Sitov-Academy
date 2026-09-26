import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import AxeBuilder from '@axe-core/playwright'

// Author answers stay in the Node test runner, never in the app's read payload.
const seed = JSON.parse(readFileSync(resolve('supabase/seeds/path-a1.1.json'), 'utf8'))
const exercises = new Map<string, any>(seed.flatMap((path: any) => path.nodes.flatMap((node: any) => node.exercises.map((exercise: any) => [exercise.id, exercise]))))
const sessionFile = process.env.PHASE4_SESSION_FILE
if (!sessionFile) throw new Error('Set PHASE4_SESSION_FILE from phase4-local-import.py --serve')
const session = JSON.parse(readFileSync(sessionFile, 'utf8'))
const backend = 'http://127.0.0.1:54339'

async function signIn(page: Page, theme = 'light') {
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
  await page.goto('/en/dashboard/level/A1.1/exercises')
  await expect(page.getByTestId('path-map')).toBeVisible()
}

async function getMap(page: Page) {
  const response = await page.request.post(`${backend}/rest/v1/rpc/get_learning_path`, {
    headers: { Authorization: `Bearer ${session.access_token}` }, data: { p_level: 'A1.1', p_locale: 'en' },
  })
  expect(response.ok()).toBeTruthy()
  const map = await response.json()
  expect(map.error).toBeUndefined()
  return map
}

async function answerCurrent(page: Page, orthography = false) {
  const form = page.getByTestId('path-exercise')
  await expect(form).toBeVisible()
  const id = await form.getAttribute('data-exercise-id')
  const exercise = exercises.get(id!)
  expect(exercise).toBeDefined()
  if (exercise.exercise_type === 'fill_in_blank') {
    const answer = orthography ? `${exercise.content.correct_answer.toUpperCase()}.` : exercise.content.correct_answer
    await page.getByTestId('path-answer').fill(answer)
  } else if (exercise.exercise_type === 'multiple_choice') {
    const index = exercise.content.options.indexOf(exercise.content.correct_answer)
    expect(index).toBeGreaterThanOrEqual(0)
    await form.getByRole('radio').nth(index).check()
  } else {
    expect(exercise.exercise_type).toBe('sentence_building')
    const normalized = (text: string) => text.normalize('NFC').toLowerCase().replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ').trim()
    let remaining = normalized(exercise.content.correct_answer)
    const available = exercise.content.parts.map((part: string, index: number) => ({ part: normalized(part), index }))
    while (available.length) {
      const next = available.findIndex((item: any) => remaining === item.part || remaining.startsWith(item.part + ' '))
      expect(next, 'Canonical answer must be formable from the seed tiles').toBeGreaterThanOrEqual(0)
      const chosen = available.splice(next, 1)[0]
      await form.locator('[aria-labelledby="path-words"] button').nth(chosen.index).click()
      remaining = remaining.slice(chosen.part.length).trim()
    }
  }
  await page.getByTestId('path-check').click()
  return exercise
}

test('first complete seed path: cards, all three task forms, PostgreSQL grades and next-path unlock', async ({ page }, info) => {
  await signIn(page)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const initial = await getMap(page)
  expect(initial.paths).toHaveLength(seed.length)
  expect(initial.paths[0].available).toBe(true)
  expect(initial.paths[1].available).toBe(false)
  await page.screenshot({ path: info.outputPath('path-map.png'), fullPage: true })
  let blanks = 0
  const types = new Set<string>()
  let firstStart = true
  for (const node of initial.paths[0].nodes) {
    await page.getByTestId(`path-node-${node.id}`).click()
    await expect(page.getByTestId(node.kind === 'practice' ? 'path-rule-card' : 'path-exercise')).toBeVisible()
    // Resume the same real run to inspect the DB read contract. Chromium can
    // evict streamed Server Action bodies; APIResponse buffers this independently.
    const started = await page.request.post(`${backend}/rest/v1/rpc/${node.kind === 'test' ? 'start_path_test' : 'start_path_node'}`, {
      headers: { Authorization: `Bearer ${session.access_token}` }, data: { p_node_id: node.id, p_locale: 'en' },
    })
    expect(started.ok()).toBeTruthy()
    const payload = await started.text()
    expect(payload).not.toMatch(/correct_answer|accepted_answers|target_form/)
    if (node.kind === 'practice') {
      await expect(page.getByTestId('path-rule-card')).toBeVisible()
      if (firstStart) {
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
        await page.screenshot({ path: info.outputPath('rule-card.png'), fullPage: true })
        firstStart = false
      }
      await page.getByTestId('path-rule-continue').click()
    }
    if (node.kind !== 'test') {
      const expectedNode = seed[0].nodes.find((item: any) => item.kind === node.kind && item.sort_order === node.sort_order)
      for (let index = 0; index < expectedNode.exercises.length; index++) {
        const exercise = await answerCurrent(page, blanks < 3)
        types.add(exercise.exercise_type)
        if (exercise.exercise_type === 'fill_in_blank') blanks++
        await expect(page.getByTestId('path-feedback')).toBeVisible()
        await expect(page.getByTestId('path-feedback').getByRole('status')).toHaveText('Correct! Well done.')
        if (blanks === 3 && exercise.exercise_type === 'fill_in_blank') {
          await page.screenshot({ path: info.outputPath('postgres-grade.png'), fullPage: true })
        }
        await page.getByTestId('path-next').click()
      }
      await expect(page.getByTestId('path-map')).toBeVisible()
    } else {
      const testSize = seed[0].nodes.find((item: any) => item.kind === 'test').test_size
      for (let index = 0; index < testSize; index++) {
        const exercise = await answerCurrent(page)
        await expect(page.getByTestId('path-feedback')).toHaveCount(0)
        await expect(page.locator(`[data-exercise-id="${exercise.id}"]`)).toHaveCount(0)
      }
      await page.getByTestId('path-test-finish').click()
      await expect(page.getByRole('heading', { name: 'Test passed' })).toBeVisible()
      await page.screenshot({ path: info.outputPath('test-passed.png'), fullPage: true })
    }
  }
  expect(blanks).toBeGreaterThanOrEqual(3)
  expect([...types].sort()).toEqual(['fill_in_blank', 'multiple_choice', 'sentence_building'])
  const final = await getMap(page)
  expect(final.paths[0].completed).toBe(true)
  expect(final.paths[1].available).toBe(true)
  expect(final.paths[0].nodes.filter((node: any) => node.kind !== 'test').every((node: any) => node.stars === 3)).toBe(true)
  expect(errors).toEqual([])
  await info.attach('database-path-result', { body: JSON.stringify({ blanks, types: [...types], firstPathCompleted: true, secondPathAvailable: true }), contentType: 'application/json' })
})

for (const theme of ['light', 'dark']) {
  test(`mobile path and rule card accessibility (${theme})`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, theme)
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const map = await getMap(page)
    await page.getByTestId(`path-node-${map.paths[0].nodes[0].id}`).click()
    await expect(page.getByTestId('path-rule-card')).toBeVisible()
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    const box = await page.getByTestId('path-rule-continue').boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(48)
    expect(box!.width).toBeGreaterThanOrEqual(48)
    await page.screenshot({ path: info.outputPath(`rule-${theme}-mobile.png`), fullPage: true })
    await page.getByTestId('path-rule-continue').click()
    await expect(page.getByTestId('path-exercise')).toBeVisible()
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
