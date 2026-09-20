/** Run on the VPS after an R8 backup. Creates/removes one synthetic learner.
 * Real authenticated SSR traffic, four readers; no grading/business mutations.
 * Only aggregate timings and resource counters are written to the report.
 */
import {readFileSync,writeFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {randomBytes} from 'node:crypto'
import {parse} from 'dotenv'
import {createClient} from '@supabase/supabase-js'
import {createServerClient} from '@supabase/ssr'
const env=parse(readFileSync('/etc/sitov-academy/app.env'))
const base=env.SUPABASE_INTERNAL_URL||'http://127.0.0.1:9080'
const admin=createClient(base,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const reportPath=process.env.PHASE4_REPORT||'/root/backups/phase4-load.json'
const duration=Number(process.env.PHASE4_DURATION_SECONDS||1800)
if(!Number.isInteger(duration)||duration<1||duration>3600)throw new Error('invalid_duration')
const sql=query=>execFileSync('docker',['exec','-i','supabase-db-eknmzxvqilojjicinatnllbt','psql','-X','-U','supabase_admin','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8'}).trim()
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const report={startedAt:new Date().toISOString(),durationSeconds:duration,workers:4,requests:0,failures:0,ttfbMs:[],completeMs:[],resources:[],status:'running'}
let userId,cookie,accessToken,stop=false
process.on('SIGTERM',()=>{stop=true})
process.on('SIGINT',()=>{stop=true})
function sample(){
 const fields=Object.fromEntries(readFileSync('/sys/fs/cgroup/system.slice/sitov-app.service/memory.events','utf8').trim().split('\n').map(line=>{const [k,v]=line.split(' ');return[k,Number(v)]}))
 const memory=Number(readFileSync('/sys/fs/cgroup/system.slice/sitov-app.service/memory.current','utf8'))
 const available=Number(/^MemAvailable:\s+(\d+)/m.exec(readFileSync('/proc/meminfo','utf8'))[1])*1024
 const restarts=Number(execFileSync('systemctl',['show','sitov-app','-p','NRestarts','--value'],{encoding:'utf8'}).trim())
 const containers=JSON.parse(execFileSync('docker',['inspect',...execFileSync('docker',['ps','-q'],{encoding:'utf8'}).trim().split('\n')],{encoding:'utf8'})).map(c=>({name:c.Name.slice(1),oom:c.State.OOMKilled,restarts:c.RestartCount,health:c.State.Health?.Status??c.State.Status}))
 report.resources.push({elapsedSeconds:Math.round((Date.now()-start)/1000),appMemoryBytes:memory,hostAvailableBytes:available,events:fields,restarts,containers})
 const initial=report.resources[0]
 if(fields.oom_kill||fields.oom||restarts>initial.restarts||containers.some(c=>c.oom||c.health==='unhealthy'||c.restarts>(initial.containers.find(old=>old.name===c.name)?.restarts??0))||available<512*1024*1024){report.failures++;stop=true}
 writeFileSync(reportPath,JSON.stringify(report,null,2),{mode:0o600})
}
let start=Date.now()
try {
 const password=randomBytes(24).toString('base64url')
 const {data,error}=await admin.auth.admin.createUser({email:`phase4-${Date.now()}@example.test`,password,email_confirm:true,user_metadata:{display_name:'Phase 4 load verification',native_language:'ru',ui_language:'ru'}})
 if(error||!data.user)throw new Error('fixture_creation_failed')
 userId=data.user.id
 writeFileSync('/root/backups/phase4-load-fixture-id',userId,{mode:0o600})
 if(!/^[0-9a-f-]{36}$/.test(userId))throw new Error('invalid_fixture_id')
 sql(`UPDATE public.profiles SET ui_language='ru',native_language='ru' WHERE id='${userId}'; INSERT INTO public.student_level_access(auth_user_id,level) VALUES('${userId}','A1.1'); INSERT INTO public.vocabulary_direction_progress(auth_user_id,card_id,direction,box_number,next_review_date) SELECT '${userId}',c.id,d.direction,1,now()-interval '1 day' FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id CROSS JOIN (VALUES ('de_to_native'::public.vocabulary_direction),('native_to_de'::public.vocabulary_direction)) d(direction) WHERE u.level='A1.1';`)
 const cookies=[]
 const client=createServerClient(base,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookieOptions:{name:'sb-sitov-auth-token'},cookies:{getAll:()=>cookies,setAll:values=>cookies.splice(0,cookies.length,...values)}})
 const signed=await client.auth.signInWithPassword({email:data.user.email,password})
 if(signed.error)throw new Error('fixture_login_failed')
 accessToken=signed.data.session.access_token
 cookie=cookies.map(({name,value})=>`${name}=${value}`).join('; ')
 const url='http://127.0.0.1:3000/ru/dashboard/level/A1.1/vocabulary/train'
 // Warm compiled route and verify that requests exercise a real learner session.
 const warm=await fetch(url,{headers:{cookie},redirect:'manual'});const html=await warm.text()
 if(warm.status!==200||!html.includes(userId)||!html.includes('progressId'))throw new Error('session_page_not_populated')
 report.fixtureDirections=Number(sql(`SELECT count(*) FROM public.vocabulary_direction_progress WHERE auth_user_id='${userId}'`))
 start=Date.now();report.startedAt=new Date(start).toISOString();sample()
 const monitor=setInterval(()=>{try{sample()}catch{report.failures++;stop=true}},30000)
 try {
  await Promise.all(Array.from({length:4},async()=>{
   while(!stop&&Date.now()-start<duration*1000){
    const begin=performance.now()
    try{
     const response=await fetch(url,{headers:{cookie},redirect:'manual',signal:AbortSignal.timeout(10000)})
     const first=performance.now()-begin;const text=await response.text();const complete=performance.now()-begin
     report.requests++;report.ttfbMs.push(first);report.completeMs.push(complete)
     if(response.status!==200||!text.includes(userId)||!text.includes('progressId'))report.failures++
    }catch{report.failures++}
    await sleep(Math.max(0,1000-(performance.now()-begin)))
   }
  }))
 }finally{clearInterval(monitor)}
 sample();report.elapsedSeconds=(Date.now()-start)/1000
 const stats=values=>{const sorted=[...values].sort((a,b)=>a-b);return {count:sorted.length,min:sorted[0],p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],p99:sorted[Math.floor(sorted.length*.99)],max:sorted.at(-1)}}
 report.ttfb=stats(report.ttfbMs);report.complete=stats(report.completeMs)
 delete report.ttfbMs;delete report.completeMs
 report.status=report.failures===0&&!stop&&report.ttfb.p95<500?'passed':'failed'
 if(report.status==='failed')process.exitCode=1
}catch{report.status='failed';report.failures++;process.exitCode=1}
finally{
 if(userId){
  if(accessToken)await admin.auth.admin.signOut(accessToken,'global')
  // Deleting the synthetic account cascades Auth-linked learning data. Its
  // business person is explicitly removed only when it has no history.
  sql(`DELETE FROM public.people p WHERE p.auth_user_id='${userId}' AND NOT EXISTS(SELECT 1 FROM public.bookings b WHERE b.person_id=p.id) AND NOT EXISTS(SELECT 1 FROM public.invoice_cases i WHERE i.person_id=p.id);`)
  const removed=await admin.auth.admin.deleteUser(userId)
  report.fixtureRemoved=!removed.error
  if(removed.error){report.status='failed';report.failures++;process.exitCode=1}
 }
 writeFileSync(reportPath,JSON.stringify(report,null,2),{mode:0o600})
 console.log(JSON.stringify({status:report.status,requests:report.requests,failures:report.failures,ttfb:report.ttfb,complete:report.complete,fixtureRemoved:report.fixtureRemoved}))
}
