import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { calendarWeekday } from '../lib/profile-course-calendar'
import { formatProfileMonth, profileMonthWindow } from '../lib/profile-month'
import { authenticateBrowser } from './helpers/authenticated-session'

for (const theme of ['light', 'dark'] as const) {
  test(`student calendar shows saved bookings and cancellations in both months (${theme})`, async ({ page, request }, testInfo) => {
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
    const token = randomUUID(), courseId = randomUUID(), bookingIds = [randomUUID(), randomUUID()]
    const email = `calendar-${token}@test.invalid`, password = `Test-${token}!`
    const title = `Calendar course ${token}`
    const { current, next } = profileMonthWindow()
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: 'Calendar Test', native_language: 'en', ui_language: 'en' } })
    expect(created.error).toBeNull()
    const userId = created.data.user!.id
    const person = await admin.from('people').select('id').eq('auth_user_id', userId).single()
    expect(person.error).toBeNull()
    const personId = person.data!.id
    try {
      expect((await admin.from('profiles').update({ native_language: 'en', ui_language: 'en' }).eq('id', userId)).error).toBeNull()
      expect((await admin.from('courses').insert({ id: courseId, slug: `calendar-${token}`, title, type: 'online', category: 'online', unit_price: 25, unit_minutes: 45, start_date: current })).error).toBeNull()
      expect((await admin.from('course_schedules').insert({ course_id: courseId, weekday: calendarWeekday(current), start_time: '18:00', end_time: '19:30' })).error).toBeNull()
      expect((await admin.from('course_exceptions').insert({ course_id: courseId, date: current, reason: 'Calendar cancellation test' })).error).toBeNull()
      expect((await admin.from('bookings').insert([current, next].map((month, index) => ({
        id: bookingIds[index], person_id: personId, target_month: month, start_date: month, kind: 'registration',
        status: index === 0 ? 'confirmed' : 'pending', contact_name: 'Calendar Test', contact_email: email,
        privacy_accepted: true, agb_accepted: true, revocation_accepted: true,
      })))).error).toBeNull()
      expect((await admin.from('booking_items').insert(bookingIds.map(booking_id => ({ booking_id, course_id: courseId, title_snapshot: title, amount: 100, unit_price: 25, unit_minutes: 45, units: 4 })))).error).toBeNull()

      await authenticateBrowser(page, { api: api!, key: key!, email, password })
      await page.goto('/en/dashboard/profile')
      const calendar = page.getByRole('region', { name: 'My course calendar' })
      await expect(calendar).toBeVisible()
      await expect(calendar.getByText('Cancelled: Calendar cancellation test', { exact: true })).toBeVisible()
      await calendar.getByRole('button', { name: /Cancelled: 1/ }).click()
      await expect(calendar.getByRole('listitem')).toHaveCount(1)
      await expect(calendar.getByRole('listitem')).toContainText(title)
      await calendar.getByRole('button', { name: 'All appointments this month' }).click()
      expect(await calendar.getByRole('listitem').count()).toBeGreaterThan(1)
      await calendar.getByRole('button', { name: formatProfileMonth(next, 'en'), exact: true }).click()
      await expect(calendar.getByText('Calendar cancellation test')).toHaveCount(0)
      await expect(calendar.getByText('Awaiting confirmation').first()).toBeVisible()
      await expect(calendar.getByText('All times: Europe/Berlin')).toBeVisible()
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
      await page.screenshot({ path: testInfo.outputPath('student-course-calendar.png') })
    } finally {
      expect((await admin.from('booking_items').delete().in('booking_id', bookingIds)).error).toBeNull()
      expect((await admin.from('bookings').delete().in('id', bookingIds)).error).toBeNull()
      expect((await admin.from('course_exceptions').delete().eq('course_id', courseId)).error).toBeNull()
      expect((await admin.from('course_schedules').delete().eq('course_id', courseId)).error).toBeNull()
      expect((await admin.from('courses').delete().eq('id', courseId)).error).toBeNull()
      expect((await admin.auth.admin.deleteUser(userId)).error).toBeNull()
      expect((await admin.from('people').delete().eq('id', personId)).error).toBeNull()
    }
  })
}
