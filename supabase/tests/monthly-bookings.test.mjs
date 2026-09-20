import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const baseline = await readFile(new URL('./fixtures/monthly-bookings-baseline.sql', import.meta.url), 'utf8')
const migration = await readFile(new URL('./fixtures/history/migrations/20260909155919_monthly_bookings_teacher_notes.sql', import.meta.url), 'utf8')
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const student = id(1), other = id(2), teacher = id(3), admin = id(4)

async function setup(db) {
  await db.exec(baseline)
  for (const [n, role] of [[1, 'student'], [2, 'student'], [3, 'teacher'], [4, 'teacher']]) {
    await db.query('insert into auth.users values ($1,$2,now())', [id(n), `person${n}@test.invalid`])
    await db.query('insert into profiles (id,email,role) values ($1,$2,$3)', [id(n), `person${n}@test.invalid`, role])
  }
  await db.exec(`insert into courses(id,translation_key,type,price,instructor,unit_duration)
    values ('legacy-course-A','a','online',10,'Test',60), ('legacy-course-B','b','online',20,'Test',60);`)
}
async function asUser(db, uid, work, role = 'authenticated') {
  await db.exec(`set role ${role}`)
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid ?? ''])
  try { return await work() }
  finally { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub','',false)") }
}
async function denied(promise, codes = ['42501']) {
  await assert.rejects(promise, error => codes.includes(error.code))
}

