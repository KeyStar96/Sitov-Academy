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
 def test_readonly_recovery_never_blind_retry(self):
  p,i=inputs();rows=m.validate_sources(p,i);plan={'parents':p,'rows':rows};row=rows[0]
  obs=dict(exercises={row['id']:row['beforeFull']},parents={f.NODE:p['nodes'][0]['before']},objectives={f.UNIT+'/P1-G1':p['objectives'][0]['before']},archives=[],receipts=[])
  self.assertEqual(m.classify(plan,obs),'OLD_REVIEW_REQUIRED');obs['exercises'][row['id']]=row['afterFull'];self.assertEqual(m.classify(plan,obs),'MIXED_OR_CHANGED_ABORT')
  obs['parents'][f.NODE]=p['nodes'][0]['after'];obs['objectives'][f.UNIT+'/P1-G1']=p['objectives'][0]['after'];self.assertEqual(m.classify(plan,obs),'NEW_NATIVE_ARCHIVE_VERIFICATION_REQUIRED')
  self.assertEqual(m.classify(plan,{}),'INCOMPLETE_READBACK_ABORT')

if __name__=='__main__':unittest.main()
