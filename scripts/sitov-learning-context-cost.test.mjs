import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { SitovNativeDatabase, createSitovCurrentNativeDatabase } from '../supabase/tests/helpers/sitov-night-current-native-db.mjs'
import { sitovUsers } from '../supabase/tests/helpers/sitov-night-current-db.mjs'

const literal = value => `'${String(value).replaceAll("'", "''")}'`
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
test('original learning context: bounded native cost and exact JSON evidence only', { skip: process.env.SITOV_NIGHT_NATIVE !== '1', timeout: 180000 }, async t => {
 const database = `sitov_night_learning_cost_${process.pid}`, admin = new SitovNativeDatabase()
 admin.raw(`CREATE DATABASE ${database}`)
 let db
 try {
  db = await createSitovCurrentNativeDatabase({ database })
  await db.exec(await readFile(new URL('../supabase/vps/93_sitov_commercial_access.sql', import.meta.url), 'utf8'))
  db.raw = sql => execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql', ['-X','-w','-qAt','-h','/tmp/sitov-night-2026-10-08-pg','-p','55438','-d',database,'-v','ON_ERROR_STOP=1'],
   { input: `SET statement_timeout='8s';${sql}`, encoding:'utf8', timeout:8500, maxBuffer:16*1024*1024,
    env:Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('PG'))), stdio:['pipe','pipe','pipe'] }).trim()
  const definitions = {}
  for (const signature of ['public.get_last_active_level()','public.get_learning_new_counts()','public.get_learning_new_items(text)','learning_private.new_objects()']) {
   definitions[signature] = (await db.query('SELECT pg_get_functiondef($1::regprocedure) body',[signature])).rows[0].body
  }
  await t.test('installed function bodies expose repeated work without replacing any guard', () => {
   assert.equal(definitions['public.get_learning_new_items(text)'].match(/learning_private\.new_objects\(\)/g).length,2)
   assert.ok(definitions['public.get_last_active_level()'].includes('sitov_verb_private.level_allowed(actor,l.code)'))
   assert.ok(definitions['learning_private.new_objects()'].includes('learning_private.allowed_unit_ids()'))
   t.diagnostic(JSON.stringify({definitionHashes:Object.fromEntries(Object.entries(definitions).map(([key,value])=>[key,hash(value)])),decision:'PROOF_ONLY_NO_MIGRATION'}))
  })
  // Seed a fixed baseline before measuring: counts itself inserts the room visit.
  await db.exec(`INSERT INTO learning_first_visits(auth_user_id,scope,first_visit_at)
   SELECT id,scope,'2026-01-01'::timestamptz FROM profiles CROSS JOIN (VALUES('room'),('A1.1')) s(scope)
   WHERE id IN('${sitovUsers.all}','${sitovUsers.selected}','${sitovUsers.outsider}') ON CONFLICT DO NOTHING;`)
  const queries = [ ['last_active','SELECT get_last_active_level() result'],
   ['counts','SELECT get_learning_new_counts() result'], ['items',"SELECT get_learning_new_items('A1.1') result"] ]
  const observations=[]
  await t.test('original student calls have complete JSON fingerprints under an exact 8s statement limit', async () => {
   for (const name of ['all','selected','outsider']) {
    await db.actor(sitovUsers[name])
    for (const [rpc,sql] of queries) {
     const start=performance.now()
     try {
      const result=(await db.query(sql)).rows[0].result
      observations.push({actor:name,rpc,milliseconds:Math.round((performance.now()-start)*100)/100,sha256:hash(result),result})
      assert.equal(result.error,undefined,`${name}/${rpc}: ${JSON.stringify(result)}`)
     } catch(error) {
      t.diagnostic(JSON.stringify({actor:name,rpc,milliseconds:Math.round((performance.now()-start)*100)/100,error:String(error.stderr??error.message)}))
      throw error
     }
    }
   }
   t.diagnostic(JSON.stringify({originalCalls:observations,statementTimeoutMs:8000,clientTimeoutMs:8500,fixture:'immutable normalized baseline92 + 93; synthetic content/history only'}))
  })
  await t.test('stored five-language profiles preserve complete original JSON for a fixed student', async () => {
   const expected=Object.fromEntries(observations.filter(row=>row.actor==='all').map(row=>[row.rpc,row.sha256]))
   for (const locale of ['de','en','ru','uk','tr']) {
    await db.actor(null,'postgres'); await db.exec(`UPDATE profiles SET ui_language=${literal(locale)} WHERE id='${sitovUsers.all}'`)
    await db.actor(sitovUsers.all)
    const results={}
    for (const [rpc,sql] of queries) {
     const result=(await db.query(sql)).rows[0].result
     results[rpc]=hash(result); assert.equal(results[rpc],expected[rpc],`${locale}/${rpc}`)
    }
    t.diagnostic(JSON.stringify({storedUiLanguage:locale,originalJsonHashes:results}))
   }
  })
  await t.test('nested last-active query plan uses the real SECURITY DEFINER owner and actor claims', async () => {
   const body=definitions['public.get_last_active_level()']
   const start=body.indexOf('WITH allowed AS ('), end=body.indexOf('FROM latest l;',start)
   assert.ok(start>=0 && end>start)
   const query=body.slice(start,end+'FROM latest l'.length).replace(/\bINTO recent\b/,'').replace(/\bactor\b/g,`${literal(sitovUsers.all)}::uuid`).replace(/\bstaff\b/g,'false')
   await db.actor(sitovUsers.all,'postgres',{role:'authenticated'})
   const plan=JSON.parse(db.raw(`SET ROLE postgres; SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"${sitovUsers.all}"}',false);
    SELECT set_config('request.jwt.claim.sub','${sitovUsers.all}',false); EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) ${query}`).split('\n').slice(2).join('\n'))
   assert.equal(plan[0].Plan['Node Type'],'Aggregate')
   t.diagnostic(JSON.stringify({lastActiveNestedPlan:plan,role:'postgres',jwtActor:sitovUsers.all,noJitOrTimeoutChange:true}))
  })
  await t.test('denied actor fallback and eager new-object components have separate native plans', async () => {
   const body=definitions['public.get_last_active_level()']
   const fallback=body.match(/SELECT l\.code INTO fallback_level[\s\S]*?LIMIT 1;/g)
   assert.equal(fallback.length,2)
   const queries=[...fallback.map((sql,index)=>[`fallback_${index+1}`,sql.replace(/\bINTO fallback_level\b/,'').replace(/\bactor\b/g,`${literal(sitovUsers.outsider)}::uuid`).replace(/\bstaff\b/g,'false')]),
    ['allowed_unit_ids','SELECT learning_private.allowed_unit_ids()'],
    ['published_video_unit_ids','SELECT media_private.published_video_unit_ids()'],
    ['new_objects','SELECT * FROM learning_private.new_objects()']]
   for(const [component,sql] of queries) {
    const output=db.raw(`SET ROLE postgres; SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"${sitovUsers.outsider}"}',false);
     SELECT set_config('request.jwt.claim.sub','${sitovUsers.outsider}',false); EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) ${sql}`)
    const plan=JSON.parse(output.split('\n').slice(2).join('\n'))[0]
    assert.ok(Number.isFinite(plan['Execution Time']))
    t.diagnostic(JSON.stringify({deniedActorComponent:component,planningMs:plan['Planning Time'],executionMs:plan['Execution Time'],jit:plan.JIT??null,plan:plan.Plan}))
   }
  })
 } finally {
  if(db) await db.close()
  admin.raw(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`)
 }
})
