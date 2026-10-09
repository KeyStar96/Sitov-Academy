"""CPU/file/mock contracts only. Actual PG15 races and Storage readback are pending."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('sitov_cas',Path(__file__).parents[1]/'sitov-audio-timings-cas.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)

class Contracts(unittest.TestCase):
 def payload(self):
  old={'id':'00000000-0000-4000-8000-000000000001','bucket_id':'audio_cache','name':'sitov-qwen-v1/de/'+'a'*64+'.mp3','version':'v1','metadata':{'size':3},'user_metadata':{'wordTimings':[{'start':0,'end':0}]},'updated_at':'old','owner':'owner'}
  return {'rows':[{'old':old,'newMetadata':{'wordTimings':[{'start':0,'end':1}]},'audioSha256':'unused','audioBytes':3}],'snapshot':{'inventoryTables':[{'schema':'storage','table':'objects'}],'consumerSnapshot':[],'readinessBefore':[],'readinessAfter':[]}}
 def test_timings_strict_tokens_finite_overlap_bounds_and_punctuation(self):
  c.timings('Hallo , Welt',[{'start':0,'end':.2},{'start':.2,'end':.2},{'start':.2,'end':.5}],.5)
  for times in [[{'start':0,'end':0}],[{'start':0,'end':float('nan')}],[{'start':-.1,'end':.2}],[{'start':0,'end':1.1}],[{'start':True,'end':1}]]:
   with self.assertRaises(ValueError):c.timings('Wort',times,1)
  with self.assertRaises(ValueError):c.timings('A B',[{'start':0,'end':.8},{'start':.2,'end':1}],1)
  with self.assertRaises(ValueError):c.timings('A B',[{'start':0,'end':1}],1)
 def test_full_object_and_mixed_state_recovery(self):
  p=self.payload();old=p['rows'][0]['old'];new={**old,'user_metadata':p['rows'][0]['newMetadata'],'updated_at':'new'}
  self.assertEqual(c.classify(p,[old]),'old');self.assertEqual(c.classify(p,[new]),'new')
  for got in [{**new,'owner':'changed'},{**new,'version':'v2'},{**new,'metadata':{'size':4}}]:
   with self.assertRaises(ValueError):c.classify(p,[got])
  p['rows'].append({**p['rows'][0],'old':{**old,'id':'second'}})
  with self.assertRaises(ValueError):c.classify(p,[new,{**old,'id':'second'}])
 def test_unknown_active_proof_and_readiness_hold(self):
  s={'readinessBefore':[{'id':'d','active':True,'audio':True,'publication':True}],'readinessAfter':[{'id':'d','active':True,'audio':True,'publication':True}],'allowedInactiveReadinessChanges':[],'consumerSnapshot':[{'table':'proofs','rows':[{'definition_id':'d'}]}]}
  with self.assertRaises(ValueError):c.validate_readiness(s)
  s['readinessBefore'][0]['active']=False;s['readinessAfter'][0]['active']=False;c.validate_readiness(s)
  s['readinessAfter'][0]['audio']=False
  with self.assertRaises(ValueError):c.validate_readiness(s)
  s['allowedInactiveReadinessChanges']=['d'];c.validate_readiness(s)
 def test_journal_chain_truncation_transition_and_no_invalid_append(self):
  with tempfile.TemporaryDirectory()as d:
   j=c.Journal(d);j.append('PREPARED',{'payloadSha256':'x'});before=j.path.read_bytes()
   with self.assertRaises(ValueError):j.append('VERIFIED',{})
   self.assertEqual(j.path.read_bytes(),before)
   j.path.write_bytes(before[:-1])
   with self.assertRaises(ValueError):j.read()
 def test_sql_bounded_sorted_full_cas_and_no_uploaded_audio(self):
  q=c.sql(self.payload(),True)
  for text in ['SERIALIZABLE','FOR UPDATE','FOR SHARE','LIMIT 501','full_object_CAS_changed','one_row_required','unexpected_row_delta','readiness_changed',"'{wordTimings}'","statement_timeout='20s'","lock_timeout='2s'"]:
   self.assertIn(text,q)
  self.assertNotIn('INSERT INTO storage.objects',q);self.assertNotIn('GRANT ',q)
 def test_unknown_commit_recovers_without_replay_and_authenticated_readback_required(self):
  with tempfile.TemporaryDirectory()as d:
   p=self.payload();c.write_new(Path(d)/'operation.json',p);j=c.Journal(d);j.append('PREPARED',{'payloadSha256':c.digest(p)})
   old=p['rows'][0]['old'];new={**old,'user_metadata':p['rows'][0]['newMetadata'],'updated_at':'new'}
   class DB:
    commits=0
    def inspect(self,p):return [new]
    def commit(self,q):self.commits+=1;raise AssertionError('must not replay')
   class Store:
    checks=0
    def verify(self,r,m):self.checks+=1
   db,store=DB(),Store();self.assertEqual(c.execute(d,db,store,True),'VERIFIED');self.assertEqual(db.commits,0);self.assertEqual(store.checks,1);self.assertEqual([r['phase']for r in j.read()],['PREPARED','COMMITTED_READBACK_PENDING','VERIFIED'])
 def test_failed_authenticated_readback_never_marks_verified(self):
  with tempfile.TemporaryDirectory()as d:
   p=self.payload();c.write_new(Path(d)/'operation.json',p);j=c.Journal(d);j.append('PREPARED',{'payloadSha256':c.digest(p)});new={**p['rows'][0]['old'],'user_metadata':p['rows'][0]['newMetadata']}
   class DB:
    def inspect(self,p):return [new]
   class Store:
    def verify(self,r,m):raise ValueError('bad API bytes')
   with self.assertRaises(ValueError):c.execute(d,DB(),Store())
   self.assertEqual(j.read()[-1]['phase'],'COMMITTED_READBACK_PENDING')
 def test_prepare_rejects_unverified_allowlist_before_archive(self):
  with tempfile.TemporaryDirectory()as d:
   p=Path(d)/'a.json';p.write_text('{}');out=Path(d)/'archive'
   with self.assertRaises(ValueError):c.prepare(p,'0'*64,{},out)
   self.assertFalse(out.exists())

 def prepare_inputs(self, folder):
  folder=Path(folder);audio=folder/'audio.mp3';audio.write_bytes(b'unit-source-audio');original=folder/'original.json';original.write_text('{}');arrays=folder/'raw.npz';arrays.write_bytes(b'unit-source-arrays')
  text='Hallo';times=[{'start':.1,'end':.2}]
  candidate={'accepted':True,'modelDecision':{'accepted':True,'thresholds':{'minProbability':.005,'minPeakRatio':.01},'classIndices':[1,2],'selectedProbabilities':[.9,.9],'selectedToPeakRatios':[1,1]},'wordTimings':times,'arraysSha256':c.file_sha(arrays),'provenance':{'modelRevision':c.REVISION,'sourceMP3Sha256':c.file_sha(audio)},'actualDecodedDuration':.4}
  candidate['receiptSha256']=c.digest(candidate);receipt=folder/'candidate.json';receipt.write_text(c.canonical(candidate))
  row={'bucket':'audio_cache','path':'sitov-qwen-v1/de/'+'a'*64+'.mp3','modelRevision':c.REVISION,'audioPath':str(audio),'audioSha256':c.file_sha(audio),'originalSourceMetadataPath':str(original),'originalSourceMetadataSha256':c.file_sha(original),'candidatePath':str(receipt),'candidateSha256':c.file_sha(receipt),'rawArraysPath':str(arrays),'rawArraysSha256':c.file_sha(arrays),'receiptSha256':candidate['receiptSha256'],'text':text,'textSha256':c.hashlib.sha256(text.encode()).hexdigest(),'method':'original_pinned_raw_classifier','wordTimings':times,'actualOriginalDecodedDuration':.4}
  allow=folder/'allow.json';allow.write_text(c.canonical({'profileFingerprint':c.PROFILE,'rows':[row]}))
  obj=self.payload()['rows'][0]['old'];obj['user_metadata'].update(profileFingerprint=c.PROFILE,audioSha256=row['audioSha256'],textSha256=row['textSha256'],keep={'unchanged':True})
  snapshot={'schemaVersion':1,'inventoryComplete':True,'inventoryTables':[{'schema':'storage','table':'objects'}],'objects':[obj],'consumerSnapshot':[],'readinessBefore':[],'readinessAfter':[],'allowedInactiveReadinessChanges':[]}
  return allow,snapshot,row
 def test_positive_prepare_archives_sources_and_only_timings_change(self):
  with tempfile.TemporaryDirectory()as d:
   allow,snapshot,row=self.prepare_inputs(d);archive=Path(d)/'archive';before=c.canonical(snapshot)
   payload=c.prepare(allow,c.file_sha(allow),snapshot,archive)
   self.assertEqual(c.canonical(snapshot),before);self.assertEqual(len(payload['archiveFiles']),4)
   for name,sha in payload['archiveFiles'].items():self.assertEqual(c.file_sha(archive/name),sha)
   new=payload['rows'][0]['newMetadata'];self.assertEqual(new['keep'],{'unchanged':True});self.assertEqual(new['wordTimings'],row['wordTimings'])
   self.assertEqual(c.Journal(archive).read()[0]['phase'],'PREPARED')
   with self.assertRaises(FileExistsError):c.prepare(allow,c.file_sha(allow),snapshot,archive)
 def test_prepare_rejects_source_drift_remote_identity_noop_and_uninventoried_schema(self):
  for mutation,code in [('source','source_sha'),('identity','remote_identity'),('noop','only_word_timings'),('inventory','explicit_schema_inventory_required')]:
   with self.subTest(mutation=mutation),tempfile.TemporaryDirectory()as d:
    allow,snapshot,row=self.prepare_inputs(d)
    if mutation=='source':Path(row['audioPath']).write_bytes(b'changed')
    elif mutation=='identity':snapshot['objects'][0]['user_metadata']['audioSha256']='changed'
    elif mutation=='noop':snapshot['objects'][0]['user_metadata']['wordTimings']=row['wordTimings']
    else:snapshot['inventoryComplete']=False
    archive=Path(d)/'archive'
    with self.assertRaisesRegex(ValueError,code):c.prepare(allow,c.file_sha(allow),snapshot,archive)
    self.assertFalse(archive.exists())
 def test_inspection_creates_only_session_scratch_before_readonly_transaction(self):
  q=c.sql(self.payload());begin=q.index('BEGIN READ ONLY;')
  self.assertIn('CREATE TEMP TABLE sitov_payload',q[:begin]);self.assertIn('CREATE TEMP TABLE sitov_state',q[:begin])
  self.assertNotIn('CREATE TEMP TABLE',q[begin:]);self.assertNotIn('UPDATE storage.objects',q)

if __name__=='__main__':unittest.main()
