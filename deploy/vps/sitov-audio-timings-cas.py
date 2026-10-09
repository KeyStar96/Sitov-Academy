#!/usr/bin/env python3
"""Bounded original-byte timing CAS. Default prepares an archive; never uploads audio."""
import argparse
import copy
import fcntl
import hashlib
import ipaddress
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
import unicodedata
import urllib.parse
import urllib.request

PROFILE = '96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5'
REVISION = '0e1a68e91d815300c7c9754b2a7639378b23db15'
MAX_BATCH = 50


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def file_sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def require(condition, code):
    if not condition:
        raise ValueError(code)


def lexical(token):
    return ''.join(c for c in token if c == "'" or unicodedata.category(c)[0] in 'LN')


def timings(text, values, duration):
    require(isinstance(duration, (int, float)) and not isinstance(duration, bool) and math.isfinite(duration) and duration > 0, 'duration')
    require(isinstance(values, list) and len(values) == len(text.split()) and values, 'token_coverage')
    previous = 0
    for token, item in zip(text.split(), values):
        require(isinstance(item, dict) and set(item) == {'start', 'end'}, 'timing_shape')
        a, b = item['start'], item['end']
        require(all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in (a, b)), 'finite_timings')
        require(previous <= a <= b <= duration and (b > a if lexical(token) else b == a), 'timing_bounds')
        previous = b


def immutable_object(value):
    return {k: v for k, v in value.items() if k not in ('user_metadata', 'updated_at')}


def validate_readiness(snapshot):
    before, after = snapshot['readinessBefore'], snapshot['readinessAfter']
    allowed = set(snapshot['allowedInactiveReadinessChanges'])
    old, new = {r['id']: r for r in before}, {r['id']: r for r in after}
    require(len(old) == len(before) and set(old) == set(new) and len(new) == len(after), 'readiness_identity')
    require(allowed <= set(old), 'readiness_whitelist')
    for key in old:
        require(set(old[key]) == set(new[key]) == {'id', 'active', 'audio', 'publication'}, 'readiness_shape')
        require(all(isinstance(old[key][k], bool) and isinstance(new[key][k], bool) for k in ('active', 'audio', 'publication')), 'readiness_boolean')
        require(old[key]['active'] == new[key]['active'], 'activation_forbidden')
        require(old[key] == new[key] or (key in allowed and not old[key]['active']), 'unexpected_readiness_change')
    for table in snapshot['consumerSnapshot']:
        require(len(table['rows']) <= 500, 'consumer_limit')
        if 'proof' in table['table']:
            for row in table['rows']:
                key = row.get('definition_id')
                require(key in old and not old[key]['active'], 'active_or_unclassified_proof_hold')


