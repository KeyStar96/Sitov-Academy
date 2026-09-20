import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import ru from '../dictionaries/ru.json'

/** Real UI + RPC + persisted progress; the marker prevents production writes. */
async function learner(page: Page, request: APIRequestContext, trainer: 'exercises' | 'vocabulary') {
  const api = process.env.E2E_SUPABASE_URL
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY
  expect(api, 'Start the isolated VPS test gateway and load its private env').toBeTruthy()
  expect(key).toBeTruthy()
  const marker = await request.get(`${api}/__phase2/health`)
  expect(await marker.json()).toEqual({ database: 'sitov_phase2_verify', mail: 'discard', isolated: true })
  expect(marker.headers()['x-sitov-test-database']).toBe('sitov_phase2_verify')
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  const admin = createClient(api!, key!, { auth: { persistSession: false, autoRefreshToken: false } })
  const token = randomUUID(), unitId = randomUUID()
  const email = `phase3-${token}@test.invalid`, password = `Test-${token}!`
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: 'Lerntest', native_language: 'ru', ui_language: 'ru' } })
  expect(created.error).toBeNull()
  const userId = created.data.user!.id
  const people = await admin.from('people').select('id').eq('auth_user_id', userId)
  expect(people.error).toBeNull()
  const cleanup = async () => {
    expect((await admin.auth.admin.deleteUser(userId)).error).toBeNull()
    expect((await admin.from('learning_exercises').delete().eq('unit_id', unitId)).error).toBeNull()
    expect((await admin.from('learning_vocabulary_cards').delete().eq('unit_id', unitId)).error).toBeNull()
    expect((await admin.from('learning_units').delete().eq('id', unitId)).error).toBeNull()
    for (const person of people.data ?? []) expect((await admin.from('people').delete().eq('id', person.id)).error).toBeNull()
  }
  try {
    expect((await admin.from('profiles').update({ native_language: 'ru', ui_language: 'ru' }).eq('id', userId)).error).toBeNull()
    expect((await admin.from('learning_units').insert({ id: unitId, level: 'A1.1', trainer, label: `Lerntest ${token}` })).error).toBeNull()
    expect((await admin.from('student_level_access').insert({ auth_user_id: userId, level: 'A1.1' })).error).toBeNull()
    expect((await admin.from('learning_trainer_grants').upsert({ auth_user_id: userId, level: 'A1.1', trainer, enabled: true, unit_mode: 'selected' })).error).toBeNull()
    expect((await admin.from('learning_unit_grants').insert({ auth_user_id: userId, level: 'A1.1', trainer, unit_id: unitId })).error).toBeNull()
    await page.goto('/ru/login')
    await page.locator('input[name="email"]').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/\/ru\/dashboard$/, { timeout: 30000 })
    return { admin, userId, unitId, lesson: `Lerntest ${token}`, cleanup }
  } catch (error) { await cleanup(); throw error }
}

test('canonical alternatives persist and a new grammar card clears input before Russian soft feedback', async ({ page, request }) => {
  const fixture = await learner(page, request, 'exercises')
  const { admin, userId, unitId } = fixture
  const [first, second] = [randomUUID(), randomUUID()].sort()
  try {
    expect((await admin.from('learning_exercises').insert([
      { id: first, unit_id: unitId, topic: 'Begrüßung', type: 'fill_in_blank', content: { text_before: 'Begrüßung: ', text_after: '', correct_answer: 'Guten Tag.', accepted_answers: ['Guten Tag.', 'Hallo.'], target_form: ['begrüßen'], options: ['Guten Tag.', 'Danke.'] } },
      { id: second, unit_id: unitId, topic: 'Begrüßung', type: 'fill_in_blank', content: { text_before: 'Bedanke dich: ', text_after: '', correct_answer: 'Danke.', accepted_answers: ['Danke.'], target_form: ['danken'], options: ['Danke.', 'Bitte.'] } },
    ])).error).toBeNull()
    await page.goto('/ru/dashboard/level/A1.1/exercises')
    await page.getByRole('button', { name: /^Begrüßung:/ }).click()
    await page.getByRole('textbox').fill('Hallo.')
    await page.getByRole('button', { name: ru.exercises.check_answer, exact: true }).click()
    await expect(page.getByRole('button', { name: ru.exercises.next_exercise, exact: true })).toBeVisible()
    const firstProgress = await admin.from('user_exercise_progress').select('completed,score').eq('auth_user_id', userId).eq('exercise_id', first).single()
    expect(firstProgress.error).toBeNull()
    expect(firstProgress.data).toEqual({ completed: true, score: 100 })
    await page.getByRole('button', { name: ru.exercises.next_exercise, exact: true }).click()
    await expect(page.getByRole('textbox')).toHaveValue('')
    await page.getByRole('textbox').fill('Danke')
    await page.getByRole('button', { name: ru.exercises.check_answer, exact: true }).click()
    const badge = page.getByText(ru.exercises.soft_error.punctuation, { exact: true })
    await expect(badge).toBeVisible()
    await expect(badge.locator('..')).toHaveClass(/bg-\[var\(--warning\)\]/)
    const secondProgress = await admin.from('user_exercise_progress').select('completed,score').eq('auth_user_id', userId).eq('exercise_id', second).single()
    expect(secondProgress.error).toBeNull()
    expect(secondProgress.data).toEqual({ completed: true, score: 90 })
  } finally { await fixture.cleanup() }
})

