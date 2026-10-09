import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { SitovNativeDatabase, createSitovCurrentNativeDatabase } from '../supabase/tests/helpers/sitov-night-current-native-db.mjs'
import { sitovUsers, sitovId, sitovHistorySnapshot } from '../supabase/tests/helpers/sitov-night-current-db.mjs'

const literal=value=>value===null?'NULL':`'${String(value).replaceAll("'","''")}'`
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
test('new items: exact native fixed-snapshot JSON equivalence and single evaluation', {skip:process.env.SITOV_NIGHT_NATIVE!=='1',timeout:180000}, async t=>{
 const admin=new SitovNativeDatabase(), database=`sitov_night_single_items_${process.pid}`
 admin.raw(`CREATE DATABASE ${database}`)
 let db
 try {
  db=await createSitovCurrentNativeDatabase({database})
  await db.exec(await readFile(new URL('../supabase/vps/93_sitov_commercial_access.sql',import.meta.url),'utf8'))
  db.raw=sql=>execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql',['-X','-w','-qAt','-h','/tmp/sitov-night-2026-10-08-pg','-p','55438','-d',database,'-v','ON_ERROR_STOP=1'],
   {input:`SET statement_timeout='8s'; BEGIN ISOLATION LEVEL REPEATABLE READ; ${sql}; COMMIT;`,encoding:'utf8',timeout:8500,maxBuffer:16*1024*1024,
    env:Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('PG'))),stdio:['pipe','pipe','pipe']}).trim()
  const definition=async signature=>(await db.query('SELECT pg_get_functiondef($1::regprocedure) body',[signature])).rows[0].body
  const metadata=async()=>(await db.query("SELECT provolatile,prosecdef,proconfig,proacl::text,proowner FROM pg_proc WHERE oid='public.get_learning_new_items(text)'::regprocedure")).rows[0]
  const original=await definition('public.get_learning_new_items(text)'), originalMeta=await metadata()
  const untouched=['learning_private.new_objects()','public.get_learning_new_counts()','public.get_last_active_level()',
   'sitov_access_private.unit_allowed(uuid,uuid)','sitov_access_private.item_allowed(uuid,text,text)','sitov_verb_private.level_allowed(uuid,text)']
  const guardBodies=Object.fromEntries(await Promise.all(untouched.map(async signature=>[signature,await definition(signature)])))
  await db.exec(original.replace('public.get_learning_new_items','sitov_qa_fixture.sitov_original_new_items'))
  await db.exec('GRANT USAGE ON SCHEMA sitov_qa_fixture TO authenticated; REVOKE ALL ON FUNCTION sitov_qa_fixture.sitov_original_new_items(text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION sitov_qa_fixture.sitov_original_new_items(text) TO authenticated;')
  const migration=await readFile(new URL('../supabase/vps/109_sitov_new_items_single_evaluation.sql',import.meta.url),'utf8')
  assert.equal(migration,await readFile(new URL('../supabase/migrations/20261009122500_sitov_new_items_single_evaluation.sql',import.meta.url),'utf8'))
  await db.exec(migration)
  const candidate=await definition('public.get_learning_new_items(text)')
  await t.test('only public items body changes; owner, ACL, volatility and private guards remain exact',async()=>{
   assert.deepEqual(await metadata(),originalMeta)
   assert.equal(originalMeta.provolatile,'v'); assert.equal(originalMeta.prosecdef,true)
   for(const signature of untouched) assert.equal(await definition(signature),guardBodies[signature],signature)
   assert.equal(original.match(/learning_private\.new_objects\(\)/g).length,2)
   assert.equal(candidate.match(/learning_private\.new_objects\(\)/g).length,1)
   assert.ok(candidate.includes('AS MATERIALIZED'))
  })
  await db.exec(`INSERT INTO learning_first_visits(auth_user_id,scope,first_visit_at)
   SELECT id,scope,'2026-01-01'::timestamptz FROM profiles CROSS JOIN(VALUES('room'),('A1.1'),('A1.2')) v(scope) ON CONFLICT DO NOTHING;
   INSERT INTO learning_seen_receipts(auth_user_id,kind,object_key)
   SELECT id,'level',level FROM profiles CROSS JOIN(VALUES('A1.1'),('A1.2')) l(level) ON CONFLICT DO NOTHING;`)
  const history=await sitovHistorySnapshot(db)
  const seen=async()=>{await db.actor(null,'postgres');return(await db.query("SELECT jsonb_build_object('visits',(SELECT jsonb_agg(to_jsonb(v) ORDER BY auth_user_id,scope) FROM learning_first_visits v),'seen',(SELECT jsonb_agg(to_jsonb(r) ORDER BY auth_user_id,kind,object_key) FROM learning_seen_receipts r)) value")).rows[0].value}
  const seenBefore=await seen(), evidence=[]
  const compare=async(name,user,level='A1.1',claims={})=>{
   await db.actor(user,'authenticated',claims)
   const row=(await db.query('SELECT sitov_qa_fixture.sitov_original_new_items($1) original,public.get_learning_new_items($1) candidate',[level])).rows[0]
   assert.deepEqual(row.candidate,row.original,name)
   assert.equal(hash(row.candidate),hash(row.original),name)
   evidence.push({case:name,level,sha256:hash(row.original),result:row.original})
   return row.original
  }
  await t.test('manual absent/all, explicit all, empty, selected, disabled and legacy history preserve nonempty JSON',async()=>{
   for(const name of ['all','explicitAll','none','selected','disabled','outsider']) await compare(`manual-${name}`,sitovUsers[name])
   const full=await compare('nonempty-lessons',sitovUsers.all)
   assert.deepEqual(full.items.vocabulary_lesson,[sitovId(211),sitovId(212)])
   assert.deepEqual(full.lessons,{[sitovId(211)]:'Sitov QA vocabulary 1',[sitovId(212)]:'Sitov QA vocabulary 2'})
   const selected=await compare('selected-single-lesson',sitovUsers.selected)
   assert.deepEqual(selected.items.vocabulary_lesson,[sitovId(211)])
   for(const level of ['A1.2','B2.2','unknown','',null,'x'.repeat(21)]) await compare('level-validation',sitovUsers.all,level)
   const anon=await compare('missing-auth',null); assert.equal(anon.error,'not_authenticated')
  })
  const source=async(vip,trial,user=sitovUsers.outsider)=>{
   await db.actor(null,'postgres');await db.exec(`INSERT INTO sitov_access_private.students(student_id,vip_enabled,trial)
    VALUES('${user}',${vip},${literal(JSON.stringify(trial))}::jsonb)
    ON CONFLICT(student_id) DO UPDATE SET vip_enabled=excluded.vip_enabled,trial=excluded.trial;`)
  }
  const emptyTrial={version:1,rules:[]}
  const trial=(unit_ids,items)=>({version:1,rules:[{level:'A1.1',trainer:'vocabulary',unit_ids,items}]})
  await t.test('trial null/empty/selected item buckets, VIP and immediate revocations keep source-local union',async()=>{
   await db.actor(null,'postgres');await db.exec(`INSERT INTO student_level_access(auth_user_id,level) VALUES('${sitovUsers.outsider}','A1.1') ON CONFLICT DO NOTHING;
    INSERT INTO learning_trainer_grants(auth_user_id,level,trainer,enabled,unit_mode)
    SELECT '${sitovUsers.outsider}','A1.1',code,true,'selected' FROM learning_trainers ON CONFLICT DO NOTHING;`)
   await source(false,emptyTrial)
   const before=await compare('empty-manual',sitovUsers.outsider)
   assert.equal(before.items.vocabulary_lesson,undefined)
   for(const [index,manifest] of [trial(null,null),trial([],null),trial([sitovId(211)],null),trial([sitovId(211)],[]),
    trial([sitovId(211)],[{unit_id:sitovId(211),refs:null}]),trial([sitovId(211)],[{unit_id:sitovId(211),refs:[]}]),
    trial([sitovId(211)],[{unit_id:sitovId(211),refs:[{kind:'vocabulary_card',id:sitovId(301)}]}])].entries()) {
    await source(false,manifest); const result=await compare(`trial-${index}`,sitovUsers.outsider)
    if(index===0) assert.deepEqual(result.items.vocabulary_lesson,[sitovId(211),sitovId(212)])
    if(index===1||index===3||index===5) assert.equal(result.items.vocabulary_lesson,undefined)
   }
   await source(true,emptyTrial);const vip=await compare('VIP-enabled',sitovUsers.outsider)
   assert.deepEqual(vip.items.vocabulary_lesson,[sitovId(211),sitovId(212)])
   await source(false,emptyTrial);assert.deepEqual(await compare('VIP-revoked-next-call',sitovUsers.outsider),before)
   await db.actor(null,'postgres');await db.exec(`INSERT INTO sitov_access_private.orders(id,student_id,level,request_id,status,provider,provider_confirmation_verified,amount_minor,currency)
    VALUES('${sitovId(9901)}','${sitovUsers.outsider}','A1.1','${sitovId(9902)}','paid','stripe',true,1,'EUR');
    INSERT INTO sitov_access_private.purchases(order_id) VALUES('${sitovId(9901)}');`)
   const purchase=await compare('verified-purchase',sitovUsers.outsider)
   assert.deepEqual(purchase.items.vocabulary_lesson,[sitovId(211),sitovId(212)])
   await db.actor(null,'postgres');await db.exec(`UPDATE sitov_access_private.purchases SET active=false WHERE order_id='${sitovId(9901)}'`)
   assert.deepEqual(await compare('purchase-revoked-next-call',sitovUsers.outsider),before)
  })
  await t.test('revoking one source preserves the other source and seen/first-visit semantics',async()=>{
   await source(false,trial([sitovId(212)],null),sitovUsers.selected)
   assert.deepEqual((await compare('manual-selected-plus-trial-other-unit',sitovUsers.selected)).items.vocabulary_lesson,[sitovId(211),sitovId(212)])
   await source(false,emptyTrial,sitovUsers.selected)
   assert.deepEqual((await compare('trial-revoke-retains-manual-selection',sitovUsers.selected)).items.vocabulary_lesson,[sitovId(211)])
   await db.actor(null,'postgres');await db.exec(`INSERT INTO learning_seen_receipts(auth_user_id,kind,object_key) VALUES('${sitovUsers.all}','vocabulary_lesson','${sitovId(211)}')`)
   const seenResult=await compare('seen-lesson-excluded-from-both-collections',sitovUsers.all)
   assert.deepEqual(seenResult.items.vocabulary_lesson,[sitovId(212)])
   assert.deepEqual(seenResult.lessons,{[sitovId(212)]:'Sitov QA vocabulary 2'})
   await db.actor(null,'postgres');await db.exec(`DELETE FROM learning_seen_receipts WHERE auth_user_id='${sitovUsers.all}' AND kind='vocabulary_lesson';
    DELETE FROM learning_first_visits WHERE auth_user_id='${sitovUsers.outsider}' AND scope='room'`)
   assert.deepEqual((await compare('no-room-first-visit',sitovUsers.outsider)).items,{})
   await db.actor(null,'postgres');await db.exec(`INSERT INTO learning_first_visits(auth_user_id,scope,first_visit_at) VALUES('${sitovUsers.outsider}','room','2026-01-01')`)
  })
  await t.test('stored five interface languages, independent catalog parent binding and staff MFA preserve JSON',async()=>{
   for(const locale of ['de','en','ru','uk','tr']) {
    await db.actor(null,'postgres');await db.exec(`UPDATE profiles SET ui_language=${literal(locale)} WHERE id='${sitovUsers.all}'`)
    await compare(`stored-ui-${locale}`,sitovUsers.all)
   }
   await db.actor(null,'postgres')
   const verb=(await db.query("SELECT id,unit_id FROM sitov_verb_catalog WHERE level='A1.1' ORDER BY id LIMIT 1")).rows[0]
   await db.exec(`UPDATE sitov_verb_catalog SET level='B2.2' WHERE id=${literal(verb.id)}`)
   await compare('canonical-parent-mismatch-A1.1',sitovUsers.all)
   await compare('canonical-parent-mismatch-B2.2',sitovUsers.all,'B2.2')
   await db.actor(null,'postgres');await db.exec(`UPDATE profiles SET role='admin',sitov_mfa_required=true WHERE id='${sitovUsers.teacher}'`)
   await db.actor(sitovUsers.teacher,'postgres',{role:'authenticated',aal:'aal1'})
   assert.equal((await db.query('SELECT sitov_access_private.staff() allowed')).rows[0].allowed,false)
   await compare('staff-MFA-aal1',sitovUsers.teacher,'A1.1',{aal:'aal1'})
   await db.actor(null,'postgres');await db.exec(`INSERT INTO auth.mfa_factors(user_id,status,factor_type) VALUES('${sitovUsers.teacher}','verified','totp')`)
   await db.actor(sitovUsers.teacher,'postgres',{role:'authenticated',aal:'aal2'})
   assert.equal((await db.query('SELECT sitov_access_private.staff() allowed')).rows[0].allowed,true)
   await compare('staff-MFA-aal2',sitovUsers.teacher,'A1.1',{aal:'aal2'})
  })
  await t.test('existing request_failed JSON and SQLSTATE survive a native helper failure',async()=>{
   await db.actor(null,'postgres')
   try {
    await db.exec(`CREATE OR REPLACE FUNCTION learning_private.new_objects()
     RETURNS TABLE(level text,mode text,kind public.learning_seen_kind,object_key text,covered boolean)
     LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $stub$
     BEGIN RAISE EXCEPTION 'sitov synthetic helper failure' USING ERRCODE='22023'; END $stub$;`)
    assert.deepEqual(await compare('helper-failure-preserves-error',sitovUsers.all),
     {error:'request_failed',message:'The request could not be completed.',sqlstate:'22023'})
   } finally {
    await db.actor(null,'postgres');await db.exec(guardBodies['learning_private.new_objects()'])
   }
   assert.equal(await definition('learning_private.new_objects()'),guardBodies['learning_private.new_objects()'])
  })
  await t.test('public calls leave history, first visits and seen receipts unchanged',async()=>{
   assert.deepEqual(await sitovHistorySnapshot(db),history)
   assert.deepEqual(await seen(),seenBefore)
  })
  await t.test('native plan evaluates the private STABLE function once and both CTE consumers share it',async()=>{
   const start=candidate.indexOf('WITH sitov_new_objects AS MATERIALIZED'),end=candidate.indexOf('INTO items,lessons;',start)
   assert.ok(start>=0&&end>start)
   const query=candidate.slice(start,end).replace(/\bp_level\b/g,"'A1.1'")
   const output=db.raw(`SET ROLE postgres; SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"${sitovUsers.all}"}',false);
    SELECT set_config('request.jwt.claim.sub','${sitovUsers.all}',false); EXPLAIN(ANALYZE,BUFFERS,VERBOSE,FORMAT JSON) ${query}`)
   const plan=JSON.parse(output.split('\n').slice(2).join('\n'))[0],nodes=[]
   const walk=node=>{nodes.push(node);for(const child of node.Plans??[])walk(child)};walk(plan.Plan)
   const functions=nodes.filter(node=>node['Node Type']==='Function Scan'&&node['Function Name']==='new_objects')
   assert.equal(functions.length,1);assert.equal(functions[0]['Actual Loops'],1)
   assert.equal(nodes.filter(node=>node['Node Type']==='CTE Scan'&&node['CTE Name']==='sitov_new_objects').length,2)
   t.diagnostic(JSON.stringify({singleEvaluationPlan:plan}))
   const timing={}
   await db.actor(sitovUsers.all)
   for(const [name,fn] of [['original','sitov_qa_fixture.sitov_original_new_items'],['candidate','public.get_learning_new_items']]) {
    const begin=performance.now();const result=(await db.query(`SELECT ${fn}('A1.1') result`)).rows[0].result
    timing[name]={milliseconds:Math.round((performance.now()-begin)*100)/100,sha256:hash(result)}
   }
   assert.equal(timing.original.sha256,timing.candidate.sha256)
   t.diagnostic(JSON.stringify({timing,statementTimeoutMs:8000,clientTimeoutMs:8500,fixedSnapshot:'REPEATABLE READ per comparison',fullJsonComparisons:evidence.length,evidence}))
  })
 } finally {
  if(db)await db.close()
  admin.raw(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`)
 }
})