def prepare(allowlist, expected_sha, snapshot, archive):
    require(file_sha(allowlist) == expected_sha, 'allowlist_sha')
    allow = json.loads(Path(allowlist).read_text())
    require(allow['profileFingerprint'] == PROFILE, 'profile')
    by_key = {(r['bucket'], r['path']): r for r in allow['rows']}
    require(len(by_key) == len(allow['rows']), 'allowlist_duplicates')
    require(snapshot['schemaVersion'] == 1 and snapshot['inventoryComplete'] is True, 'explicit_schema_inventory_required')
    tables = snapshot['inventoryTables']
    require(tables and len(tables) == len(set((t['schema'], t['table']) for t in tables)), 'inventory_duplicates')
    require(all(re.fullmatch('[A-Za-z_][A-Za-z0-9_]*', t[k]) for t in tables for k in ('schema', 'table')), 'inventory_identifiers')
    validate_readiness(snapshot)
    require(1 <= len(snapshot['objects']) <= MAX_BATCH, 'batch_limit')
    rows, ids, keys = [], set(), set()
    sources = []
    for obj in sorted(snapshot['objects'], key=lambda o: (o['bucket_id'], o['name'], o['id'])):
        require({'id', 'bucket_id', 'name', 'version', 'metadata', 'user_metadata', 'updated_at'} <= set(obj), 'full_object_required')
        key = (obj['bucket_id'], obj['name'])
        require(key in by_key and key not in keys and obj['id'] not in ids, 'object_identity')
        require(re.fullmatch('[0-9a-fA-F-]{36}', obj['id']) and re.fullmatch('sitov-qwen-v1/de/[0-9a-f]{64}\\.mp3', obj['name']), 'object_path')
        ids.add(obj['id']); keys.add(key)
        a = by_key[key]
        require(a['modelRevision'] == REVISION, 'model_revision')
        for path_key, sha_key in [('audioPath', 'audioSha256'), ('originalSourceMetadataPath', 'originalSourceMetadataSha256'), ('candidatePath', 'candidateSha256'), ('rawArraysPath', 'rawArraysSha256')]:
            require(file_sha(a[path_key]) == a[sha_key], 'source_sha')
            sources.append((a[path_key], obj['id'] + '-' + path_key, a[sha_key]))
        candidate = json.loads(Path(a['candidatePath']).read_text())
        require(candidate['receiptSha256'] == a['receiptSha256'] == digest({k: v for k, v in candidate.items() if k != 'receiptSha256'}), 'receipt_digest')
        require(candidate['accepted'] is True and candidate['modelDecision']['accepted'] is True, 'held_candidate')
        require(candidate['modelDecision']['thresholds'] == {'minProbability': .005, 'minPeakRatio': .01}, 'thresholds')
        require(candidate['wordTimings'] == a['wordTimings'] and candidate['arraysSha256'] == a['rawArraysSha256'], 'candidate_timings')
        decision=candidate['modelDecision'];n=2*sum(bool(lexical(t)) for t in a['text'].split())
        require(len(decision['classIndices'])==len(decision['selectedProbabilities'])==len(decision['selectedToPeakRatios'])==n, 'classifier_coverage')
        require(all(isinstance(v,(int,float)) and math.isfinite(v) and .005<=v<=1 for v in decision['selectedProbabilities']) and all(isinstance(v,(int,float)) and math.isfinite(v) and .01<=v<=1 for v in decision['selectedToPeakRatios']), 'classifier_support')
        if a['method'] == 'archived_pinned_known_linear_clock_transform':
            require(candidate.get('sourceMP3Sha256') == a['audioSha256'] and candidate.get('text') == a['text'], 'clock_source_identity')
            require(candidate.get('launchCheckpointValidated') is True and candidate.get('modelRevision') == REVISION, 'launch_pin')
            for p, h in [('originalDecodedWavPath', 'originalDecodedWavSha256'), ('alignmentInputWavPath', 'alignmentInputWavSha256')]:
                require(file_sha(candidate[p]) == candidate[h], 'measurement_archive_sha')
                sources.append((candidate[p], obj['id'] + '-' + p, candidate[h]))
            require(candidate.get('ffmpegVersion') and candidate['actualOriginalDuration'] == a['actualOriginalDecodedDuration'], 'measurement_provenance')
        else:
            require(a['method'] == 'original_pinned_raw_classifier' and candidate['provenance']['modelRevision'] == REVISION, 'method')
            require(candidate['provenance']['sourceMP3Sha256'] == a['audioSha256'] and candidate['actualDecodedDuration'] == a['actualOriginalDecodedDuration'], 'original_identity')
        meta = obj['user_metadata']
        require('wordTimings' in meta, 'existing_timing_key_required')
        require(meta.get('profileFingerprint') == PROFILE and meta.get('audioSha256') == a['audioSha256'] and meta.get('textSha256') == a['textSha256'], 'remote_identity')
        require(hashlib.sha256(a['text'].encode()).hexdigest() == a['textSha256'], 'text_identity')
        timings(a['text'], a['wordTimings'], a['actualOriginalDecodedDuration'])
        new = {**meta, 'wordTimings': a['wordTimings']}
        require(new != meta and {k:v for k,v in new.items() if k != 'wordTimings'} == {k:v for k,v in meta.items() if k != 'wordTimings'}, 'only_word_timings')
        rows.append({'old': obj, 'newMetadata': new, 'audioSha256': a['audioSha256'], 'audioBytes': Path(a['audioPath']).stat().st_size, 'oldMetadataSha256': digest(meta), 'source': a})
    payload = {'schemaVersion': 1, 'allowlistSha256': expected_sha, 'rows': rows, 'snapshot': snapshot}
    archive = Path(archive)
    archive.mkdir(mode=0o700, parents=True, exist_ok=False)
    payload['archiveFiles'] = {}
    for path, name, expected in sources:
        target = archive / name
        shutil.copyfile(path, target)
        target.chmod(0o600)
        require(file_sha(target)==expected,'archive_copy_changed')
        payload['archiveFiles'][name]=expected
        with target.open('rb') as f: os.fsync(f.fileno())
    write_new(archive/'operation.json', payload)
    Journal(archive).append('PREPARED', {'payloadSha256': digest(payload)})
    return payload


