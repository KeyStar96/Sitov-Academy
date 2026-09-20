import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { registrationLabels } from '../lib/admin-registration-i18n'

/** A real anonymous registration RPC and real browser Signup/Login/Profile flow.
 * The registration form's DNS/MX validator correctly refuses .invalid domains,
 * so its optional signup UI is separately covered by the component tests.
 */
test('anonymous course registration is visible after later verified signup', async ({ page, request }, testInfo) => {
  // The test instance is self-contained; existing marketing integrations are
  // outside this identity test and must receive no test-user interactions.
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort()
  })
  const api = process.env.E2E_SUPABASE_URL
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY
  expect(api, 'Start the isolated VPS gateway and load its private test env').toBeTruthy()
  expect(key, 'Test service-role key is required').toBeTruthy()
  const marker = await request.get(`${api}/__phase2/health`)
  expect(await marker.json()).toEqual({ database: 'sitov_phase2_verify', mail: 'discard', isolated: true })
  expect(marker.headers()['x-sitov-test-database']).toBe('sitov_phase2_verify')
  const admin = createClient(api!, key!, { auth: { persistSession: false, autoRefreshToken: false } })
  const token = randomUUID()
  const email = `registration-${token}@phase2.invalid`
  const password = `Test-${token}!`
  const { data: courses, error: courseError } = await admin.from('courses').select('id,title').eq('category', 'private').is('archived_at', null).limit(1)
  expect(courseError).toBeNull()
  expect(courses?.length).toBe(1)
  const course = courses![0]
  const start = new Date()
  start.setUTCDate(1)
  start.setUTCMonth(start.getUTCMonth() + 1)
  const { data: bookingId, error: bookingError } = await admin.rpc('submit_business_registration', {
    p_contact: { name: 'Phase Test', email, birth_date: '1990-01-02', street: 'Testweg 1', postal_code: '10115', city: 'Berlin' },
    p_course_selections: [{ course_id: course.id, requested_units: 2 }], p_start: start.toISOString().slice(0, 10),
    p_consents: { privacy: true, agb: true, revocation: true }, p_locale: 'ru', p_trial: false,
  })
  expect(bookingError).toBeNull()
  expect(typeof bookingId).toBe('string')
  const { data: originalBooking, error: originalError } = await admin.from('bookings').select('id,person_id,contact_name,contact_email').eq('id', bookingId).single()
  expect(originalError).toBeNull()
  const { data: unclaimed } = await admin.from('people').select('auth_user_id').eq('id', originalBooking!.person_id).single()
  expect(unclaimed!.auth_user_id).toBeNull()

  await page.goto('/ru/register', { waitUntil: 'domcontentloaded' })
  await page.locator('input[name="display_name"]').fill('Phase Test')
  await page.locator('input[name="email"]').fill(email)
  await page.locator('select[name="native_language"]').selectOption('ru')
  await page.locator('input[name="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/ru\/login\?status=signup_email_sent/, { timeout: 30000 })
  const { data: freshPerson, error: freshError } = await admin.from('people').select('id,auth_user_id').eq('email', email).not('auth_user_id', 'is', null).single()
  expect(freshError).toBeNull()
  expect(freshPerson!.id).not.toBe(originalBooking!.person_id)
  const { data: pending } = await admin.auth.admin.getUserById(freshPerson!.auth_user_id)
  expect(pending.user!.email_confirmed_at).toBeFalsy()
  // Simulate the email verification in the isolated Auth API. SMTP is discarded
  // by the gateway; this does not set a session or bypass the following login.
  const { error: verificationError } = await admin.auth.admin.updateUserById(freshPerson!.auth_user_id, { email_confirm: true })
  expect(verificationError).toBeNull()
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/ru\/dashboard$/, { timeout: 30000 })
  await page.goto('/ru/dashboard/profile', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Твои заявки на курсы' })).toBeVisible()
  const history = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Твои заявки на курсы' }) })
  await expect(history.getByRole('listitem').filter({ hasText: course.title }).last()).toBeVisible()
  await expect(page.getByText(registrationLabels('ru').identity_unresolved, { exact: true })).toHaveCount(0)
  const { data: after, error: afterError } = await admin.from('bookings').select('id,person_id,contact_name,contact_email').eq('id', bookingId).single()
  expect(afterError).toBeNull()
  expect(after).toEqual(originalBooking)
  const { data: linked } = await admin.from('people').select('auth_user_id').eq('id', originalBooking!.person_id).single()
  expect(linked!.auth_user_id).toBe(freshPerson!.auth_user_id)
  await page.screenshot({ path: testInfo.outputPath('verified-registration-dashboard.png'), fullPage: true })
})
