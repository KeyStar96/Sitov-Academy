import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createSitovCurrentNativeDatabase } from './helpers/sitov-night-current-native-db.mjs'
import { sitovUsers, sitovId } from './helpers/sitov-night-current-db.mjs'

// Native canonical RPC/RLS adapter slice. Does not execute TypeScript via PostgREST.
test('recommendation metadata and evidence on isolated canonical PostgreSQL17 +93', async () => {
 const database=`sitov_night_s2_recommendations_${process.pid}`
 const bin='/opt/homebrew/opt/postgresql@17/bin/'
 const args=['-h','/tmp/sitov-night-2026-10-08-pg','-p','55438']
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('PG')))
 execFileSync(`${bin}createdb`,[...args,database],{env,stdio:'pipe'})
 try {
  const db=await createSitovCurrentNativeDatabase({database})
  await db.exec(await readFile(new URL('../vps/93_sitov_commercial_access.sql',import.meta.url),'utf8'))
  await db.exec(`INSERT INTO learning_vocabulary_cards(id,word_de,unit_id) VALUES('${sitovId(312)}','Tisch','${sitovId(211)}');
   INSERT INTO sitov_access_private.students(student_id,trial) VALUES('${sitovUsers.outsider}','${JSON.stringify({version:1,rules:[{level:'A1.1',trainer:'vocabulary',unit_ids:[sitovId(211)],items:[{unit_id:sitovId(211),refs:[{kind:'vocabulary_card',id:sitovId(301)}]}]}]})}'::jsonb) ON CONFLICT(student_id) DO UPDATE SET trial=excluded.trial;`)
  await db.actor(sitovUsers.outsider)
  const catalog=(await db.query("SELECT get_sitov_access_catalog('A1.1','vocabulary') data")).rows[0].data
  assert.equal(catalog.level,'A1.1');assert.equal(catalog.trainer,'vocabulary')
  assert.deepEqual(catalog.units.map(u=>u.id),[sitovId(211)])
  assert.deepEqual(catalog.units.flatMap(u=>u.items).map(i=>[i.kind,i.id,i.published]),[['vocabulary_card',sitovId(301),true]])
  // Another account's real direction-progress row must never appear as our progress.
  assert.deepEqual((await db.query(`SELECT id,direction,box_number FROM vocabulary_direction_progress WHERE auth_user_id='${sitovUsers.outsider}' AND card_id='${sitovId(301)}'`)).rows,[])
  assert.deepEqual((await db.query(`SELECT id FROM vocabulary_direction_progress WHERE auth_user_id='${sitovUsers.selected}'`)).rows,[])
  await db.actor(sitovUsers.selected)
  const progress=(await db.query(`SELECT box_number,direction FROM vocabulary_direction_progress WHERE auth_user_id='${sitovUsers.selected}' AND card_id='${sitovId(301)}'`)).rows
  assert.deepEqual(progress,[{box_number:4,direction:'de_to_native'}])
  await db.actor(null,'postgres')
  await db.exec(`UPDATE learning_units SET is_active=false WHERE id='${sitovId(211)}'`)
  await db.actor(sitovUsers.outsider)
  assert.deepEqual((await db.query("SELECT get_sitov_access_catalog('A1.1','vocabulary') data")).rows[0].data.units,[])
 } finally { execFileSync(`${bin}dropdb`,[...args,database],{env,stdio:'pipe'}) }
})
