import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createSitovIntegrated99NativeDatabase} from './helpers/sitov-night-integrated99-native-db.mjs'
import {SitovNativeDatabase} from './helpers/sitov-night-current-native-db.mjs'
import {sitovId as id,sitovUsers as users,sitovHistorySnapshot,sitovRightsSnapshot} from './helpers/sitov-night-current-db.mjs'
const sql=await readFile(new URL('../migrations/20261009082500_sitov_learning_recommendation_sources.sql',import.meta.url),'utf8')
const literal=v=>v===null?'NULL':`'${(typeof v==='object'?JSON.stringify(v):String(v)).replaceAll("'","''")}'`
const array=ids=>`ARRAY[${ids.map(literal).join(',')}]::uuid[]`
test('108 authorized learner source metadata on real native integrated99 RLS',async t=>{
 const database=`sitov_night_sources108_${process.pid}_${Date.now()}`,admin=new SitovNativeDatabase();admin.raw(`CREATE DATABASE ${database}`);let db
 try{
  db=await createSitovIntegrated99NativeDatabase({database});await db.actor(null,'postgres');await db.exec(sql)
  const unit=id(108001),other=id(108002),practice=id(108010),review=id(108011),special=id(108012),hidden=id(108013),otherNode=id(108014)
  await db.exec(`INSERT INTO public.learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_title,path_slug) VALUES
   ('${unit}','A1.1','exercises','Sitov synthetic source fixture',1,true,'SITOV-SOURCE-108','Synthetic source','sitov-source-108'),
   ('${other}','A1.1','exercises','Sitov synthetic other fixture',2,true,'SITOV-OTHER-108','Other source','sitov-other-108');
   INSERT INTO public.path_objectives(unit_id,id,area,description) VALUES('${unit}','sitov.goal.108','grammar','Synthetic goal'),('${other}','sitov.goal.108','grammar','Synthetic goal');
   INSERT INTO public.path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,goals,merkkarte) VALUES
   ('${practice}','${unit}','sitov.node.108.practice','practice',1,'Synthetic practice','Synthetic topic',ARRAY['sitov.goal.108'],'{"card":"sitov.synthetic","rule":"Synthetic","examples":["Ich bin hier."],"highlight":null}'),
   ('${review}','${unit}','sitov.node.108.review','review',2,'Synthetic review','Synthetic topic',ARRAY['sitov.goal.108'],NULL),
   ('${otherNode}','${other}','sitov.node.108.other','practice',1,'Other practice','Synthetic topic',ARRAY['sitov.goal.108'],'{"card":"sitov.synthetic","rule":"Synthetic","examples":["Ich bin hier."],"highlight":null}');
   INSERT INTO public.path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,goals,anchor_node_id) VALUES('${special}','${unit}','sitov.node.108.special','special',3,'Synthetic special','Synthetic topic',ARRAY['sitov.goal.108'],'${practice}');
   INSERT INTO public.path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,goals,is_active) VALUES('${hidden}','${unit}','sitov.node.108.hidden','review',4,'Hidden','Synthetic',ARRAY['sitov.goal.108'],false);
   INSERT INTO public.learning_trainer_grants(auth_user_id,level,trainer,enabled,unit_mode) VALUES('${users.selected}','A1.1','exercises',true,'selected') ON CONFLICT(auth_user_id,level,trainer) DO UPDATE SET enabled=true,unit_mode='selected';
   INSERT INTO public.learning_unit_grants(auth_user_id,level,trainer,unit_id) VALUES('${users.selected}','A1.1','exercises','${unit}') ON CONFLICT DO NOTHING;`)
  const rpc=async(ids,level='A1.1')=>(await db.query(`SELECT public.sitov_get_learning_recommendation_sources($1,${ids===null?'NULL':array(ids)}) value`,[level])).rows[0].value
  const snapshot=async()=>{await db.actor(null,'postgres');const tables=(await db.query(`SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN('public','learning_private','path_private','sitov_access_private','sitov_special_private','sitov_pronunciation_private','storage') ORDER BY schemaname,tablename`)).rows;const parts=tables.map(r=>`SELECT '${r.schemaname}.${r.tablename}' name,coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) rows FROM "${r.schemaname}"."${r.tablename}" t`);return(await db.query(`SELECT jsonb_object_agg(name,rows) snapshot FROM (${parts.join(' UNION ALL ')}) q`)).rows[0].snapshot}
  const functions=async()=>(await db.query(`SELECT p.oid,n.nspname,p.provolatile,p.prosecdef,p.proconfig,p.proacl,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname IN('sitov_get_learning_recommendation_sources','sitov_recommendation_sources') ORDER BY n.nspname`)).rows
  // Synthetic publication adapters exercise the real Special guard; no real audio/publication claim.
  await db.actor(users.teacher,'postgres',{aal:'aal2'})
  await db.exec(`INSERT INTO public.learning_exercises(id,unit_id,node_id,goal_id,sort_order,topic,type,content,path_is_active) SELECT ('00000000-0000-4000-8000-'||lpad((108100+n)::text,12,'0'))::uuid,'${unit}','${special}','sitov.goal.108',n,'Synthetic','multiple_choice','{"question":"Artikel?","options":["den","die","das"],"correct_answer":"den","accepted_answers":["den"],"target_form":["den"]}',true FROM generate_series(1,20)n;INSERT INTO sitov_special_private.sources VALUES('sitov.synthetic.sources108',repeat('c',64),'A1.1','catalog:supabase/tests/sitov-learning-recommendation-sources.test.mjs',true);`)
  const pool=(await db.query(`SELECT jsonb_agg(jsonb_build_object('id',e.id,'stratum',CASE WHEN e.sort_order<=8 THEN 'a' WHEN e.sort_order<=14 THEN 'b' ELSE 'c' END,'snapshot',path_private.snapshot(e.id))) pool FROM public.learning_exercises e WHERE node_id=$1`,[special])).rows[0].pool,blueprint={a:4,b:3,c:3}
  const version=(await db.query('SELECT sitov_special_private.definition_fingerprint($1,$2,$3,$4) value',[special,'sitov.synthetic.sources108',blueprint,pool])).rows[0].value,approval=id(108030),definition=id(108031)
  await db.exec(`INSERT INTO sitov_special_private.approvals(id,node_id,version,source_ref,source_sha256,reviewed_by) VALUES('${approval}','${special}','${version}','sitov.synthetic.sources108',repeat('c',64),'${users.teacher}')`)
  const assets=[],sha=value=>createHash('sha256').update(value).digest('hex'),fingerprint='96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5'
  for(const {spoken} of (await db.query('SELECT spoken FROM sitov_special_private.audible_texts($1)',[pool])).rows){
   const path='sitov-qwen-v1/de/'+sha(JSON.stringify({text:spoken,voice:'sitov-qwen-male-de-v1',rate:'qwen-native-1-lufs-18-aligned-v1',format:'audio-24khz-48kbitrate-mono-mp3',leadIn:.35,profile:fingerprint}))+'.mp3'
   const metadata={engine:'qwen3-tts',voice:'sitov-qwen-male-de-v1',revision:'sitov-qwen-base-bf16-v1',profileFingerprint:fingerprint,textSha256:sha(spoken),audioSha256:'d'.repeat(64),wordTimings:spoken.split(' ').map((_,i)=>({start:.35+i*.4,end:.7+i*.4}))}
   await db.exec(`INSERT INTO storage.objects(bucket_id,name,metadata,user_metadata) VALUES('audio_cache','${path}','{"mimetype":"audio/mpeg","size":1000}',${literal(metadata)}::jsonb) ON CONFLICT(bucket_id,name) DO UPDATE SET user_metadata=excluded.user_metadata`)
   assets.push({textSha256:sha(spoken),audioSha256:'d'.repeat(64),path:'storage://audio_cache/'+path})
  }
  await db.exec(`INSERT INTO sitov_special_private.definitions(id,node_id,version,source_ref,blueprint,pool,published,editorial_proof,audio_import_proof) VALUES('${definition}','${special}','${version}','sitov.synthetic.sources108',${literal(blueprint)}::jsonb,${literal(pool)}::jsonb,true,${literal({reviewId:approval,definitionVersion:version,sourceSha256:'c'.repeat(64)})}::jsonb,${literal({definitionVersion:version,assets})}::jsonb);INSERT INTO sitov_special_private.activation VALUES('${special}','${definition}')`)
  await db.actor(null,'postgres')
  const before=await snapshot(),history=await sitovHistorySnapshot(db),rights=await sitovRightsSnapshot(db),functionBefore=await functions()
  await t.test('mirror replay ACL/STABLE/search_path and unchanged raw learner RLS',async()=>{
   assert.equal(sql,await readFile(new URL('../vps/108_sitov_learning_recommendation_sources.sql',import.meta.url),'utf8'));await db.actor(null,'postgres');await db.exec(sql);await db.exec(sql);assert.deepEqual(await functions(),functionBefore);assert.equal(functionBefore.length,2)
   for(const fn of functionBefore){assert.equal(fn.provolatile,'s');assert.deepEqual(fn.proconfig,['search_path=""']);assert.equal(fn.prosecdef,fn.nspname==='learning_private')}
   for(const role of ['anon','service_role']){await db.actor(null,role);await assert.rejects(rpc([practice]),/permission denied/)}
   await db.actor(null);assert.equal((await rpc([practice])).error,'authentication_required')
   await db.actor(users.selected);assert.deepEqual((await db.query('SELECT id,source_id FROM public.path_nodes')).rows,[])
  })
  await t.test('exact current available canonical metadata works with selected commercial unit scope',async()=>{
   await db.actor(users.selected)
   const path=(await db.query("SELECT get_learning_path('A1.1','de') value")).rows[0].value;assert.equal(path.paths.find(p=>p.id===unit).nodes.find(n=>n.id===practice).available,true)
   assert.deepEqual(await rpc([practice,review,special,hidden,otherNode,id(999999)]),{ok:true,data:{level:'A1.1',sources:[{nodeId:practice,unitId:unit,pathSourceId:'SITOV-SOURCE-108',nodeSourceId:'sitov.node.108.practice',kind:'practice',anchorNodeId:null,anchorSourceId:null,goals:['sitov.goal.108'],anchorGoals:[]}]}})
   assert.deepEqual((await rpc([practice],'A1.2')).data.sources,[])
   await db.actor(users.none,'authenticated',{user_metadata:{role:'admin',student_id:users.selected}});assert.deepEqual((await rpc([practice])).data.sources,[])
  })
  await t.test('malformed/duplicate/unknown UUID input and canonical ambiguity constraints fail closed',async()=>{
   await db.actor(users.selected)
   for(const values of [null,[],[practice,practice],[null],Array.from({length:201},(_,i)=>id(109000+i))])assert.equal((await rpc(values)).error,'invalid_input')
   assert.equal((await rpc([practice],'invented')).error,'invalid_input');assert.deepEqual((await rpc([id(999999)])).data.sources,[])
   await assert.rejects(db.query("SELECT public.sitov_get_learning_recommendation_sources('A1.1',ARRAY['not-a-uuid']::uuid[])"),/invalid input syntax for type uuid/)
   await db.actor(null,'postgres');await assert.rejects(db.exec(`INSERT INTO public.path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,goals) VALUES('${id(108015)}','${unit}','sitov.node.108.practice','review',5,'Duplicate','Synthetic',ARRAY['sitov.goal.108'])`),/duplicate key/)
   await assert.rejects(db.exec(`INSERT INTO public.learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_title,path_slug) VALUES('${id(108003)}','A1.1','exercises','Duplicate',3,true,'SITOV-SOURCE-108','Duplicate','sitov-duplicate')`),/duplicate key/)
  })
  const probe=(mutation,ids,query=null)=>{
   const raw=db.raw(`BEGIN;${mutation};SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${users.selected}',true);SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"${users.selected}"}',true);${query??`SELECT public.sitov_get_learning_recommendation_sources('A1.1',${array(ids)})`};ROLLBACK;`)
   return JSON.parse(raw.split('\n').at(-1))
  }
  await t.test('current revocation and inactive canonical publication deny without changing claims',async()=>{
   assert.deepEqual(probe(`UPDATE public.learning_trainer_grants SET enabled=false WHERE auth_user_id='${users.selected}' AND level='A1.1' AND trainer='exercises'`,[practice]).data.sources,[])
   assert.deepEqual(probe(`UPDATE public.learning_units SET is_active=false WHERE id='${unit}'`,[practice]).data.sources,[])
   await db.actor(users.selected);assert.equal((await rpc([practice])).data.sources.length,1)
  })
  await t.test('Special requires current completed same-parent active anchor and real publication gate',async()=>{
   await db.actor(users.selected);assert.deepEqual((await rpc([special])).data.sources,[])
   const completed=`INSERT INTO public.path_node_progress(auth_user_id,node_id,status) VALUES('${users.selected}','${practice}','completed')`
   const path=probe(completed,[],"SELECT get_learning_path('A1.1','de')");assert.equal(path.paths.find(p=>p.id===unit).nodes.find(n=>n.id===special).available,true)
   assert.deepEqual(probe(completed,[special]).data.sources,[{nodeId:special,unitId:unit,pathSourceId:'SITOV-SOURCE-108',nodeSourceId:'sitov.node.108.special',kind:'special',anchorNodeId:practice,anchorSourceId:'sitov.node.108.practice',goals:['sitov.goal.108'],anchorGoals:['sitov.goal.108']}])
   assert.deepEqual(probe(completed+`;DELETE FROM sitov_special_private.activation WHERE node_id='${special}'`,[special]).data.sources,[])
   assert.deepEqual(probe(completed+";UPDATE sitov_special_private.sources SET active=false WHERE source_ref='sitov.synthetic.sources108'",[special]).data.sources,[])
   assert.deepEqual(probe(completed+`;UPDATE public.path_nodes SET is_active=false WHERE id='${practice}'`,[special]).data.sources,[])
   await db.actor(null,'postgres');await assert.rejects(db.exec(`INSERT INTO public.path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,goals,anchor_node_id) VALUES('${id(108016)}','${unit}','sitov.node.108.cross','special',5,'Cross-parent','Synthetic',ARRAY['sitov.goal.108'],'${otherNode}')`),/invalid_anchor/)
  })
  await t.test('actual authenticated READ ONLY and exact full data/effective-rights/history preservation',async()=>{
   const output=db.raw(`BEGIN READ ONLY;SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${users.selected}',true);SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"${users.selected}"}',true);SELECT public.sitov_get_learning_recommendation_sources('A1.1',ARRAY['${practice}']::uuid[]);ROLLBACK;`)
   const result=JSON.parse(output.split('\n').at(-1));assert.equal(result.ok,true);assert.equal(result.data.sources[0].nodeId,practice)
   assert.deepEqual(await snapshot(),before);assert.deepEqual(await sitovHistorySnapshot(db),history);assert.deepEqual(await sitovRightsSnapshot(db),rights)
  })
 }finally{await db?.close();admin.raw(`DROP DATABASE ${database} WITH(FORCE)`)}
})
