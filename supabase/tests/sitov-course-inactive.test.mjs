import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const migration = '87_sitov_course_level_3_inactive.sql'
const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const teacher = uid(1)
const [level2, level3] = ['05cdec9b-9da7-43fb-b3b0-109515207789', 'a2602f45-acdb-42b2-b587-8aebabfdd218']

/**
 * A course is switched inactive through `courses.archived_at` (course CMS: "Inaktiv"). The
 * catalogue then hides it from the home page and the registration and refuses new registrations.
 */
await test('"Deutsch Level 3" is switched inactive: hidden from the catalogue and no longer bookable (87)', async t => {
  const db = new PGlite()
  try {
    // The canonical business model with the nine production courses (see canonical-business.test.mjs).
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb DEFAULT '{}');
      CREATE TABLE profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),name text,email text,role text,phone text,street text,zip_code text,city text,legacy_user_id uuid,ui_language text DEFAULT 'de',native_language text,allowed_levels text[] DEFAULT '{}');
      GRANT SELECT ON profiles TO authenticated;GRANT ALL ON profiles TO service_role;
      CREATE TABLE courses(id text PRIMARY KEY,booking_id uuid,title text,translation_key text,type text,price numeric,unit_duration integer,instructor text,start_date date,end_date date,trial_lessons boolean,sessions jsonb);
      CREATE TABLE course_exceptions(date date,reason text,course_ids text[]);
      CREATE TABLE users(id uuid);CREATE TABLE registrations(id uuid);CREATE TABLE monthly_course_bookings(id uuid);`)
    await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())', [teacher, 'teacher@example.test'])
    await db.query("INSERT INTO profiles(id,name,email,role,native_language) VALUES($1,'Teacher','teacher@example.test','teacher','Deutsch')", [teacher])
    for (const c of JSON.parse(await read('./fixtures/vps-courses.json'))) {
      await db.query('INSERT INTO courses VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [c.id, c.booking_id, c.title, c.translation_key, c.type, c.price, c.unit_duration, c.instructor, c.start_date, c.end_date, c.trial_lessons, JSON.stringify(c.sessions)])
    }
    for (const file of ['../vps/mail.sql', '../vps/business.sql', '../standardization/foundation.sql', '../standardization/business.sql']) await db.exec(await read(file))
    const actor = async (user, role = 'authenticated') => { await db.exec('RESET ROLE'); await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user ?? '']); await db.exec(`SET ROLE ${role}`) }
    const run = async path => { await db.exec('RESET ROLE'); await db.exec(`BEGIN;${await read(path)}COMMIT;`) }
    const start = (await db.query("SELECT (date_trunc('month',now())+interval '1 month')::date::text date")).rows[0].date
    const offered = async role => { await actor(null, role); return (await db.query('SELECT slug FROM courses ORDER BY sort_order')).rows.map(row => row.slug) }
    const register = async (name, course) => {
      await actor(null, 'service_role')
      return (await db.query('SELECT submit_business_registration($1,$2,$3,$4,$5,false) id',
        [JSON.stringify({ name, email: `${name.toLowerCase()}@example.test` }), JSON.stringify([{ course_id: course }]), start, JSON.stringify({ privacy: true, agb: true }), 'de'])).rows[0].id
    }
    const state = async () => { await db.exec('RESET ROLE'); return (await db.query("SELECT slug,archived_at FROM courses ORDER BY sort_order")).rows }

    await t.test('before: the course is offered and bookable', async () => {
      assert.ok((await offered('anon')).includes('deutsch-level-3'))
      assert.match(await register('Before', level3), /^[0-9a-f-]{36}$/)
    })

    const untouched = (await state()).filter(course => course.slug !== 'deutsch-level-3')
    await run(`../vps/${migration}`)

    await t.test('the catalogue of the home page and the registration no longer lists it', async () => {
      for (const role of ['anon', 'authenticated']) {
        const slugs = await offered(role)
        assert.equal(slugs.length, 8, role)
        assert.ok(!slugs.includes('deutsch-level-3'), role)
        assert.ok(slugs.includes('deutsch-level-2'), role)
      }
      // Staff still find the course in the CMS to offer it again.
      await actor(teacher)
      assert.equal((await db.query("SELECT count(*)::int n FROM courses WHERE slug='deutsch-level-3' AND archived_at IS NOT NULL")).rows[0].n, 1)
    })

    await t.test('a new registration for the inactive course is refused; other courses stay bookable', async () => {
      await assert.rejects(register('Refused', level3))
      await db.exec('RESET ROLE')
      assert.equal((await db.query("SELECT count(*)::int n FROM bookings WHERE contact_name='Refused'")).rows[0].n, 0)
      assert.match(await register('Second', level2), /^[0-9a-f-]{36}$/)
    })

    await t.test('only this course changes; existing bookings stay; the migration is repeatable', async () => {
      const current = await state()
      assert.deepEqual(current.filter(course => course.slug !== 'deutsch-level-3'), untouched)
      assert.equal((await db.query("SELECT count(*)::int n FROM bookings WHERE contact_name='Before'")).rows[0].n, 1)
      await run(`../vps/${migration}`)
      assert.deepEqual(await state(), current, 'the switch time is kept')
      assert.equal(await read('../migrations/20261007091000_sitov_course_level_3_inactive.sql'), await read(`../vps/${migration}`))
      assert.ok((await read('../schema.sql')).includes(`-- Consolidated correction: ${migration}\n${await read(`../vps/${migration}`)}`))
    })

    await t.test('the rollback offers the course again', async () => {
      await run(`../vps/rollback/${migration}`)
      assert.ok((await offered('anon')).includes('deutsch-level-3'))
      assert.match(await register('Again', level3), /^[0-9a-f-]{36}$/)
    })
  } finally { await db.close() }
})
