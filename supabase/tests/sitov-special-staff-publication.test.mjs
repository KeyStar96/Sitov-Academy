import {test} from 'node:test'
import assert from 'node:assert/strict'
import {execFile,execFileSync} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createSitovIntegrated99NativeDatabase} from './helpers/sitov-night-integrated99-native-db.mjs'
import {sitovId as id,sitovUsers as users,sitovHistorySnapshot,sitovRightsSnapshot} from './helpers/sitov-night-current-db.mjs'
import {buildInactiveSpecialAuthorInput} from '../../scripts/sitov-learning-specials-authoring.mjs'
const bin='/opt/homebrew/opt/postgresql@17/bin/',args=['-h','/tmp/sitov-night-2026-10-08-pg','-p','55438'],env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('PG')))
const draft=JSON.parse(await readFile(new URL('../seeds/sitov-learning-special-pools-2026-10-08.json',import.meta.url),'utf8')),source=draft.sources[0]
const migration=await readFile(new URL('../vps/104_sitov_special_staff_publication.sql',import.meta.url),'utf8')
const unit='f72f211a-9d44-41a2-af18-87976effe62d',anchor='9f92ad82-cb5c-40cf-86d3-87b17b75c5bb',reviewer=id(910)
const quote=x=>x==null?'NULL':"'"+(typeof x==='object'?JSON.stringify(x):String(x)).replaceAll("'","''")+"'",hash=x=>createHash('sha256').update(x).digest('hex')
test('integrated99+100/101/102/103/104 actual Storage12cols: independent proof, full80 scope, readonly, CAS/retry/concurrency/history',async()=>{
 const database=`sitov_night_s2_publish_${process.pid}`;execFileSync(bin+'createdb',[...args,database],{env,stdio:'pipe'})
 try{
 const db=await createSitovIntegrated99NativeDatabase({database});
 // Vendor Storage12 shape: pinned adapter omits only the vendor's generated path_tokens.
 await db.exec(`ALTER TABLE storage.objects ADD COLUMN path_tokens text[] GENERATED ALWAYS AS(string_to_array(name,'/')) STORED;`);
 assert.equal((await db.query("SELECT count(*) n FROM information_schema.columns WHERE table_schema='storage' AND table_name='objects'")).rows[0].n,12);for(const file of ['100_sitov_pretest_staff_drafts.sql','101_sitov_special_authoring.sql','102_sitov_pretest_staff_publication.sql','103_sitov_staff_draft_authority.sql'])await db.exec(await readFile(new URL('../vps/'+file,import.meta.url),'utf8'));await db.exec(migration);await db.exec(migration)
 assert.equal((await db.query("SELECT count(*) n FROM information_schema.columns WHERE table_schema='storage' AND table_name='objects' AND column_name IN('archived_at','is_delete_marker')")).rows[0].n,0)
 const history=await sitovHistorySnapshot(db),rights=await sitovRightsSnapshot(db)
 await db.exec(`INSERT INTO learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_title,path_slug) VALUES('${unit}','A1.1','exercises','Sitov synthetic parent',90,true,'P4','Wohnen','sitov-synthetic-parent');INSERT INTO path_objectives VALUES('${unit}','P4-G1','grammar','Artikel');INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,merkkarte,goals) VALUES('${anchor}','${unit}','P4-N1','practice',1,'Der, das, die','Artikel','{"card":"sitov-test","rule":"Artikel","examples":["der Flur"],"highlight":"article"}',ARRAY['P4-G1']);INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES('${reviewer}','sitov-independent@example.test',now(),'{"display_name":"Sitov QA Paul","ui_language":"ru"}');UPDATE profiles SET role='teacher' WHERE id='${reviewer}';`)
 await db.actor(users.teacher);const context=(await db.query('SELECT sitov_special_author_context($1,$2,$3) r',[unit,anchor,source.ref])).rows[0].r
 const created=(await db.query('SELECT sitov_special_author_create($1) r',[buildInactiveSpecialAuthorInput(draft,context.data,id(911))])).rows[0].r;assert.equal(created.ok,true)
 const node=created.data.nodeId,def=created.data.definitionId,version=created.data.definitionVersion
 const call=async(publish=false,request=id(912),base=null)=>(await db.query(`SELECT ${publish?'sitov_publish_special':'sitov_get_special_publication'}($1,$2,$3,$4,$5${publish?',$6':''}) r`,[node,def,version,source.sha256,base,...(publish?[request]:[])])).rows[0].r
 assert.equal((await call()).error,'version_conflict');assert.equal((await call(true)).error,'version_conflict') // inactive registry is not publication authority
 await db.actor(null,'postgres');await db.exec(`UPDATE sitov_special_private.sources SET active=true WHERE source_ref=${quote(source.ref)}`)
 await db.actor(users.teacher);assert.equal((await call(true)).error,'authoring_not_ready')
 await db.actor(users.selected);assert.equal((await call(true)).error,'not_found');await db.actor(null,'anon');await assert.rejects(call(),/permission denied/)
 await db.actor(users.teacher,'postgres');await db.exec(`INSERT INTO sitov_special_private.approvals(id,node_id,version,source_ref,source_sha256,reviewed_by) VALUES('${id(913)}','${node}','${version}',${quote(source.ref)},${quote(source.sha256)},'${users.teacher}')`)
 const metadataByPath=new Map(),assets=[];const fingerprint='96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5'
 for(const alias of draft.audioManifest.aliases){
 const spoken=alias.text,preimage=JSON.stringify({text:spoken,voice:'sitov-qwen-male-de-v1',rate:'qwen-native-1-lufs-18-aligned-v1',format:'audio-24khz-48kbitrate-mono-mp3',leadIn:0.35,profile:fingerprint}),path=`sitov-qwen-v1/de/${hash(preimage)}.mp3`
 const metadata={engine:'qwen3-tts',voice:'sitov-qwen-male-de-v1',revision:'sitov-qwen-base-bf16-v1',profileFingerprint:fingerprint,textSha256:hash(spoken),audioSha256:'d'.repeat(64),wordTimings:spoken.split(' ').map((word,n)=>({word,start:0.35+n*0.4,end:0.7+n*0.4}))};metadataByPath.set(path,metadata)
 await db.exec(`INSERT INTO storage.objects(bucket_id,name,metadata,user_metadata) VALUES('audio_cache',${quote(path)},'{"mimetype":"audio/mpeg","size":1000}',${quote(metadata)})`)
 if(alias.requiredBy95)assets.push({textSha256:hash(spoken),audioSha256:'d'.repeat(64),path:`storage://audio_cache/${path}`})
 }
 const texts=(await db.query('SELECT t.spoken FROM sitov_special_private.definitions d,sitov_special_private.author_audio_texts(d) t WHERE d.id=$1',[def])).rows.map(r=>r.spoken).sort();assert.deepEqual(texts,draft.audioManifest.aliases.map(a=>a.text).sort());assert.equal(assets.length,28)
 const editorial={reviewId:id(913),definitionVersion:version,sourceSha256:source.sha256},audio={definitionVersion:version,assets}
 const importProof=()=>db.exec(`UPDATE sitov_special_private.definitions SET editorial_proof=${quote(editorial)},audio_import_proof=${quote(audio)} WHERE id='${def}'`)
 await assert.rejects(importProof(),/special_publication_proof_required/) // self-review rejects despite metadata/all80
 await db.exec(`DELETE FROM sitov_special_private.approvals WHERE id='${id(913)}'`);await db.actor(reviewer,'postgres');await db.exec(`INSERT INTO sitov_special_private.approvals(id,node_id,version,source_ref,source_sha256,reviewed_by) VALUES('${id(913)}','${node}','${version}',${quote(source.ref)},${quote(source.sha256)},'${reviewer}')`)
 await importProof();
 const first=draft.pools[0].items[0],originalContent=first.snapshot.content;await db.exec(`UPDATE learning_exercises SET content=${quote({...originalContent,instruction:'Bitte wählen Sie.'})} WHERE id='${first.id}'`);await db.actor(users.teacher);assert.equal((await call()).data.ready,false);await db.actor(users.teacher,'postgres');await db.exec(`UPDATE learning_exercises SET content=${quote(originalContent)} WHERE id='${first.id}'`);
 await assert.rejects(db.exec(`UPDATE sitov_special_private.definitions SET audio_import_proof=${quote({...audio,fake:true})} WHERE id='${def}'`),/special_publication_proof_required/);await assert.rejects(db.exec(`UPDATE sitov_special_private.definitions SET editorial_proof='{"reviewed":true}' WHERE id='${def}'`),/special_publication_proof_required/);
 await db.exec(`INSERT INTO sitov_special_private.runs(id,student_id,definition_id,mode,status,selected,queue,answers,result,completed_at) VALUES('${id(917)}','${users.selected}','${def}','test','completed',ARRAY['${draft.pools[0].items[0].id}']::uuid[],ARRAY[]::uuid[],'{}','{"fixture":"historical"}',now())`);const oldRun=(await db.query('SELECT to_jsonb(r) r FROM sitov_special_private.runs r WHERE id=$1',[id(917)])).rows[0].r;await db.actor(users.teacher);assert.equal((await call()).data.ready,true)
 const readonly=db.raw(`BEGIN READ ONLY;SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claims',${quote({sub:users.teacher,role:'authenticated'})},true);SELECT set_config('request.jwt.claim.sub','${users.teacher}',true);SELECT sitov_get_special_publication('${node}','${def}','${version}',${quote(source.sha256)},NULL);ROLLBACK;`);assert.equal(JSON.parse(readonly.split('\n').at(-1)).data.ready,true)
 const extraPath=[...metadataByPath.keys()].find(p=>!assets.some(a=>a.path.endsWith(p))),requiredPath=assets[0].path.slice('storage://audio_cache/'.length)
 for(const [path,patch] of [[extraPath,{voice:'female'}],[requiredPath,{wordTimings:[]}],[requiredPath,{textSha256:'e'.repeat(64)}],[requiredPath,{audioSha256:'e'.repeat(64)}]]){
 await db.actor(users.teacher,'postgres');await db.exec(`UPDATE storage.objects SET user_metadata=${quote({...metadataByPath.get(path),...patch})} WHERE name=${quote(path)}`);await db.actor(users.teacher);assert.equal((await call()).data.ready,false);assert.equal((await call(true)).error,'authoring_not_ready');await db.actor(users.teacher,'postgres');await db.exec(`UPDATE storage.objects SET user_metadata=${quote(metadataByPath.get(path))} WHERE name=${quote(path)}`)
 }
 await db.actor(users.teacher,'postgres');await db.exec(`UPDATE profiles SET role='admin' WHERE id='${users.teacher}'`);await db.actor(users.teacher);assert.equal((await call(true)).error,'not_found');await db.actor(users.teacher,'postgres');await db.exec(`INSERT INTO auth.mfa_factors(id,user_id,status,factor_type) VALUES('${id(914)}','${users.teacher}','verified','totp')`)
 const race=request=>new Promise((resolve,reject)=>{const child=execFile(bin+'psql',['-X','-w','-qAt',...args,'-d',database,'-v','ON_ERROR_STOP=1'],{env},(e,out)=>e?reject(e):resolve(JSON.parse(out.trim().split('\n').at(-1))));child.stdin.end(`SET ROLE authenticated;SELECT set_config('request.jwt.claims',${quote({sub:users.teacher,role:'authenticated',aal:'aal2'})},false);SELECT set_config('request.jwt.claim.sub','${users.teacher}',false);SELECT sitov_publish_special('${node}','${def}','${version}',${quote(source.sha256)},NULL,'${request}');`)})
 const races=await Promise.all([race(id(915)),race(id(916))]);assert.equal(races.filter(r=>r.ok).length,1,JSON.stringify(races));assert.equal(races.find(r=>!r.ok).error,'version_conflict');const request=races[0].ok?id(915):id(916),win=races.find(r=>r.ok)
 await db.actor(users.teacher,'authenticated',{aal:'aal2'});assert.deepEqual(await call(true,request),win);assert.equal((await call(true,request,def)).error,'request_conflict')

 // A changed-payload receipt request must lose authority committed while it actually waits on advisory.
 const revokeDuringAdvisory=async(kind)=>{
  const lockName='sitov-special-publication:'+users.teacher+':'+request,appName=`sitov_s2_receipt_wait_${process.pid}_${kind}`
  let holder,waiter
  const start=()=>{
   let output='',failure=''
   const child=execFile(bin+'psql',['-X','-w','-qAt',...args,'-d',database,'-v','ON_ERROR_STOP=1'],{env})
   child.stdout.on('data',chunk=>{output+=chunk});child.stderr.on('data',chunk=>{failure+=chunk})
   const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve(output):reject(new Error(failure||`psql exit ${code}`)))})
   // Observe errors even before awaiting final output.
   done.catch(()=>{})
   return {child,done,output:()=>output}
  }
  try{
   holder=start();holder.child.stdin.write(`BEGIN;SELECT pg_advisory_xact_lock(hashtextextended(${quote(lockName)},0));SELECT 'sitov_s2_lock_held';\n`)
   for(let n=0;!holder.output().includes('sitov_s2_lock_held');n++){assert(n<100,'holder did not acquire advisory');await new Promise(resolve=>setTimeout(resolve,20))}
   waiter=start();waiter.child.stdin.end(`SET application_name=${quote(appName)};SET statement_timeout='10s';SET ROLE authenticated;SELECT set_config('request.jwt.claims',${quote({sub:users.teacher,role:'authenticated',aal:'aal2'})},false);SELECT set_config('request.jwt.claim.sub','${users.teacher}',false);SELECT sitov_publish_special('${node}','${def}','${version}',${quote(source.sha256)},'${def}','${request}');`)
   await db.actor(null,'postgres')
   let observed=false
   for(let n=0;n<100;n++){observed=(await db.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event='advisory') waiting",[appName])).rows[0].waiting;if(observed)break;await new Promise(resolve=>setTimeout(resolve,20))}
   assert(observed,'request must be observed actually waiting on advisory')
   const revoke=kind==='role'?`UPDATE public.profiles SET role='student' WHERE id='${users.teacher}';`:`UPDATE auth.mfa_factors SET status='unverified' WHERE id='${id(914)}';`
   holder.child.stdin.end(revoke+'COMMIT;')
   await holder.done
   const result=JSON.parse((await waiter.done).trim().split('\n').at(-1));assert.deepEqual(result,{ok:false,error:'not_found',retryable:false})
   await db.exec(`UPDATE public.profiles SET role='admin' WHERE id='${users.teacher}';UPDATE auth.mfa_factors SET status='verified' WHERE id='${id(914)}';`)
   await db.actor(users.teacher,'authenticated',{aal:'aal2'});assert.deepEqual(await call(true,request),win);assert.equal((await call(true,request,def)).error,'request_conflict')
  }finally{holder?.child.kill();waiter?.child.kill()}
 }
 await revokeDuringAdvisory('role');await revokeDuringAdvisory('totp')
 await db.actor(users.teacher,'postgres');await db.exec(migration);await db.actor(users.teacher,'authenticated',{aal:'aal2'});assert.deepEqual(await call(true,request),win)
 await db.actor(users.teacher,'postgres');await assert.rejects(db.exec(`UPDATE sitov_special_private.definitions SET pool='[]' WHERE id='${def}'`),/special_definition_immutable/);await assert.rejects(db.exec(`UPDATE sitov_special_private.author_receipts SET response='{}'`),/special_definition_immutable/);await assert.rejects(db.exec(`UPDATE sitov_special_private.authored_drafts SET payload='{}'`),/special_definition_immutable/)
 await db.exec(`UPDATE profiles SET role='student' WHERE id='${reviewer}'`);await db.actor(users.teacher,'authenticated',{aal:'aal2'});assert.equal((await call(true,request)).error,'authoring_not_ready');await db.actor(users.teacher,'postgres');await db.exec(`UPDATE profiles SET role='teacher' WHERE id='${reviewer}';UPDATE path_nodes SET is_active=false WHERE id='${node}'`);await db.actor(users.teacher,'authenticated',{aal:'aal2'});assert.equal((await call(true,request)).error,'version_conflict')
 await db.actor(users.teacher,'postgres');await db.exec(`UPDATE profiles SET role='teacher' WHERE id='${users.teacher}';DELETE FROM auth.mfa_factors WHERE id='${id(914)}'`);assert.deepEqual((await db.query('SELECT to_jsonb(r) r FROM sitov_special_private.runs r WHERE id=$1',[id(917)])).rows[0].r,oldRun);assert.deepEqual(await sitovHistorySnapshot(db),history);assert.deepEqual(await sitovRightsSnapshot(db),rights)
 }finally{execFileSync(bin+'dropdb',[...args,'--if-exists',database],{env,stdio:'pipe'})}
})
