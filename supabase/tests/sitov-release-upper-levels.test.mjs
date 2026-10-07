import { PGlite } from '@electric-sql/pglite'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = '86_sitov_release_upper_levels.sql'
const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const [b2Learner, c1Learner, b1Learner, teacher] = [uid(1), uid(2), uid(3), uid(4)]
const UPPER = ['B2.1', 'B2.2', 'C1.1', 'C1.2']
const SIX = "'A1.1','A1.2','A2.1','A2.2','B1.1','B1.2')"
const TEN = "'A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')"
const COARSE = ["'B1.1','B1.2','B2','C1')", "'B1.1','B1.2','B2.1','B2.2','B2','C1')"]
const GRANT = " AND EXISTS(SELECT 1 FROM public.student_level_access"
/** Every function with a student level list, its last defining migration and the expected text change. */
const TARGETS = [
  ['trainer_access_private.allowed(text,text)', '63_verb_trainer.sql', [[SIX, TEN]]],
  ['sitov_verb_private.media_allowed(text)', '63_verb_trainer.sql', [[SIX, TEN]]],
  ['sitov_verb_private.level_allowed(uuid,text)', '63_verb_trainer.sql',
    [[`'B1.1','B1.2')${GRANT}`, `'B1.1','B1.2','B2.1','B2.2')${GRANT}`], COARSE]],
  ['sitov_verb_private.tense_allowed(text,text,text)', '63_verb_trainer.sql', [COARSE]],
  ['public.get_learning_progress(uuid,text,integer)', '65_sitov_verb_learning_progress.sql', [COARSE]],
  ['sitov_pronunciation_private.readiness(text,uuid)', '66_sitov_pronunciation_readiness.sql', [[SIX, TEN]]],
  ['sitov_pronunciation_private.set_access(uuid,text,text)', '66_sitov_pronunciation_readiness.sql', [[SIX, TEN]]],
  ['public.sitov_import_vocabulary_seed(jsonb,boolean)', '74_sitov_vocabulary_chunks_import.sql', [[SIX, TEN]]],
]

