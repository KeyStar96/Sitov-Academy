import {test} from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync,execFile} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import {createSitovCurrentNativeDatabase} from './helpers/sitov-night-current-native-db.mjs'
import {sitovId as id,sitovUsers as users,sitovHistorySnapshot,sitovRightsSnapshot} from './helpers/sitov-night-current-db.mjs'
const bin='/opt/homebrew/opt/postgresql@17/bin/',args=['-h','/tmp/sitov-night-2026-10-08-pg','-p','55438']
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('PG')))
const migration=await readFile(new URL('../vps/101_sitov_special_authoring.sql',import.meta.url),'utf8')
const draft=JSON.parse(await readFile(new URL('../seeds/sitov-learning-special-pools-2026-10-08.json',import.meta.url),'utf8'))
const pool=draft.pools[0],source=draft.sources[0],unit='f72f211a-9d44-41a2-af18-87976effe62d',anchor='9f92ad82-cb5c-40cf-86d3-87b17b75c5bb'
const literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'"
test('actual source-bound inactive new Special author: native roles/CAS/retry/concurrency/history',async()=>{
 const database=`sitov_night_s2_author_${process.pid}`;execFileSync(bin+'createdb',[...args,database],{env,stdio:'pipe'})
 try{
 const db=await createSitovCurrentNativeDatabase({database});await db.exec(await readFile(new URL('../vps/93_sitov_commercial_access.sql',import.meta.url),'utf8'));await db.exec(await readFile(new URL('../vps/95_sitov_learning_specials.sql',import.meta.url),'utf8'));await db.exec(migration);await db.exec(migration)
 const history=await sitovHistorySnapshot(db),rights=await sitovRightsSnapshot(db)
 // Synthetic fixture copies ONLY independently read parent identities; never imports the old path seed.
 await db.exec(`INSERT INTO learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_title,path_slug) VALUES('${unit}','A1.1','exercises','Sitov synthetic parent',90,true,'P4','Wohnen','sitov-synthetic-parent');
 INSERT INTO path_objectives VALUES('${unit}','P4-G1','grammar','Artikel');
 INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,merkkarte,goals) VALUES('${anchor}','${unit}','P4-N1','practice',1,'Der, das, die','Artikel','{"card":"sitov-test","rule":"Artikel","examples":["der Flur"],"highlight":"article"}',ARRAY['P4-G1']);`)
 const context=async()=>(await db.query('SELECT sitov_special_author_context($1,$2,$3) r',[unit,anchor,source.ref])).rows[0].r
 await db.actor(null,'anon');await assert.rejects(context(),/permission denied/)
 await db.actor(users.selected);assert.equal((await context()).error,'not_found')
 await db.actor(users.teacher);const ctx=await context();assert.equal(ctx.ok,true)
 const input={requestId:id(901),unitId:unit,anchorNodeId:anchor,sourceRef:source.ref,sourceSha256:source.sha256,expectedAnchorVersion:ctx.data.anchorVersion,specialSourceId:pool.specialId,title:pool.title,topic:'Artikel im Nominativ',goalId:'P4-G1',blueprint:pool.blueprint,items:pool.items.map(({published,...x})=>{assert.equal(published,false);return x})}
 const call=async(x=input)=>(await db.query('SELECT sitov_special_author_create($1) r',[x])).rows[0].r
 assert.equal((await call({...input,published:true})).error,'invalid_input')
 assert.equal((await call({...input,sourceSha256:'e'.repeat(64)})).error,'source_conflict')
 assert.equal((await call({...input,expectedAnchorVersion:'e'.repeat(64)})).error,'stale_revision')
 assert.equal((await call({...input,anchorNodeId:id(999)})).error,'not_found')
 const missingEvidence=structuredClone(input);delete missingEvidence.items[0].sourceEvidence.task.page;assert.equal((await call(missingEvidence)).error,'invalid_input')
 await db.actor(users.teacher,'postgres');await db.exec(`UPDATE path_nodes SET title='Der, das, die · aktualisiert' WHERE id='${anchor}'`);await db.actor(users.teacher);assert.equal((await call()).error,'stale_revision');input.expectedAnchorVersion=(await context()).data.anchorVersion
 await db.exec(`BEGIN READ ONLY;SELECT sitov_special_author_context('${unit}','${anchor}','${source.ref}');COMMIT;`)
 assert.equal((await call({...input,items:[...input.items.slice(1),input.items[1]]})).error,'invalid_input')
 const malformed=structuredClone(input);malformed.items[0].snapshot.content.correct_answer='unknown';assert.equal((await call(malformed)).error,'invalid_input')
 await db.actor(users.selected);assert.equal((await call()).error,'not_found')
 // Current DB role overrides forged client/JWT admin role.
 await db.actor(users.selected,'authenticated',{app_metadata:{role:'admin'},aal:'aal2'});assert.equal((await call()).error,'not_found')
 await db.actor(users.teacher,'postgres');await db.exec(`UPDATE profiles SET role='admin' WHERE id='${users.teacher}'`)
 await db.actor(users.teacher);assert.equal((await context()).error,'not_found');assert.equal((await call()).error,'not_found')
 await db.actor(users.teacher,'postgres');await db.exec(`INSERT INTO auth.mfa_factors(id,user_id,status,factor_type) VALUES('${id(902)}','${users.teacher}','verified','totp')`)
 await db.actor(users.teacher,'authenticated',{aal:'aal2'});assert.equal((await context()).ok,true)
 // Two genuinely parallel authenticated PostgreSQL sessions race on the same real unit/base.
 // execFile stdin is supplied with a child to avoid shell interpolation.
 const race=requestId=>new Promise((resolve,reject)=>{const child=execFile(bin+'psql',['-X','-w','-qAt',...args,'-d',database,'-v','ON_ERROR_STOP=1'],{env},(err,out)=>err?reject(err):resolve(JSON.parse(out.trim().split('\n').at(-1))));child.stdin.end(`SET ROLE authenticated;SELECT set_config('request.jwt.claims',${literal({sub:users.teacher,role:'authenticated',aal:'aal2'})},false);SELECT set_config('request.jwt.claim.sub','${users.teacher}',false);SELECT sitov_special_author_create(${literal({...input,requestId})}::jsonb);`)})
 const races=await Promise.all([race(input.requestId),race(id(903))]);assert.equal(races.filter(r=>r.ok).length,1,JSON.stringify(races));assert.equal(races.find(r=>!r.ok).error,'already_exists')
 const win=races.find(r=>r.ok),winningRequest=races[0].ok?input.requestId:id(903);const accepted={...input,requestId:winningRequest}
 assert.deepEqual(await call(accepted),win);assert.equal((await call({...accepted,title:'Verändert'})).error,'request_conflict')
 await db.actor(null,'postgres');await db.exec(migration);await db.actor(users.teacher,'authenticated',{aal:'aal2'});assert.deepEqual(await call(accepted),win);await db.actor(null,'postgres');const state=(await db.query(`SELECT n.is_active,d.published,d.editorial_proof,d.audio_import_proof,d.version=dbo.v AS fingerprint, jsonb_array_length(d.pool) AS items,
 (SELECT count(*) FROM sitov_special_private.activation) AS activations FROM path_nodes n JOIN sitov_special_private.definitions d ON d.node_id=n.id
 CROSS JOIN LATERAL (SELECT sitov_special_private.definition_fingerprint(d.node_id,d.source_ref,d.blueprint,d.pool) v) dbo WHERE n.id=$1`,[win.data.nodeId])).rows[0]
 assert.deepEqual(state,{is_active:false,published:false,editorial_proof:null,audio_import_proof:null,fingerprint:true,items:20,activations:0})
 await assert.rejects(db.exec(`UPDATE sitov_special_private.author_receipts SET response='{}' WHERE request_id='${winningRequest}'`),/special_definition_immutable/)
 await assert.rejects(db.exec(`UPDATE sitov_special_private.definitions SET published=true WHERE id='${win.data.definitionId}'`),/special_definition_immutable/)
 await assert.rejects(db.exec(`INSERT INTO sitov_special_private.activation VALUES('${win.data.nodeId}','${win.data.definitionId}')`),/special_publication_proof_required/)
 await db.exec(`UPDATE profiles SET role='teacher' WHERE id='${users.teacher}';DELETE FROM auth.mfa_factors WHERE id='${id(902)}';`);assert.deepEqual(await sitovHistorySnapshot(db),history);assert.deepEqual(await sitovRightsSnapshot(db),rights)
 await db.actor(users.selected);assert.equal((await db.query('SELECT count(*) n FROM path_nodes WHERE id=$1',[win.data.nodeId])).rows[0].n,0)
 await assert.rejects(db.query('SELECT * FROM sitov_special_private.authored_drafts'),/permission denied/)
 await db.actor(users.teacher,'postgres');await db.exec(`UPDATE profiles SET role='student' WHERE id='${users.teacher}'`)
 await db.actor(users.teacher,'authenticated',{aal:'aal2'});assert.equal((await call(accepted)).error,'not_found')
 }finally{execFileSync(bin+'dropdb',[...args,'--if-exists',database],{env,stdio:'pipe'})}
})
