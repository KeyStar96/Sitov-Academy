import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { teacherAnalyticsCopy } from '../lib/teacher-analytics-i18n'
import ru from '../dictionaries/ru.json'
import { authenticateBrowser } from './helpers/authenticated-session'

for (const theme of ['light', 'dark'] as const) {
  test(`teacher analytics loads SQL aggregates for the selected student and course (${theme})`, async ({ page, request }, testInfo) => {
    const api = process.env.E2E_SUPABASE_URL
    const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY
    expect(api, 'Use the isolated self-hosted test gateway').toBeTruthy()
    expect(key).toBeTruthy()
    const marker = await request.get(`${api}/__phase2/health`)
    expect(await marker.json()).toEqual({ database: 'sitov_phase2_verify', mail: 'discard', isolated: true })
    expect(marker.headers()['x-sitov-test-database']).toBe('sitov_phase2_verify')
    await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
    await page.addInitScript(value => { localStorage.setItem('theme', value); localStorage.setItem('academy-contrast', 'standard') }, theme)

    const admin = createClient(api!, key!, { auth: { persistSession: false, autoRefreshToken: false } })
    const token = randomUUID(), courseId = randomUUID(), userIds: string[] = [], personIds: string[] = []
    const password = `Test-${token}!`, teacherEmail = `analytics-teacher-${token}@test.invalid`
    const t = teacherAnalyticsCopy('ru')
    try {
      for (const role of ['teacher', 'student'] as const) {
        const created = await admin.auth.admin.createUser({
          email: role === 'teacher' ? teacherEmail : `analytics-student-${token}@test.invalid`, password, email_confirm: true,
          user_metadata: { display_name: `${role} ${token}`, native_language: 'ru', ui_language: 'ru' },
        })
        expect(created.error).toBeNull()
        const userId = created.data.user!.id
        userIds.push(userId)
        expect((await admin.from('profiles').update({ role, native_language: 'ru', ui_language: 'ru' }).eq('id', userId)).error).toBeNull()
        const person = await admin.from('people').select('id').eq('auth_user_id', userId).single()
        expect(person.error).toBeNull()
        personIds.push(person.data!.id)
      }
      expect((await admin.from('courses').insert({ id: courseId, slug: `analytics-${token}`, title: `Analytics A1 ${token}`, type: 'online', category: 'online', level: 'A1.1', unit_price: 25, unit_minutes: 45 })).error).toBeNull()
      await authenticateBrowser(page, { api: api!, key: key!, email: teacherEmail, password })
      await page.goto('/ru/admin/analytics')
      await expect(page.getByRole('heading', { name: t.title, exact: true })).toBeVisible()
      await page.getByRole('combobox', { name: t.student, exact: true }).selectOption(userIds[1])
      await expect(page.getByRole('region', { name: t.history }).getByText(t.noHistory, { exact: true })).toBeVisible()
      await page.getByRole('combobox', { name: t.course, exact: true }).selectOption(courseId)
      await expect(page.getByText(t.scope, { exact: true })).toBeVisible()
      const phases = page.getByRole('region', { name: t.phases, exact: true })
      await expect(phases.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
      await expect(phases.getByText(ru.vocabulary.phase_chart_empty, { exact: true })).toBeVisible()
      // A new student has no answer receipts. Do not fabricate a learning history.
      await expect(page.getByRole('region', { name: t.history }).getByText(t.noHistory, { exact: true })).toBeVisible()
      await expect(page.getByText(t.failed, { exact: true })).toHaveCount(0)
      await expect(page.getByRole('link', { name: t.manage, exact: true })).toHaveAttribute('href', '/ru/admin/courses')
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
      await page.screenshot({ path: testInfo.outputPath('teacher-course-analytics.png') })
    } finally {
      expect((await admin.from('courses').delete().eq('id', courseId)).error).toBeNull()
      for (const userId of userIds) expect((await admin.auth.admin.deleteUser(userId)).error).toBeNull()
      for (const personId of personIds) expect((await admin.from('people').delete().eq('id', personId)).error).toBeNull()
    }
  })
}
