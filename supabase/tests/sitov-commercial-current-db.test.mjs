import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SitovNativeDatabase, createSitovCurrentNativeDatabase } from './helpers/sitov-night-current-native-db.mjs'
import { sitovRightsSnapshot, sitovHistorySnapshot, sitovUsers, sitovId } from './helpers/sitov-night-current-db.mjs'

test('93 guarded source integration on isolated real normalized current92', { skip: process.env.SITOV_NIGHT_NATIVE !== '1' }, async t => {
  const admin = new SitovNativeDatabase(), database = `sitov_night_commercial_${process.pid}`
  admin.raw(`CREATE DATABASE ${database}`)
  let db
  try {
    db = await createSitovCurrentNativeDatabase({ database })
    // Synthetic operator fixture: remove staged staff-MFA requirement consistently before both snapshots.
    await db.actor(null, 'postgres'); await db.exec(`UPDATE profiles SET sitov_mfa_required=false WHERE id='${sitovUsers.teacher}'`)
    await db.exec(`INSERT INTO lms_media_folder(folder_id,level,title) VALUES('${sitovId(350)}','A1.1','Sitov QA upload folder');
     SET session_replication_role=replica;
     INSERT INTO learning_videos(id,unit_id,folder_id,title,storage_path,file_size) VALUES('${sitovId(351)}','${sitovId(242)}','${sitovId(350)}','Sitov QA uploaded video','A1.1/${sitovId(350)}/videos/${sitovId(351)}.mp4',100);
     SET session_replication_role=origin;`)
    const mediaBefore = {}
    for (const [name, user] of Object.entries(sitovUsers)) {
      await db.actor(user); mediaBefore[name] = (await db.query(`SELECT id FROM learning_videos WHERE id='${sitovId(351)}'`)).rows
    }
    const before = await sitovRightsSnapshot(db), history = await sitovHistorySnapshot(db)
    const sql = await readFile(new URL('../vps/93_sitov_commercial_access.sql', import.meta.url), 'utf8')
    await db.exec(sql)
    const after = await sitovRightsSnapshot(db)
    await t.test('all/none/selected/disabled/explicit-all unchanged, de expansion explicit, history unchanged', async () => {
      for (const key of Object.keys(before).filter(key => key !== 'german')) assert.deepEqual(after[key], before[key], key)
      assert.equal(before.german.filter(row => row.unit_allowed).length, 0)
      assert.equal(after.german.filter(row => row.unit_allowed).length, 8)
      assert.deepEqual(await sitovHistorySnapshot(db), history)
      for (const [name, user] of Object.entries(sitovUsers)) {
        await db.actor(user); assert.deepEqual((await db.query(`SELECT id FROM learning_videos WHERE id='${sitovId(351)}'`)).rows, mediaBefore[name], `legacy uploaded media ${name}`)
      }
      await db.actor(null, 'postgres')
      await db.exec(await readFile(new URL('../vps/rollback/93_sitov_commercial_access.sql', import.meta.url), 'utf8'))
      assert.deepEqual(await sitovRightsSnapshot(db), before, 'pristine rollback restores original effective guards')
      await db.actor(null, 'postgres'); await db.exec(sql)
    })
    await t.test('VIP source reaches real unit/content RLS and revoke restores previous rights', async () => {
      await db.actor(sitovUsers.teacher)
      assert.equal((await db.query(`SELECT set_sitov_student_vip('${sitovUsers.outsider}',true,0) result`)).rows[0].result.success, true)
      await db.actor(sitovUsers.outsider)
      assert.equal((await db.query(`SELECT id FROM learning_vocabulary_cards WHERE id='${sitovId(301)}'`)).rows.length, 1)
      await db.actor(sitovUsers.teacher)
      assert.equal((await db.query(`SELECT set_sitov_student_vip('${sitovUsers.outsider}',false,1) result`)).rows[0].result.success, true)
      await db.actor(sitovUsers.outsider)
      assert.equal((await db.query(`SELECT id FROM learning_vocabulary_cards WHERE id='${sitovId(301)}'`)).rows.length, 0)
    })
    await t.test('selected-item trial catalog only returns own scope; old unit-only RPC guard stays closed', async () => {
      const manifest = { version: 1, rules: [{ level: 'A1.1', trainer: 'vocabulary', unit_ids: [sitovId(211)],
        items: [{ unit_id: sitovId(211), refs: [{ kind: 'vocabulary_card', id: sitovId(301) }] }] }] }
      await db.actor(sitovUsers.teacher)
      assert.equal((await db.query('SELECT set_sitov_student_trial($1,$2,2) result', [sitovUsers.outsider, manifest])).rows[0].result.success, true)
      await db.actor(sitovUsers.outsider)
      const catalog = (await db.query("SELECT get_sitov_access_catalog('A1.1','vocabulary') result")).rows[0].result
      assert.deepEqual(catalog.units.flatMap(unit => unit.items.map(item => item.id)), [sitovId(301)])
      await db.actor(sitovUsers.outsider, 'postgres', { role: 'authenticated' })
      assert.equal((await db.query(`SELECT learning_private.unit_allowed('${sitovId(211)}') allowed`)).rows[0].allowed, false)
      assert.equal((await db.query(`SELECT sitov_access_private.item_allowed('${sitovUsers.outsider}','vocabulary_card','${sitovId(301)}') allowed`)).rows[0].allowed, true)
    })
    await t.test('replay preserves claims, selections, payment-off and historical state', async () => {
      const rights = await sitovRightsSnapshot(db)
      await db.actor(null, 'postgres'); await db.exec(sql)
      assert.deepEqual(await sitovRightsSnapshot(db), rights)
      assert.deepEqual(await sitovHistorySnapshot(db), history)
      await db.actor(sitovUsers.outsider)
      assert.equal((await db.query('SELECT start_sitov_checkout($1,$2) result', ['A1.1', sitovId(999)])).rows[0].result.error, 'payment_disabled')
    })
  } finally { await db?.close(); admin.raw(`DROP DATABASE ${database}`) }
})
