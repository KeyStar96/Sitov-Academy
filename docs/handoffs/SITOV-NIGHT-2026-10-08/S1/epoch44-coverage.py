import json,pathlib,hashlib,subprocess,datetime,collections,re,shutil
R=pathlib.Path('/Users/denniskostjuk/.codex/worktrees/sitov-night-s1/SmartGerman');C=pathlib.Path('/Users/denniskostjuk/Documents/SitovAcademy/SmartGerman/.git/sitov-orchestration/SITOV-NIGHT-2026-10-08');O=C/'S1';D=R/'docs/handoffs/SITOV-NIGHT-2026-10-08/S1';D.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
canon=lambda x:json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
I=C/'master/M-after-epoch42-full-adoption-inventory-private.json';raw=I.read_bytes();assert sha(raw)=='671761e7592bfe9f127acf9ec8a7bfedf5defcd4abefd68b0068f244d0f814a7';inv=json.loads(raw);source=inv['summary']['sourceHead'];assert source=='03ae6c9905b4c154df33457ecf0ca39a29e3d378';(O/'epoch44-inventory-snapshot-private.json').write_bytes(raw)
paths={};seedbytes={}
for f in sorted((R/'supabase/seeds').glob('path-*.json')):
 b=subprocess.check_output(['git','show',source+':supabase/seeds/'+f.name],cwd=R);v=json.loads(b)
 if isinstance(v,list):
  seedbytes[f.name]=sha(b)
  for p in v:
   for n in p.get('nodes',[]):paths[(p['level'].lower(),n['id'])]=(p,n)
objects={}
for x in inv['exercises']:
 p,n=paths[(x['level'].lower(),x['nodeSourceId'])];t=next(e for e in n['exercises'] if e['id']==x['id']);assert t==x['seedExercise'];objects[x['id']]={'task':t,'parent':{k:v for k,v in n.items() if k!='exercises'},'node':n,'objectives':p.get('objectives',[])}
for x in inv['nodes']:
 p,n=paths[(x['level'].lower(),x['sourceId'])];assert n==x['seedNode'];objects['sitov-parent:'+x['id']]={'parent':{k:v for k,v in n.items() if k!='exercises'},'node':n,'objectives':p.get('objectives',[])}
# JavaScript itself provides insertion-order serialization, Python provides its actual sorted-key UTF8 convention.
tmp=O/'epoch44-hash-input-private.json';tmp.write_text(json.dumps(objects,ensure_ascii=False));js="const f=require('fs'),c=require('crypto'),d=JSON.parse(f.readFileSync(process.argv[1],'utf8'));let o={};for(const[id,v]of Object.entries(d)){o[id]={};for(const[k,x]of Object.entries(v))o[id][k]=c.createHash('sha256').update(JSON.stringify(x),'utf8').digest('hex')}process.stdout.write(JSON.stringify(o));";jh=json.loads(subprocess.check_output(['node','-e',js,str(tmp)]));tmp.unlink()
hashes={k:{scope:{'jsInsertionJSON':jh[k][scope],'pythonSortedUTF8Compact':sha(canon(v))} for scope,v in vals.items()}for k,vals in objects.items()}
files=[]
for folder in [R/'docs/handoffs/SITOV-NIGHT-2026-10-08'/a for a in ['S4','S7','M']]+[C/'S7']:
 for f in sorted(folder.glob('*.json')):
  if re.search(r'(review|audit)',f.name):files.append(f)