test('typed vocabulary answer earns a soft ascent with the previous interval and no lapse', async ({ page, request }) => {
  const fixture = await learner(page, request, 'vocabulary')
  const { admin, userId, unitId } = fixture
  const cardId = randomUUID(), progressId = randomUUID()
  try {
    expect((await admin.from('learning_vocabulary_cards').insert({ id: cardId, unit_id: unitId, word_de: 'Haus', article: 'das', sentence_practice: false })).error).toBeNull()
    expect((await admin.from('vocabulary_translations').insert({ card_id: cardId, locale: 'ru', translation: 'дом' })).error).toBeNull()
    expect((await admin.from('vocabulary_direction_progress').insert({ id: progressId, auth_user_id: userId, card_id: cardId, direction: 'native_to_de', box_number: 3, next_review_date: '2020-01-01', lapses: 0 })).error).toBeNull()
    await page.goto('/ru/dashboard/level/A1.1/vocabulary/train')
    await page.getByRole('textbox').fill('das Hauss')
    await page.getByRole('button', { name: ru.vocabulary.check_sentence, exact: true }).click()
    await expect(page.getByText(ru.exercises.soft_error.typo, { exact: true })).toBeVisible()
    const result = await admin.from('vocabulary_direction_progress').select('box_number,lapses,next_review_date,last_answered_at').eq('id', progressId).single()
    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({ box_number: 4, lapses: 0 })
    expect(new Date(result.data!.next_review_date).getTime() - new Date(result.data!.last_answered_at).getTime()).toBe(3 * 86400000)
  } finally { await fixture.cleanup() }
})

test('CMS requires a target form and publishes the localized translation prompt with its German target', async ({ page, request }) => {
  const fixture = await learner(page, request, 'exercises')
  const { admin, userId, unitId, lesson } = fixture
  try {
    expect((await admin.from('profiles').update({ role: 'teacher' }).eq('id', userId)).error).toBeNull()
    await page.goto('/de/admin/content/exercises')
    await expect(page.getByText('Unvollständig', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Neue Übung', exact: true }).click()
    await page.getByLabel('Lektion', { exact: true }).fill(lesson)
    await page.getByLabel('Thema', { exact: true }).fill('Vorstellung')
    await page.getByLabel('Richtige Antwort', { exact: true }).fill('Wie heißen Sie?')
    await page.getByLabel('Antwortmöglichkeiten – eine pro Zeile', { exact: true }).fill('Wie heißen Sie?\nWie geht es Ihnen?')
    await page.getByLabel('Übersetzungsaufgabe (RU, optional)', { exact: true }).fill('Как вас зовут?')
    const target = page.getByLabel('Zielwerte – eine Grundform pro Zeile (Pflichtfeld)', { exact: true })
    await page.getByRole('button', { name: 'Übung speichern', exact: true }).click()
    await expect(target).toBeVisible()
    const unsaved = await admin.from('learning_exercises').select('id').eq('unit_id', unitId)
    expect(unsaved.error).toBeNull()
    expect(unsaved.data).toEqual([])
    await target.fill('heißen')
    await page.getByRole('button', { name: 'Übung speichern', exact: true }).click()
    await expect(page.getByText('Die Übung wurde gespeichert.', { exact: true })).toBeVisible()
    const saved = await admin.from('learning_exercises').select('id,content,content_status,translations:grammar_translations(locale,prompt)').eq('unit_id', unitId).single()
    expect(saved.error).toBeNull()
    expect(saved.data).toMatchObject({ content_status: 'ready', content: { target_form: ['heißen'] }, translations: expect.arrayContaining([{ locale: 'ru', prompt: 'Как вас зовут?' }]) })
    expect((await admin.from('profiles').update({ role: 'student' }).eq('id', userId)).error).toBeNull()
    await page.goto('/ru/dashboard/level/A1.1/exercises')
    await page.getByRole('button', { name: /^Vorstellung:/ }).click()
    await expect(page.getByText('Как вас зовут? [heißen]', { exact: true })).toBeVisible()
    await page.getByRole('textbox').fill('Wie heißen Sie?')
    await page.getByRole('button', { name: ru.exercises.check_answer, exact: true }).click()
    await expect(page.getByRole('button', { name: /Завершить/ })).toBeVisible()
    const progress = await admin.from('user_exercise_progress').select('completed,score').eq('auth_user_id', userId).eq('exercise_id', saved.data!.id).single()
    expect(progress.error).toBeNull()
    expect(progress.data).toEqual({ completed: true, score: 100 })
  } finally { await fixture.cleanup() }
})
