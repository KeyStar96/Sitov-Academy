import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createPhase3Database, actor, student, outsider, id } from './helpers/phase3-db.mjs'

const migrations=await Promise.all(['20260929165242_certificate_csv_schema.sql','20260929165727_certificate_csv_workflow.sql','20260929170539_certificate_eligibility_guards.sql','20260929172325_certificate_pdf_issuance.sql'].map(name=>readFile(new URL(`../migrations/${name}`,import.meta.url),'utf8')))

await test('PDF issuance: immutable source reservation, private storage, owner authorization and revalidation',async t=>{
 const db=await createPhase3Database()
 const query=async(sql,args=[]) => (await db.query(sql,args)).rows
 const rpc=async(command,payload={},user=student) => (await query('SELECT certificate_issue_command($1,$2,$3) value',[user,command,JSON.stringify(payload)]))[0].value
 const sha='b'.repeat(64)
 let person,invoice,allocation,participation,issued
 const upload=async(issue)=>query("INSERT INTO storage.objects(bucket_id,name,metadata,user_metadata) VALUES('certificates',$1,'{\"mimetype\":\"application/pdf\",\"size\":1234}',$2) ON CONFLICT DO NOTHING",[issue.storage_path,JSON.stringify({issue_id:issue.id,sha256:sha})])
 try {
  for(const migration of migrations) await db.exec(migration)
  await db.exec(migrations[3])
  await db.exec('ALTER TABLE auth.users ADD COLUMN is_anonymous boolean DEFAULT false')
  person=(await query('SELECT id FROM people WHERE auth_user_id=$1',[student]))[0].id
  await query("UPDATE people SET display_name='Тест Schüler',street='Musterstraße 1',postal_code='30159',city='Hannover' WHERE id=$1",[person])
  await query("INSERT INTO courses(id,slug,title,type,category,level,unit_price) VALUES($1,'pdf-course','Deutsch A1','online','private','A1.1',25)",[id(800)])
  const customer=(await query("INSERT INTO external_customers(customer_number,person_id,display_name,email,review_status) VALUES('PDF-C',$1,'Source name','source@example.test','resolved') RETURNING id",[person]))[0].id
  const product=(await query("INSERT INTO external_products(article_number,name,review_status) VALUES('PDF-P','Deutsch A1','resolved') RETURNING id"))[0].id
  await query("INSERT INTO external_product_courses(product_id,course_id,certificate_title) VALUES($1,$2,'Deutsch A1')",[product,id(800)])
  invoice=(await query("INSERT INTO invoices(invoice_number,external_customer_id,source_status,payment_status,validity,invoice_date,service_month,gross_amount,paid_amount,source_exported_at,article_numbers) VALUES('PDF-R',$1,'Bezahlt','paid','valid','2025-12-28','2026-01-01',50,50,now(),ARRAY['PDF-P']) RETURNING id",[customer]))[0].id
  allocation=(await query("INSERT INTO invoice_allocations(invoice_id,person_id,course_id,start_date,end_date,status) VALUES($1,$2,$3,'2026-01-15','2026-01-31','confirmed') RETURNING id",[invoice,person,id(800)]))[0].id
  participation=(await query("INSERT INTO participation_periods(person_id,course_id,start_date,end_date,status,confirmed_at,title_snapshot) VALUES($1,$2,'2026-01-15','2026-01-31','confirmed',now(),'Deutsch A1') RETURNING id",[person,id(800)]))[0].id
  await actor(db,null,'service_role')
  await t.test('direct clients, unverified and anonymous accounts cannot reserve or select another owner',async()=>{
   await actor(db,student)
   await assert.rejects(rpc('reserve'),e=>e.code==='42501')
   await actor(db,null,'service_role')
   await query('UPDATE auth.users SET email_confirmed_at=NULL WHERE id=$1',[student])
   await assert.rejects(rpc('reserve'),e=>e.code==='42501')
   await query('UPDATE auth.users SET email_confirmed_at=now(),is_anonymous=true WHERE id=$1',[student])
   await assert.rejects(rpc('reserve'),e=>e.code==='42501')
   await query('UPDATE auth.users SET is_anonymous=false WHERE id=$1',[student])
   const other=await rpc('reserve',{person_id:person},outsider)
   assert.equal(other.error,'conflict')
  })
  await t.test('reserve snapshots the verified profile and all provenance; duplicate generation is blocked',async()=>{
   const issue=await rpc('reserve',{month:'2026-01-01'})
   assert.equal(issue.status,'generating');assert.equal(issue.person_id,person)
   assert.equal(issue.snapshot.person.display_name,'Тест Schüler')
   assert.equal(issue.snapshot.periods[0].start_date,'2026-01-15')
   assert.equal(issue.storage_path,`${person}/${issue.id}.pdf`)
   assert.equal((await query('SELECT count(*)::int n FROM certificate_sources WHERE issue_id=$1',[issue.id]))[0].n,1)
   assert.equal((await rpc('reserve',{month:'2026-01-01'})).error,'conflict')
   assert.equal((await rpc('reserve')).error,'conflict','changing selection cannot bypass one-render-per-person')
   await assert.rejects(rpc('finalize',{id:issue.id,pdf_sha256:sha},outsider),e=>e.code==='42501')
   await upload(issue)
   issued=await rpc('finalize',{id:issue.id,pdf_sha256:sha})
   assert.equal(issued.status,'issued');assert.equal(issued.pdf_sha256,sha)
   assert.equal((await rpc('finalize',{id:issue.id,pdf_sha256:sha})).status,'issued')
   assert.equal((await rpc('finalize',{id:issue.id,pdf_sha256:'c'.repeat(64)})).error,'conflict')
   assert.equal((await rpc('download',{id:issue.id})).id,issue.id)
   assert.equal((await rpc('reserve',{month:'2026-01-01'})).id,issue.id)
  })
  await t.test('foreign downloads and historical snapshot mutation are denied',async()=>{
   await assert.rejects(rpc('download',{id:issued.id},outsider),e=>e.code==='42501')
   await assert.rejects(query("UPDATE certificate_issues SET snapshot='{}' WHERE id=$1",[issued.id]),e=>e.code==='23514')
   await query("UPDATE people SET display_name='Neuer Profilname' WHERE id=$1",[person])
   assert.equal((await rpc('download',{id:issued.id})).snapshot.person.display_name,'Тест Schüler')
  })
  await t.test('payment changes during rendering prevent issuance and revoke earlier issued documents',async()=>{
   const pending=await rpc('reserve',{month:'2026-01-01'})
   assert.equal(pending.status,'generating')
   await upload(pending)
   await query("UPDATE invoices SET payment_status='unpaid',paid_amount=0 WHERE id=$1",[invoice])
   assert.equal((await rpc('finalize',{id:pending.id,pdf_sha256:sha})).error,'conflict')
   assert.equal((await query('SELECT status FROM certificate_issues WHERE id=$1',[pending.id]))[0].status,'failed')
   assert.equal((await query('SELECT status FROM certificate_issues WHERE id=$1',[issued.id]))[0].status,'revoked')
   assert.equal((await rpc('download',{id:issued.id})).error,'conflict')
   assert.equal((await rpc('reserve')).error,'conflict')
   await query("UPDATE invoices SET payment_status='paid',paid_amount=50 WHERE id=$1",[invoice])
  })
  await t.test('missing storage and expired generation fail persistently without issuing a document',async()=>{
   const missing=await rpc('reserve')
   assert.equal((await rpc('finalize',{id:missing.id,pdf_sha256:sha})).error,'conflict')
   assert.equal((await query('SELECT failure_reason FROM certificate_issues WHERE id=$1',[missing.id]))[0].failure_reason,'storage_upload_missing')
   const expired=await rpc('reserve')
   await query("UPDATE certificate_issues SET created_at=now()-interval '11 minutes' WHERE id=$1",[expired.id])
   const retry=await rpc('reserve')
   assert.notEqual(retry.id,expired.id)
   assert.equal((await query('SELECT failure_reason FROM certificate_issues WHERE id=$1',[expired.id]))[0].failure_reason,'generation_expired')
   await rpc('fail',{id:retry.id})
   assert.equal((await query('SELECT status FROM certificate_issues WHERE id=$1',[retry.id]))[0].status,'failed')
  })
  await t.test('finalize rechecks revisions even if notification triggers were temporarily absent',async()=>{
   const pending=await rpc('reserve')
   await upload(pending)
   await db.exec('RESET ROLE; ALTER TABLE invoice_allocations DISABLE TRIGGER certificate_invalidate')
   await query("UPDATE invoice_allocations SET end_date='2026-01-30' WHERE id=$1",[allocation])
   await db.exec('ALTER TABLE invoice_allocations ENABLE TRIGGER certificate_invalidate')
   await actor(db,null,'service_role')
   assert.equal((await rpc('finalize',{id:pending.id,pdf_sha256:sha})).error,'conflict')
   assert.equal((await query('SELECT status,failure_reason FROM certificate_issues WHERE id=$1',[pending.id]))[0].failure_reason,'source_changed')
   assert.equal((await query('SELECT id FROM participation_periods WHERE id=$1',[participation])).length,1)
  })
  await t.test('global render cap expires stale work and storage provenance must match the issue digest',async()=>{
   await query("UPDATE invoice_allocations SET end_date='2026-01-31' WHERE id=$1",[allocation])
   const otherPerson=(await query('SELECT id FROM people WHERE auth_user_id=$1',[outsider]))[0].id
   await query("INSERT INTO certificate_issues(person_id,snapshot) SELECT $1,'{}'::jsonb FROM generate_series(1,3)",[otherPerson])
   assert.equal((await rpc('reserve')).error,'conflict')
   await query("UPDATE certificate_issues SET created_at=now()-interval '11 minutes' WHERE person_id=$1 AND status='generating'",[otherPerson])
   const issue=await rpc('reserve')
   assert.equal(issue.status,'generating')
   await query("INSERT INTO storage.objects(bucket_id,name,metadata,user_metadata) VALUES('certificates',$1,'{\"mimetype\":\"application/pdf\",\"size\":1234}','{\"issue_id\":\"wrong\",\"sha256\":\"wrong\"}')",[issue.storage_path])
   assert.equal((await rpc('finalize',{id:issue.id,pdf_sha256:sha})).error,'conflict')
   assert.equal((await query('SELECT failure_reason FROM certificate_issues WHERE id=$1',[issue.id]))[0].failure_reason,'storage_upload_missing')
  })
 } finally {await db.close()}
})