await test('Monthly bookings migration and RLS on isolated PostgreSQL', async t => {
  const db = new PGlite()
  try {
    await setup(db)
    // Existing, partially populated columns must also survive deployment.
    await db.exec('alter table profiles add phone text, add street text, add zip_code text, add city text')
    await db.query('update profiles set street=$1 where id=$2', ['Keep this street', teacher])
    for (const [n, email, first, street] of [
      [10,' PERSON1@test.invalid ','Same',' Original Straße 7 '],
      [11,' PERSON1@test.invalid ','Same',' Original Straße 7 '],
      [12,'person2@test.invalid','Child A','Family street'],
      [13,'person2@test.invalid','Child B','Family street'],
      [14,'person3@test.invalid','Teacher','Conflicting street'],
      [15,'no-account@test.invalid','No account','Preserved street'],
    ]) {
      await db.query(`insert into users(id,first_name,last_name,birth_date,email,phone,street,zip,city)
        values($1,$2,'Test','01.01.2000',$3,'+49 (0) 123',$4,'00123','Київ')`,[id(n),first,email,street])
    }
    const legacyBefore = await db.query('select * from users order by id')
    await db.exec(migration)
    await db.query("update profiles set role='admin' where id=$1", [admin])
    const course = (await db.query("select booking_id from courses where id='legacy-course-A'")).rows[0].booking_id
    const courseB = (await db.query("select booking_id from courses where id='legacy-course-B'")).rows[0].booking_id
    const booking = id(100), note = id(200)
    const insertBooking = (owner, month='2026-10-01', courses=[course], status='pending', bookingId=booking) =>
      db.query('insert into monthly_course_bookings(id,user_id,target_month,course_ids,status) values ($1,$2,$3,$4,$5)',[bookingId,owner,month,courses,status])
    const insertNote = (author=teacher, studentId=student, noteId=note, discount=12.5) =>
      db.query('insert into teacher_student_notes(id,student_id,teacher_id,note_text,discount_percent) values($1,$2,$3,$4,$5)',[noteId,studentId,author,'Test note',discount])

    await t.test('copies unique/identical duplicate contacts verbatim; preserves sources', async () => {
      assert.deepEqual(await db.query('select * from users order by id'), legacyBefore)
      const p=(await db.query('select phone,street,zip_code,city from profiles where id=$1',[student])).rows[0]
      assert.deepEqual(p,{phone:'+49 (0) 123',street:' Original Straße 7 ',zip_code:'00123',city:'Київ'})
    })
    await t.test('reports shared email, existing conflicts, and missing profiles', async () => {
      const rows=(await db.query('select result,count(*)::int as n from monthly_booking_private.profile_contact_migration_audit group by result order by result')).rows
      assert.deepEqual(rows,[{result:'ambiguous_legacy',n:2},{result:'conflicting_profile',n:1},{result:'copied',n:2},{result:'no_verified_profile',n:1}])
      assert.equal((await db.query('select street from profiles where id=$1',[teacher])).rows[0].street,'Keep this street')
      assert.equal((await db.query('select street from profiles where id=$1',[other])).rows[0].street,null)
    })
    await t.test('adds stable UUIDs without changing text course IDs',async()=>{
      assert.notEqual(course,courseB)
      assert.deepEqual((await db.query('select id from courses order by id')).rows.map(x=>x.id),['legacy-course-A','legacy-course-B'])
    })
    await t.test('students cannot read migration audit or FK projection',async()=>asUser(db,student,async()=>{
      await denied(db.exec('select * from monthly_booking_private.profile_contact_migration_audit'))
      await denied(db.exec('select * from monthly_booking_private.booking_courses'))
    }))
    await t.test('students cannot self-promote or modify billing/access fields',async()=>asUser(db,student,async()=>{
      for (const expression of ["role='admin'", "role='teacher'", "allowed_levels=ARRAY['A1.1']", "subscription_status='aktiv'", "email='other@test.invalid'", `id='${other}'`]) {
        await denied(db.exec(`update profiles set ${expression} where id='${student}'`))
      }
      await denied(db.exec('truncate profiles cascade'))
    }))
    await t.test('students update their own contact, but see/change no foreign profile',async()=>asUser(db,student,async()=>{
      await db.query("update profiles set city='Berlin' where id=$1",[student])
      assert.equal((await db.query('select * from profiles')).rows.length,1)
      assert.equal((await db.query("update profiles set city='Injected' where id=$1 returning id",[other])).rows.length,0)
    }))
    await t.test('staff profile lookup/update works without recursive RLS',async()=>asUser(db,teacher,async()=>{
      assert.equal((await db.query('select * from profiles')).rows.length,4)
      await db.query("update profiles set city='Bonn' where id=$1",[other])
      await denied(db.query("update profiles set role='admin' where id=$1",[teacher]))
    }))
    await t.test('owner can create/read booking',async()=>asUser(db,student,async()=>{
      await insertBooking(student)
      assert.equal((await db.query('select * from monthly_course_bookings')).rows.length,1)
    }))
    await t.test('another student and a teacher cannot read/update/delete foreign bookings',async()=>{
      for(const uid of [other,teacher]) await asUser(db,uid,async()=>{
        assert.equal((await db.query('select * from monthly_course_bookings')).rows.length,0)
        assert.equal((await db.query("update monthly_course_bookings set status='cancelled' returning id")).rows.length,0)
        assert.equal((await db.query('delete from monthly_course_bookings returning id')).rows.length,0)
        await denied(insertBooking(student,'2026-11-01',[course],'pending',id(101)))
      })
    })
    await t.test('owner updates course projection atomically',async()=>{
      await asUser(db,student,()=>db.query('update monthly_course_bookings set course_ids=$1 where id=$2',[[course,courseB],booking]))
      assert.equal((await db.query('select * from monthly_booking_private.booking_courses')).rows.length,2)
    })
    await t.test('array rejects unknown, duplicate, empty, null, and multidimensional IDs',async()=>{
      for(const ids of [[id(999)],[course,course],[],[null]]) {
        await asUser(db,student,()=>denied(db.query('update monthly_course_bookings set course_ids=$1 where id=$2',[ids,booking]),['23503','23514']))
      }
      await asUser(db,student,()=>denied(db.query('update monthly_course_bookings set course_ids=ARRAY[ARRAY[$1::uuid]] where id=$2',[course,booking]),['23514','0A000']))
      assert.equal((await db.query('select * from monthly_booking_private.booking_courses')).rows.length,2)
    })
    await t.test('real FK blocks deleting/rekeying referenced courses',async()=>{
      await denied(db.exec("delete from courses where id='legacy-course-A'"),['23503'])
      await denied(db.query("update courses set booking_id=$1 where id='legacy-course-A'",[id(900)]),['23503'])
    })
    await t.test('month, status and user/month uniqueness are enforced',async()=>asUser(db,student,async()=>{
      await denied(insertBooking(student,'2026-10-02',[course],'pending',id(101)),['23514'])
      await denied(insertBooking(student,'infinity',[course],'pending',id(101)),['23514'])
      await denied(insertBooking(student,'2026-10-01',[course],'pending',id(101)),['23505'])
      await denied(insertBooking(student,'2026-11-01',[course],'invented',id(101)),['23514'])
    }))
    await t.test('owners cannot confirm or reassign a booking',async()=>asUser(db,student,async()=>{
      await denied(db.query("update monthly_course_bookings set status='confirmed' where id=$1",[booking]))
      await denied(db.query('update monthly_course_bookings set user_id=$1 where id=$2',[other,booking]),['23514'])
    }))
    await t.test('admins can see, confirm, and create bookings for others',async()=>asUser(db,admin,async()=>{
      assert.equal((await db.query('select * from monthly_course_bookings')).rows.length,1)
      await db.query("update monthly_course_bookings set status='confirmed' where id=$1",[booking])
      await insertBooking(other,'2026-12-01',[course],'confirmed',id(102))
    }))
    await t.test('owner can only cancel confirmed booking, then resubmit pending',async()=>asUser(db,student,async()=>{
      await denied(db.query("update monthly_course_bookings set status='pending' where id=$1",[booking]))
      await denied(db.query("update monthly_course_bookings set status='cancelled',course_ids=$1 where id=$2",[[courseB],booking]))
      await db.query("update monthly_course_bookings set status='cancelled' where id=$1",[booking])
      await db.query("update monthly_course_bookings set status='pending' where id=$1",[booking])
    }))
    await t.test('students have no note access, including their own notes',async()=>asUser(db,student,async()=>{
      assert.equal((await db.query('select * from teacher_student_notes')).rows.length,0)
      await denied(insertNote(student),['23514','42501'])
    }))
    await t.test('teacher creates note and cannot forge author or invalid student',async()=>asUser(db,teacher,async()=>{
      await insertNote()
      await denied(insertNote(admin,student,id(201)))
      await denied(insertNote(teacher,teacher,id(201)),['23514'])
    }))
    await t.test('admin reads/edits teacher note without changing authorship',async()=>asUser(db,admin,async()=>{
      assert.equal((await db.query('select * from teacher_student_notes')).rows.length,1)
      await db.query("update teacher_student_notes set note_text='Updated',discount_percent=0 where id=$1",[note])
      await denied(db.query('update teacher_student_notes set teacher_id=$1 where id=$2',[admin,note]),['23514'])
      await denied(db.query('update teacher_student_notes set student_id=$1 where id=$2',[other,note]),['23514'])
    }))
    await t.test('note discount and text constraints reject invalid data',async()=>asUser(db,teacher,async()=>{
      for(const val of [-1,101,NaN]) await denied(insertNote(teacher,student,id(201),val),['23514'])
      for(const val of ['', ' ', 'x'.repeat(5001)]) await denied(db.query('update teacher_student_notes set note_text=$1 where id=$2',[val,note]),['23514'])
    }))
    await t.test('student cannot read/update/delete existing note',async()=>asUser(db,student,async()=>{
      assert.equal((await db.query('select * from teacher_student_notes')).rows.length,0)
      assert.equal((await db.query("update teacher_student_notes set discount_percent=100 returning id")).rows.length,0)
      assert.equal((await db.query('delete from teacher_student_notes returning id')).rows.length,0)
    }))
    await t.test('anonymous requests cannot CRUD protected tables',async()=>asUser(db,null,async()=>{
      for(const table of ['profiles','monthly_course_bookings','teacher_student_notes']) {
        for(const sql of [`select * from ${table}`,`delete from ${table}`,`insert into ${table} default values`,`update ${table} set id=id`]) await denied(db.exec(sql))
      }
    },'anon'))
    await t.test('admin passes existing content/submission/feedback policies',async()=>{
      await db.query("insert into submissions(id,user_id,type) values($1,$2,'audio')",[id(300),student])
      await asUser(db,admin,async()=>{
        assert.equal((await db.query('select * from submissions')).rows.length,1)
        await db.query("update submissions set status='reviewed' where id=$1",[id(300)])
        await db.query('insert into teacher_feedback(submission_id,teacher_id,feedback_text) values($1,$2,$3)',[id(300),admin,'Good'])
        assert.equal((await db.query('select * from teacher_feedback')).rows.length,1)
        await db.query("insert into exercises(lesson,topic,type,content) values('Test','Test','multiple_choice','{}')")
      })
    })
    await t.test('teacher/admin note delete and owner/admin booking delete work',async()=>{
      await asUser(db,teacher,()=>db.query('delete from teacher_student_notes where id=$1',[note]))
      await asUser(db,student,()=>db.query('delete from monthly_course_bookings where id=$1',[booking]))
      await asUser(db,admin,()=>db.query('delete from monthly_course_bookings where id=$1',[id(102)]))
      assert.equal((await db.query('select * from monthly_booking_private.booking_courses')).rows.length,0)
    })
    await t.test('profile deletion cascades new notes/bookings and projection',async()=>{
      await asUser(db,other,()=>insertBooking(other,'2027-01-01',[course],'pending',id(104)))
      await asUser(db,teacher,()=>insertNote(teacher,other,id(204)))
      await db.query('delete from profiles where id=$1',[other])
      assert.equal((await db.query('select * from monthly_course_bookings')).rows.length,0)
      assert.equal((await db.query('select * from teacher_student_notes')).rows.length,0)
      assert.equal((await db.query('select * from monthly_booking_private.booking_courses')).rows.length,0)
    })
    await t.test('invalid profile role is rejected; legacy null stays valid',async()=>{
      await denied(db.query("update profiles set role='owner' where id=$1",[student]),['23514'])
      await db.query('update profiles set role=null where id=$1',[student])
    })
    await t.test('new tables have RLS; trigger functions are private with fixed search_path', async () => {
      const tables = (await db.query(`select relname,relrowsecurity from pg_class
        where relnamespace in ('public'::regnamespace,'monthly_booking_private'::regnamespace)
        and relname in ('monthly_course_bookings','teacher_student_notes','booking_courses','profile_contact_migration_audit')`)).rows
      assert.equal(tables.length,4)
      assert.ok(tables.every(row=>row.relrowsecurity))
      const functions = (await db.query(`select p.proname,p.proconfig,
        has_function_privilege('anon',p.oid,'execute') as anon_execute,
        has_function_privilege('authenticated',p.oid,'execute') as user_execute
        from pg_proc p where p.pronamespace='monthly_booking_private'::regnamespace`)).rows
      assert.ok(functions.every(row=>row.proconfig.includes('search_path=""') && !row.anon_execute))
      assert.ok(functions.every(row=>row.user_execute === (row.proname==='current_profile_role')))
    })
    await t.test('a replay fails without modifying existing UUIDs/data', async () => {
      const before=await db.query('select id,booking_id from courses order by id')
      await denied(db.exec(migration),['42P06'])
      await db.exec('rollback')
      assert.deepEqual(await db.query('select id,booking_id from courses order by id'),before)
    })
  } finally { await db.close() }
})

await test('Migration applies to original schema with absent contact columns',async()=>{
  const db=new PGlite()
  try { await setup(db); await db.exec(migration); assert.equal((await db.query('select phone from profiles')).rows.length,4) }
  finally { await db.close() }
})

await test('Schema drift aborts and rolls back contact backfill and role changes',async()=>{
  const db=new PGlite()
  try {
    await setup(db)
    await db.exec('drop policy "Lehrer sehen alle Submissions" on submissions')
    await denied(db.exec(migration),['42704'])
    await db.exec('rollback')
    assert.equal((await db.query("select to_regnamespace('monthly_booking_private') as schema")).rows[0].schema,null)
    assert.equal((await db.query("select count(*)::int as n from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='phone'")).rows[0].n,0)
    await denied(db.query("update profiles set role='admin' where id=$1",[admin]),['23514'])
  } finally { await db.close() }
})
