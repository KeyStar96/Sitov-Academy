import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createPhase3Database, actor, teacher, student, id } from './helpers/phase3-db.mjs'

const schema = await readFile(new URL('../migrations/20260929165242_certificate_csv_schema.sql',import.meta.url),'utf8')
const workflow = await readFile(new URL('../migrations/20260929165727_certificate_csv_workflow.sql',import.meta.url),'utf8')
const guards = await readFile(new URL('../migrations/20260929170539_certificate_eligibility_guards.sql',import.meta.url),'utf8')
await test('certificate CSV workflow: identity, payments, corrections, provenance and private access', async t => {
 const db=await createPhase3Database()
 let sequence=0
 const courseId=id(600), otherCourse=id(601)
 const query=async(sql,args=[]) => (await db.query(sql,args)).rows
 const rpc=async(command,payload={},user=teacher) => (await query('SELECT certificate_staff_command($1,$2,$3) result',[user,command,JSON.stringify(payload)]))[0].result
 const stage=async(kind,rows,options={}) => rpc('stage_import',{
  kind,filename:`${kind}.csv`,file_sha256:(++sequence).toString(16).padStart(64,'0'),exported_at:`2026-09-${String(sequence).padStart(2,'0')}T12:00:00Z`,
  expected_baseline:(await query("SELECT certificates_private.account_baseline('papierkram') value"))[0].value,
  rows:rows.map((d,i)=>({row_number:i+2,external_key:kind==='customers'?d.customer_number:kind==='products'?d.article_number:d.invoice_number,normalized_data:d,raw_data:d,disposition:'new'})),...options,
 })
 const imported=async(kind,rows,options={}) => {const batch=await stage(kind,rows,options);return rpc('apply_import',{batch_id:batch.batch_id})}
 const invoice=(number,status='unpaid',more={}) => ({invoice_number:number,customer_number:'K-1',document_type:'invoice',source_status:status,payment_status:status,validity:'valid',invoice_date:'2025-12-28',due_date:'2026-01-01',paid_at:null,service_month:'2026-01-01',gross_amount:'58.00',paid_amount:status==='paid'?'50.00':'0.00',discount_amount:status==='paid'?'8.00':'0.00',article_numbers:['DE-A1'],subject:'Januar 2026',review_reason:null,...more})
 let person,product,invoiceId,allocationId,periodId
 try {
  await db.exec(schema);await db.exec(workflow);await db.exec(workflow);await db.exec(guards)
  await db.query(`INSERT INTO courses(id,slug,title,type,category,level,unit_price,unit_minutes) VALUES($1,'cert-course','Deutsch A1','online','private','A1.1',25,45),($2,'cert-other','Deutsch B1','online','private','A1.1',25,45)`,[courseId,otherCourse])
  await actor(db,null,'service_role')
  await t.test('nonstaff and direct authenticated clients cannot call commands or update financial data',async()=>{
   await assert.rejects(rpc('stage_import',{},student),e=>e.code==='42501')
   await actor(db,student)
   await assert.rejects(query('SELECT certificate_eligibility($1)',[id(9)]),e=>e.code==='42501')
   await assert.rejects(query("UPDATE invoices SET payment_status='paid'"),e=>e.code==='42501')
   await actor(db,null,'service_role')
  })
  await t.test('customer import links a new person without overwriting later profile edits',async()=>{
   await imported('customers',[{customer_number:'K-1',display_name:'Import Name',email:'certificate@example.test',street:'Import street'}])
   person=(await query("SELECT person_id FROM external_customers WHERE customer_number='K-1'"))[0].person_id
   await query("UPDATE people SET display_name='Profile Name',street='Profile street' WHERE id=$1",[person])
   await imported('customers',[{customer_number:'K-1',display_name:'Changed Export Name',email:'certificate@example.test',street:'Changed export street'}])
   assert.deepEqual((await query('SELECT display_name,street FROM people WHERE id=$1',[person]))[0],{display_name:'Profile Name',street:'Profile street'})
   await imported('customers',[{customer_number:'K-2',display_name:'Ambiguous sibling',email:'certificate@example.test'},{customer_number:'K-3',display_name:'No email',email:null}])
   assert.deepEqual((await query("SELECT customer_number,person_id,review_status FROM external_customers WHERE customer_number IN ('K-2','K-3') ORDER BY customer_number")).map(r=>[r.customer_number,r.person_id,r.review_status]),[['K-2',null,'pending'],['K-3',null,'pending']])
  })
  await t.test('one SKU mapping does not grant unbooked courses and manual allocations enforce course/month',async()=>{
   await imported('products',[{article_number:'DE-A1',name:'Deutsch A1',description:'Sprachkurs',unit:'Monat',unit_price:'58.00'}])
   product=(await query("SELECT id FROM external_products WHERE article_number='DE-A1'"))[0].id
   await rpc('map_product',{id:product,course_ids:[courseId]})
   await imported('invoices',[invoice('R-1')])
   invoiceId=(await query("SELECT id FROM invoices WHERE invoice_number='R-1'"))[0].id
   assert.equal((await query('SELECT count(*)::int n FROM invoice_allocations'))[0].n,0)
   await assert.rejects(rpc('allocate',{invoice_id:invoiceId,course_id:otherCourse,start:'2026-01-15',end:'2026-01-31'}),e=>e.code==='23514')
   await assert.rejects(rpc('allocate',{invoice_id:invoiceId,course_id:courseId,start:'2026-02-01',end:'2026-02-28'}),e=>e.code==='23514')
   allocationId=(await rpc('allocate',{invoice_id:invoiceId,course_id:courseId,start:'2026-01-15',end:'2026-01-31'})).id
   await rpc('confirm_participation',{periods:[{person_id:person,course_id:courseId,start:'2026-01-15',end:'2026-01-31',title:'Deutsch A1'}]})
   periodId=(await query('SELECT id FROM participation_periods WHERE person_id=$1',[person]))[0].id
   assert.equal((await query('SELECT certificate_eligibility($1) result',[person]))[0].result[0].reason,'invoice_unpaid')
  })
  await t.test('late payment with skonto unlocks original attendance dates and known month survives missing subject',async()=>{
   await imported('invoices',[invoice('R-1','paid',{service_month:null,review_reason:'missing_month',subject:'Deutsch'})])
   const eligibility=(await query('SELECT certificate_eligibility($1) result',[person]))[0].result[0]
   assert.equal(eligibility.eligible,true);assert.equal(eligibility.start_date,'2026-01-15')
   assert.equal(eligibility.allocations.length,1)
   assert.equal((await query('SELECT service_month::text FROM invoices WHERE id=$1',[invoiceId]))[0].service_month,'2026-01-01')
  })
  await t.test('preview baseline and export chronology prevent silent stale overwrites',async()=>{
   const stale=await stage('invoices',[invoice('R-1','unpaid')])
   await rpc('allocate',{id:allocationId,invoice_id:invoiceId,course_id:courseId,start:'2026-01-15',end:'2026-01-31'})
   // A source change, rather than unrelated read activity, invalidates preview.
   await rpc('resolve_invoice',{id:invoiceId,service_month:'2026-01-01',validity:'review'})
   await assert.rejects(rpc('apply_import',{batch_id:stale.batch_id}),e=>e.code==='40001')
   await rpc('resolve_invoice',{id:invoiceId,service_month:'2026-01-01',validity:'valid'})
   const old=await stage('invoices',[invoice('R-1','unpaid')],{exported_at:'2020-01-01T00:00:00Z'})
   await assert.rejects(rpc('apply_import',{batch_id:old.batch_id}),e=>e.code==='40001')
  })
  await t.test('certificate source changes revoke issued PDFs and retention prevents content mutation',async()=>{
   const p=(await query('SELECT * FROM participation_periods WHERE id=$1',[periodId]))[0]
   const a=(await query('SELECT * FROM invoice_allocations WHERE id=$1',[allocationId]))[0]
   const i=(await query('SELECT * FROM invoices WHERE id=$1',[invoiceId]))[0]
   const issue=(await query("INSERT INTO certificate_issues(person_id,certificate_number,status,snapshot,storage_path,pdf_sha256,issued_at) VALUES($1,'TB-TEST','issued','{}','private/test.pdf',$2,now()) RETURNING id",[person,'a'.repeat(64)]))[0].id
   await query("INSERT INTO certificate_sources(issue_id,participation_period_id,invoice_allocation_id,source_revision,participation_revision,invoice_revision,allocation_revision,snapshot) VALUES($1,$2,$3,1,$4,$5,$6,'{}')",[issue,periodId,allocationId,p.revision,i.source_revision,a.source_revision])
   await assert.rejects(query("UPDATE certificate_issues SET snapshot='{\"changed\":true}' WHERE id=$1",[issue]),e=>e.code==='23514')
   await imported('invoices',[invoice('R-1','unpaid')])
   assert.equal((await query('SELECT status FROM certificate_issues WHERE id=$1',[issue]))[0].status,'revoked')
   await assert.rejects(query('DELETE FROM people WHERE id=$1',[person]),e=>e.code==='23503')
  })
  await t.test('future confirmation, overlapping dates and stale revisions are rejected',async()=>{
   await assert.rejects(rpc('confirm_participation',{periods:[{person_id:person,course_id:courseId,start:'2999-01-01',end:'2999-01-31',title:'Future'}]}),e=>e.code==='23514')
   await assert.rejects(rpc('confirm_participation',{periods:[{person_id:person,course_id:courseId,start:'2026-01-20',end:'2026-01-31',title:'Overlap'}]}),e=>e.code==='23514')
   await assert.rejects(rpc('revoke_participation',{id:periodId,revision:999,reason:'Correction'}),e=>e.code==='40001')
   const revision=(await query('SELECT revision FROM participation_periods WHERE id=$1',[periodId]))[0].revision
   await rpc('revoke_participation',{id:periodId,revision,reason:'Correction'})
   assert.equal((await query('SELECT certificate_eligibility($1) result',[person]))[0].result[0].reason,'participation_unconfirmed')
  })
  await t.test('partial absence preserves invoice, full archived snapshot marks it for review',async()=>{
   await imported('invoices',[invoice('R-2','paid')])
   assert.notEqual((await query("SELECT validity FROM invoices WHERE invoice_number='R-1'"))[0].validity,'review')
   await imported('invoices',[invoice('R-2','paid')],{is_complete_snapshot:true,export_year:2025,scope:{includes_archived:true}})
   assert.deepEqual((await query("SELECT validity,review_reason FROM invoices WHERE invoice_number='R-1'"))[0],{validity:'review',review_reason:'missing_from_snapshot'})
   assert.equal((await query("SELECT validity FROM invoices WHERE invoice_number='R-2'"))[0].validity,'valid')
  })
  await t.test('automatic mapping uses actual booking and keeps attendance pending; replacement remains blocked until paid',async()=>{
   const existingAllocations=await query('SELECT id,invoice_id,person_id,course_id,start_date,end_date,status FROM invoice_allocations ORDER BY id')
   const existingPeriods=await query('SELECT id,person_id,course_id,start_date,end_date,status FROM participation_periods ORDER BY id')
   await rpc('map_product',{id:product,course_ids:[courseId,otherCourse]})
   assert.deepEqual(await query('SELECT course_id FROM external_product_courses WHERE product_id=$1 ORDER BY course_id',[product]),[{course_id:courseId},{course_id:otherCourse}])
   assert.deepEqual(await query('SELECT id,invoice_id,person_id,course_id,start_date,end_date,status FROM invoice_allocations ORDER BY id'),existingAllocations)
   assert.deepEqual(await query('SELECT id,person_id,course_id,start_date,end_date,status FROM participation_periods ORDER BY id'),existingPeriods)
   await assert.rejects(rpc('map_product',{id:product,course_ids:[otherCourse]}),e=>e.code==='23514')
   assert.equal((await query('SELECT count(*)::int n FROM external_product_courses WHERE product_id=$1',[product]))[0].n,2)
   await db.exec('RESET ROLE')
   const booking=(await query(`INSERT INTO bookings(person_id,target_month,start_date,status,kind,contact_name,contact_email,privacy_accepted,agb_accepted)
    VALUES($1,'2026-02-01','2026-02-15','confirmed','monthly','Snapshot name','snapshot@example.test',true,true) RETURNING id`,[person]))[0].id
   await query('INSERT INTO booking_items(booking_id,course_id,title_snapshot,unit_price,unit_minutes,units,amount) VALUES($1,$2,$3,25,45,2,50)',[booking,courseId,'Deutsch A1'])
   await actor(db,null,'service_role')
   const feb=(number,status='paid')=>invoice(number,status,{invoice_date:'2026-01-28',service_month:'2026-02-01',subject:'Februar 2026'})
   await imported('invoices',[feb('R-Feb')])
   const original=(await query("SELECT id FROM invoices WHERE invoice_number='R-Feb'"))[0].id
   assert.deepEqual((await query('SELECT course_id,start_date::text,end_date::text FROM invoice_allocations WHERE invoice_id=$1',[original])),[{course_id:courseId,start_date:'2026-02-15',end_date:'2026-02-28'}])
   const p=(await query("SELECT * FROM participation_periods WHERE person_id=$1 AND start_date='2026-02-15'",[person]))[0]
   assert.equal(p.status,'pending')
   await rpc('confirm_participation',{periods:[{id:p.id,revision:p.revision,person_id:person,course_id:courseId,start:'2026-02-15',end:'2026-02-28',title:'Deutsch A1'}]})
   await imported('invoices',[feb('R-Feb-2','unpaid')])
   const replacement=(await query("SELECT id FROM invoices WHERE invoice_number='R-Feb-2'"))[0].id
   await rpc('relate_invoice',{original,related:replacement,type:'replaces'})
   const eligibility=async()=> (await query('SELECT certificate_eligibility($1) result',[person]))[0].result.find(r=>r.id===p.id)
   assert.equal((await eligibility()).reason,'invoice_unpaid')
   await imported('invoices',[feb('R-Feb-2','paid')])
   assert.equal((await eligibility()).eligible,true)
   assert.equal((await eligibility()).allocations.every(a=>a.invoice_id===replacement),true)
   const cancellation={...feb('R-Feb-Cancel'),document_type:'cancellation',source_status:'Stornorechnung',gross_amount:'-58.00',paid_amount:'0.00',discount_amount:'0.00'}
   await imported('invoices',[cancellation])
   assert.equal((await eligibility()).reason,'cancellation_unresolved')
   const cancelled=(await query("SELECT id FROM invoices WHERE invoice_number='R-Feb-Cancel'"))[0].id
   await rpc('relate_invoice',{original:replacement,related:cancelled,type:'cancels'})
   assert.equal((await eligibility()).eligible,false)
  })
  await t.test('a malformed row blocks the complete apply transaction',async()=>{
   const batch=await stage('customers',[{customer_number:'K-Bad',display_name:'Should not appear',email:'not-imported@example.test'}],{rows:[{row_number:2,external_key:'K-Bad',normalized_data:{customer_number:'K-Bad',display_name:'Should not appear',email:'not-imported@example.test'},disposition:'new'},{row_number:3,external_key:'K-Invalid',normalized_data:{},disposition:'error',issues:[{code:'bad_row'}]}]})
   await assert.rejects(rpc('apply_import',{batch_id:batch.batch_id}),e=>e.code==='23514')
   assert.equal((await query("SELECT id FROM external_customers WHERE customer_number='K-Bad'")).length,0)
   const wrongYear=await stage('invoices',[invoice('Wrong-Year','paid')],{is_complete_snapshot:true,export_year:2026,scope:{includes_archived:true}})
   await assert.rejects(rpc('apply_import',{batch_id:wrongYear.batch_id}),e=>e.code==='23514')
   assert.equal((await query("SELECT id FROM invoices WHERE invoice_number='Wrong-Year'")).length,0)
  })
  await t.test('cancellation relationships cannot mask a different month or survive changed document identity',async()=>{
   const original=(await query("SELECT * FROM invoices WHERE invoice_number='R-Feb-2'"))[0]
   const cancellation=(await query("SELECT * FROM invoices WHERE invoice_number='R-Feb-Cancel'"))[0]
   const january=(await query("SELECT id FROM invoices WHERE invoice_number='R-2'"))[0].id
   await assert.rejects(rpc('relate_invoice',{original:january,related:cancellation.id,type:'cancels'}),e=>e.code==='23514')
   const relationValid=async()=> (await query('SELECT certificates_private.valid_invoice_relation($1) value',[cancellation.id]))[0].value
   assert.equal(await relationValid(),true)
   for (const [column,changed,restored] of [
    ['gross_amount','-60.00',cancellation.gross_amount],
    ['document_type','unknown',cancellation.document_type],
    ['article_numbers',['CHANGED'],cancellation.article_numbers],
    ['service_month','2026-03-01','2026-02-01'],
    ['external_customer_id',null,cancellation.external_customer_id],
   ]) {
    await query(`UPDATE invoices SET ${column}=$1 WHERE id=$2`,[changed,cancellation.id])
    assert.equal(await relationValid(),false,column)
    assert.equal((await query('SELECT validity FROM invoices WHERE id=$1',[original.id]))[0].validity,'review')
    await query(`UPDATE invoices SET ${column}=$1 WHERE id=$2`,[restored,cancellation.id])
    await rpc('relate_invoice',{original:original.id,related:cancellation.id,type:'cancels'})
    assert.equal(await relationValid(),true)
   }
   // A CSV correction can move a cancellation to an already paid different
   // customer. Its previous relation must not suppress that customer's review.
   await imported('customers',[{customer_number:'K-New',display_name:'New customer',email:'new-certificate@example.test'}])
   const target=(await query("SELECT * FROM external_customers WHERE customer_number='K-New'"))[0]
   await imported('invoices',[invoice('R-New','paid',{customer_number:'K-New',service_month:'2026-02-01'})])
   const targetInvoice=(await query("SELECT id FROM invoices WHERE invoice_number='R-New'"))[0].id
   await rpc('allocate',{invoice_id:targetInvoice,course_id:courseId,start:'2026-02-15',end:'2026-02-28'})
   await rpc('confirm_participation',{periods:[{person_id:target.person_id,course_id:courseId,start:'2026-02-15',end:'2026-02-28',title:'Deutsch A1'}]})
   assert.equal((await query('SELECT certificate_eligibility($1) result',[target.person_id]))[0].result[0].eligible,true)
   await query('UPDATE invoices SET external_customer_id=$1,customer_number=$2 WHERE id=$3',[target.id,'K-New',cancellation.id])
   assert.equal(await relationValid(),false)
   assert.equal((await query('SELECT certificate_eligibility($1) result',[target.person_id]))[0].result[0].reason,'cancellation_unresolved')
  })
  await t.test('private certificate objects are denied even if another storage policy allows all reads',async()=>{
   await db.exec('RESET ROLE')
   await query("INSERT INTO storage.objects(bucket_id,name) VALUES('certificates','private/test.pdf')")
   await db.exec('CREATE POLICY permissive_test_read ON storage.objects FOR SELECT TO authenticated USING(true)')
   await actor(db,student)
   assert.equal((await query("SELECT * FROM storage.objects WHERE bucket_id='certificates'")).length,0)
   assert.equal((await query('SELECT * FROM participation_periods WHERE person_id=$1',[person])).length,0)
   await actor(db,null,'service_role')
  })
 } finally {await db.close()}
})
