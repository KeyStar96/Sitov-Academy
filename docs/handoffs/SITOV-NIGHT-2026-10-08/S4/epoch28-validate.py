#!/usr/bin/env python3
"""Read-only validation of S4 epoch28 review artifacts against frozen source files."""
import json,pathlib,hashlib,subprocess,collections
ROOT=pathlib.Path(__file__).resolve().parents[4]
HERE=pathlib.Path(__file__).resolve().parent
x=json.loads((HERE/'epoch28-audio-safe31-54-candidates.json').read_text())
assert x['baseCommit']=='fd14abbe8568aff5f9e7c9d3aa5aa19b42d755da'
for f in x['sourceFiles']: assert hashlib.sha256((ROOT/f['path']).read_bytes()).hexdigest()==f['sha256'],f['path']
m=json.loads((ROOT/x['sourceFiles'][0]['path']).read_text());a=json.loads((ROOT/x['sourceFiles'][1]['path']).read_text())
assert len(x['pools'])==24 and len(x['reviewedTaskMatrix'])==576
allowed={'promptDe','rationaleDe','options'}; calculated=[]; tasks=0
for p,d in zip(x['pools'],m['drafts'][30:54]):
 assert p['textId']==d['textId'] and p['oldDefinition']==d['definition']
 assert p['oldDraftMetadata']=={k:v for k,v in d.items() if k!='definition'}
 b=p['oldDefinition'];c=p['candidateDefinition']
 assert {k:v for k,v in b.items() if k!='tasks'}=={k:v for k,v in c.items() if k!='tasks'}
 assert p['oldCoreMatrix']==b['competencies']
 for old,new in zip(b['tasks'],c['tasks']):
  tasks+=1
  assert {k:v for k,v in old.items() if k not in allowed}=={k:v for k,v in new.items() if k not in allowed}
  assert len(old['options'])==len(new['options'])==3
  assert [o['id'] for o in old['options']]==[o['id'] for o in new['options']]
  assert len(set(o['textDe'] for o in new['options']))==3
  key=old['correctOptionId'];assert next(o for o in old['options'] if o['id']==key)==next(o for o in new['options'] if o['id']==key)
  assert '___' not in new['promptDe'] and '…' not in new['promptDe']
  for span in old['sourceSpans']: assert p['source']['text'][span['start']:span['end']]==span['quote']
  if old!=new: calculated.append((p['pool'],old['id']))
assert calculated==[(p['pool'],p['taskId']) for p in x['patches']]
for delta in x['aliasDeltas']: assert a[delta['key']]==delta['before'] and delta['before']!=delta['after']
assert len({v['key'] for v in x['aliasDeltas']})==len(x['aliasDeltas'])==272
# Decode UTF8 as text before JSON.parse; never concatenate raw split Buffer chunks.
js='process.stdin.setEncoding("utf8");let s="";for await(const c of process.stdin)s+=c;const x=JSON.parse(s),crypto=await import("node:crypto");for(const p of x.pools)for(const [f,h]of [["oldDefinition","oldNativeDefinitionSha256"],["candidateDefinition","candidateNativeDefinitionSha256"]])if(crypto.createHash("sha256").update(JSON.stringify(p[f])).digest("hex")!==p[h])throw Error(p.pool+":"+f);process.stdout.write("48 native hashes pass");'
result=subprocess.check_output(['node','--input-type=module','-e',js],input=json.dumps(x,ensure_ascii=False).encode()).decode()
assert all(not row['manualListeningPerformed'] for row in x['asrDispositions'])
assert not any('passt die regelmäßige Zeitangabe' in p['candidate']['promptDe'] for p in x['patches'])
print(json.dumps({'status':'pass','tasks':tasks,'patches':len(calculated),'aliasDeltas':len(x['aliasDeltas']),'nativeHashes':48,'asrRows':len(x['asrDispositions']),'audioQA':False,'editorialApproval':False}))