sources=[];index=collections.defaultdict(list);records=collections.defaultdict(list);adapters=collections.Counter();commitcache={}
def realcommit(s):
 if not isinstance(s,str) or not re.fullmatch('[0-9a-f]{40}',s):return False
 if s not in commitcache:commitcache[s]=subprocess.run(['git','cat-file','-e',s+'^{commit}'],cwd=R,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
 return commitcache[s]
def walk(x,ptr,si):
 if isinstance(x,str) and re.fullmatch('[0-9a-f]{64}',x):index[x].append({'source':si,'pointer':ptr})
 elif isinstance(x,dict):
  for k,v in x.items():walk(v,ptr+'/'+str(k),si)
 elif isinstance(x,list):
  for k,v in enumerate(x):walk(v,ptr+'/'+str(k),si)
sourcecache={}
def sourceexact(eid,commit):
 if not realcommit(commit):return False
 level=next(x['level'].lower() for x in inv['exercises'] if x['id']==eid);key=(commit,level)
 if key not in sourcecache:
  try:
   data=json.loads(subprocess.check_output(['git','show',commit+':supabase/seeds/path-'+level+'.json'],cwd=R,stderr=subprocess.DEVNULL));found={}
   for p in data:
    for n in p.get('nodes',[]):
     for t in n.get('exercises',[]):found[t['id']]={'task':t,'parent':{k:v for k,v in n.items() if k!='exercises'},'objectives':p.get('objectives',[])}
   sourcecache[key]=found
  except Exception:sourcecache[key]={}
 v=sourcecache[key].get(eid);return bool(v) and all(v[k]==objects[eid][k] for k in ['task','parent','objectives'])
def add(si,row,ptr,th,ph,oh,read,verdict,commit,kind):
 eid=row.get('id',row.get('taskId'));h=hashes.get(eid)
 if not h:return
 match=lambda scope,z:z in h[scope].values() if z else False
 rec={'source':si,'pointer':ptr,'kind':kind,'verdict':verdict,'taskHash':th,'parentHash':ph,'objectivesHash':oh,'taskExact':match('task',th),'parentExact':match('parent',ph),'objectivesExact':match('objectives',oh),'completeDocumentedRead':bool(read),'sourceCommit':commit,'sourceCommitExists':realcommit(commit)}
 rec['sourceCommitContentExact']=sourceexact(eid,commit)
 rec['explicitAcceptCandidate']=verdict=='ACCEPT' and all(rec[k] for k in ['taskExact','parentExact','objectivesExact','completeDocumentedRead','sourceCommitExists','sourceCommitContentExact'])
 records[eid].append(rec);adapters[kind]+=1
for f in files:
 b=f.read_bytes();d=json.loads(b);si=len(sources);commit=d.get('sourceCommit',d.get('sourceHead',d.get('sourceSha',d.get('sourceSHA',d.get('sourcePatchCommit',d.get('base'))))))
 sources.append({'path':str(f),'byteSHA256':sha(b),'bytes':len(b),'declaredSourceCommit':commit,'declaredCommitExists':realcommit(commit),'counts':d.get('counts',d.get('coverage',{})) if f.name in ['epoch22-reviewed.json','epoch42-final31-role-review.json'] else None});walk(d,'',si)
 if f.name=='epoch42-final31-role-review.json':
  for j,x in enumerate(d['rows']):
   s=x.get('readScope',{});add(si,x,f'/rows/{j}',x.get('wholeFinalSeedExerciseSHA256'),x.get('wholeFinalParentWithoutChildrenSHA256'),x.get('wholeFinalPathObjectivesSHA256'),all(s.get(k) is True for k in ['actualFinalWholeTaskIncludingOptionsKeyHintExplanationAndAllFourTranslationRecords','wholeCurrentParentWithoutChildrenIncludingAllLocalesCardsRulesExamples','allCurrentPathObjectives']) and s.get('readerTruncations')==0,x.get('verdict'),x.get('sourceCommit',commit),'S4e42-final-whole')
 elif f.name=='epoch41-actual41-content-review.json':
  for j,x in enumerate(d['rows']):add(si,x,f'/rows/{j}',x.get('newExerciseFullSHA256'),x.get('parentFullSHA256'),x.get('objectivesFullSHA256'),x.get('wholeTaskFiveLanguagesRead') is True and x.get('completeParentMetadataFiveLanguagesAndAllObjectivesRead') is True,x.get('editorialVerdict',x.get('verdict')),x.get('sourceCommit',commit),'S4e41-final-whole')
 elif f.name=='epoch39-final50-independent-review.json':
  parents={x['key']:x for x in d['parents']}
  for j,x in enumerate(d['rows']):
   p=parents.get(x['level']+':'+x['nodeSourceId'],{});add(si,x,f'/rows/{j}',x.get('seedExerciseCanonicalSHA256'),x.get('parentCanonicalSHA256'),p.get('goalContextSHA256'),x.get('fullTaskBeforeAfterAndFiveLanguagesRead') is True and x.get('associatedCompleteParentFiveLanguagesAndGoalsRead') is True,x.get('verdict'),x.get('sourceCommit',commit),'S4e39-final-whole')
 elif f.name=='epoch22-reviewed.json':
  for j,x in enumerate(d['records']):
   s=x.get('readScope',{});add(si,x,f'/records/{j}',x.get('wholeTaskSHA256'),x.get('wholeParentMinusChildrenSHA256'),x.get('allPathObjectivesSHA256'),all(s.get(k) is True for k in ['wholeFinalTask','wholeActualParentMinusChildren','allPathObjectives','allOptionsAndAcceptedAnswers']) and set(s.get('locales',[]))=={'de','en','ru','uk','tr'},x.get('status'),x.get('sourceCommit',commit),'S7e22-final-whole-not-mirror')
 # Older whole nodes remain discovery only unless explicit all-child and objective bindings are independently established.
rows=[];candidates=[]
for x in inv['exercises']:
 eid=x['id'];h=hashes[eid];rs=records[eid];hits={k:{conv:index.get(v,[]) for conv,v in vals.items()}for k,vals in h.items()};accept=[a for a in rs if a['explicitAcceptCandidate']];reasons=[]
 if not accept:
  if not rs:reasons.append('NO_SUPPORTED_EXPLICIT_WHOLE_TASK_CONTEXT_OBJECTIVES_REVIEW')
  else:
   if any(not a['taskExact'] for a in rs):reasons.append('STALE_TASK_BINDING')
   if any(not a['parentExact'] for a in rs):reasons.append('STALE_OR_MISSING_PARENT_BINDING')
   if any(not a['objectivesExact'] for a in rs):reasons.append('STALE_OR_MISSING_OBJECTIVES_BINDING')
   if any(a['verdict'] in ['HOLD','PARTIAL'] for a in rs):reasons.append('EXPLICIT_HOLD_OR_PARTIAL')
   if any(not a['completeDocumentedRead'] for a in rs):reasons.append('INCOMPLETE_READ_SCOPE')
  if any(hits[k][conv] for k in hits for conv in hits[k]):reasons.append('HASH_DISCOVERY_ONLY_CANNOT_UPGRADE_APPROVAL')
 row={'id':eid,'ref':x['ref'],'level':x['level'],'nodeSourceId':x['nodeSourceId'],'hashes':h,'reviewRecords':rs,'hashDiscovery':hits,'explicitAcceptCandidate':bool(accept),'missingReasons':reasons};rows.append(row)
 if accept:
  a=accept[-1];s=sources[a['source']]
  if s['bytes']<=2000000:candidates.append({'id':eid,'approved':True,'binding':{'id':eid,'beforeFullSHA256':sha(canon(x['beforeFull'])),'afterBusinessSHA256':sha(canon(x['after']))},'reviewer':a['kind'],'evidence_uri':s['path']+'#'+a['pointer'],'docPath':s['path'],'docSHA256':s['byteSHA256'],'sourceCommit':a['sourceCommit']})
counts={'tasks':len(rows),'parents':len(inv['nodes']),'explicitAcceptCandidates':sum(x['explicitAcceptCandidate'] for x in rows),'missingWholeApprovals':sum(not x['explicitAcceptCandidate'] for x in rows),'casExerciseFragmentCandidates':len(candidates),'perReason':dict(collections.Counter(z for x in rows for z in x['missingReasons'])),'supportedAdapters':dict(adapters),'sourceDocuments':len(sources)}
parentrecs=[]
for si,s in enumerate(sources):
 if pathlib.Path(s['path']).name not in ['epoch41-actual41-content-review.json','epoch42-final31-role-review.json']:continue
 d=json.loads(pathlib.Path(s['path']).read_text())
 for j,a in enumerate(d.get('parentReviews',[])):
  level=a.get('level',pathlib.Path(a['file']).stem.replace('path-','')).lower();pn=paths.get((level,a['id']))
  if not pn:continue
  p,n=pn;ph=sha(canon({k:v for k,v in n.items() if k!='exercises'}));oh=sha(canon(p.get('objectives',[])));read=a.get('wholeFiveLocaleRead') is True or d.get('checks',{}).get('all25CompleteParentMetadataAndObjectivesRead') is True
  parentrecs.append({'level':level,'sourceId':a['id'],'source':si,'pointer':f'/parentReviews/{j}','verdict':a['verdict'],'parentExact':ph==a.get('finalSHA256',a.get('afterSHA256')),'objectivesExact':oh==a.get('finalObjectivesSHA256',a.get('objectivesSHA256')),'documentedFullParentAndObjectivesRead':read,'childrenApproved':False})
parents=[]
for x in inv['nodes']:
 p,n=paths[(x['level'].lower(),x['sourceId'])];child=next((h for eid,h in hashes.items() if objects[eid]['node']==n),None);parents.append({'id':x['id'],'sourceId':x['sourceId'],'level':x['level'],'hashes':child and {k:child[k] for k in ['parent','node','objectives']},'reviewRecords':[a for a in parentrecs if a['level']==x['level'].lower() and a['sourceId']==x['sourceId']],'explicitParentCandidate':any(a['verdict']=='ACCEPT' and a['parentExact'] and a['objectivesExact'] and a['documentedFullParentAndObjectivesRead'] for a in parentrecs if a['level']==x['level'].lower() and a['sourceId']==x['sourceId']),'globalParentsApproval':False})
counts['explicitParentCandidates']=sum(p['explicitParentCandidate'] for p in parents)
counts['parentsMissingExplicitCandidate']=len(parents)-counts['explicitParentCandidates']
report={'version':1,'school':'Sitov Academy','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'inventorySHA256':sha(raw),'sourceCommit':source,'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip(),'seedFileByteSHA256':seedbytes,'hashConventions':['actual Node JSON.stringify insertion order UTF8','actual Python sorted keys ensure_ascii=False compact UTF8'],'counts':counts,'sources':sources,'rows':rows,'parents':parents,'publicationApproved':False,'honestPartial':True,'limits':['Discovery covers all selected S4/S7/M JSON audits and both hash conventions. Explicit parsers cover S4 epochs39/41/42 and S7epoch22 only. Other schemas require scoped manual adjudication; their hashes never grant approval.','No old whole-node review was inherited: complete all-children read, explicit children approval and objective binding have not jointly been established by a supported adapter.','No global parentsApproval generated. This is a candidate evidence compilation, not a valid complete CAS review manifest or fresh editorial review.']}
for path,value in [(O/'epoch44-coverage-private.json',report),(O/'epoch44-cas-exercise-fragment-private.json',{'version':1,'publicationApproved':False,'validCompleteManifest':False,'parentsApprovalMissing':True,'exercises':candidates})]:path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');path.chmod(0o600)
compact={'version':1,'school':'Sitov Academy','inventorySHA256':sha(raw),'sourceCommit':source,'counts':counts,'publicationApproved':False,'honestPartial':True,'sources':[{'path':s['path'],'byteSHA256':s['byteSHA256'],'bytes':s['bytes']}for s in sources],'parents':parents,'perID':[{'id':x['id'],'ref':x['ref'],'level':x['level'],'explicitAcceptCandidate':x['explicitAcceptCandidate'],'missingReasons':x['missingReasons'],'candidateEvidence':[{'sourcePath':sources[a['source']]['path'],'docSHA256':sources[a['source']]['byteSHA256'],'pointer':a['pointer'],'sourceCommit':a['sourceCommit']}for a in x['reviewRecords'] if a['explicitAcceptCandidate']]}for x in rows],'limits':report['limits']}
(D/'epoch44-offline-content-coverage.json').write_text(json.dumps(compact,ensure_ascii=False,indent=2)+'\n');shutil.copyfile(O/'epoch44-coverage.py',D/'epoch44-coverage.py');print(json.dumps(counts,indent=2))
