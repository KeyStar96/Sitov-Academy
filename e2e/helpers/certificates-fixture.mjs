#!/usr/bin/env node
/** Browser-only UI fixture. Synthetic .invalid identities, loopback HTTP, no
 * production database. SQL/RLS/payment rules are covered by the DB suites. */
import http from 'node:http'
const port=54330
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const student=id(1), teacher=id(2), person=id(10), course=id(20)
const stamp='2026-09-01T12:00:00Z'
let tables,periods,commands
const period=(n,start,end,eligible=true,reason=null,status='confirmed')=>({id:id(n),person_id:person,course_id:course,start_date:start,end_date:end,status,confirmed_at:status==='confirmed'?stamp:null,title_snapshot:'Deutsch A1 · Demo',description_snapshot:'Synthetischer Kurs für Browserprüfungen.',schedule_snapshot:[],revision:1,source_revision:1,eligible,reason,allocations:eligible?[{id:id(100+n),invoice_id:id(30),start_date:start,end_date:end,source_revision:1,invoice_revision:1,payment_status:'paid',validity:'valid',invoice_number:'DEMO-R-1'}]:[]})
function reset(){
 periods=[period(40,'2026-01-15','2026-01-31'),period(41,'2026-02-01','2026-02-28'),period(42,'2026-04-01','2026-04-30'),period(43,'2026-03-01','2026-03-31',false,'participation_unconfirmed','pending'),period(44,'2026-05-01','2026-05-31',false,'invoice_unpaid')]
 commands=[]
 const studentPerson={id:person,auth_user_id:student,display_name:'Demo Schüler',email:'demo@example.invalid',street:'Musterstraße 1',postal_code:'30159',city:'Hannover',phone:null,birth_date:null}
 tables={
  people:[studentPerson],
  profiles:[{id:student,role:'student',native_language:'de',ui_language:'de',person:studentPerson,level_access:[{level:'A1.1'}]},{id:teacher,role:'teacher',native_language:'de',ui_language:'de',person:{display_name:'Demo Lehrkraft'}}],
  external_customers:[{id:id(11),customer_number:'DEMO-K-1',person_id:person,display_name:'Demo Schüler',email:'demo@example.invalid',street:'Musterstraße 1',postal_code:'30159',city:'Hannover',phone:null,review_status:'resolved',review_reason:null,source_data:{},source_exported_at:stamp},{id:id(12),customer_number:'DEMO-K-OFFEN',person_id:null,display_name:'Demo Klärfall',email:null,phone:null,street:null,postal_code:null,city:null,review_status:'pending',review_reason:'missing_email',source_data:{},source_exported_at:stamp}],
  external_products:[{id:id(21),article_number:'DEMO-DE-A1',name:'Deutsch A1',description:'Demo Beschreibung',unit:'Monat',unit_price:50,review_status:'resolved',review_reason:null,source_data:{},source_exported_at:stamp}],
  external_product_courses:[{product_id:id(21),course_id:course,certificate_title:'Deutsch A1 · Demo',certificate_description:'Synthetischer Kurs für Browserprüfungen.',schedule_snapshot:[],version:1}],
  courses:[{id:course,title:'Deutsch A1 · Demo',description:'Demo Beschreibung',slug:'demo-a1',start_date:null,end_date:null,archived_at:null,type:'online'}],
  course_schedules:[],bookings:[],booking_items:[],invoice_relations:[],invoice_allocations:[],
  invoices:[{id:id(30),invoice_number:'DEMO-R-1',external_customer_id:id(11),customer_number:'DEMO-K-1',document_type:'invoice',source_status:'Bezahlt',payment_status:'paid',validity:'valid',invoice_date:'2026-01-01',service_month:'2026-01-01',gross_amount:50,paid_amount:50,discount_amount:0,article_numbers:['DEMO-DE-A1'],review_reason:null,source_revision:1,source_exported_at:stamp,last_import_batch_id:null,external_customers:{person_id:person},source_data:{}}],
  participation_periods:periods,
  certificate_issues:[{id:id(50),person_id:person,certificate_number:'DEMO-SA-ISSUED',status:'issued',requested_month:null,issued_at:stamp,revoked_at:null,revoked_reason:null,created_at:stamp},{id:id(51),person_id:person,certificate_number:'DEMO-SA-REVOKED',status:'revoked',requested_month:null,issued_at:stamp,revoked_at:stamp,revoked_reason:'Geänderte Quelldaten',created_at:stamp}],
  import_batches:[],import_rows:[],student_level_access:[{auth_user_id:student,level:'A1.1'}],
 }
 for(const name of ['external_customers','external_products','invoices'])for(const row of tables[name])row.account_key='papierkram'
}
reset()
function actor(request){try{return JSON.parse(Buffer.from(request.headers.authorization?.split('.')[1]??'','base64url')).sub??student}catch{return student}}
async function jsonBody(request){let body='';for await(const chunk of request)body+=chunk;try{return JSON.parse(body)}catch{return {}}}
function command(body){
 commands.push(body)
 const p=body.p_payload??{}
 if(body.p_command==='stage_import'){
  const batch=id(70+tables.import_batches.length)
  tables.import_batches.push({id:batch,account_key:'papierkram',kind:p.kind,status:'preview',filename:p.filename,exported_at:p.exported_at,scope:p.scope,is_complete_snapshot:p.is_complete_snapshot,export_year:p.export_year,summary:p.summary,created_at:stamp,applied_at:null})
  tables.import_rows.push(...p.rows.map((r,i)=>({...r,id:id(700+i),batch_id:batch,resolution:{}})))
  return {batch_id:batch,status:'preview',summary:p.summary}
 }
 if(body.p_command==='apply_import'){const b=tables.import_batches.find(b=>b.id===p.batch_id);b.status='applied';b.applied_at=stamp;return {batch_id:b.id,status:'applied'}}
 if(body.p_command==='resolve_customer'){const c=tables.external_customers.find(c=>c.id===p.id);c.person_id=p.person_id;c.review_status='resolved';c.review_reason=null;return {id:c.id}}
 if(body.p_command==='confirm_participation'){for(const value of p.periods){const target=periods.find(r=>r.id===value.id);if(target)Object.assign(target,{status:'confirmed',confirmed_at:stamp,eligible:true,reason:null,revision:2})}return {confirmed_count:p.periods.length}}
 return {id:p.id??id(99)}
}
const server=http.createServer(async(request,response)=>{
 const url=new URL(request.url,`http://127.0.0.1:${port}`), name=url.pathname.split('/').at(-1)
 let data=[]
 if(url.pathname==='/__certificates/health')data={fixture:'certificates',synthetic:true}
 else if(url.pathname==='/__certificates/reset'){reset();data={ok:true}}
 else if(url.pathname==='/__certificates/commands')data=commands
 else if(url.pathname==='/auth/v1/user')data={id:actor(request),aud:'authenticated',role:'authenticated',email:actor(request)===teacher?'teacher@example.invalid':'demo@example.invalid',email_confirmed_at:stamp,is_anonymous:false,app_metadata:{provider:'email'},user_metadata:{},created_at:stamp}
 else if(url.pathname.startsWith('/rest/v1/rpc/')){
  const body=await jsonBody(request)
  if(name==='claim_verified_person')data={id:person,unresolved:false}
  else if(name==='certificate_eligibility')data=periods
  else if(name==='certificate_import_baseline')data='a'.repeat(32)
  else if(name==='certificate_staff_command')data=command(body)
  else if(name==='get_last_active_level')data={level:'A1.1',mode:'vocabulary',source:'activity',levels:[]}
  else if(name==='get_learning_new_counts')data={success:true,levels:{},any:false,visited:[]}
  else if(name==='get_staff_pronunciation_view')data={success:true,hiddenSubmissions:[],hiddenMessages:[],pendingCount:0}
 }
 else if(url.pathname.startsWith('/rest/v1/')){
  data=[...(tables[name]??[])]
  for(const [key,value] of url.searchParams){if(value.startsWith('eq.')&&!key.includes('.'))data=data.filter(row=>String(row[key])===value.slice(3));if(value.startsWith('in.')){const set=value.slice(4,-1).split(',');data=data.filter(row=>set.includes(String(row[key])))}}
  if(Number(url.searchParams.get('offset')??0)>0)data=[]
  if(url.searchParams.get('limit'))data=data.slice(0,Number(url.searchParams.get('limit')))
  if(request.headers.accept?.includes('vnd.pgrst.object+json'))data=data[0]??null
 }
 response.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'*','content-range':`0-${Math.max(0,(Array.isArray(data)?data.length:1)-1)}/${Array.isArray(data)?data.length:1}`})
 response.end(request.method==='HEAD'?'':JSON.stringify(data))
})
server.listen(port,'127.0.0.1',()=>console.log(`Synthetic certificate fixture: http://127.0.0.1:${port}`))
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)))