def write_new(path, value):
    with Path(path).open('x', encoding='utf-8') as f:
        os.chmod(path, 0o600); f.write(canonical(value) + '\n'); f.flush(); os.fsync(f.fileno())
    fd = os.open(Path(path).parent, os.O_RDONLY)
    try: os.fsync(fd)
    finally: os.close(fd)


class Journal:
    def __init__(self, archive): self.path = Path(archive)/'outcomes.jsonl'
    def read(self):
        if not self.path.exists(): return []
        raw = self.path.read_bytes(); require(raw.endswith(b'\n'), 'truncated_journal')
        rows = [json.loads(line) for line in raw.splitlines()]; previous = None
        for row in rows:
            require(row['previous'] == previous and row['hash'] == digest({k:v for k,v in row.items() if k != 'hash'}), 'journal_integrity')
            previous = row['hash']
        require([r['phase'] for r in rows] in [[], ['PREPARED'], ['PREPARED','COMMITTED_READBACK_PENDING'], ['PREPARED','COMMITTED_READBACK_PENDING','VERIFIED']], 'journal_transition')
        return rows
    def append(self, phase, data):
        rows = self.read(); record = {'phase':phase,'data':data,'previous':rows[-1]['hash'] if rows else None}
        record['hash'] = digest(record)
        require([r['phase'] for r in rows]+[phase] in [['PREPARED'],['PREPARED','COMMITTED_READBACK_PENDING'],['PREPARED','COMMITTED_READBACK_PENDING','VERIFIED']], 'journal_transition')
        with self.path.open('a', encoding='utf-8') as f:
            os.chmod(self.path, 0o600); f.write(canonical(record)+'\n'); f.flush(); os.fsync(f.fileno())
        self.read()
        fd=os.open(self.path.parent,os.O_RDONLY)
        try:os.fsync(fd)
        finally:os.close(fd)


# Only constant SQL plus a delimiter-checked JSON literal; no SQL from snapshot data.
COMMON = r'''
CREATE TEMP TABLE sitov_payload(v jsonb); INSERT INTO sitov_payload VALUES(__PAYLOAD__::jsonb);
CREATE TEMP TABLE sitov_state(v jsonb);
DO $sitov_guard$ DECLARE p jsonb; t jsonb; got jsonb; consumers jsonb:='[]'; inventory jsonb; ready jsonb:='[]'; BEGIN
 SELECT v INTO p FROM sitov_payload;
 SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname) ORDER BY n.nspname,c.relname) INTO inventory FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN('r','p') AND n.nspname !~ '^pg_' AND n.nspname<>'information_schema';
 IF inventory IS DISTINCT FROM p->'snapshot'->'inventoryTables' THEN RAISE EXCEPTION 'schema_inventory_changed';END IF;
 FOR t IN SELECT value FROM jsonb_array_elements(inventory) LOOP
  IF t->>'schema'='storage' AND t->>'table'='objects' THEN CONTINUE;END IF;
  EXECUTE format('SELECT coalesce(jsonb_agg(x.data ORDER BY x.data::text),''[]''::jsonb) FROM (SELECT to_jsonb(q) data FROM %I.%I q WHERE EXISTS(SELECT 1 FROM jsonb_array_elements($1) r WHERE strpos(to_jsonb(q)::text,r->''old''->>''name'')>0) LIMIT 501 __ROWLOCK__)x',t->>'schema',t->>'table') INTO got USING p->'rows';
  IF jsonb_array_length(got)>500 THEN RAISE EXCEPTION 'consumer_bound';END IF;
  IF got<>'[]'::jsonb THEN consumers:=consumers||jsonb_build_array(t||jsonb_build_object('rows',got));END IF;
 END LOOP;
 IF consumers IS DISTINCT FROM p->'snapshot'->'consumerSnapshot' THEN RAISE EXCEPTION 'consumer_snapshot_changed';END IF;
 IF inventory @> '[{"schema":"sitov_pronunciation_private","table":"pretest_definitions"}]'::jsonb THEN
  EXECUTE 'SELECT coalesce(jsonb_agg(jsonb_build_object(''id'',d.id,''active'',d.active,''audio'',sitov_pronunciation_private.public_audio_ready(d.id,d.test_version,d.definition),''publication'',sitov_pronunciation_private.publication_ready(d.id,d.text_id,d.text_version,d.test_version,d.definition)) ORDER BY d.id),''[]''::jsonb) FROM sitov_pronunciation_private.pretest_definitions d' INTO ready;
 END IF;
 IF ready IS DISTINCT FROM p->'snapshot'->__READINESS__ THEN RAISE EXCEPTION 'readiness_changed';END IF;
 INSERT INTO sitov_state VALUES(jsonb_build_object('consumers',consumers,'readiness',ready));
END $sitov_guard$;
'''
MUTATE = r'''
DO $sitov_change$ DECLARE p jsonb;r jsonb;o storage.objects;n bigint;a jsonb;BEGIN
 SELECT v INTO p FROM sitov_payload;
 FOR r IN SELECT value FROM jsonb_array_elements(p->'rows') ORDER BY value->'old'->>'bucket_id',value->'old'->>'name',value->'old'->>'id' LOOP
  SELECT * INTO STRICT o FROM storage.objects WHERE id=(r->'old'->>'id')::uuid FOR UPDATE;
  IF to_jsonb(o) IS DISTINCT FROM r->'old' OR NOT sitov_storage_private.sitov_object_is_current(to_jsonb(o)) THEN RAISE EXCEPTION 'full_object_CAS_changed';END IF;
  UPDATE storage.objects SET user_metadata=jsonb_set(user_metadata,'{wordTimings}',r->'newMetadata'->'wordTimings',false) WHERE id=o.id AND user_metadata=o.user_metadata AND metadata IS NOT DISTINCT FROM o.metadata AND version IS NOT DISTINCT FROM o.version;
  GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'one_row_required';END IF;
  SELECT to_jsonb(x) INTO a FROM storage.objects x WHERE id=o.id;
  IF a->'user_metadata' IS DISTINCT FROM r->'newMetadata' OR a-'user_metadata'-'updated_at' IS DISTINCT FROM to_jsonb(o)-'user_metadata'-'updated_at' THEN RAISE EXCEPTION 'unexpected_row_delta';END IF;
 END LOOP;
END $sitov_change$;
'''


