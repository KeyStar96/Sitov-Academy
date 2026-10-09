import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { SitovNativeDatabase, createSitovCurrentNativeDatabase } from '../supabase/tests/helpers/sitov-night-current-native-db.mjs'
import { sitovUsers, sitovId } from '../supabase/tests/helpers/sitov-night-current-db.mjs'

const literal = value => `'${String(value).replaceAll("'", "''")}'`
const levels = ['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2', 'B2.1', 'B2.2', 'C1.1', 'C1.2', 'B2', 'C1', 'unknown', null]
test('candidate verb-level shortcut: bounded native equivalence and catalog-binding counterexample', { skip: process.env.SITOV_NIGHT_NATIVE !== '1' }, async t => {
 const database = `sitov_night_verb_cost_${process.pid}`, admin = new SitovNativeDatabase()
 admin.raw(`CREATE DATABASE ${database}`)
 let db
 try {
  db = await createSitovCurrentNativeDatabase({ database })
  await db.exec(await readFile(new URL('../supabase/vps/93_sitov_commercial_access.sql', import.meta.url), 'utf8'))
  const original = (await db.query("SELECT pg_get_functiondef('sitov_verb_private.level_allowed(uuid,text)'::regprocedure) definition")).rows[0].definition
  const tail = "OR EXISTS(SELECT 1 FROM public.sitov_verb_catalog c WHERE c.level=p_level AND sitov_access_private.item_allowed(p.id,'verb',c.id))"
  assert.equal(original.split(tail).length, 2, 'candidate changes only the exact final catalog fallback')
  const guarded = `OR CASE WHEN EXISTS(SELECT 1 FROM sitov_access_private.students s, LATERAL jsonb_array_elements(s.trial->'rules') rule
   WHERE s.student_id=p.id AND rule->>'level'=p_level AND rule->>'trainer'='verbs')
   THEN EXISTS(SELECT 1 FROM public.sitov_verb_catalog c WHERE c.level=p_level AND sitov_access_private.item_allowed(p.id,'verb',c.id)) ELSE false END`
  await db.exec(original.replace('sitov_verb_private.level_allowed', 'sitov_qa_fixture.sitov_candidate_level_allowed').replace(tail, guarded))
  await db.exec(`REVOKE ALL ON FUNCTION sitov_qa_fixture.sitov_candidate_level_allowed(uuid,text) FROM PUBLIC;
   GRANT USAGE ON SCHEMA sitov_qa_fixture TO authenticated;
   GRANT EXECUTE ON FUNCTION sitov_qa_fixture.sitov_candidate_level_allowed(uuid,text) TO authenticated;`)
  // Bound every measured/cross-product client operation and its server statement.
  db.raw = sql => execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql', ['-X','-w','-qAt','-h','/tmp/sitov-night-2026-10-08-pg','-p','55438','-d',database,'-v','ON_ERROR_STOP=1'],
   { input: `SET statement_timeout='8s';${sql}`, encoding:'utf8', timeout:8500, maxBuffer:16*1024*1024,
    env:Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('PG'))), stdio:['pipe','pipe','pipe'] }).trim()
  const verbs = (await db.query("SELECT c.id,c.unit_id,c.level FROM sitov_verb_catalog c JOIN learning_units u ON u.id=c.unit_id WHERE c.level='A1.1' AND u.level=c.level AND u.trainer='verbs' ORDER BY c.id LIMIT 2")).rows
  assert.equal(verbs.length, 2)
  const counts = (await db.query('SELECT level,count(*)::int candidates FROM sitov_verb_catalog GROUP BY level ORDER BY level')).rows
  const compare = async (actor, subject = actor, claims = {}) => {
   await db.actor(actor, 'authenticated', claims)
   const rows = (await db.query(`SELECT level, sitov_verb_private.level_allowed($1,level) original,
    sitov_qa_fixture.sitov_candidate_level_allowed($1,level) candidate FROM (VALUES ${levels.map(level=>`(${level===null?'NULL::text':literal(level)})`).join(',')}) scope(level)`, [subject])).rows
   for (const row of rows) assert.equal(row.candidate, row.original, `${actor}/${subject}/${row.level}`)
   return rows
  }
  await t.test('canonical fixture legacy all/selected-empty/selected/disabled and foreign actor remain equivalent', async () => {
   for (const name of ['all','none','selected','disabled','outsider']) await compare(sitovUsers[name])
   const foreign = await compare(sitovUsers.outsider, sitovUsers.all)
   assert.ok(foreign.every(row => row.original === false))
  })
  await db.actor(null, 'postgres')
  await db.exec(`INSERT INTO learning_trainer_grants(auth_user_id,level,trainer,enabled,unit_mode)
   VALUES('${sitovUsers.none}','A1.1','verbs',true,'selected'),('${sitovUsers.selected}','A1.1','verbs',true,'selected'),('${sitovUsers.disabled}','A1.1','verbs',false,'all')
   ON CONFLICT(auth_user_id,level,trainer) DO UPDATE SET enabled=excluded.enabled,unit_mode=excluded.unit_mode;
   INSERT INTO learning_unit_grants(auth_user_id,level,trainer,unit_id) VALUES('${sitovUsers.selected}','A1.1','verbs','${verbs[0].unit_id}') ON CONFLICT DO NOTHING;`)
  await t.test('actual selected-empty/selected/disabled verb overrides remain equivalent', async () => {
   for (const name of ['none','selected','disabled']) await compare(sitovUsers[name])
  })
  const setSource = async (vip, trial) => {
   await db.actor(null, 'postgres')
   await db.exec(`INSERT INTO sitov_access_private.students(student_id,vip_enabled,trial) VALUES('${sitovUsers.outsider}',${vip},${literal(JSON.stringify(trial))}::jsonb)
    ON CONFLICT(student_id) DO UPDATE SET vip_enabled=excluded.vip_enabled,trial=excluded.trial;`)
  }
  const rule = (unit_ids, items) => ({ version:1,rules:[{level:'A1.1',trainer:'verbs',unit_ids,items}] })
  await t.test('VIP/revoke and null/empty/selected trial buckets retain exact results', async () => {
   await setSource(true, {version:1,rules:[]}); await compare(sitovUsers.outsider)
   await setSource(false, {version:1,rules:[]}); await compare(sitovUsers.outsider)
   for (const trial of [rule(null,null), rule([],null), rule([verbs[0].unit_id],[]),
    rule([verbs[0].unit_id],[{unit_id:verbs[0].unit_id,refs:[]}]),
    rule([verbs[0].unit_id],[{unit_id:verbs[0].unit_id,refs:null}]),
    rule([verbs[0].unit_id],[{unit_id:verbs[0].unit_id,refs:[{kind:'verb',id:verbs[0].id}]}]),
    {version:1,rules:[{level:'A1.1',trainer:'vocabulary',unit_ids:null,items:null}]}]) {
     await setSource(false,trial); await compare(sitovUsers.outsider)
   }
   await db.actor(null,'postgres')
   await db.exec(`INSERT INTO sitov_access_private.students(student_id,trial) VALUES('${sitovUsers.disabled}',${literal(JSON.stringify(rule(null,null)))}::jsonb) ON CONFLICT(student_id) DO UPDATE SET trial=excluded.trial`)
   await compare(sitovUsers.disabled)
  })
  await t.test('staff MFA denial and permitted staff keep actor checks', async () => {
   await db.actor(null,'postgres'); await db.exec(`UPDATE profiles SET role='admin',sitov_mfa_required=true WHERE id='${sitovUsers.teacher}'`)
   const denied = await compare(sitovUsers.teacher, sitovUsers.teacher, {aal:'aal1'})
   assert.ok(denied.every(row=>row.original===false))
   await db.actor(null,'postgres')
   await db.exec(`INSERT INTO auth.mfa_factors(user_id,status,factor_type) VALUES('${sitovUsers.teacher}','verified','totp')`)
   const verified = await compare(sitovUsers.teacher, sitovUsers.teacher, {aal:'aal2'})
   assert.equal(verified.find(row=>row.level==='A1.1').original,true)
   await db.actor(null,'postgres'); await db.exec(`UPDATE profiles SET role='teacher',sitov_mfa_required=false WHERE id='${sitovUsers.teacher}'`)
   await compare(sitovUsers.teacher)
  })
  await t.test('verified purchases and revocation remain equivalent', async () => {
   await db.actor(null,'postgres')
   await db.exec(`INSERT INTO sitov_access_private.orders(id,student_id,level,request_id,status,provider,provider_confirmation_verified,amount_minor,currency)
    VALUES('${sitovId(9901)}','${sitovUsers.outsider}','A1.1','${sitovId(9902)}','paid','stripe',true,1,'EUR');
    INSERT INTO sitov_access_private.purchases(order_id) VALUES('${sitovId(9901)}');`)
   await compare(sitovUsers.outsider)
   await db.actor(null,'postgres'); await db.exec(`UPDATE sitov_access_private.purchases SET active=false WHERE order_id='${sitovId(9901)}'`)
   await setSource(false,{version:1,rules:[]}); await compare(sitovUsers.outsider)
  })
  await t.test('bounded denied-level timing is diagnostic, never a machine-specific acceptance threshold', async () => {
   await db.actor(sitovUsers.outsider,'authenticated')
   const timing = {}
   for (const [label, fn] of [['original','sitov_verb_private.level_allowed'],['candidate','sitov_qa_fixture.sitov_candidate_level_allowed']]) {
    const start=performance.now(), rows=(await db.query(`SELECT ${fn}($1,code) allowed FROM (VALUES('B1.2'),('B2.1'),('B2.2')) l(code)`,[sitovUsers.outsider])).rows
    timing[label]={milliseconds:Math.round((performance.now()-start)*100)/100,rows:rows.length}
    assert.ok(rows.every(row=>row.allowed===false))
   }
   t.diagnostic(JSON.stringify({catalogCounts:counts,scopedClientTiming:timing,statementTimeoutMs:8000,clientTimeoutMs:8500}))
  })
  await t.test('DB-permitted catalog/parent level mismatch disproves unconditional shortcut equivalence', async () => {
   await db.actor(null,'postgres')
   // Both independent FKs remain valid; no trigger/check binds catalog.level to unit.level.
   await db.exec(`UPDATE sitov_verb_catalog SET level='B2.2' WHERE id=${literal(verbs[0].id)}`)
   await db.actor(sitovUsers.all,'authenticated')
   const row=(await db.query(`SELECT sitov_verb_private.level_allowed($1,'B2.2') original,
    sitov_qa_fixture.sitov_candidate_level_allowed($1,'B2.2') candidate`,[sitovUsers.all])).rows[0]
   assert.deepEqual(row,{original:true,candidate:false})
   t.diagnostic(JSON.stringify({decision:'NO_MIGRATION',verbId:verbs[0].id,unitId:verbs[0].unit_id,catalogLevel:'B2.2',parentLevel:'A1.1',actor:sitovUsers.all,...row}))
  })
 } finally {
  if(db) await db.close()
  admin.raw(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`)
 }
})
