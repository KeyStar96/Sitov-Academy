import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPhase2Database, phase2Actor, phase2Id as id, readPhase2Sql } from './helpers/phase2-db.mjs'

await test('verified registration identity lifecycle, staff resolution and RLS', async t => {
  const db = await createPhase2Database()
  const migration = await readPhase2Sql('03_registration_identity.sql')
  const teacher = id(900), learner = id(901), family = id(902), booked = id(903), unrelated = id(904)
  try {
    await db.exec(await readPhase2Sql('02_identity_alignment.sql'))
    await db.exec(migration)
    await db.exec(`INSERT INTO locales VALUES('de'),('ru');
      CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION business_private.provision_profile();
      INSERT INTO courses(id,slug,title,type,category,level,unit_price,unit_minutes,trial_lessons)
        VALUES('${id(910)}','identity-private','Kurs nach Anmeldung','online','private','A1.1',25,45,false);`)
    const signup = async (user, email, verified = true, role = 'student') => {
      await db.exec('RESET ROLE')
      await db.query(`INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data)
        VALUES($1,$2,CASE WHEN $3 THEN now() ELSE NULL END,'{"display_name":"Neues Konto","native_language":"ru","ui_language":"ru"}')`, [user,email,verified])
      if (role !== 'student') await db.query('UPDATE profiles SET role=$2 WHERE id=$1', [user,role])
    }
    const anonPerson = async (person, email, name = 'Anmeldung') => {
      await db.exec('RESET ROLE')
      await db.query('INSERT INTO people(id,display_name,email) VALUES($1,$2,$3)', [person,name,email])
    }
    const claim = async user => {
      await phase2Actor(db,user)
      return (await db.query('SELECT claim_verified_person() result')).rows[0].result
    }
    const resolve = async (person,user) => (await db.query('SELECT resolve_registration_identity($1,$2) result',[person,user])).rows[0].result
    const bookingFor = async (person,booking) => {
      await db.exec('RESET ROLE')
      await db.query(`INSERT INTO bookings(id,person_id,target_month,start_date,contact_name,contact_email,privacy_accepted,agb_accepted)
        VALUES($1,$2,'2026-10-01','2026-10-01','Unveränderter Name','snapshot@example.test',true,true)`,[booking,person])
    }
    await signup(teacher,'staff@example.test',true,'teacher')

    await t.test('anonymous booking → later signup → verified dashboard booking, without changing snapshots or business IDs', async () => {
      await phase2Actor(db,null,'service_role')
      const start=(await db.query("SELECT (date_trunc('month',now())+interval '1 month')::date::text value")).rows[0].value
      const registration=(await db.query('SELECT submit_business_registration($1,$2,$3,$4,$5,false) id',[
        JSON.stringify({name:'Erste Anmeldung',email:'learner@example.test'}),
        JSON.stringify([{course_id:id(910),requested_units:2}]),start,JSON.stringify({privacy:true,agb:true}),'ru',
      ])).rows[0].id
      const before=(await db.query('SELECT * FROM bookings WHERE id=$1',[registration])).rows[0]
      await signup(learner,'learner@example.test',false)
      const fresh=(await db.query('SELECT id FROM people WHERE auth_user_id=$1',[learner])).rows[0].id
      assert.notEqual(fresh,before.person_id)
      await phase2Actor(db,learner)
      assert.deepEqual(await claim(learner),{error:'not_authenticated',message:'A verified account is required.'})
      assert.equal((await db.query('SELECT * FROM bookings')).rows.length,0)
      await assert.rejects(db.query('SELECT save_business_month($1,$2,false,NULL,NULL)',[
        start,JSON.stringify([{course_id:id(910),requested_units:2}]),
      ]),error=>error.code==='42501')
      await db.exec('RESET ROLE')
      await db.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1',[learner])
      assert.deepEqual(await claim(learner),{id:before.person_id,unresolved:false})
      assert.deepEqual((await db.query('SELECT * FROM bookings WHERE id=$1',[registration])).rows[0],before)
      const dashboard=(await db.query(`SELECT b.id,i.title_snapshot,i.units,i.amount FROM bookings b JOIN booking_items i ON i.booking_id=b.id WHERE b.person_id=$1`,[before.person_id])).rows
      assert.equal(dashboard.length,1)
      assert.equal(dashboard[0].title_snapshot,'Kurs nach Anmeldung')
      assert.equal(Number(dashboard[0].amount),50)
      await db.exec('RESET ROLE')
      assert.equal((await db.query('SELECT id FROM people WHERE id=$1',[fresh])).rows.length,0)
      await signup(unrelated,'different@example.test')
      await phase2Actor(db,unrelated)
      assert.equal((await db.query('SELECT * FROM bookings')).rows.length,0)
    })

    await t.test('ambiguous families require an explicit staff choice and do not reclaim a sibling on the next login', async () => {
      await signup(family,'family@example.test')
      await anonPerson(id(920),'FAMILY@example.test','Anna')
      await anonPerson(id(921),'family@example.test','Bruno')
      await bookingFor(id(920),id(922))
      const before = await claim(family)
      assert.equal(before.unresolved,true)
      await phase2Actor(db,family)
      assert.equal((await db.query('SELECT list_registration_identity_conflicts() result')).rows[0].result.error,'not_authorized')
      assert.equal((await resolve(id(920),family)).error,'not_authorized')
      await phase2Actor(db,teacher)
      const conflicts=(await db.query('SELECT list_registration_identity_conflicts() result')).rows[0].result.conflicts
      assert.equal(conflicts.filter(row=>row.email.toLowerCase()==='family@example.test').length,2)
      assert.equal(conflicts.find(row=>row.person_id===id(920)).candidates[0].can_assign,true)
      assert.deepEqual(await resolve(id(920),family),{person_id:id(920),auth_user_id:family,resolved:true})
      assert.deepEqual(await resolve(id(920),family),{person_id:id(920),auth_user_id:family,resolved:true})
      assert.deepEqual(await claim(family),{id:id(920),unresolved:false})
      await db.exec('RESET ROLE')
      assert.equal((await db.query('SELECT auth_user_id FROM people WHERE id=$1',[id(921)])).rows[0].auth_user_id,null)
      assert.equal((await db.query('SELECT resolved_by FROM business_private.registration_identity_resolutions WHERE auth_user_id=$1',[family])).rows[0].resolved_by,teacher)
    })

    await t.test('a single candidate blocked by existing account bookings remains unresolved and manual resolution cannot merge IDs', async () => {
      await signup(booked,'booked@example.test')
      const own=(await db.query('SELECT id FROM people WHERE auth_user_id=$1',[booked])).rows[0].id
      await bookingFor(own,id(930))
      await anonPerson(id(931),'booked@example.test')
      assert.deepEqual(await claim(booked),{id:own,unresolved:true})
      await phase2Actor(db,teacher)
      assert.equal((await resolve(id(931),booked)).error,'conflict')
      assert.equal((await resolve(id(931),unrelated)).error,'conflict')
      await db.exec('RESET ROLE')
      assert.equal((await db.query('SELECT person_id FROM bookings WHERE id=$1',[id(930)])).rows[0].person_id,own)
      assert.equal((await db.query('SELECT auth_user_id FROM people WHERE id=$1',[id(931)])).rows[0].auth_user_id,null)
    })

    await t.test('unverified, missing and stale targets return structured errors; anonymous execution and direct audit reads are denied', async () => {
      await signup(id(940),'pending@example.test',false)
      await anonPerson(id(941),'pending@example.test')
      await phase2Actor(db,teacher)
      for (const [person,user,code] of [[id(941),id(940),'invalid_input'],[id(999),unrelated,'not_found'],[id(920),unrelated,'conflict']]) {
        const result=await resolve(person,user)
        assert.equal(result.error,code)
        assert.equal(typeof result.message,'string')
      }
      await phase2Actor(db,learner)
      await assert.rejects(db.query('SELECT * FROM business_private.registration_identity_resolutions'),error=>error.code==='42501')
      await phase2Actor(db,null,'anon')
      await assert.rejects(db.query('SELECT list_registration_identity_conflicts()'),error=>error.code==='42501')
      await assert.rejects(resolve(id(941),id(940)),error=>error.code==='42501')
    })

    await t.test('migration replay preserves resolved identities and all business rows', async () => {
      await db.exec('RESET ROLE')
      const before=(await db.query('SELECT * FROM business_private.registration_identity_resolutions ORDER BY auth_user_id')).rows
      const bookings=(await db.query('SELECT * FROM bookings ORDER BY id')).rows
      await db.exec(migration)
      assert.deepEqual((await db.query('SELECT * FROM business_private.registration_identity_resolutions ORDER BY auth_user_id')).rows,before)
      assert.deepEqual((await db.query('SELECT * FROM bookings ORDER BY id')).rows,bookings)
      assert.deepEqual(await claim(family),{id:id(920),unresolved:false})
    })
  } finally { await db.close() }
})
