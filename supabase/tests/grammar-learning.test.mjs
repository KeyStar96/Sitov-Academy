import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const security = await readFile(new URL('../seeds/grammar-progress-security.sql', import.meta.url), 'utf8')
const seed = await readFile(new URL('../seeds/grammar-curriculum-2026.sql', import.meta.url), 'utf8')
const student = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const teacher = '00000000-0000-4000-8000-000000000003'

test('Grammar curriculum and server grading in isolated PostgreSQL', async t => {
  const db = new PGlite()
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
      CREATE TABLE profiles(id uuid PRIMARY KEY, role text, allowed_levels text[]);
      CREATE TABLE exercises(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), level text NOT NULL, lesson text NOT NULL,
        topic text NOT NULL, type text NOT NULL, content jsonb NOT NULL, hint_ru text, hint_tr text, solution_audio_url text);
      CREATE TABLE user_exercise_progress(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES profiles,
        exercise_id uuid REFERENCES exercises ON DELETE CASCADE, attempts int NOT NULL DEFAULT 0, completed boolean DEFAULT false,
        score int, hint_shown boolean NOT NULL DEFAULT false, updated_at timestamptz, UNIQUE(user_id,exercise_id));
      ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
      ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
      ALTER TABLE user_exercise_progress ENABLE ROW LEVEL SECURITY;
      CREATE POLICY own_profile ON profiles FOR SELECT TO authenticated USING(id=auth.uid());
      CREATE POLICY read_exercises ON exercises FOR SELECT TO authenticated USING(auth.uid() IS NOT NULL);
      CREATE POLICY own_progress ON user_exercise_progress TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
      GRANT SELECT ON profiles,exercises TO authenticated;
      GRANT SELECT,INSERT,UPDATE,DELETE ON user_exercise_progress TO authenticated;
    `)
    await db.query("INSERT INTO profiles VALUES($1,'student',ARRAY['A1.1']),($2,'student',ARRAY[]::text[]),($3,'teacher',ARRAY[]::text[])", [student,other,teacher])
    await db.exec(seed)
    const rows = (await db.query("SELECT id,content->>'correct_answer' answer FROM exercises WHERE level='A1.1' ORDER BY id LIMIT 2")).rows
    const locked = (await db.query("SELECT id FROM exercises WHERE level='B1.2' LIMIT 1")).rows[0].id
    await db.exec(security)
    async function actor(id, role = 'authenticated') {
      await db.exec('RESET ROLE')
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id ?? ''])
      await db.exec(`SET ROLE ${role}`)
    }
    async function attempt(id, answer, hint = false) {
      return (await db.query('SELECT record_grammar_attempt($1,$2,$3) result', [id,answer,hint])).rows[0].result
    }
    await t.test('imports 100 exercises per level and preserves teacher edits on reimport', async () => {
      const counts = (await db.query('SELECT level,count(*)::int n FROM exercises GROUP BY level ORDER BY level')).rows
      assert.equal(counts.length,6); counts.forEach(row => assert.equal(row.n,100))
      await db.query("UPDATE exercises SET topic='Teacher edited topic' WHERE id=$1",[rows[0].id])
      await db.exec(seed)
      assert.equal((await db.query('SELECT topic FROM exercises WHERE id=$1',[rows[0].id])).rows[0].topic,'Teacher edited topic')
    })
    await actor(student)
    await t.test('only an unlocked level can be read or graded', async () => {
      assert.equal((await db.query('SELECT count(*)::int n FROM exercises')).rows[0].n,100)
      await assert.rejects(attempt(locked,'der'), error => error.code === '42501')
    })
    await t.test('wrong answers keep exercise open; correct answers promote completion and preserve attempt count', async () => {
      assert.deepEqual(await attempt(rows[0].id,'incorrect'), { success: true, attempts: 1, isCorrect: false })
      assert.equal((await db.query('SELECT completed FROM user_exercise_progress')).rows[0].completed,false)
      assert.deepEqual(await attempt(rows[0].id,` ${rows[0].answer.toUpperCase()} `,true), { success: true, attempts: 2, isCorrect: true })
      const progress = (await db.query('SELECT * FROM user_exercise_progress')).rows[0]
      assert.equal(progress.score,80); assert.equal(progress.completed,true); assert.equal(progress.hint_shown,true)
      await attempt(rows[0].id,'wrong again')
      const retained = (await db.query('SELECT * FROM user_exercise_progress')).rows[0]
      assert.equal(retained.completed,true); assert.equal(retained.score,80)
    })
    await t.test('direct API requests cannot forge completion or erase attempts', async () => {
      await assert.rejects(db.exec('UPDATE user_exercise_progress SET completed=true,score=100'),error => error.code === '42501')
      await assert.rejects(db.query('INSERT INTO user_exercise_progress(user_id,exercise_id,completed) VALUES($1,$2,true)',[student,rows[1].id]),error => error.code === '42501')
      await assert.rejects(db.exec('DELETE FROM user_exercise_progress'),error => error.code === '42501')
    })
    await t.test('atomic upserts retain every queued attempt', async () => {
      await Promise.all(Array.from({length:12}, () => attempt(rows[1].id,'wrong')))
      const result = await attempt(rows[1].id,rows[1].answer)
      assert.equal(result.attempts,13)
      assert.equal((await db.query('SELECT score FROM user_exercise_progress WHERE exercise_id=$1',[rows[1].id])).rows[0].score,40)
    })
    await t.test('another student cannot read progress or access unopened material', async () => {
      await actor(other)
      assert.equal((await db.query('SELECT * FROM user_exercise_progress')).rows.length,0)
      assert.equal((await db.query('SELECT * FROM exercises')).rows.length,0)
      await assert.rejects(attempt(rows[0].id,rows[0].answer),error => error.code === '42501')
    })
    await t.test('teachers retain access to all levels', async () => {
      await actor(teacher)
      assert.equal((await db.query('SELECT count(*)::int n FROM exercises')).rows[0].n,600)
      assert.equal((await attempt(rows[0].id,rows[0].answer)).isCorrect,true)
    })
    await t.test('anonymous callers and malformed submissions are rejected', async () => {
      await actor(null,'anon')
      await assert.rejects(attempt(rows[0].id,rows[0].answer),error => error.code === '42501')
      await actor(student)
      await assert.rejects(attempt(rows[0].id,''),error => error.code === '22023')
      await assert.rejects(attempt('ffffffff-ffff-4fff-8fff-ffffffffffff','der'),error => error.code === '22023')
    })
  } finally { await db.close() }
})
