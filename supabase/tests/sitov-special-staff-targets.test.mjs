import {test} from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
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
test('actual105+106 staff index: roles/MFA, inactive/active identity, live source, bindings, private ACL and readonly',async()=>{
 const database=`sitov_night_s2_targets_${process.pid}`;execFileSync(bin+'createdb',[...args,database],{env,stdio:'pipe'})
 try{
 const db=await createSitovIntegrated99NativeDatabase({database});
 // Vendor Storage12 shape: pinned adapter omits only the vendor's generated path_tokens.
 await db.exec(`ALTER TABLE storage.objects ADD COLUMN path_tokens text[] GENERATED ALWAYS AS(string_to_array(name,'/')) STORED;`);
 assert.equal((await db.query("SELECT count(*) n FROM information_schema.columns WHERE table_schema='storage' AND table_name='objects'")).rows[0].n,12);for(const file of ['100_sitov_pretest_staff_drafts.sql','101_sitov_special_authoring.sql','102_sitov_pretest_staff_publication.sql','103_sitov_staff_draft_authority.sql','105_sitov_pretest_publication_authority.sql'])await db.exec(await readFile(new URL('../vps/'+file,import.meta.url),'utf8'));await db.exec(migration);await db.exec(migration)
 assert.equal((await db.query("SELECT count(*) n FROM information_schema.columns WHERE table_schema='storage' AND table_name='objects' AND column_name IN('archived_at','is_delete_marker')")).rows[0].n,0)
 const indexSql=await readFile(new URL('../vps/106_sitov_special_staff_targets.sql',import.meta.url),'utf8');await db.exec(indexSql);await db.exec(indexSql);
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
 await db.exec(`INSERT INTO sitov_special_private.runs(id,student_id,definition_id,mode,status,selected,queue,answers,result,completed_at) VALUES('${id(917)}','${users.selected}','${def}','test','completed',ARRAY['${draft.pools[0].items[0].id}']::uuid[],ARRAY[]::uuid[],'{}','{"fixture":"historical"}',now())`);await db.actor(users.teacher);assert.equal((await call()).data.ready,true)
 const readonly=db.raw(`BEGIN READ ONLY;SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claims',${quote({sub:users.teacher,role:'authenticated'})},true);SELECT set_config('request.jwt.claim.sub','${users.teacher}',true);SELECT sitov_get_special_publication('${node}','${def}','${version}',${quote(source.sha256)},NULL);ROLLBACK;`);assert.equal(JSON.parse(readonly.split('\n').at(-1)).data.ready,true)

 const index=async(level=null)=>(await db.query('SELECT sitov_get_special_staff_targets($1) r',[level])).rows[0].r
 const expected={nodeId:node,unitId:unit,title:draft.pools[0].title,level:'A1.1',sourceSha256:source.sha256,activeDefinitionId:null}
 assert.deepEqual(await index(),{ok:true,data:[expected]});assert.deepEqual(await index('A1.1'),{ok:true,data:[expected]});assert.deepEqual(await index('A1.2'),{ok:true,data:[]})
 for(const bad of ['', 'a1.1',' A1.1','A9', 'A1.1;SELECT 1'])assert.deepEqual(await index(bad),{ok:false,error:'invalid_input',retryable:false})
 await db.actor(null);assert.equal((await index()).error,'authentication_required')
 await db.actor(users.selected,'authenticated',{app_metadata:{role:'admin'},aal:'aal2'});assert.equal((await index()).error,'not_found');await assert.rejects(db.query('SELECT * FROM sitov_special_private.definitions'),/permission denied/)
 for(const role of ['anon','service_role']){await db.actor(null,role);await assert.rejects(index(),/permission denied/)}
 await db.actor(users.teacher,'postgres');await db.exec(`UPDATE profiles SET role='admin' WHERE id='${users.teacher}';INSERT INTO auth.mfa_factors(id,user_id,status,factor_type) VALUES('${id(914)}','${users.teacher}','verified','totp')`)
 await db.actor(users.teacher);assert.equal((await index()).error,'not_found');await db.actor(users.teacher,'authenticated',{aal:'aal2'});assert.deepEqual(await index(),{ok:true,data:[expected]})
 await db.actor(users.teacher,'postgres');await db.exec(`UPDATE auth.mfa_factors SET status='unverified' WHERE id='${id(914)}'`);await db.actor(users.teacher,'authenticated',{aal:'aal2'});assert.equal((await index()).error,'not_found')
 await db.actor(users.teacher,'postgres');await db.exec(`UPDATE auth.mfa_factors SET status='verified' WHERE id='${id(914)}'`);await db.actor(users.teacher,'authenticated',{aal:'aal2'})
 const published=await call(true);assert.equal(published.ok,true);expected.activeDefinitionId=def;assert.deepEqual(await index(),{ok:true,data:[expected]})
 // Entire RPC succeeds in a real READ ONLY transaction, with exactly six metadata keys.
 const indexRead=db.raw(`BEGIN READ ONLY;SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claims',${quote({sub:users.teacher,role:'authenticated',aal:'aal2'})},true);SELECT set_config('request.jwt.claim.sub','${users.teacher}',true);SELECT sitov_get_special_staff_targets();ROLLBACK;`);assert.deepEqual(JSON.parse(indexRead.split('\n').at(-1)),{ok:true,data:[expected]})
 assert.deepEqual(Object.keys(expected).sort(),['activeDefinitionId','level','nodeId','sourceSha256','title','unitId'].sort())
 const snapshot=async()=>(await db.query(`SELECT jsonb_build_object('nodes',(SELECT jsonb_agg(to_jsonb(n) ORDER BY id) FROM path_nodes n),'definitions',(SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM sitov_special_private.definitions d),'activation',(SELECT jsonb_agg(to_jsonb(a) ORDER BY node_id) FROM sitov_special_private.activation a),'runs',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM sitov_special_private.runs r)) state`)).rows[0].state
 await db.actor(null,'postgres');const before=await snapshot();await db.actor(users.teacher,'authenticated',{aal:'aal2'});await index();await index('A1.1');await db.actor(null,'postgres');assert.deepEqual(await snapshot(),before)
 // Current registry hash is returned even when old publication proofs become stale.
 await db.exec(`UPDATE sitov_special_private.sources SET source_sha256='${'e'.repeat(64)}' WHERE source_ref=${quote(source.ref)}`);await db.actor(users.teacher,'authenticated',{aal:'aal2'});assert.deepEqual((await index()).data,[{...expected,sourceSha256:'e'.repeat(64)}]);await db.actor(null,'postgres');await db.exec(`UPDATE sitov_special_private.sources SET source_sha256=${quote(source.sha256)},level='A1.2' WHERE source_ref=${quote(source.ref)}`);await db.actor(users.teacher,'authenticated',{aal:'aal2'});assert.deepEqual((await index()).data,[])
 await db.actor(null,'postgres');await db.exec(`UPDATE sitov_special_private.sources SET level='A1.1' WHERE source_ref=${quote(source.ref)};UPDATE learning_units SET owner_auth_user_id='${users.selected}',trainer='vocabulary',label='Eigene Wörter',is_path=false WHERE id='${unit}'`);await db.actor(users.teacher,'authenticated',{aal:'aal2'});assert.deepEqual((await index()).data,[])
 await db.actor(null,'postgres');await db.exec(`UPDATE learning_units SET owner_auth_user_id=NULL,trainer='exercises',label='Sitov synthetic parent',is_path=true WHERE id='${unit}';UPDATE path_nodes SET is_active=false WHERE id='${node}'`);await db.actor(users.teacher,'authenticated',{aal:'aal2'});assert.deepEqual((await index()).data,[expected]) // Pointer remains actual despite node flag.
 await db.actor(null,'postgres');await db.exec(`UPDATE profiles SET role='student' WHERE id='${users.teacher}'`);await db.actor(users.teacher,'authenticated',{aal:'aal2'});assert.equal((await index()).error,'not_found')
 await db.actor(null,'postgres');await db.exec(`UPDATE profiles SET role='teacher' WHERE id='${users.teacher}';DELETE FROM auth.mfa_factors WHERE id='${id(914)}'`);assert.deepEqual(await sitovHistorySnapshot(db),history);assert.deepEqual(await sitovRightsSnapshot(db),rights)

 await db.actor(users.teacher);assert.deepEqual((await index()).data,[expected]);await db.actor(null,'postgres')
 const addVersion=(ref,at)=>db.exec(`INSERT INTO sitov_special_private.definitions(node_id,version,source_ref,blueprint,pool,created_at) SELECT node_id,NULL,${quote(ref)},blueprint||jsonb_build_object('sitov-version-'||${quote(at)},1),pool,${quote(at)}::timestamptz FROM sitov_special_private.definitions WHERE id='${def}'`)
 await addVersion('sitov.unregistered-source','2090-01-01');await db.actor(users.teacher);assert.deepEqual((await index()).data,[]) // Latest invalid source never falls back.
 await db.actor(null,'postgres');await addVersion(source.ref,'2091-01-01');await db.actor(users.teacher);assert.deepEqual((await index()).data,[expected])
 await db.actor(null,'postgres');await db.exec(`INSERT INTO sitov_special_private.sources VALUES('sitov.ambiguous-source','${source.sha256}','A1.1','catalog:sitov-test',false)`);await addVersion('sitov.ambiguous-source','2091-01-01');await db.actor(users.teacher);assert.deepEqual((await index()).data,[]) // Equal-time different sources are ambiguous.
 await db.actor(null,'postgres');await addVersion(source.ref,'2092-01-01')
 await db.exec(`WITH nodes AS (INSERT INTO path_nodes(unit_id,source_id,kind,sort_order,title,topic,anchor_node_id,goals) SELECT '${unit}','sitov-target-'||g,'special',100+g,'Artikel '||g,'Artikel','${anchor}',ARRAY['P4-G1'] FROM generate_series(1,1005) g RETURNING id) INSERT INTO sitov_special_private.definitions(node_id,version,source_ref,blueprint,pool) SELECT id,NULL,${quote(source.ref)},'{}','[]' FROM nodes`)
 await db.actor(users.teacher);const bounded=await index();assert.equal(bounded.data.length,1000);assert.deepEqual(await index(),bounded);assert.equal(new Set(bounded.data.map(t=>t.nodeId)).size,1000);await db.actor(null,'postgres')
 const acl=(await db.query(`SELECT p.prosecdef,p.provolatile,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('service_role',p.oid,'EXECUTE') service,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated FROM pg_proc p WHERE p.oid='public.sitov_get_special_staff_targets(text)'::regprocedure`)).rows[0];assert.deepEqual(acl,{prosecdef:true,provolatile:'s',proconfig:['search_path=""'],anon:false,service:false,authenticated:true})
 }finally{execFileSync(bin+'dropdb',[...args,'--if-exists',database],{env,stdio:'pipe'})}
})
