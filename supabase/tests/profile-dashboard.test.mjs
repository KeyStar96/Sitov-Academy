import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const baseline = await read('./fixtures/monthly-bookings-baseline.sql')
const baseMigration = await read('../migrations/20260909155919_monthly_bookings_teacher_notes.sql')
const migration = await read('../migrations/20260909165848_profile_dashboard_workflow.sql')
const user = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'

await test('Profile dashboard workflow on isolated PostgreSQL', async t => {
  const db = new PGlite()
  try {
    await db.exec(baseline)
    for (const uid of [user, other]) {
      await db.query('insert into auth.users values($1,$2,now())',[uid,`${uid}@test.invalid`])
      await db.query('insert into profiles(id,email) values($1,$2)',[uid,`${uid}@test.invalid`])
    }
    await db.exec(baseMigration)
    await db.exec(migration)
    await db.exec("insert into courses(id,translation_key,type,price,instructor,unit_duration) values('course-a','a','online',1,'Test',60),('course-b','b','online',1,'Test',60)")
    const courses = (await db.query('select booking_id from courses order by id')).rows.map(row=>row.booking_id)
    const month = (await db.query("select to_char(date_trunc('month',now() at time zone 'Europe/Berlin') + interval '1 month','YYYY-MM-DD') as month")).rows[0].month
    async function actor(uid, role='authenticated') {
      await db.exec('reset role')
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid??''])
      await db.exec(`set role ${role}`)
    }
    let expected = null
    async function save(ids,paused,old=expected,target=month) {
      return (await db.query('select * from save_next_month_booking($1,$2,$3,$4,$5,$6)',[
        target,ids,paused,old?.id??null,old?.course_ids??null,old?.status??null,
      ])).rows[0]
    }
    await actor(user)
    await t.test('pause without selected courses persists as cancellation',async()=>{
      expected = await save([],true)
      assert.equal(expected.status,'cancelled'); assert.deepEqual(expected.course_ids,[])
    })
    await t.test('active empty selection fails without changing persisted pause',async()=>{
      await assert.rejects(save([],false),error=>error.code==='23514')
      assert.equal((await db.query('select status from monthly_course_bookings')).rows[0].status,'cancelled')
    })
    await t.test('resume and add courses atomically',async()=>{
      expected=await save(courses,false)
      assert.equal(expected.status,'pending');assert.deepEqual(expected.course_ids,courses)
    })
    await t.test('stale tab cannot overwrite the latest choice',async()=>{
      await assert.rejects(save([courses[0]],false,null),error=>error.code==='40001')
      assert.deepEqual((await db.query('select course_ids from monthly_course_bookings')).rows[0].course_ids,courses)
    })
    await t.test('arbitrary/expired target month is refused',async()=>{
      await assert.rejects(save(courses,false,expected,'2020-01-01'),error=>error.code==='22008')
    })
    await t.test('owner can revise a confirmed next-month booking with no partial cancellation',async()=>{
      await db.exec('reset role')
      await db.query("update monthly_course_bookings set status='confirmed' where id=$1",[expected.id])
      expected={...expected,status:'confirmed'}
      await actor(user)
      await assert.rejects(save(['00000000-0000-4000-8000-000000000099'],false),error=>error.code==='23514')
      assert.equal((await db.query('select status from monthly_course_bookings')).rows[0].status,'confirmed')
      expected=await save([courses[1]],false)
      assert.equal(expected.status,'pending')
    })
    await t.test('unavailable courses cannot be added',async()=>{
      await db.exec('reset role')
      await db.query("update courses set end_date='2000-01-01' where booking_id=$1",[courses[0]])
      await actor(user)
      await assert.rejects(save(courses,false),error=>error.code==='23514')
    })
    await t.test('forged expected ID grants no access to another student',async()=>{
      await actor(other)
      await assert.rejects(save([courses[1]],false),error=>error.code==='40001')
      assert.equal((await db.query('select * from monthly_course_bookings')).rows.length,0)
    })
    await t.test('anonymous RPC denied and profile identity link is not user-writable',async()=>{
      await actor(null,'anon')
      await assert.rejects(save([],true,null),error=>error.code==='42501')
      await actor(user)
      await assert.rejects(db.query('update profiles set legacy_user_id=$1 where id=$2',[other,user]),error=>error.code==='42501')
    })
    await t.test('confirmed auth email is synchronized into profiles, without browser email grant',async()=>{
      await db.exec('reset role')
      await db.query("update auth.users set email='confirmed@test.invalid' where id=$1",[user])
      assert.equal((await db.query('select email from profiles where id=$1',[user])).rows[0].email,'confirmed@test.invalid')
      await actor(user)
      await assert.rejects(db.query("update profiles set email='forged@test.invalid' where id=$1",[user]),error=>error.code==='42501')
    })
  } finally { await db.close() }
})
