#!/usr/bin/env python3
"""Validate five explicit proposals against epoch29 frozen current sources; no writes."""
import pathlib,json,hashlib,copy,subprocess,collections
HERE=pathlib.Path(__file__).resolve().parent;ROOT=HERE.parents[3]
x=json.loads((HERE/'epoch29-final49-60-a12-candidates.json').read_text())
assert x['baseCommit']=='977af1831184db379457f52c03cfc7a1c5970a68'
for f in x['sourceFiles']:assert hashlib.sha256((ROOT/f['path']).read_bytes()).hexdigest()==f['sha256'],f['path']
m=json.loads((ROOT/x['sourceFiles'][0]['path']).read_text());aliases=json.loads((ROOT/x['sourceFiles'][1]['path']).read_text())
assert x['counts']['grammarTasksRead']==216 and len(x['semanticReadingMatrix'])==218
assert len({v['taskId']for v in x['semanticReadingMatrix']})==218
assert len(x['patches'])==5 and len(x['pools'])==14
hashinputs=[];actualdeltas=[];changed=0;correctchanges=[]
for p in x['pools']:
 d=m['drafts'][p['pool']-1];old=d['definition'];new=copy.deepcopy(old)
 assert p['textId']==d['textId'] and p['oldCoreMatrix']==old['competencies']
 assert p['oldDraftMetadata']['review']['definitionContentHash']==p['oldNativeDefinitionSha256']
 assert p['oldDraftMetadata']=={k:v for k,v in d.items()if k!='definition'}
 for patch in [v for v in x['patches']if v['pool']==p['pool']]:
  ti=next(i for i,t in enumerate(old['tasks'])if t['id']==patch['taskId']);bt=old['tasks'][ti];ct=patch['candidate'];assert patch['before']==bt
  assert {k:v for k,v in bt.items()if k not in ['promptDe','options','rationaleDe','assessmentUnit','equivalenceKey']}=={k:v for k,v in ct.items()if k not in ['promptDe','options','rationaleDe','assessmentUnit','equivalenceKey']}
  assert len(ct['options'])==3 and len({o['textDe']for o in ct['options']})==3
  assert [o['id']for o in bt['options']]==[o['id']for o in ct['options']]
  assert ct['equivalenceKey']==bt['equivalenceKey']+':audio-safe-v1'
  assert patch['assessmentUnitDelta']=={'before':bt['assessmentUnit'],'after':ct['assessmentUnit']}
  assert patch['equivalenceKeyDelta']=={'before':bt['equivalenceKey'],'after':ct['equivalenceKey']}
  for span in bt['sourceSpans']:assert p['fullSource']['text'][span['start']:span['end']]==span['quote']
  correctbefore=next(o['textDe']for o in bt['options']if o['id']==bt['correctOptionId']);correctafter=next(o['textDe']for o in ct['options']if o['id']==ct['correctOptionId'])
  assert patch['correctWordChange']['changed']==(correctbefore!=correctafter)
  if correctbefore!=correctafter:correctchanges.append(bt['id']);assert p['pool']in[16,17]
  prefix=f"sitov-pretest:{d['textId']}:{bt['id']}"
  if bt['promptDe']!=ct['promptDe']:actualdeltas.append((prefix+':prompt',bt['promptDe'],ct['promptDe']))
  for bo,co in zip(bt['options'],ct['options']):
   if bo['textDe']!=co['textDe']:actualdeltas.append((prefix+':'+bo['id'],bo['textDe'],co['textDe']))
  new['tasks'][ti]=ct;core=next(c for c in new['competencies']if c['id']==bt['competencyId']);assert core['languageUnits'].count(bt['assessmentUnit'])==1;core['languageUnits'][core['languageUnits'].index(bt['assessmentUnit'])]=ct['assessmentUnit'];changed+=1
 assert new['competencies']==p['candidateCoreMatrix']
 for bc,cc in zip(old['competencies'],new['competencies']):
  assert {k:v for k,v in bc.items()if k!='languageUnits'}=={k:v for k,v in cc.items()if k!='languageUnits'}
  assert len(bc['languageUnits'])==len(cc['languageUnits'])==len(set(cc['languageUnits']))==6
 hashinputs.append({'old':old,'candidate':new})
assert actualdeltas==[(v['key'],v['before'],v['after'])for v in x['aliasDeltas']]
assert len(actualdeltas)==14 and len(set(v[0]for v in actualdeltas))==14 and len(correctchanges)==2
for key,before,after in actualdeltas:assert aliases[key]==before and before!=after
js='process.stdin.setEncoding("utf8");let b="";for await(const c of process.stdin)b+=c;const crypto=await import("node:crypto");process.stdout.write(JSON.stringify(JSON.parse(b).map(p=>Object.fromEntries(Object.entries(p).map(([k,v])=>[k,crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex")])))));'
hashes=json.loads(subprocess.check_output(['node','--input-type=module','-e',js],input=json.dumps(hashinputs,ensure_ascii=False).encode()))
for p,h in zip(x['pools'],hashes):assert p['oldNativeDefinitionSha256']==h['old']and p['candidateNativeDefinitionSha256']==h['candidate']
for f in x['asrEvidence']:assert hashlib.sha256(pathlib.Path(f['file']).read_bytes()).hexdigest()==f['sha256']
assert len(x['asrDispositions'])==109 and all(not r['listened']for r in x['asrDispositions'])
print(json.dumps({'status':'PASS','exactCurrentBase':x['baseCommit'],'patches':changed,'aliasDeltas':14,'protectedTaskIdsKeysOptionOrderSources':True,'explicitCorrectWordChanges':2,'explicitUnitEquivalenceAndCoreDeltas':5,'nativeUTF8WholeDefinitionHashes':28,'semanticReadingRecords':218,'asrEvidenceRows':109,'audioQA':False}))
