import {test} from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import {createSitovCurrentNativeDatabase} from './helpers/sitov-night-current-native-db.mjs'
import {sitovId as id,sitovUsers as users} from './helpers/sitov-night-current-db.mjs'
const sql=await readFile(new URL('../vps/95_sitov_learning_specials.sql',import.meta.url),'utf8')
test('Special learning/test private engine on canonical native PostgreSQL17 +93 +95',async()=>{
 const database=`sitov_night_s2_specials_${process.pid}`,bin='/opt/homebrew/opt/postgresql@17/bin/',args=['-h','/tmp/sitov-night-2026-10-08-pg','-p','55438']
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('PG')))
 execFileSync(bin+'createdb',[...args,database],{env,stdio:'pipe'})
 try{
 const db=await createSitovCurrentNativeDatabase({database});await db.exec(await readFile(new URL('../vps/93_sitov_commercial_access.sql',import.meta.url),'utf8'));await db.exec(sql)
 await db.exec(`INSERT INTO learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_title,path_slug) VALUES('${id(600)}','A1.1','exercises','Sitov Testpfad',90,true,'SITOV-QA','Testpfad','sitov-qa');
 INSERT INTO path_objectives VALUES('${id(600)}','SITOV-QA-G1','grammar','Artikel');
 INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,merkkarte,goals) VALUES('${id(601)}','${id(600)}','SITOV-QA-N1','practice',1,'Artikel','Artikel','{"card":"sitov-qa","rule":"Artikel","examples":["der Tisch"],"highlight":"article"}',ARRAY['SITOV-QA-G1']);
 INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,goals,anchor_node_id) VALUES('${id(602)}','${id(600)}','SITOV-QA-S1','special',2,'Extra','Artikel',ARRAY['SITOV-QA-G1'],'${id(601)}');
 INSERT INTO learning_exercises(id,unit_id,node_id,goal_id,sort_order,topic,type,content,path_is_active)
 SELECT ('00000000-0000-4000-8000-'||lpad((700+n)::text,12,'0'))::uuid,'${id(600)}','${id(602)}','SITOV-QA-G1',n,'Artikel','multiple_choice','{"question":"Artikel?","options":["den","die","das"],"correct_answer":"den","accepted_answers":["den"],"target_form":["den"]}', true FROM generate_series(1,20)n;
 INSERT INTO sitov_special_private.definitions(id,node_id,version,source_ref,blueprint,pool,published,editorial_proof,audio_import_proof)
 SELECT '${id(603)}','${id(602)}',repeat('a',64),'sitov.synthetic-fixture-only','{"masculine":4,"feminine":3,"neuter":3}',jsonb_agg(jsonb_build_object('id',e.id,'stratum',CASE WHEN e.sort_order<=8 THEN 'masculine' WHEN e.sort_order<=14 THEN 'feminine' ELSE 'neuter' END,'snapshot',path_private.snapshot(e.id))),true,'{"synthetic":true}','{"synthetic":true}' FROM learning_exercises e WHERE node_id='${id(602)}';
 INSERT INTO sitov_special_private.activation VALUES('${id(602)}','${id(603)}');`)
 let request=800;let previous=[]
 const call=async(op,run=null,revision=null,answers=null,mode=null,req=id(++request))=>(await db.query(`SELECT sitov_special_operation($1,$2,$3,$4,$5,$6,$7,'de') data`,[op,id(602),run,mode,revision,req,answers])).rows[0].data
 await db.actor(users.all)
 assert.equal((await call('start',null,null,null,'learning')).error,'not_found')
 await db.actor(null,'postgres');await db.exec(`INSERT INTO path_node_progress(auth_user_id,node_id,status) VALUES('${users.all}','${id(601)}','completed')`)
 await db.actor(users.all)
 assert.equal((await db.query(`SELECT sitov_special_staff_catalog('${id(602)}') data`)).rows[0].data.error,'not_found')
 const before=(await db.query(`SELECT count(*)::int n FROM path_node_progress WHERE auth_user_id='${users.all}'`)).rows[0].n
 let r=(await call('start',null,null,null,'learning')).data;assert.equal(r.queue.length,20);assert.equal(r.learningSolution,null);assert(!JSON.stringify(r.tasks).includes('correct_answer'))
 assert.equal((await call('right',r.runId,r.revision)).error,'reveal_required')
 const revealReq=id(++request);let flip=await call('reveal',r.runId,r.revision,null,null,revealReq);assert(flip.data.learningSolution);assert.deepEqual(await call('reveal',r.runId,r.revision,null,null,revealReq),flip)
 assert.equal((await call('wrong',r.runId,r.revision)).error,'revision_conflict')
 const first=flip.data.queue[0];r=(await call('wrong',r.runId,flip.data.revision)).data;assert.equal(r.queue.at(-1),first)
 r=(await call('get',r.runId)).data;assert.equal(r.queue.length,20)
 r=(await call('reveal',r.runId,r.revision)).data;r=(await call('right',r.runId,r.revision)).data;assert.equal(r.queue.length,19)
 for(const correct of [7,8]){
  const start=await call('start',null,null,null,'test');assert(start.ok,JSON.stringify(start));const a=start.data;assert.equal(a.selected.length,10);const ordinal=i=>Number(i.slice(-12))-700;assert.equal(a.selected.filter(i=>ordinal(i)<=8).length,4);assert.equal(a.selected.filter(i=>ordinal(i)>8&&ordinal(i)<=14).length,3);assert.equal(a.selected.filter(i=>ordinal(i)>14).length,3)
  if(previous.length)assert(a.selected.every(i=>!previous.includes(i)))
  const answers=Object.fromEntries(a.selected.map((i,n)=>[i,{index:n<correct?0:1}]))
  const saveReq=id(++request);const save=await call('save',a.runId,a.revision,{[a.selected[0]]:answers[a.selected[0]]},null,saveReq);assert(save.ok);assert.deepEqual(await call('save',a.runId,a.revision,{[a.selected[0]]:answers[a.selected[0]]},null,saveReq),save);assert.equal(save.data.result,null);assert.equal(save.data.learningSolution,null);assert.equal((await call('submit',a.runId,save.data.revision,{})).error,'incomplete_attempt');
  const submitReq=id(++request);const done=await call('submit',a.runId,save.data.revision,answers,null,submitReq);assert.deepEqual(await call('submit',a.runId,save.data.revision,answers,null,submitReq),done);assert(done.ok,JSON.stringify(done));assert.equal(done.data.result.correct,correct);assert.equal(done.data.result.passed,correct>=8)
  previous=a.selected
 }
 assert.equal((await db.query(`SELECT count(*)::int n FROM path_node_progress WHERE auth_user_id='${users.all}'`)).rows[0].n,before)
 await assert.rejects(db.query('SELECT * FROM sitov_special_private.definitions'),/permission denied/)
 await db.actor(users.outsider);assert.equal((await call('get',r.runId)).error,'not_found')
 await db.actor(null,'postgres')
 const trial={version:1,rules:[{level:'A1.1',trainer:'exercises',unit_ids:[id(600)],items:[{unit_id:id(600),refs:[{kind:'path_special',id:id(602)},{kind:'path_special_item',id:id(701)}]}]}]}
 await db.exec(`INSERT INTO sitov_access_private.students(student_id,trial) VALUES('${users.outsider}','${JSON.stringify(trial)}');INSERT INTO path_node_progress(auth_user_id,node_id,status) VALUES('${users.outsider}','${id(601)}','completed');`)
 await db.actor(users.outsider)
 const limited=await call('start',null,null,null,'learning');assert(limited.ok,JSON.stringify(limited));assert.deepEqual(limited.data.selected,[id(701)]);assert.deepEqual(limited.data.tasks.map(t=>t.id),[id(701)])
 assert.equal((await call('start',null,null,null,'test')).error,'scope_insufficient_for_test')
 let last=(await call('reveal',limited.data.runId,limited.data.revision)).data;last=(await call('right',last.runId,last.revision)).data;assert.equal(last.status,'completed');assert.deepEqual(last.queue,[]);assert.equal(last.result,null)
 await db.actor(null,'postgres');const saved=(await db.query('SELECT count(*)::int n FROM sitov_special_private.runs')).rows[0].n
 await db.exec(await readFile(new URL('../vps/rollback/95_sitov_learning_specials.sql',import.meta.url),'utf8'))
 assert.equal((await db.query('SELECT count(*)::int n FROM sitov_special_private.runs')).rows[0].n,saved)
 await db.actor(users.all);await assert.rejects(call('start',null,null,null,'learning'),/permission denied/)
 }finally{execFileSync(bin+'dropdb',[...args,database],{env,stdio:'pipe'})}
})
