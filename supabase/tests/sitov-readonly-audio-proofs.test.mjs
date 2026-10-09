import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {createSitovIntegrated96NativeDatabase} from './helpers/sitov-night-integrated96-native-db.mjs'
import {SitovNativeDatabase} from './helpers/sitov-night-current-native-db.mjs'
import {sitovId,sitovUsers,sitovHistorySnapshot} from './helpers/sitov-night-current-db.mjs'
import {sitovReadAuthoringSources} from '../../scripts/sitov-pronunciation-pretests-authoring.mjs'
const sql=await readFile(new URL('../migrations/20261009003000_sitov_readonly_audio_proofs.sql',import.meta.url),'utf8'),sql97=await readFile(new URL('../migrations/20261009001000_sitov_storage_proof_compatibility.sql',import.meta.url),'utf8')
const literal=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`,hash=t=>createHash('sha256').update(t).digest('hex'),fingerprint='96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5'
const drafts=JSON.parse(await readFile(new URL('../seeds/sitov-pronunciation-pretests-2026-10-08.json',import.meta.url),'utf8')).drafts,sources=await sitovReadAuthoringSources()
const sql98=await readFile(new URL('../migrations/20261009002000_sitov_pretest_option_presentation.sql',import.meta.url),'utf8')
test('99 fixes authenticated readonly text RLS while strict assets and write locks remain',async t=>{
 const name=`sitov_night_readonly99_${process.pid}_${Date.now()}`,admin=new SitovNativeDatabase();admin.raw(`CREATE DATABASE ${name}`);let db
 try{
  db=await createSitovIntegrated96NativeDatabase({database:name});await db.actor(null,'postgres');await db.exec(sql97);await db.exec(sql98)
  const history=await sitovHistorySnapshot(db),draft=drafts[0],definition=draft.definition,body=sources.rows.find(s=>s.id===draft.textId).text,textId=sitovId(98302)
  const rpc=async(name,args)=>(await db.query(`SELECT ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args)).rows[0].value
  let serial=98400;const request=()=>sitovId(serial++)
  const seedAsset=async text=>{const spoken=(await db.query('SELECT vocabulary_private.sitov_normalize_audio_text($1) value',[text])).rows[0].value,path='sitov-qwen-v1/de/'+hash(JSON.stringify({text:spoken,voice:'sitov-qwen-male-de-v1',rate:'qwen-native-1-lufs-18-aligned-v1',format:'audio-24khz-48kbitrate-mono-mp3',leadIn:.35,profile:fingerprint}))+'.mp3',metadata={engine:'qwen3-tts',voice:'sitov-qwen-male-de-v1',revision:'sitov-qwen-base-bf16-v1',profileFingerprint:fingerprint,textSha256:hash(spoken),audioSha256:'a'.repeat(64),wordTimings:spoken.split(' ').map((_,i)=>({start:i,end:i+.5}))};await db.exec(`INSERT INTO storage.objects(bucket_id,name,metadata,user_metadata) VALUES('audio_cache','${path}','{"mimetype":"audio/mpeg","size":1000}',${literal(metadata)}) ON CONFLICT(bucket_id,name) DO UPDATE SET metadata=excluded.metadata,user_metadata=excluded.user_metadata`);return{spoken,path}}
  await db.exec(`INSERT INTO learning_reading_texts(id,unit_id,sentence_de) VALUES('${textId}','${sitovId(232)}','${body.replaceAll("'","''")}');INSERT INTO sitov_pronunciation_private.pretest_definitions(text_id,text_version,test_version,definition) VALUES('${textId}','${draft.textVersion}',repeat('a',64),${literal(definition)})`)
  const d=(await db.query('SELECT id,text_version,test_version,definition FROM sitov_pronunciation_private.pretest_definitions WHERE text_id=$1',[textId])).rows[0],ref=await seedAsset(body)
  await db.exec(`INSERT INTO sitov_pronunciation_private.pretest_approvals(definition_id,text_version,test_version,author_identity,reviewer_identity,review_status,reviewed_at,review_document_ref,review_document_sha256,reference_kind,reference_bucket,reference_path,reference_audio_sha256) VALUES('${d.id}','${d.text_version}','${d.test_version}','sitov.qa.author','sitov.qa.editor','independent_approved',now(),'sitov.editorial.review.synthetic98',repeat('b',64),'prepared_qwen','audio_cache','${ref.path}',repeat('a',64))`)
  const assets=[];for(const row of (await db.query('SELECT sitov_pronunciation_private.public_audio_texts($1) spoken',[definition])).rows)assets.push(await seedAsset(row.spoken))
  await db.exec(`INSERT INTO sitov_pronunciation_private.pretest_question_audio_proofs(definition_id,test_version,text_sha256,path,audio_sha256,word_timings_sha256) VALUES ${assets.map(a=>`('${d.id}','${d.test_version}','${hash(a.spoken)}','${a.path}',repeat('a',64),(SELECT sitov_pronunciation_private.pretest_hash((user_metadata->'wordTimings')::text) FROM storage.objects WHERE name='${a.path}'))`).join(',')};UPDATE sitov_pronunciation_private.pretest_definitions SET active=true WHERE id='${d.id}'`)
  const start=req=>rpc('sitov_start_pronunciation_pretest',[textId,req??request()]),get=id=>rpc('sitov_get_pronunciation_pretest_attempt',[id]),save=(a,answers,req=request(),revision=a.revision)=>rpc('sitov_save_pronunciation_pretest_answers',[a.id,revision,answers,req]),submit=(a,answers,req=request(),revision=a.revision)=>rpc('sitov_submit_pronunciation_pretest',[a.id,revision,answers,req])
  const canonicalAnswers=data=>Object.fromEntries(data.attempt.questionIds.map(id=>[id,definition.tasks.find(q=>q.id===id).correctOptionId]))
  const presentedAnswers=data=>Object.fromEntries(data.tasks.map(q=>{const canonical=definition.tasks.find(c=>c.id===q.id),correctText=canonical.options.find(o=>o.id===canonical.correctOptionId).textDe;return[q.id,q.options.find(o=>o.textDe===correctText).id]}))
  await db.actor(sitovUsers.german);const begun=(await start()).data,answers=presentedAnswers(begun),done=await submit(begun.attempt,answers);assert.equal(done.data.result.passed,true)
  const readonly=uid=>{const claims={role:'authenticated',...(uid?{sub:uid}:{})},result=db.raw(`BEGIN READ ONLY;SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claims',${literal(claims).replace('::jsonb','::text')},true);SELECT set_config('request.jwt.claim.sub','${uid??''}',true);SELECT jsonb_build_object('readonly',current_setting('transaction_read_only'),'pass',sitov_pronunciation_private.current_pass('${textId}'),'rows',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'body',sentence_de,'audio',audio_url)) FROM public.learning_reading_texts WHERE id='${textId}'),'[]'::jsonb));ROLLBACK;`);return JSON.parse(result.split('\n').at(-1))}
  await t.test('reproduce real authenticated READ ONLY current-pass false and zero-row SELECT before99',async()=>{
   assert.equal((await db.query('SELECT sitov_pronunciation_private.current_pass($1) value',[textId])).rows[0].value,true)
   const before=readonly(sitovUsers.german);assert.equal(before.readonly,'on');assert.equal(before.pass,false);assert.deepEqual(before.rows,[])
   assert.throws(()=>db.raw(`BEGIN READ ONLY;SET LOCAL ROLE postgres;SELECT vocabulary_private.sitov_prepared_german_audio_url('${body.replaceAll("'","''")}');ROLLBACK;`),/cannot execute SELECT FOR SHARE in a read-only transaction/)
  })
  await db.actor(null,'postgres')
  const attempts=(await db.query('SELECT * FROM sitov_pronunciation_private.pretest_attempts ORDER BY id')).rows,passes=(await db.query('SELECT * FROM sitov_pronunciation_private.pretest_passes ORDER BY id')).rows
  const signatures=['vocabulary_private.sitov_prepared_german_audio_url(text)','sitov_pronunciation_private.reference_valid(text,text,sitov_pronunciation_private.pretest_approvals)','sitov_pronunciation_private.public_audio_ready(uuid,text,jsonb)'],attrs=async()=>(await db.query(`SELECT oid,proowner,proacl,prosecdef,provolatile,proconfig FROM pg_proc WHERE oid IN(${signatures.map(s=>`'${s}'::regprocedure`).join(',')}) ORDER BY oid`)).rows,beforeAttrs=await attrs()
  await t.test('99 mirrors/replays preserving guard attributes and exact RLS passed-only readonly body',async()=>{
   assert.equal(sql,await readFile(new URL('../vps/99_sitov_readonly_audio_proofs.sql',import.meta.url),'utf8'));await db.exec(sql);await db.exec(sql);assert.deepEqual(await attrs(),beforeAttrs)
   const after=readonly(sitovUsers.german);assert.equal(after.pass,true);assert.deepEqual(after.rows,[{id:textId,body,audio:null}])
   for(const uid of [sitovUsers.all,sitovUsers.explicitAll,sitovUsers.outsider,sitovUsers.selected,null]){const denied=readonly(uid);assert.equal(denied.pass,false);assert.deepEqual(denied.rows,[])}
   await db.actor(sitovUsers.german);assert.equal((await db.query('SELECT id FROM storage.objects WHERE bucket_id=$1',['audio_cache'])).rows.length,0)
  })
  await t.test('readonly still requires exact public prompt/option/reference hashes, voice, timing proof and live commercial scope',async()=>{
   await db.actor(null,'postgres')
   for(const spoken of [body,definition.tasks[0].promptDe,definition.tasks[0].options[1].textDe]){
    const target=(await db.query('SELECT name,user_metadata FROM storage.objects WHERE user_metadata->>$1=$2',['textSha256',hash(spoken)])).rows[0]
    for(const delta of [{voice:'wrong-profile'},{audioSha256:'d'.repeat(64)},{wordTimings:[]}]){await db.exec(`UPDATE storage.objects SET user_metadata=${literal({...target.user_metadata,...delta})} WHERE name='${target.name}'`);const denied=readonly(sitovUsers.german);assert.equal(denied.pass,false);assert.deepEqual(denied.rows,[]);await db.exec(`UPDATE storage.objects SET user_metadata=${literal(target.user_metadata)} WHERE name='${target.name}'`)}
   }
   await db.exec('ALTER TABLE storage.objects ADD COLUMN archived_at timestamptz;ALTER TABLE storage.objects ADD COLUMN is_delete_marker boolean DEFAULT false')
   for(const a of [ref,assets.find(a=>a.spoken===definition.tasks[0].options[1].textDe)])for(const marker of ['archived_at=now()','is_delete_marker=true']){await db.exec(`UPDATE storage.objects SET ${marker} WHERE name='${a.path}'`);assert.deepEqual(readonly(sitovUsers.german).rows,[]);await db.exec(`UPDATE storage.objects SET archived_at=NULL,is_delete_marker=false WHERE name='${a.path}'`)}
   const option=assets.find(a=>a.spoken===definition.tasks[0].options[0].textDe),metadata=(await db.query('SELECT user_metadata FROM storage.objects WHERE name=$1',[option.path])).rows[0].user_metadata
   await db.exec(`UPDATE storage.objects SET user_metadata=jsonb_set(user_metadata,'{wordTimings,0,end}','0.4'::jsonb) WHERE name='${option.path}'`);assert.deepEqual(readonly(sitovUsers.german).rows,[]);await db.exec(`UPDATE storage.objects SET user_metadata=${literal(metadata)} WHERE name='${option.path}'`)
   const rights=(await db.query('SELECT * FROM public.student_level_access WHERE auth_user_id=$1 AND level=$2',[sitovUsers.german,'A1.1'])).rows
   await db.exec(`DELETE FROM public.student_level_access WHERE auth_user_id='${sitovUsers.german}' AND level='A1.1'`);assert.deepEqual(readonly(sitovUsers.german).rows,[])
   for(const right of rights)await db.exec(`INSERT INTO public.student_level_access SELECT (jsonb_populate_record(NULL::public.student_level_access,${literal(right)})).*`)
   assert.equal(readonly(sitovUsers.german).pass,true)
   await db.exec(`UPDATE learning_reading_texts SET sentence_de=sentence_de||' Paul lernt.' WHERE id='${textId}'`);assert.deepEqual(readonly(sitovUsers.german).rows,[]);await db.exec(`UPDATE learning_reading_texts SET sentence_de='${body.replaceAll("'","''")}' WHERE id='${textId}'`)
   await db.exec('ALTER TABLE storage.objects DROP COLUMN archived_at;ALTER TABLE storage.objects DROP COLUMN is_delete_marker');assert.equal(readonly(sitovUsers.german).pass,true)
  })
  await t.test('actual write-ticket RPC still holds object FOR SHARE against simultaneous metadata mutation',async()=>{
   await db.actor(sitovUsers.german)
   const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('PG'))),ticketRequest=request()
   const query=`SET application_name='${name}_lock';BEGIN;SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${sitovUsers.german}',true);SELECT public.sitov_create_pronunciation_upload_ticket('${textId}','${ticketRequest}','webm');SELECT 'SITOV99_LOCK_READY';SELECT pg_sleep(1.2);COMMIT;`
   let child;const finished=new Promise((resolve,reject)=>{child=execFile('/opt/homebrew/opt/postgresql@17/bin/psql',['-X','-w','-qAt','-h','/tmp/sitov-night-2026-10-08-pg','-p','55438','-d',name,'-v','ON_ERROR_STOP=1','-c',query],{env},(error,stdout)=>error?reject(error):resolve(stdout))})
   await db.actor(null,'postgres');let sleeping=false;for(let i=0;i<40;i++){sleeping=(await db.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=$1 AND application_name=$2 AND wait_event=$3) value',[name,name+'_lock','PgSleep'])).rows[0].value;if(sleeping)break;await new Promise(resolve=>setTimeout(resolve,20))}assert.equal(sleeping,true,'Actual ticket transaction must reach sleep while holding its locks')
   assert.throws(()=>db.raw(`SET lock_timeout='100ms';UPDATE storage.objects SET user_metadata=user_metadata||'{"voice":"wrong-profile"}'::jsonb WHERE name='${ref.path}'`),/lock timeout/)
   const output=await finished,lines=output.trim().split('\n'),ticket=JSON.parse(lines.find(line=>line.startsWith('{')&&line.includes('ticketId')));assert.equal(ticket.ok,true)
   const unchanged=(await db.query('SELECT user_metadata->>$1 value FROM storage.objects WHERE name=$2',['voice',ref.path])).rows[0].value;assert.equal(unchanged,'sitov-qwen-male-de-v1');assert.equal(readonly(sitovUsers.german).pass,true)
  })
  await t.test('native private metadata helper permissions and historical attempts/pass/checkpoints remain unchanged',async()=>{
   for(const role of ['anon','authenticated','service_role']){await db.actor(null,role);await assert.rejects(db.query('SELECT * FROM sitov_storage_private.sitov_audio_metadata($1,$2)',['audio_cache',ref.path]),/permission denied/)}
   await db.actor(null,'postgres');assert.deepEqual(await attrs(),beforeAttrs);assert.deepEqual((await db.query('SELECT * FROM sitov_pronunciation_private.pretest_attempts ORDER BY id')).rows,attempts);assert.deepEqual((await db.query('SELECT * FROM sitov_pronunciation_private.pretest_passes ORDER BY id')).rows,passes);assert.deepEqual(await sitovHistorySnapshot(db),history)
  })
 }finally{await db?.close();admin.raw(`DROP DATABASE ${name} WITH(FORCE)`)}
})