/** The complete `CREATE OR REPLACE FUNCTION name(…) … AS $tag$ … $tag$;` statement of a migration file. */
function statement(source, signature) {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION ${signature.slice(0, signature.indexOf('(') + 1)}`)
  assert.ok(start >= 0, `${signature} is defined`)
  const tag = /AS (\$[A-Za-z_]*\$)/.exec(source.slice(start))
  const open = start + tag.index + tag[0].length
  const close = source.indexOf(tag[1], open)
  return source.slice(start, source.indexOf(';', close) + 1)
}
const catalog = async db => Object.fromEntries((await db.query(`SELECT sig,proowner,proacl::text acl,prosecdef,provolatile,proconfig,pg_get_functiondef(p.oid) definition
  FROM unnest($1::text[]) sig JOIN pg_proc p ON p.oid=sig::regprocedure`, [TARGETS.map(([signature]) => signature)])).rows.map(({ sig, ...row }) => [sig, row]))
const levels = async db => (await db.query('SELECT code,sort_order::int position,is_active active FROM learning_levels ORDER BY sort_order')).rows
const as = async (db, user) => { await db.exec('RESET ROLE'); await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user]); await db.exec('SET ROLE authenticated') }
const allowed = async (db, level, trainer) => (await db.query('SELECT trainer_access_private.allowed($1,$2) result', [level, trainer])).rows[0].result
const run = async (db, path) => db.exec(`BEGIN;${await read(path)}COMMIT;`)

await test('B2.1, B2.2, C1.1 and C1.2 are released to learners; C1 has no verb trainer (86)', async t => {
  const db = new PGlite()
  try {
    // The catalogue after migration 85, as in production, and the tables the access functions read.
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE SCHEMA trainer_access_private; CREATE SCHEMA sitov_verb_private; CREATE SCHEMA sitov_pronunciation_private;
      GRANT USAGE ON SCHEMA auth,trainer_access_private,sitov_verb_private TO authenticated;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE TABLE learning_levels(code text PRIMARY KEY,cefr_level text NOT NULL,sort_order smallint NOT NULL UNIQUE,is_active boolean NOT NULL DEFAULT true);
      INSERT INTO learning_levels VALUES('A1.1','A1',1,true),('A1.2','A1',2,true),('A2.1','A2',3,true),('A2.2','A2',4,true),('B1.1','B1',5,true),('B1.2','B1',6,true),
       ('B2.1','B2',7,false),('B2.2','B2',8,false),('B2','B2',9,false),('C1.1','C1',10,false),('C1.2','C1',11,false),('C1','C1',12,false),('C2','C2',13,false);
      CREATE TABLE profiles(id uuid PRIMARY KEY,role text,ui_language text);
      CREATE TABLE student_level_access(auth_user_id uuid,level text REFERENCES learning_levels,PRIMARY KEY(auth_user_id,level));
      CREATE TABLE learning_trainer_grants(auth_user_id uuid,level text,trainer text,enabled boolean,unit_mode text DEFAULT 'all',PRIMARY KEY(auth_user_id,level,trainer));
      CREATE TABLE learning_unit_grants(auth_user_id uuid,level text,trainer text,unit_id uuid);`)
    await db.query("INSERT INTO profiles VALUES($1,'student','ru'),($2,'student','en'),($3,'student','uk'),($4,'teacher','de')", [b2Learner, c1Learner, b1Learner, teacher])
    await db.query("INSERT INTO student_level_access VALUES($1,'B2.1'),($1,'B2.2'),($2,'C1.1'),($2,'C1.2'),($3,'B1.2')", [b2Learner, c1Learner, b1Learner])

    await t.test('a database without the access functions stops the migration', async () => {
      await assert.rejects(run(db, `../vps/${migration}`), /sitov_level_release_function_missing/)
      await db.exec('ROLLBACK')
      assert.ok((await levels(db)).filter(level => UPPER.includes(level.code)).every(level => !level.active), 'nothing was released')
    })

    // The real last definitions; their bodies read tables this fixture does not need to carry.
    await db.exec('SET check_function_bodies=off')
    for (const [signature, file] of TARGETS) await db.exec(statement(await read(`../vps/${file}`), signature))
    await db.exec('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA trainer_access_private,sitov_verb_private TO authenticated')
    const before = { catalog: await catalog(db), levels: await levels(db) }

    await t.test('before the release a stored grant opens nothing on the new levels', async () => {
      await as(db, b2Learner)
      for (const trainer of ['vocabulary', 'exercises', 'pronunciation', 'videos', 'verbs']) assert.equal(await allowed(db, 'B2.1', trainer), false, trainer)
      await as(db, b1Learner)
      assert.equal(await allowed(db, 'B1.2', 'exercises'), true)
      await db.exec('RESET ROLE')
    })

    await run(db, `../vps/${migration}`)

    await t.test('the four levels become active; the coarse levels and the order stay', async () => {
      assert.deepEqual(await levels(db), before.levels.map(level => UPPER.includes(level.code) ? { ...level, active: true } : level))
      const next = await db.query(`SELECT n.code FROM learning_levels n JOIN learning_levels l ON l.code='B1.2'
        WHERE n.sort_order>l.sort_order AND n.is_active ORDER BY n.sort_order LIMIT 1`)
      assert.equal(next.rows[0].code, 'B2.1', 'the level after B1.2 is B2.1')
    })

    await t.test('only the level lists change; owner, privileges and attributes are kept; the migration is repeatable', async () => {
      const current = await catalog(db)
      for (const [signature, , changes] of TARGETS) {
        const { definition, ...metadata } = current[signature]
        const { definition: previous, ...previousMetadata } = before.catalog[signature]
        assert.deepEqual(metadata, previousMetadata, signature)
        assert.equal(definition, changes.reduce((text, [released, extended]) => {
          assert.ok(text.includes(released), `${signature} carries ${released}`)
          return text.replaceAll(released, extended)
        }, previous), signature)
      }
      await run(db, `../vps/${migration}`)
      assert.deepEqual(await catalog(db), current)
      const timestamped = await read('../migrations/20261007090000_sitov_release_upper_levels.sql')
      assert.equal(timestamped, await read(`../vps/${migration}`))
      assert.ok((await read('../schema.sql')).includes(`-- Consolidated correction: ${migration}\n${timestamped}`))
    })

    await t.test('a learner with a grant uses every trainer of B2; C1 has no verb trainer', async () => {
      await as(db, b2Learner)
      for (const level of ['B2.1', 'B2.2']) for (const trainer of ['vocabulary', 'exercises', 'pronunciation', 'videos', 'verbs']) assert.equal(await allowed(db, level, trainer), true, `${level} ${trainer}`)
      for (const level of ['C1.1', 'B1.2', 'B2', 'C1']) assert.equal(await allowed(db, level, 'exercises'), false, `${level} without a grant`)
      await as(db, c1Learner)
      for (const level of ['C1.1', 'C1.2']) {
        for (const trainer of ['vocabulary', 'exercises', 'pronunciation', 'videos']) assert.equal(await allowed(db, level, trainer), true, `${level} ${trainer}`)
        assert.equal(await allowed(db, level, 'verbs'), false, `${level} has no verb trainer`)
      }
      // Staff keep the verb contexts of migration 63 and get none on C1.1/C1.2 either.
      await as(db, teacher)
      assert.equal(await allowed(db, 'B2.1', 'verbs'), true)
      assert.equal(await allowed(db, 'C1', 'verbs'), true)
      assert.equal(await allowed(db, 'C1.1', 'verbs'), false)
      assert.equal(await allowed(db, 'C1.1', 'exercises'), true)
      // A learner with German as interface language keeps the existing rule: verbs only.
      await db.exec('RESET ROLE')
      await db.query("UPDATE profiles SET ui_language='de' WHERE id=$1", [b2Learner])
      await as(db, b2Learner)
      assert.equal(await allowed(db, 'B2.1', 'exercises'), false)
      assert.equal(await allowed(db, 'B2.1', 'verbs'), true)
      await db.exec('RESET ROLE')
      await db.query("UPDATE profiles SET ui_language='ru' WHERE id=$1", [b2Learner])
    })

    await t.test('media follows the level grant; a disabled trainer stays closed', async () => {
      const media = async level => (await db.query('SELECT sitov_verb_private.media_allowed($1) result', [level])).rows[0].result
      await db.query("INSERT INTO learning_trainer_grants VALUES($1,'B2.2','videos',false,'all'),($1,'B2.2','verbs',false,'all')", [b2Learner])
      await as(db, b2Learner)
      assert.equal(await media('B2.1'), true)
      assert.equal(await media('B2.2'), false)
      assert.equal(await media('C1.1'), false)
      assert.equal(await allowed(db, 'B2.2', 'verbs'), false)
      assert.equal(await allowed(db, 'B2.1', 'verbs'), true)
      await as(db, c1Learner)
      assert.equal(await media('C1.2'), true)
      await db.exec('RESET ROLE')
    })

    await t.test('Präteritum is open on B2.1 and B2.2 like on B1', async () => {
      const tense = async (level, form) => (await db.query("SELECT sitov_verb_private.tense_allowed($1,'sitov-verb-fahren',$2) result", [level, form])).rows[0].result
      for (const level of ['B1.2', 'B2.1', 'B2.2', 'B2', 'C1']) assert.equal(await tense(level, 'past'), true, level)
      assert.equal(await tense('A2.1', 'past'), false)
      assert.equal(await tense('C1.1', 'past'), false, 'no verb context')
    })

    await t.test('a drifted definition stops the migration instead of releasing half', async () => {
      const [signature, file] = TARGETS[1]
      const released = statement(await read(`../vps/${file}`), signature)
      await db.exec(released.replace(SIX, "'A1.1','A1.2')"))
      await assert.rejects(run(db, `../vps/${migration}`), /sitov_level_release_contract_changed: sitov_verb_private\.media_allowed/)
      await db.exec('ROLLBACK')
      await db.exec(released)
      await run(db, `../vps/${migration}`)
    })

    await t.test('the rollback returns to the lists of A1.1 … B1.2 and keeps grants; reapply works', async () => {
      const applied = { catalog: await catalog(db), levels: await levels(db) }
      await run(db, `../vps/rollback/${migration}`)
      assert.deepEqual({ catalog: await catalog(db), levels: await levels(db) }, before)
      assert.equal((await db.query("SELECT count(*)::int n FROM student_level_access WHERE level=ANY($1)", [UPPER])).rows[0].n, 4)
      await as(db, b2Learner)
      assert.equal(await allowed(db, 'B2.1', 'exercises'), false)
      await db.exec('RESET ROLE')
      await run(db, `../vps/${migration}`)
      assert.deepEqual({ catalog: await catalog(db), levels: await levels(db) }, applied)
    })
  } finally { await db.close() }
})
