import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCurrentDatabase, apply, actor, student, teacher, result } from './helpers/current-db.mjs'

const migration = '85_sitov_upper_levels.sql'
const UPPER = ['B2.1', 'B2.2', 'C1.1', 'C1.2']
const shape = 'path_private.valid_seed_shape(jsonb)'
const levels = async db => (await db.query('SELECT code,cefr_level::text cefr,sort_order::int position,is_active active FROM learning_levels ORDER BY sort_order')).rows
const catalog = async db => (await db.query(`SELECT proowner,proacl::text acl,prosecdef,provolatile,proconfig,pg_get_functiondef(oid) definition
 FROM pg_proc WHERE oid=$1::regprocedure`, [shape])).rows[0]
const valid = (db, path) => result(db, 'SELECT path_private.valid_seed_shape($1::jsonb) result', [JSON.stringify(path)])
const as = async (db, user, role) => { await db.exec('RESET ROLE'); await actor(db, user, role) }
/** A released path seed moved to another level: the smallest valid seed of that level. */
const pathFor = (source, level) => ({ ...source, level, unit: { ...source.unit, level, label: source.unit.label.replace(source.level, level) } })

await test('B2.1, B2.2, C1.1 and C1.2 exist as inactive levels and accept path seeds (85)', async t => {
  const [source] = JSON.parse(await readFile(new URL('../seeds/path-a1.2.json', import.meta.url), 'utf8'))
  const db = await createCurrentDatabase()
  try {
    // The live catalogue before 85: the released levels and the coarse verb contexts of migration 63.
    await db.exec(`INSERT INTO cefr_levels(code) VALUES('A1'),('A2'),('B1'),('B2'),('C1') ON CONFLICT DO NOTHING;
      INSERT INTO learning_levels(code,cefr_level,sort_order,is_active) VALUES('A1.1','A1',1,true),('A1.2','A1',2,true),('A2.1','A2',3,true),
       ('A2.2','A2',4,true),('B1.1','B1',5,true),('B1.2','B1',6,true),('B2','B2',7,true),('C1','C1',8,true) ON CONFLICT(code) DO NOTHING;`)
    const before = { levels: await levels(db), shape: await catalog(db) }
    for (const level of UPPER) assert.equal(await valid(db, pathFor(source, level)), false, `${level} is refused before 85`)
    await apply(db, [migration])

    await t.test('the four levels are inserted inactive between B1.2 and the verb contexts; nothing else moves', async () => {
      const current = await levels(db)
      assert.deepEqual(current.slice(0, 6), before.levels.slice(0, 6), 'A1.1 … B1.2 are untouched')
      assert.deepEqual(current.slice(6), [
        { code: 'B2.1', cefr: 'B2', position: 7, active: false }, { code: 'B2.2', cefr: 'B2', position: 8, active: false },
        { code: 'B2', cefr: 'B2', position: 9, active: true },
        { code: 'C1.1', cefr: 'C1', position: 10, active: false }, { code: 'C1.2', cefr: 'C1', position: 11, active: false },
        { code: 'C1', cefr: 'C1', position: 12, active: true },
      ])
      // The level after B1.2 that learner-facing rules pick is still an active one.
      const next = await result(db, `SELECT n.code result FROM learning_levels n JOIN learning_levels l ON l.code='B1.2'
        WHERE n.sort_order>l.sort_order AND n.is_active ORDER BY n.sort_order LIMIT 1`)
      assert.equal(next, 'B2')
    })

    await t.test('the migration changes the level list of the seed check only and is repeatable', async () => {
      const current = await catalog(db)
      const { definition, ...metadata } = current
      const { definition: previous, ...previousMetadata } = before.shape
      assert.deepEqual(metadata, previousMetadata, 'owner, privileges and attributes are kept')
      assert.equal(definition, previous.replace("'B1.1','B1.2')", "'B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')"))
      await apply(db, [migration])
      assert.deepEqual(await catalog(db), current)
      assert.equal((await levels(db)).length, 12)
      const timestamped = await readFile(new URL('../migrations/20261005210000_sitov_upper_levels.sql', import.meta.url), 'utf8')
      assert.equal(timestamped, await readFile(new URL(`../vps/${migration}`, import.meta.url), 'utf8'))
      assert.ok((await readFile(new URL('../schema.sql', import.meta.url), 'utf8')).includes(`-- Consolidated correction: ${migration}\n${timestamped}`))
    })

    await t.test('seeds of the new levels pass the shape check; unknown levels and the verb contexts do not', async () => {
      for (const level of [...UPPER, 'A1.2', 'B1.2']) assert.equal(await valid(db, pathFor(source, level)), true, level)
      for (const level of ['B2', 'C1', 'C2.1', 'B2.3', 'b2.1']) assert.equal(await valid(db, pathFor(source, level)), false, level)
    })

    await t.test('the rollback removes the unused levels and restores the old order and check; reapply works', async () => {
      const applied = { levels: await levels(db), shape: await catalog(db) }
      await db.exec(`BEGIN;${await readFile(new URL(`../vps/rollback/${migration}`, import.meta.url), 'utf8')}COMMIT;`)
      assert.deepEqual(await levels(db), before.levels)
      assert.deepEqual(await catalog(db), before.shape)
      await apply(db, [migration])
      assert.deepEqual({ levels: await levels(db), shape: await catalog(db) }, applied)
    })

    await t.test('a B2.1 seed is imported; staff see the path, a learner without a grant does not', async () => {
      const seed = [pathFor(source, 'B2.1')]
      await as(db, null, 'service_role')
      const imported = await result(db, 'SELECT public.import_learning_path_seed($1::jsonb) result', [JSON.stringify(seed)])
      assert.ok(!imported.error, JSON.stringify(imported))
      assert.equal(imported.path_count, 1)
      await as(db, teacher)
      const shown = await result(db, "SELECT public.get_learning_path('B2.1','en') result")
      assert.equal(shown.level, 'B2.1', JSON.stringify(shown).slice(0, 300))
      assert.equal(shown.paths.length, 1)
      await as(db, student)
      const hidden = await result(db, "SELECT public.get_learning_path('B2.1','en') result")
      assert.ok(hidden.error, JSON.stringify(hidden).slice(0, 300))
      assert.equal(hidden.paths, undefined)
      // The unreleased level is no "last active level", not even for staff.
      await as(db, teacher)
      const last = await result(db, 'SELECT public.get_last_active_level() result')
      assert.ok(!UPPER.includes(last?.level), JSON.stringify(last))
      await db.exec('RESET ROLE')
      // Imported content pins the level: the rollback refuses to delete it.
      await assert.rejects(db.exec(`BEGIN;${await readFile(new URL(`../vps/rollback/${migration}`, import.meta.url), 'utf8')}COMMIT;`), error => error.code === '23503')
      await db.exec('ROLLBACK')
    })
  } finally { await db.close() }
})
