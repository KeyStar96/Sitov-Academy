import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const student = id(1), other = id(2), teacher = id(3), admin = id(4), fresh = id(5)
const canonical = id(20), history = id(21), otherNote = id(22)

await test('Canonical student blackboards in isolated PostgreSQL', async t => {
  const db = new PGlite()
  try {
    await db.exec(await read('./fixtures/monthly-bookings-baseline.sql'))
    for (const [person, role] of [[student, 'student'], [other, 'student'], [teacher, 'teacher'], [admin, 'teacher'], [fresh, 'student']]) {
      await db.query('INSERT INTO auth.users VALUES($1,$2,now())', [person, `${person}@test.invalid`])
      await db.query('INSERT INTO profiles(id,email,role) VALUES($1,$2,$3)', [person, `${person}@test.invalid`, role])
    }
    await db.exec(await read('../migrations/20260909155919_monthly_bookings_teacher_notes.sql'))
    await db.query("UPDATE profiles SET role='admin' WHERE id=$1", [admin])
    await db.query(`INSERT INTO teacher_student_notes(id,student_id,teacher_id,note_text,discount_percent)
      VALUES($1,$2,$3,'Visible before migration',12.5),($4,$2,$3,'Retained history',7),($5,$6,$3,'Other student',3)`,
    [canonical, student, teacher, history, otherNote, other])
    const before = (await db.query('SELECT * FROM teacher_student_notes ORDER BY id')).rows
    await db.exec(await read('../migrations/20260913110912_canonical_student_blackboards.sql'))
    // The combined conflict migration also contains a vocabulary RPC, which
    // has its own complete fixture in vps-learning.test.mjs.
    const conflictMigration = await read('../migrations/20260913144640_application_conflict_responses.sql')
    await db.exec('BEGIN;\n'+conflictMigration.slice(conflictMigration.indexOf('CREATE OR REPLACE FUNCTION public.save_student_blackboard')))
    const actor = async (person, role = 'authenticated') => {
      await db.exec('RESET ROLE')
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [person ?? ''])
      await db.exec(`SET ROLE ${role}`)
    }
    const save = (person, note, expected = null) => db.query('SELECT * FROM save_student_blackboard($1,$2,$3)', [person, note, expected])

    await t.test('migration retains every field and row and marks the previous visible note', async () => {
      const migrated = (await db.query('SELECT * FROM teacher_student_notes ORDER BY id')).rows
      assert.deepEqual(migrated.map(({ is_blackboard, ...row }) => row), before)
      assert.deepEqual(migrated.filter(row => row.is_blackboard).map(row => row.id), [canonical, otherNote])
    })
    await t.test('student and anonymous callers cannot read or save staff notes', async () => {
      await actor(student)
      assert.equal((await db.query('SELECT * FROM teacher_student_notes')).rows.length, 0)
      await assert.rejects(save(student, 'Forged'), error => error.code === '42501')
      await actor(null, 'anon')
      await assert.rejects(save(student, 'Anonymous'), error => error.code === '42501')
    })
    await t.test('staff save preserves canonical ID, original author, hidden discounts and history', async () => {
      await actor(admin)
      const saved = (await save(student, 'Updated centrally', canonical)).rows[0]
      assert.equal(saved.id, canonical)
      assert.equal(saved.teacher_id, teacher)
      assert.equal(Number(saved.discount_percent), 12.5)
      assert.equal(saved.is_blackboard, true)
      assert.equal((await db.query('SELECT note_text FROM teacher_student_notes WHERE id=$1', [history])).rows[0].note_text, 'Retained history')
    })
    await t.test('stale and foreign expected IDs fail before changing either student', async () => {
      await assert.rejects(save(student, 'Wrong target', otherNote), error => error.code === 'PT409')
      await assert.rejects(save(student, 'Wrong legacy row', history), error => error.code === 'PT409')
      assert.equal((await db.query('SELECT note_text FROM teacher_student_notes WHERE id=$1', [canonical])).rows[0].note_text, 'Updated centrally')
      assert.equal((await db.query('SELECT note_text FROM teacher_student_notes WHERE id=$1', [otherNote])).rows[0].note_text, 'Other student')
    })
    await t.test('clearing leaves the same canonical row and never exposes an older note', async () => {
      const saved = (await save(student, '', canonical)).rows[0]
      assert.equal(saved.id, canonical)
      assert.equal(saved.note_text, '\u2060')
      assert.equal(Number(saved.discount_percent), 12.5)
      assert.equal((await db.query('SELECT count(*)::int n FROM teacher_student_notes WHERE student_id=$1', [student])).rows[0].n, 2)
    })
    await t.test('stale null-ID first saves converge on one board with a unique index as backstop', async () => {
      assert.deepEqual((await save(fresh, '')).rows, [])
      const first = (await save(fresh, 'First browser')).rows[0]
      const second = (await save(fresh, 'Second browser')).rows[0]
      assert.equal(first.id, second.id)
      assert.equal(second.note_text, 'Second browser')
      assert.equal(Number(second.discount_percent), 0)
      await assert.rejects(db.query(`INSERT INTO teacher_student_notes(student_id,teacher_id,note_text,is_blackboard)
        VALUES($1,$2,'Duplicate',true)`, [fresh, admin]), error => error.code === '23505')
      assert.equal((await db.query('SELECT count(*)::int n FROM teacher_student_notes WHERE student_id=$1', [fresh])).rows[0].n, 1)
    })
    await t.test('new legacy notes cannot replace the canonical selection', async () => {
      await db.query(`INSERT INTO teacher_student_notes(id,student_id,teacher_id,note_text,discount_percent)
        VALUES($1,$2,$3,'New low-id legacy note',25)`, [id(10), student, admin])
      assert.equal((await save(student, 'Still central')).rows[0].id, canonical)
      assert.equal((await db.query('SELECT discount_percent FROM teacher_student_notes WHERE id=$1', [id(10)])).rows[0].discount_percent, '25.00')
    })
    await t.test('generic staff history CRUD still works and a profile cascade remains valid', async () => {
      await db.query('UPDATE teacher_student_notes SET note_text=$1,discount_percent=9 WHERE id=$2', ['Edited history', history])
      await db.query('DELETE FROM teacher_student_notes WHERE id=$1', [id(10)])
      assert.equal((await db.query('SELECT note_text FROM teacher_student_notes WHERE id=$1', [history])).rows[0].note_text, 'Edited history')
      await db.exec('RESET ROLE')
      await db.query('DELETE FROM profiles WHERE id=$1', [fresh])
      assert.equal((await db.query('SELECT * FROM teacher_student_notes WHERE student_id=$1', [fresh])).rows.length, 0)
    })
    await t.test('existing notes remain editable after a student is promoted to staff', async () => {
      await db.exec('RESET ROLE')
      await db.query("UPDATE profiles SET role='teacher' WHERE id=$1", [other])
      await actor(teacher)
      assert.equal((await save(other, 'Retained after promotion', otherNote)).rows[0].id, otherNote)
    })
    await t.test('RPC is invoker-only, validates students, and cannot create a board for staff', async () => {
      const config = (await db.query("SELECT prosecdef,proconfig FROM pg_proc WHERE oid='public.save_student_blackboard(uuid,text,uuid)'::regprocedure")).rows[0]
      assert.equal(config.prosecdef, false)
      assert.ok(config.proconfig.includes('search_path=""'))
      await actor(teacher)
      await assert.rejects(save(teacher, 'Not a student'), error => error.code === '23514')
      await assert.rejects(save(student, 'x'.repeat(5001)), error => error.code === '23514')
    })
  } finally { await db.close() }
})