def sql(payload, mutate=False):
    encoded = canonical(payload); tag = '$sitov_' + digest(payload)[:24] + '$'
    require(tag not in encoded, 'sql_literal_collision')
    literal = tag + encoded + tag
    def guard(after=False):
        return COMMON.replace('__PAYLOAD__', literal).replace('__ROWLOCK__', 'FOR SHARE' if mutate else '').replace('__READINESS__', "'readinessAfter'" if after else "'readinessBefore'")
    begin = "BEGIN ISOLATION LEVEL SERIALIZABLE;" if mutate else "BEGIN READ ONLY;"
    out = begin + "SET LOCAL lock_timeout='2s';SET LOCAL statement_timeout='20s';SET LOCAL application_name='sitov_audio_timings_cas';" + guard()
    if mutate:
        out += MUTATE + 'DROP TABLE sitov_payload;DROP TABLE sitov_state;' + guard(True)
    out += "SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY o.id),'[]'::jsonb) FROM storage.objects o JOIN jsonb_array_elements((SELECT v FROM sitov_payload)->'rows')r ON o.id=(r->'old'->>'id')::uuid;COMMIT;"
    return out


def classify(payload, objects):
    by_id = {o['id']:o for o in objects}; require(len(by_id)==len(objects)==len(payload['rows']), 'object_count')
    states=[]
    for r in payload['rows']:
        old, got = r['old'], by_id.get(r['old']['id'])
        if got == old: states.append('old')
        elif got and immutable_object(got)==immutable_object(old) and got['user_metadata']==r['newMetadata']: states.append('new')
        else: raise ValueError('changed_state_abort')
    require(len(set(states))==1, 'partial_state_abort')
    return states[0]


def execute(archive, database, storage, apply=False):
    archive=Path(archive)
    with (archive/'operation.lock').open('a+') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        payload=json.loads((archive/'operation.json').read_text()); journal=Journal(archive); events=journal.read()
        require(events and events[0]['data']['payloadSha256']==digest(payload),'archived_payload_integrity')
        for name,expected in payload.get('archiveFiles',{}).items():
            require(Path(name).name==name and file_sha(archive/name)==expected,'archive_integrity')
        # Inspect with the correct readiness state: recovery may already be committed.
        objects=database.inspect(payload); state=classify(payload,objects)
        if state=='old':
            require(events[-1]['phase']=='PREPARED','committed_state_reverted')
            if not apply:return 'NOT_COMMITTED'
            for r in payload['rows']: storage.verify(r, r['old']['user_metadata'])
            database.commit(sql(payload,True))  # On uncertainty, keep PREPARED and inspect; no retry here.
            objects=database.inspect(payload); require(classify(payload,objects)=='new','commit_readback_state')
        if events[-1]['phase']=='PREPARED': journal.append('COMMITTED_READBACK_PENDING',{'objects':objects})
        elif events[-1]['phase']=='VERIFIED':
            require(events[-2]['data']['objects']==objects,'verified_object_drift')
        else:require(events[-1]['data']['objects']==objects,'committed_object_drift')
        for r in payload['rows']:storage.verify(r,r['newMetadata'])
        require(database.inspect(payload)==objects,'final_object_readback_drift')
        if journal.read()[-1]['phase']!='VERIFIED':journal.append('VERIFIED',{'objectIds':[r['old']['id']for r in payload['rows']]})
        return 'VERIFIED'


