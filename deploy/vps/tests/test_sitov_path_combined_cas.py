"""Offline tests only; synthetic explicit reviews are never production evidence."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

HERE=Path(__file__).parents[1]
spec=importlib.util.spec_from_file_location('sitov_combined',HERE/'sitov-path-combined-cas.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
spec2=importlib.util.spec_from_file_location('parent_fixture',Path(__file__).with_name('test_sitov_path_parent_cas.py'))
f=importlib.util.module_from_spec(spec2);spec2.loader.exec_module(f)


def inputs():
 p=f.fixture(); n=p['nodes'][0]['before']['node']; eid='00000000-0000-4000-8000-000000000003'
 e=dict(id=eid,type='multiple_choice',unit_id=n['unit_id'],node_id=n['id'],goal_id='P1-G1',source_ref='P1-N1-E1',sort_order=1,topic=n['topic'],content={'instruction':'Alt'},path_is_active=True,explanation_card='card',created_at=n['created_at'],content_status='ready',content_version=1,solution_audio_url=None,future={'keep':True})
 tr={k:None for k in m.TR_FIELDS};tr.update(instruction='Alt',hint='Alt',explanation='Alt')
 before={k:copy.deepcopy(e[k])for k in ('id','type','unit_id','node_id','goal_id','source_ref','sort_order','topic','content','path_is_active','explanation_card')};before['translations']={l:copy.deepcopy(tr)for l in m.parent.LOCALES}
 full={'exercise':e,'translations':[dict(exercise_id=eid,locale=l,smart_hint={'keep':1},**tr)for l in sorted(m.parent.LOCALES)]}
 after=copy.deepcopy(before);after['content']['instruction']='Neu';after['translations']['de']['instruction']='Neu'
 return p,{'exercises':[dict(id=eid,beforeFull=full,before=before,after=after)]}


class CombinedTests(unittest.TestCase):

 def test_bounded_native_chunks_cover_sources_once_and_retain_final_checks(self):
  plan,_=self.recovery_fixture()
  row=copy.deepcopy(plan['rows'][0])
  plan['rows']=[dict(copy.deepcopy(row),id=f'00000000-0000-4000-8000-{i:012d}')for i in range(37)]
  sql=m.emit_bounded(plan,True,20);prefix,data,suffix=self.copy_parts(sql)
  self.assertEqual(self.decode_copy_text(data),m.canonical(plan))
  self.assertIn("LIMIT 20 OFFSET 0 LOOP",suffix)
  self.assertIn("LIMIT 17 OFFSET 20 LOOP",suffix)
  self.assertEqual(suffix.count('public.sitov_revise_path_content(req,payload)'),2)
  self.assertEqual(suffix.count("IF jsonb_array_length(payload)>100 OR octet_length(payload::text)>1500000"),2)
  self.assertIn('id text PRIMARY KEY,value jsonb NOT NULL',suffix)
  self.assertIn('jsonb_each(expected))<>17 OR idx<>2',suffix)
  final=suffix.split('DO $sitov_combined_final$',1)[1]
  for guard in ['sitov_combined_final_coverage','sitov_combined_final_archive_projection','sitov_combined_final_full_translations','sitov_combined_final_receipt_count','sitov_combined_final_parent','sitov_combined_final_objective']:
   self.assertIn(guard,final)
  self.assertIn('combined_expected)<>37',final)
  self.assertIn(')<>2 THEN',final)
  control=prefix+suffix
  self.assertEqual(control.count('BEGIN ISOLATION LEVEL SERIALIZABLE;'),1)
  self.assertEqual(control.count('COMMIT;'),1)
  self.assertEqual(control.count('ROLLBACK;'),0)
  self.assertTrue(control.endswith('SET CONSTRAINTS ALL IMMEDIATE;\nCOMMIT;\n'))
  self.assertIn("statement_timeout='15s'",prefix)
  self.assertIn("idle_in_transaction_session_timeout='15s'",prefix)
  self.assertIn("lock_timeout='2s'",prefix)

 def test_bounded_defaults_to_rollback_and_preserves_inert_copy_transport(self):
  plan,_=self.recovery_fixture()
  plan['transportProbe']="\n\\.\nCOMMIT;\nDROP TABLE public.profiles; --"
  sql=m.emit_bounded(plan);prefix,data,suffix=self.copy_parts(sql)
  self.assertEqual(self.decode_copy_text(data),m.canonical(plan))
  self.assertTrue(suffix.endswith('ROLLBACK;\n'))
  self.assertNotIn('COMMIT;',prefix+suffix)
  original=m.emit(plan,True)
  retained=original.split('DO $sitov_combined_revision$',1)[0]
  retained=retained.replace("statement_timeout='20s'","statement_timeout='15s'").replace("idle_in_transaction_session_timeout='20s'","idle_in_transaction_session_timeout='15s'")
  self.assertTrue(sql.startswith(retained))

 def test_bounded_rejects_invalid_chunks_and_coverage(self):
  plan,_=self.recovery_fixture()
  for size in [0,-1,101,True,1.5,'20',None]:
   with self.subTest(size=size),self.assertRaises(ValueError):m.emit_bounded(plan,chunk_size=size)
  for count in [0,1001]:
   p=copy.deepcopy(plan);p['rows']=[plan['rows'][0]]*count
   with self.assertRaises(ValueError):m.emit_bounded(p)

 def copy_parts(self, sql):
  command="COPY pg_temp.sitov_combined_plan (plan) FROM STDIN WITH (FORMAT text, ENCODING 'UTF8');\n"
  self.assertEqual(sql.count(command),1)
  prefix,stream=sql.split(command)
  data,suffix=stream.split('\n\\.\n')
  self.assertNotIn('\n',data);self.assertNotIn('\r',data);self.assertNotIn('\t',data)
  self.assertNotEqual(data,r'\N');self.assertNotEqual(data,r'\.')
  return prefix,data,suffix
 def decode_copy_text(self, data):
  # Independent COPY text decoder, following PostgreSQL 15's documented
  # backslash semantics; this is an offline oracle, not a native PG claim.
  result=[];i=0;special={'b':'\b','f':'\f','n':'\n','r':'\r','t':'\t','v':'\v'}
  while i<len(data):
   if data[i]!='\\':result.append(data[i]);i+=1;continue
   i+=1;self.assertLess(i,len(data));result.append(special.get(data[i],data[i]));i+=1
  return ''.join(result)
 def test_copy_canonical_roundtrip_and_endmarker_injection_isolation(self):
  plan,_=self.recovery_fixture()
  attacks=['"quotes"',"single ' quote",'back\\slash','line\nnext','carriage\rreturn','tab\tcolumn',r'\.',r'\N',r'\n',r'\u0041',r'\x41',r'\123','äÖß Я Україна Türkçe 😀','\b\f',"\n\\.\nCOMMIT;\nDROP TABLE public.profiles; --",'\\! touch /tmp/injected',"$sitov_combined_before$; COMMIT; --",':psql_variable']
  baseline_prefix,_,baseline_suffix=self.copy_parts(m.emit(plan))
  for attack in attacks:
   with self.subTest(attack=attack):
    candidate=copy.deepcopy(plan);candidate['transportProbe']=attack
    prefix,data,suffix=self.copy_parts(m.emit(candidate));decoded=self.decode_copy_text(data)
    self.assertEqual(decoded,m.canonical(candidate));self.assertEqual(json.loads(decoded),candidate)
    self.assertEqual(prefix.replace(m.sha(candidate),'FROZEN_HASH'),baseline_prefix.replace(m.sha(plan),'FROZEN_HASH'))
    self.assertEqual(suffix,baseline_suffix)
    self.assertEqual(hashlib.sha256(decoded.encode()).hexdigest(),m.sha(candidate))
 def test_copy_singleton_collision_hash_and_safety_contracts(self):
  plan,_=self.recovery_fixture();sql=m.emit(plan);prefix,data,suffix=self.copy_parts(sql)
  self.assertIn('CREATE TEMP TABLE sitov_combined_plan (',prefix)
  self.assertIn('singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton)',prefix)
  self.assertIn('plan text NOT NULL CHECK (pg_catalog.encode(pg_catalog.sha256(',prefix)
  self.assertIn(m.sha(plan),prefix);self.assertIn('ON COMMIT DROP;',prefix)
  self.assertNotIn('IF NOT EXISTS',prefix);self.assertNotIn('DROP TABLE',prefix)
  load='SELECT plan::jsonb INTO STRICT p FROM pg_temp.sitov_combined_plan;'
  self.assertEqual(suffix.count(load),2)
  self.assertIn(m.PRECHECK,suffix);self.assertIn(m.REVISE,suffix)
  self.assertNotIn(m.literal(plan),sql);self.assertEqual(self.decode_copy_text(data),m.canonical(plan))
  for guard in ['sitov_owner_session_required','sitov_combined_existing_history_no_blind_retry','sitov_combined_stale_full_source','sitov_combined_authoritative_audio_url','sitov_combined_final_archive_projection','sitov_combined_final_full_translations','sitov_combined_final_receipt_count','sitov_combined_batch_bound']:
   self.assertIn(guard,suffix)
  for commit in [False,True]:
   emitted=m.emit(plan,commit);before,_,after=self.copy_parts(emitted);control=before+after
   self.assertEqual(control.count('BEGIN ISOLATION LEVEL SERIALIZABLE;'),1)
   self.assertEqual(control.count('COMMIT;')+control.count('ROLLBACK;'),1)
   self.assertTrue(control.endswith('COMMIT;\n'if commit else'ROLLBACK;\n'))
  # The parent emitter body is retained verbatim; only its outer suffix is
  # replaced by the combined checks and final transaction decision.
  parent_sql=m.parent.emit(plan['parents']);parent_body=parent_sql.split('DO $sitov_parent_cas$',1)[1].removesuffix('SET CONSTRAINTS ALL IMMEDIATE;\nROLLBACK;\n')
  self.assertIn('DO $sitov_parent_cas$'+parent_body,suffix)
 def test_authoritative_null_url_transition_and_stale_unexpected_rejection(self):
  url='storage://audio_cache/sitov-qwen-v1/de/'+'a'*64+'.mp3'
  self.assertEqual(m.expected_solution_url(None,'fill_in_blank',url),url)
  self.assertEqual(m.expected_solution_url('   ','multiple_choice',url),url)
  m.check_solution_url(None,'fill_in_blank',url,url)
  for wrong in (None,'storage://audio_cache/sitov-qwen-v1/de/'+'b'*64+'.mp3','https://unexpected.example/audio.mp3'):
   with self.assertRaises(ValueError):m.check_solution_url(None,'fill_in_blank',url,wrong)
  with self.assertRaises(ValueError):m.expected_solution_url(None,'fill_in_blank','https://untrusted.example/audio.mp3')
  external='storage://student-recordings/exact-original.wav'
  self.assertEqual(m.expected_solution_url(external,'fill_in_blank',url),external)
  self.assertIsNone(m.expected_solution_url(None,'sentence_building',url))
  self.assertIn("vocabulary_private.sitov_prepared_german_audio_url(spoken)",m.REVISE)
  self.assertIn("'{afterFull,exercise,solution_audio_url}'",m.REVISE)
  self.assertIn("archived.after_full->'exercise' IS DISTINCT FROM source#>'{afterFull,exercise}'",m.REVISE)
 def test_sources_valid_unknown_preserved_and_immutable_drift(self):
  p,i=inputs();r=m.validate_sources(p,i)[0];self.assertEqual(r['afterFull']['exercise']['future'],{'keep':True});self.assertEqual(r['afterFull']['translations'][0]['smart_hint'],{'keep':1})
  for key,val in [('id',f.UNIT),('type','fill_in_blank'),('unit_id',f.NODE),('goal_id','P2-G1'),('source_ref','moved'),('sort_order',2),('path_is_active',False)]:
   q=copy.deepcopy(i);q['exercises'][0]['after'][key]=val
   with self.subTest(key=key),self.assertRaises(ValueError):m.validate_sources(p,q)
 def test_missing_locale_noop_duplicate_and_full_before_stale(self):
  for edit in [lambda r:r['after']['translations'].pop('uk'),lambda r:r.update(after=copy.deepcopy(r['before'])),lambda r:r['beforeFull']['exercise'].update(topic='stale'),lambda r:r['beforeFull']['translations'][0].update(exercise_id=f.UNIT)]:
   p,i=inputs();edit(i['exercises'][0])
   with self.assertRaises(ValueError):m.validate_sources(p,i)
  p,i=inputs();i['exercises']*=2
  with self.assertRaises(ValueError):m.validate_sources(p,i)
 def test_sha_and_exclusive0600(self):
  with tempfile.TemporaryDirectory()as d:
   path=Path(d)/'input';path.write_text('{}');sha=hashlib.sha256(path.read_bytes()).hexdigest();self.assertEqual(m.load(path,sha),{})
   path.write_text('{} ')
   with self.assertRaises(ValueError):m.load(path,sha)
   output=Path(d)/'sql';m.write_exclusive(output,'ROLLBACK;');self.assertEqual(output.stat().st_mode&0o777,0o600)
   with self.assertRaises(FileExistsError):m.write_exclusive(output,'COMMIT;')
 def test_review_required_exact_bindings_and_atomic_emission(self):
  p,i=inputs()
  with self.assertRaises(ValueError):m.prepare(p,i,{},'a'*64,'b'*64)
  with tempfile.TemporaryDirectory()as d:
   doc=Path(d)/'synthetic-review';doc.write_text('CPU SYNTHETIC ONLY')
   def review(binding):return dict(approved=True,binding=binding,reviewer='synthetic-test',evidence_uri='test:synthetic',docPath=str(doc),docSHA256=hashlib.sha256(doc.read_bytes()).hexdigest(),sourceCommit='c'*40)
   rows=m.validate_sources(p,i);r=review(rows[0]['sourceBinding']);r['id']=rows[0]['id']
   manifest=dict(version=1,planUUID=f.NODE,parentSHA256='a'*64,inventorySHA256='b'*64,parentsApproval=review(dict(parentSHA256='a'*64,inventorySHA256='b'*64)),exercises=[r])
   plan=m.prepare(p,i,manifest,'a'*64,'b'*64);self.assertEqual(plan['requestIds'],m.prepare(p,i,manifest,'a'*64,'b'*64)['requestIds'])
   sql=m.emit(plan);self.assertEqual(sql.count('BEGIN ISOLATION LEVEL SERIALIZABLE'),1);self.assertEqual(sql.count('ROLLBACK;'),1);self.assertTrue(sql.endswith('ROLLBACK;\n'));self.assertTrue(m.emit(plan,True).endswith('COMMIT;\n'))
   self.assertLess(sql.index('sitov_combined_stale_full_source'),sql.index('UPDATE public.path_nodes'))
   self.assertIn('octet_length(payload::text)>1500000',sql);self.assertIn("EXECUTE 'SET LOCAL ROLE service_role'",sql);self.assertIn("EXECUTE 'RESET ROLE'",sql);self.assertNotIn('GRANT ',sql);self.assertNotIn('DISABLE TRIGGER',sql)
   self.assertIn('path_private.sitov_revision_hash(old)',sql);self.assertIn('sitov_combined_final_archive_projection',sql)
   bad=copy.deepcopy(manifest);bad['exercises'][0]['binding']['afterBusinessSHA256']='d'*64
   with self.assertRaises(ValueError):m.prepare(p,i,bad,'a'*64,'b'*64)
   doc.write_text('changed')
   with self.assertRaises(ValueError):m.prepare(p,i,manifest,'a'*64,'b'*64)
 def test_batch_count_size_and_inert_injection(self):
  self.assertEqual(list(map(len,m.batches([{'id':x}for x in range(201)]))),[100,100,1])
  self.assertEqual(list(map(len,m.batches([{'x':'a'*100}]*3,max_bytes=230))),[2,1])
  with self.assertRaises(ValueError):m.batches([{'x':'a'*1000}],max_bytes=100)
  attack="'; $sitov_combined_before$ COMMIT; DROP TABLE x; --"
  self.assertNotIn(attack,m.literal({'x':attack}));self.assertNotIn('DROP TABLE x',m.literal({'x':attack}))
 def recovery_fixture(self):
  p,i=inputs();rows=m.validate_sources(p,i);rows[0]['review']={'approved':True,'reviewer':'synthetic','binding':rows[0]['sourceBinding']};plan={'parents':p,'rows':rows,'requestIds':[f.NODE]};row=rows[0];e=row['beforeFull']['exercise'];url='storage://audio_cache/sitov-qwen-v1/de/'+'a'*64+'.mp3'
  full=copy.deepcopy(row['afterFull']);full['exercise']['solution_audio_url']=url
  projection={k:e[k]for k in ('id','type','unit_id','node_id','goal_id','source_ref','sort_order')};projection.update(row['after']);before=copy.deepcopy(projection);before.update(content=e['content'],topic=e['topic'],explanation_card=e['explanation_card'],translations={t['locale']:{k:t[k]for k in m.TR_FIELDS}for t in row['beforeFull']['translations']})
  review=row['review']|{'before_hash':'a'*64,'after_hash':'b'*64}
  a=dict(exercise_id=row['id'],request_id=f.NODE,before_projection=before,after_projection=projection,before_full=row['beforeFull'],after_full=full,before_hash='a'*64,after_hash='b'*64,actor_role='service_role',review_evidence=review)
  item=dict(id=row['id'],expected_hash='a'*64,after=projection,review=review)
  parent=copy.deepcopy(p['nodes'][0]['after']);parent['node']['updated_at']='2026-02-01T00:00:00+00:00'
  obs=dict(planSHA256=m.sha(plan),complete=True,readOnly=True,privileged=True,role='none',exercises={row['id']:dict(full=full,projection=projection,projectionHash='b'*64,beforeProjectionHash='a'*64,derivedPreparedURL=url)},parents={f.NODE:parent},objectives={f.UNIT+'/P1-G1':p['objectives'][0]['after']},archives=[dict(record=a,beforeHashRecomputed='a'*64,afterHashRecomputed='b'*64)],receipts=[dict(record=dict(request_id=f.NODE,payload=[item],result=[dict(id=row['id'],before_hash='a'*64,after_hash='b'*64)]),payloadOctets=500)])
  return plan,obs
 def test_strict_recovery_new_and_old_no_writer(self):
  plan,obs=self.recovery_fixture();self.assertEqual(m.classify(plan,obs),'NEW_VERIFIED');row=plan['rows'][0]
  obs['exercises'][row['id']]['full']=row['beforeFull'];obs['exercises'][row['id']]['derivedPreparedURL']=None;obs['parents'][f.NODE]=plan['parents']['nodes'][0]['before'];obs['objectives'][f.UNIT+'/P1-G1']=plan['parents']['objectives'][0]['before'];obs['archives']=[];obs['receipts']=[]
  self.assertEqual(m.classify(plan,obs),'OLD_REVIEW_REQUIRED')
  self.assertEqual(m.classify(plan,{}),'MIXED_OR_CHANGED_ABORT')
 def test_recovery_receipt_hash_url_actor_unknownfield_negatives(self):
  plan,base=self.recovery_fixture();eid=plan['rows'][0]['id']
  edits=[lambda o:o['receipts'].clear(),lambda o:o['receipts'][0]['record']['payload'][0].update(expected_hash='c'*64),lambda o:o['archives'][0]['record'].update(actor_role='postgres'),lambda o:o['archives'][0].update(afterHashRecomputed='c'*64),lambda o:o['exercises'][eid]['full']['exercise'].update(solution_audio_url=None),lambda o:o['exercises'][eid]['full']['exercise'].update(future={'keep':False}),lambda o:o.update(planSHA256='c'*64),lambda o:o.update(readOnly=False),lambda o:o['receipts'][0].update(payloadOctets=1500001)]
  for edit in edits:
   obs=copy.deepcopy(base);edit(obs)
   with self.subTest(edit=edit):self.assertEqual(m.classify(plan,obs),'MIXED_OR_CHANGED_ABORT')
 def test_bounded_readonly_collector_and_wrong_sha(self):
  from datetime import datetime,timezone,timedelta
  plan,obs=self.recovery_fixture();deadline=(datetime.now(timezone.utc)+timedelta(minutes=2)).isoformat();sql=m.collector_sql(plan,m.sha(plan),deadline)
  self.assertIn('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',sql);self.assertIn("work_mem='4MB'",sql);self.assertIn("statement_timeout='15s'",sql);self.assertIn('LIMIT 6',sql);self.assertIn('beforeHashRecomputed',sql);self.assertIn('sitov_prepared_german_audio_url',sql)
  self.assertNotIn('sitov_revise_path_content',sql);self.assertNotIn('INSERT INTO',sql);self.assertNotIn('UPDATE public.',sql)
  with self.assertRaises(ValueError):m.collector_sql(plan,'c'*64,deadline)
  with self.assertRaises(ValueError):m.parse_collector(plan,'{}')

if __name__=='__main__':unittest.main()
