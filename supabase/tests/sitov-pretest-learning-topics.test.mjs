import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createSitovIntegrated99NativeDatabase} from './helpers/sitov-night-integrated99-native-db.mjs'
import {SitovNativeDatabase} from './helpers/sitov-night-current-native-db.mjs'
import {sitovId,sitovUsers,sitovHistorySnapshot,sitovRightsSnapshot} from './helpers/sitov-night-current-db.mjs'
import {sitovReadAuthoringSources} from '../../scripts/sitov-pronunciation-pretests-authoring.mjs'
const sql=await readFile(new URL('../migrations/20261009015000_sitov_pretest_learning_topics.sql',import.meta.url),'utf8')
const literal=value=>`'${(typeof value==='object'?JSON.stringify(value):String(value)).replaceAll("'","''")}'`
const hash=value=>createHash('sha256').update(value,'utf8').digest('hex')

// This terminal/inactive fixture proves read authorization only. No grading,
// publication, review, audio assets, or student-progress unlock is fabricated.
test('107 owned immutable failed-attempt learning topics, native integrated99',async t=>{
 const database=`sitov_night_topics107_${process.pid}_${Date.now()}`,admin=new SitovNativeDatabase()
 admin.raw(`CREATE DATABASE ${database}`)
 let db
 try{
  db=await createSitovIntegrated99NativeDatabase({database})
  assert.equal(db.installPlan.through,99)
  await db.actor(null,'postgres');await db.exec(sql)
  const draft=JSON.parse(await readFile(new URL('../seeds/sitov-pronunciation-pretests-2026-10-08.json',import.meta.url),'utf8')).drafts[0]
  const sources=await sitovReadAuthoringSources(),body=sources.rows.find(row=>row.id===draft.textId).text,textId=sitovId(107001)
  assert.equal(hash(body),draft.textVersion)
  const definition=structuredClone(draft.definition),core=definition.competencies[0].id
  definition.competencies[0].mapping.topicIds=['sitov.topic.kennenlernen','sitov.topic.kennenlernen']
  definition.competencies[1].mapping.topicIds=['sitov.topic.familie']
  await db.exec(`INSERT INTO public.learning_reading_texts(id,unit_id,sentence_de) VALUES('${textId}','${sitovId(232)}',${literal(body)})`)
  const seedDefinition=async value=>{
   await db.exec(`INSERT INTO sitov_pronunciation_private.pretest_definitions(text_id,text_version,test_version,definition) VALUES('${textId}','${draft.textVersion}',repeat('a',64),${literal(value)}::jsonb)`)
   return (await db.query('SELECT * FROM sitov_pronunciation_private.pretest_definitions WHERE text_id=$1 AND definition=$2::jsonb',[textId,value])).rows[0]
  }
  const stored=await seedDefinition(definition)
  assert.equal(stored.active,false)
  assert.equal((await db.query('SELECT sitov_pronunciation_private.valid_authoring($1,$2::jsonb) valid',[body,definition])).rows[0].valid,true)
  const newer=structuredClone(definition);newer.competencies[0].mapping.topicIds=['sitov.topic.familie'];const latest=await seedDefinition(newer)
  assert.notEqual(latest.id,stored.id);assert.notEqual(latest.test_version,stored.test_version)
  const empty=structuredClone(definition);empty.competencies[0].mapping.topicIds=[];const emptyDefinition=await seedDefinition(empty)
  const unknown=structuredClone(definition);unknown.competencies[0].mapping.topicIds=['sitov.topic.unknown'];const unknownDefinition=await seedDefinition(unknown)
  let serial=107010
  const seedAttempt=async({owner=sitovUsers.german,status='failed',d=stored,failed=[core],change={}}={})=>{
   const id=sitovId(serial++),questions=definition.tasks.filter(q=>q.competencyId===core).slice(0,3),answers=Object.fromEntries(questions.map(q=>[q.id,q.options[0].id]))
   const result={attemptId:id,textId,textVersion:d.text_version,testVersion:d.test_version,passed:false,correct:1,total:3,competencies:[{id:core,correct:1,total:3,required:2,met:false}],failedCompetencyIds:failed,learningLinks:[],proof:null,...change}
   await db.exec(`INSERT INTO sitov_pronunciation_private.pretest_attempts(id,student_id,text_id,definition_id,tasks,answers,status,revision,result) VALUES('${id}','${owner}','${textId}','${d.id}',${literal(questions)}::jsonb,${literal(answers)}::jsonb,'${status}',1,${literal(result)}::jsonb)`)
   return id
  }
  const own=await seedAttempt(),foreign=await seedAttempt({owner:sitovUsers.outsider})
  const nonfailed=[];for(const status of ['in_progress','passed','outdated'])nonfailed.push(await seedAttempt({status}))
  const noMapping=await seedAttempt({d:emptyDefinition}),unknownMapping=await seedAttempt({d:unknownDefinition}),unknownCore=await seedAttempt({failed:['sitov.core.unknown']})
  const mismatched=[];for(const change of [{attemptId:sitovId(999001)},{textId:sitovId(999002)},{textVersion:'c'.repeat(64)},{testVersion:'c'.repeat(64)},{passed:true},{failedCompetencyIds:{bad:core}}])mismatched.push(await seedAttempt({change}))
  const rpc=async id=>(await db.query('SELECT public.sitov_get_pronunciation_pretest_learning_topics($1) value',[id])).rows[0].value
  const functionSnapshot=async()=>(await db.query(`SELECT p.oid,n.nspname,p.proname,p.provolatile,p.prosecdef,p.proconfig,p.proacl,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='public' AND p.proname='sitov_get_pronunciation_pretest_learning_topics') OR (n.nspname='sitov_pronunciation_private' AND p.proname='learning_topics') ORDER BY n.nspname`)).rows
  const dataSnapshot=async()=>{
   await db.actor(null,'postgres')
   const tables=(await db.query(`SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN('public','sitov_pronunciation_private','sitov_access_private','pronunciation_private','storage') ORDER BY schemaname,tablename`)).rows
   const parts=tables.map(({schemaname,tablename})=>`SELECT '${schemaname}.${tablename}' name,coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) rows FROM "${schemaname}"."${tablename}" t`)
   return (await db.query(`SELECT jsonb_object_agg(name,rows) snapshot FROM (${parts.join(' UNION ALL ')}) snapshots`)).rows[0].snapshot
  }
  const before=await dataSnapshot(),history=await sitovHistorySnapshot(db),rights=await sitovRightsSnapshot(db),functions=await functionSnapshot()
  await t.test('exact SQL mirror/replay, STABLE empty search_path, explicit EXECUTE and private table denial',async()=>{
   assert.equal(sql,await readFile(new URL('../vps/107_sitov_pretest_learning_topics.sql',import.meta.url),'utf8'))
   await db.actor(null,'postgres');await db.exec(sql);await db.exec(sql);assert.deepEqual(await functionSnapshot(),functions)
   assert.equal(functions.length,2)
   for(const fn of functions){assert.equal(fn.provolatile,'s');assert.deepEqual(fn.proconfig,['search_path=""']);assert.equal(fn.prosecdef,fn.nspname!=='public')}
   const acl=(await db.query(`SELECT has_function_privilege('anon','public.sitov_get_pronunciation_pretest_learning_topics(uuid)','EXECUTE') anon,has_function_privilege('service_role','public.sitov_get_pronunciation_pretest_learning_topics(uuid)','EXECUTE') service,has_function_privilege('authenticated','public.sitov_get_pronunciation_pretest_learning_topics(uuid)','EXECUTE') authenticated`)).rows[0]
   assert.deepEqual(acl,{anon:false,service:false,authenticated:true})
   await db.actor(sitovUsers.german);await assert.rejects(db.query('SELECT * FROM sitov_pronunciation_private.pretest_definitions'),/permission denied/);await assert.rejects(db.exec('UPDATE sitov_pronunciation_private.pretest_attempts SET revision=revision+1'),/permission denied/)
  })
  await t.test('missing authentication/anonymous/service/foreign/nonfailed/forged owner denied',async()=>{
   await db.actor(null);assert.equal((await rpc(own)).error,'authentication_required')
   for(const role of ['anon','service_role']){await db.actor(null,role);await assert.rejects(rpc(own),/permission denied/)}
   await db.actor(sitovUsers.german);assert.equal((await rpc(foreign)).error,'not_found');for(const id of nonfailed)assert.equal((await rpc(id)).error,'not_found')
   await db.actor(sitovUsers.outsider,'authenticated',{user_metadata:{role:'admin',student_id:sitovUsers.german},app_metadata:{student_id:sitovUsers.german}});assert.equal((await rpc(own)).error,'not_found')
   await db.actor(sitovUsers.german,'authenticated',{user_metadata:{role:'teacher',student_id:sitovUsers.outsider}});assert.equal((await rpc(foreign)).error,'not_found')
  })
  await t.test('only stored failed IDs and exact immutable definition; narrow DTO with no private evidence',async()=>{
   await db.actor(sitovUsers.german)
   const expected={ok:true,data:{attemptId:own,textId,textVersion:stored.text_version,testVersion:stored.test_version,failedCompetencyIds:[core],topicIds:['sitov.topic.kennenlernen']}}
   assert.deepEqual(await rpc(own),expected);assert.deepEqual(await rpc(own),expected)
   const dto=JSON.stringify(expected);for(const field of ['correctOptionId','sourceSpans','quote','sentence_de','pendingReasonDe','necessityDe','rationaleDe','definition'])assert.equal(dto.includes(field),false)
   for(const id of mismatched)assert.equal((await rpc(id)).error,'not_found')
  })
  await t.test('empty mapping/unknown failed core empty; unknown topic remains an honest optional identifier',async()=>{
   await db.actor(sitovUsers.german)
   for(const id of [noMapping,unknownCore]){const reply=await rpc(id);assert.equal(reply.ok,true);assert.deepEqual(reply.data.topicIds,[])}
   const reply=await rpc(unknownMapping);assert.equal(reply.ok,true);assert.deepEqual(reply.data.topicIds,['sitov.topic.unknown'])
   // Existing epoch28 server tests prove unknown identifiers are filtered without resolver lookup.
  })
  await t.test('same actor claims recheck current commercial source entitlement after revocation',async()=>{
   await db.actor(sitovUsers.german);assert.equal((await rpc(own)).ok,true)
   await db.actor(null,'postgres');const access=(await db.query('SELECT * FROM public.student_level_access WHERE auth_user_id=$1 AND level=$2',[sitovUsers.german,'A1.1'])).rows
   assert.equal(access.length,1);await db.exec(`DELETE FROM public.student_level_access WHERE auth_user_id='${sitovUsers.german}' AND level='A1.1'`)
   await db.actor(sitovUsers.german);assert.equal((await rpc(own)).error,'not_found')
   await db.actor(null,'postgres');await db.exec(`INSERT INTO public.student_level_access SELECT * FROM jsonb_populate_recordset(NULL::public.student_level_access,${literal(access)}::jsonb)`)
   await db.actor(sitovUsers.german);assert.equal((await rpc(own)).ok,true)
  })
  await t.test('actual authenticated READ ONLY returns exact same result',async()=>{
   const output=db.raw(`BEGIN READ ONLY;SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"${sitovUsers.german}"}',true);SELECT set_config('request.jwt.claim.sub','${sitovUsers.german}',true);SELECT public.sitov_get_pronunciation_pretest_learning_topics('${own}');ROLLBACK;`)
   const value=JSON.parse(output.split('\n').at(-1));assert.equal(value.ok,true);assert.deepEqual(value.data.topicIds,['sitov.topic.kennenlernen']);assert.equal(value.data.testVersion,stored.test_version)
  })
  await t.test('all application/content/rights/storage/immutable results/history rows exactly unchanged',async()=>{
   assert.deepEqual(await dataSnapshot(),before);assert.deepEqual(await sitovHistorySnapshot(db),history);assert.deepEqual(await sitovRightsSnapshot(db),rights)
   await db.actor(null,'postgres');assert.equal((await db.query('SELECT count(*) count FROM sitov_pronunciation_private.pretest_definitions WHERE active')).rows[0].count,0)
  })
 }finally{await db?.close();admin.raw(`DROP DATABASE ${database} WITH(FORCE)`)}
})