class Database:
    def __init__(self,container,name):self.container,self.name,self.deadline=container,name,time.monotonic()+180
    def query(self,query):
        remaining=self.deadline-time.monotonic();require(remaining>0,'operation_deadline')
        p=subprocess.run(['docker','exec','-i',self.container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d',self.name],input=query,text=True,capture_output=True,timeout=min(45,remaining))
        require(p.returncode==0,'database_operation_failed')
        return json.loads(p.stdout.strip().splitlines()[-1])
    def inspect(self,payload):
        # Inspect both exact object states first; then validate matching consumer/readiness snapshot.
        raw="BEGIN READ ONLY;SET LOCAL statement_timeout='8s';SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY o.id),'[]'::jsonb) FROM storage.objects o WHERE id=ANY(ARRAY["+','.join("'"+r['old']['id']+"'::uuid"for r in payload['rows'])+"]);COMMIT;"
        objects=self.query(raw);state=classify(payload,objects);check=copy.deepcopy(payload)
        if state=='new':check['snapshot']['readinessBefore']=check['snapshot']['readinessAfter']
        checked=self.query(sql(check));require(checked==objects,'inspection_race');return objects
    def commit(self,query):return self.query(query)


class Storage:
    def __init__(self,container,url):
        parsed=urllib.parse.urlparse(url);require(parsed.scheme=='http' and not parsed.username and not parsed.query and url.endswith('/storage/v1'),'local_storage_url')
        require(parsed.hostname=='localhost' or ipaddress.ip_address(parsed.hostname).is_private,'local_storage_host')
        p=subprocess.run(['docker','inspect',container],check=True,capture_output=True,text=True,timeout=5)
        env=dict(e.split('=',1)for e in json.loads(p.stdout)[0]['Config']['Env']);self.key=env['SERVICE_KEY'];self.url=url;self.deadline=time.monotonic()+180
    def get(self,path):
        remaining=self.deadline-time.monotonic();require(remaining>0,'operation_deadline')
        req=urllib.request.Request(self.url+path,headers={'Authorization':'Bearer '+self.key,'apikey':self.key})
        with urllib.request.urlopen(req,timeout=min(5,remaining))as response:return response.read()
    def verify(self,row,metadata):
        path=urllib.parse.quote(row['old']['name'],safe='/')
        audio=self.get('/object/authenticated/audio_cache/'+path)
        require(len(audio)==row['audioBytes'] and hashlib.sha256(audio).hexdigest()==row['audioSha256'],'authenticated_audio_readback')
        info=json.loads(self.get('/object/info/audio_cache/'+path));actual=info.get('metadata')or info.get('user_metadata')or info.get('userMetadata')or {}
        require(actual==metadata,'authenticated_metadata_readback')


def main():
    os.umask(0o077);p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--action',choices=['prepare','apply','recover'],default='prepare');p.add_argument('--archive',type=Path,required=True)
    for name in ['allowlist','allowlist-sha','snapshot','db-container','database','storage-container','storage-url']:p.add_argument('--'+name)
    a=p.parse_args()
    if a.action=='prepare':
        require(a.allowlist and a.allowlist_sha and a.snapshot,'prepare_inputs');prepare(a.allowlist,a.allowlist_sha,json.loads(Path(a.snapshot).read_text()),a.archive);print(canonical({'phase':'PREPARED','mutation':False}))
    else:
        require(all([a.db_container,a.database,a.storage_container,a.storage_url]),'explicit_execution_targets_required')
        print(canonical({'phase':execute(a.archive,Database(a.db_container,a.database),Storage(a.storage_container,a.storage_url),a.action=='apply')}))


if __name__=='__main__':main()
