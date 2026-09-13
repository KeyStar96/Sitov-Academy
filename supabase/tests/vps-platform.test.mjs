import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'

await test('local limiter and legacy cleanup work in isolated PostgreSQL', async t => {
  const db = new PGlite()
  try {
    // pg_cron is stubbed; the tests never connect to an external database.
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA cron; CREATE TABLE cron.job(jobid bigint,command text);
      CREATE FUNCTION cron.unschedule(bigint) RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
      CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS $$SELECT 1::bigint$$;
      CREATE SCHEMA monthly_booking_private;
      CREATE TABLE monthly_booking_private.booking_courses(id int);
      CREATE TABLE monthly_booking_private.profile_contact_migration_audit(id int);
      CREATE FUNCTION monthly_booking_private.current_profile_role() RETURNS text LANGUAGE sql AS $$SELECT 'student'::text$$;
      CREATE FUNCTION monthly_booking_private.validate_teacher_note() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$;
      CREATE FUNCTION public.confirm_staff_registration(text,uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;
      CREATE FUNCTION public.set_manual_invoice_status(text,uuid,date,boolean,text) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;
      CREATE FUNCTION public.claim_verified_legacy_profile() RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;
    `)
    await db.exec(await readFile(new URL('../vps/platform.sql', import.meta.url), 'utf8'))
    const key = 'a'.repeat(64)
    await t.test('rejects every null RPC argument without incrementing a bucket', async () => {
      await db.exec('SET ROLE service_role')
      for (const args of [[null, 2, 60], [key, null, 60], [key, 2, null], ['z'.repeat(64), 2, 60]]) {
        await assert.rejects(db.query('SELECT * FROM consume_rate_limit($1,$2,$3)', args), /Invalid rate limit parameters/)
      }
      assert.equal((await db.query('SELECT count(*)::int n FROM platform_private.rate_limits')).rows[0].n, 0)
    })
    await t.test('enforces the limit and resets an expired bucket', async () => {
      const consume = () => db.query('SELECT * FROM consume_rate_limit($1,2,60)', [key])
      assert.equal((await consume()).rows[0].success, true)
      assert.equal((await consume()).rows[0].remaining, 0)
      assert.equal((await consume()).rows[0].success, false)
      await db.query("UPDATE platform_private.rate_limits SET expires_at=now()-interval '1 second' WHERE key_hash=$1", [key])
      assert.equal((await consume()).rows[0].remaining, 1)
    })
    await t.test('does not expose limiter writes to a student or anonymous caller', async () => {
      for (const role of ['anon', 'authenticated']) {
        await db.exec(`RESET ROLE; SET ROLE ${role}`)
        await assert.rejects(db.query('SELECT * FROM consume_rate_limit($1,2,60)', [key]), e => e.code === '42501')
      }
    })
    await t.test('removes dead business RPCs and projections while keeping current helpers', async () => {
      await db.exec('RESET ROLE')
      const { rows: [row] } = await db.query(`SELECT
        to_regclass('monthly_booking_private.booking_courses') old_table,
        to_regprocedure('public.confirm_staff_registration(text,uuid)') old_rpc,
        to_regprocedure('monthly_booking_private.current_profile_role()') role_helper,
        to_regprocedure('monthly_booking_private.validate_teacher_note()') note_helper,
        to_regprocedure('public.claim_verified_legacy_profile()') current_claim`)
      assert.equal(row.old_table, null); assert.equal(row.old_rpc, null)
      assert.ok(row.role_helper); assert.ok(row.note_helper); assert.ok(row.current_claim)
    })
  } finally { await db.close() }
})
