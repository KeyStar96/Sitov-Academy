import json,pathlib,hashlib,subprocess,datetime,collections,re,shutil
R=pathlib.Path('/Users/denniskostjuk/.codex/worktrees/sitov-night-s1/SmartGerman');C=pathlib.Path('/Users/denniskostjuk/Documents/SitovAcademy/SmartGerman/.git/sitov-orchestration/SITOV-NIGHT-2026-10-08');O=C/'S1';D=R/'docs/handoffs/SITOV-NIGHT-2026-10-08/S1';D.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
canon=lambda x:json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
I=C/'master/M-after-epoch43-full-adoption-inventory-private.json';raw=I.read_bytes();assert sha(raw)=='e0306fbe794755ee57a3189f2d1839a3bbbd8936d6d097f36cfd45cb6dcfa1b6';inv=json.loads(raw);source=inv['summary']['sourceHead'];assert source=='e95b52a1bc21cfbd10bfc416daa7141200f28fc3';(O/'epoch45-inventory-snapshot-private.json').write_bytes(raw)
paths={};seedbytes={}
for f in sorted((R/'supabase/seeds').glob('path-*.json')):
 b=subprocess.check_output(['git','show',source+':supabase/seeds/'+f.name],cwd=R);v=json.loads(b)
 if isinstance(v,list):
  seedbytes[f.name]=sha(b);assert b==subprocess.check_output(['git','show','c8cbd52e9ee89621dc0658d7eaa2b24e4c5eb0e9:supabase/seeds/'+f.name],cwd=R)
  for p in v:
   for n in p.get('nodes',[]):paths[(p['level'].lower(),n['id'])]=(p,n)
objects={}
for x in inv['exercises']:
 p,n=paths[(x['level'].lower(),x['nodeSourceId'])];t=next(e for e in n['exercises'] if e['id']==x['id']);assert t==x['seedExercise'];objects[x['id']]={'task':t,'parent':{k:v for k,v in n.items() if k!='exercises'},'node':n,'objectives':p.get('objectives',[])}
for x in inv['nodes']:
 p,n=paths[(x['level'].lower(),x['sourceId'])];assert n==x['seedNode'];objects['sitov-parent:'+x['id']]={'parent':{k:v for k,v in n.items() if k!='exercises'},'node':n,'objectives':p.get('objectives',[])}
# JavaScript itself provides insertion-order serialization, Python provides its actual sorted-key UTF8 convention.
tmp=O/'epoch45-hash-input-private.json';tmp.write_text(json.dumps(objects,ensure_ascii=False));js="const f=require('fs'),c=require('crypto'),d=JSON.parse(f.readFileSync(process.argv[1],'utf8'));let o={};for(const[id,v]of Object.entries(d)){o[id]={};for(const[k,x]of Object.entries(v))o[id][k]=c.createHash('sha256').update(JSON.stringify(x),'utf8').digest('hex')}process.stdout.write(JSON.stringify(o));";jh=json.loads(subprocess.check_output(['node','-e',js,str(tmp)]));tmp.unlink()
hashes={k:{scope:{'jsInsertionJSON':jh[k][scope],'pythonSortedUTF8Compact':sha(canon(v))} for scope,v in vals.items()}for k,vals in objects.items()}
prior=json.loads((O/'epoch44-coverage-private.json').read_text());files=[pathlib.Path(x['path'])for x in prior['sources']]
assert len(files)==71
for f,x in zip(files,prior['sources']):assert sha(f.read_bytes())==x['byteSHA256']
extra=pathlib.Path('/Users/denniskostjuk/.codex/worktrees/sitov-night-integration/SmartGerman/docs/handoffs/SITOV-NIGHT-2026-10-08/S4/epoch43-final11-content-review.json');eb=extra.read_bytes();assert sha(eb)=='ea700ed80afecb6c6480905a343e09f244bc35bdc8819170158ac67f99e7312c';ep=O/'epoch45-S4e43-review-original-private.json';ep.write_bytes(eb);ep.chmod(0o600);files.append(ep)
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
gitnodes={}
def boundnode(commit,level,nid):
 key=(commit,level.lower())
 if key not in gitnodes:
  try:
   data=json.loads(subprocess.check_output(['git','show',commit+':supabase/seeds/path-'+level.lower()+'.json'],cwd=R,stderr=subprocess.DEVNULL));gitnodes[key]={n['id']:(p,n)for p in data for n in p.get('nodes',[])}
  except Exception:gitnodes[key]={}
 return gitnodes[key].get(nid)
def jsdigest(x):
 return subprocess.check_output(['node','-e',"const c=require('crypto');process.stdout.write(c.createHash('sha256').update(JSON.stringify(JSON.parse(process.argv[1]))).digest('hex'))",json.dumps(x,ensure_ascii=False,separators=(',',':'))],text=True).strip()
def legacyNode(si,d,row,ptr,commit,nh,read,verdict,kind):
 level=row['level'];nid=row.get('sourceId');pn=boundnode(commit,level,nid)
 if not pn:return
 p,n=pn;reconstructed=nh in [jsdigest(n),sha(canon(n))];ph=jsdigest({k:v for k,v in n.items()if k!='exercises'})
 for t in n.get('exercises',[]):
  if t['id']not in hashes:continue
  # Explicit whole-node verdict/scope only. A scoped or HOLD node never becomes a whole-child ACCEPT.
  add(si,{'id':t['id']},ptr,jsdigest(t),ph,None,read,verdict,commit,kind)
  a=records[t['id']][-1];a.update(wholeNodeSourceHash=nh,reconstructedSourceNodeExact=reconstructed,wholeNodeCurrentExact=nh in hashes[t['id']]['node'].values(),allChildrenReadDocumented=bool(read),allObjectivesApproval='UNESTABLISHED_CONTEXT',approvalScope='whole-node-children' if verdict=='ACCEPT' else 'restricted-node-review')
  a['explicitAcceptCandidate']=False
  a['scopedContentAcceptCandidateNoAllObjectives']=verdict=='ACCEPT' and read and reconstructed and a['wholeNodeCurrentExact'] and a['taskExact'] and a['parentExact'] and a['sourceCommitExists']
for f in files:
 b=f.read_bytes();d=json.loads(b);si=len(sources);commit=d.get('sourceCommit',d.get('sourceHead',d.get('sourceSha',d.get('sourceSHA',d.get('sourcePatchCommit',d.get('base'))))))
 sources.append({'path':str(f),'byteSHA256':sha(b),'bytes':len(b),'reviewer':d.get('reviewer',d.get('role','UNESTABLISHED')),'declaredSourceCommit':commit,'declaredCommitExists':realcommit(commit),'counts':d.get('counts',d.get('coverage',{})) if f.name in ['epoch22-reviewed.json','epoch42-final31-role-review.json'] else None,'documentedOriginalCoverage':d.get('coverage',d.get('counts')) if f.name.startswith(('epoch34-','epoch35-','epoch36-','epoch38-','epoch20-')) else None,'copiedFromOriginalPath':str(extra) if f==ep else None});walk(d,'',si)
 if f.name=='epoch45-S4e43-review-original-private.json':
  for j,x in enumerate(d['rows']):
   q=x.get('readScope',{});add(si,x,f'/rows/{j}',x['wholeFinalSeedExerciseSHA256'],x['wholeFinalParentWithoutChildrenSHA256'],x['wholeFinalObjectivesSHA256'],all(q.get(k)is True for k in ['actualWholeCurrentSeedExerciseAllFiveLocalesIncludingOptionsPartsKeysHintsExplanations','wholeCurrentParentWithoutChildrenAllLocalesCardsRulesExamples','allCurrentPathObjectives'])and q.get('truncations')==0,x['verdict'],x['sourceCommit'],'S4e43-final-whole')
 elif f.name=='epoch42-final31-role-review.json':
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
 elif f.name=='epoch34-independent-parent-review.json':
  for j,x in enumerate(d['perNode']):
   read=all(x.get('semanticallyRead',{}).get(k)is True for k in ['completeGermanRuleAndExamples','allFourTranslatedRules','wholeChildTasks','allDistinctChildHintsExplanationsAndTaskTranslations','explanationCardAndGoalContext'])
   legacyNode(si,d,x,f'/perNode/{j}',d['sourceBase'],x['wholeCurrentSeedNodeNativeSha256'],read,x['verdict'],'S4e34-explicit-whole-node')
 elif f.name=='epoch35-independent-repair-review.json':
  for j,x in enumerate(d['perNode']):legacyNode(si,d,x,f'/perNode/{j}',d['base'],x['wholeSeedNodeNativeSha256'],d['coverage'].get('allFourChildTranslationContextsRead')is True,x['completeContextVerdict'],'S4e35-restricted-node')
 elif f.name=='epoch36-independent-context-review.json':
  changed={x['id']:x for x in d['changedTasks']}
  for j,x in enumerate(d['wholeContexts']):
   # Full reads of93 children do not turn a14-repair verdict into93 whole-task approvals.
   legacyNode(si,d,x,f'/wholeContexts/{j}',d['sourceRepairCommit'],x['wholeCurrentNodeNativeSha256'],x.get('wholeCurrentContextRead')is True,'READ_WITH_14_REPAIR_SCOPE','S4e36-read-repair-scope')
  for j,x in enumerate(d.get('nextInventoryAssessments',[])):
   if x['taskId']in hashes:
    add(si,x,f'/nextInventoryAssessments/{j}',x['wholeRecordNativeSha256'],None,None,x.get('reviewed')is True,x['verdict'],d['base'],'S4e36-explicit-task-assessment')
 elif f.name=='epoch38-final-context-review.json':
  for j,x in enumerate(d['wholeContexts']):legacyNode(si,d,x,f'/wholeContexts/{j}',d['source38'],x['afterNativeSha256'],x.get('wholeFiveLanguageContextRead')is True and d['coverage'].get('wholeChildren')==49,x['verdict'],'S4e38-explicit-whole-node')
 elif f.name=='epoch20-reviewed.json':
  for j,x in enumerate(d['wholeTaskReviews']):
   read=set(x.get('localesRead',[]))=={'de','en','ru','uk','tr'} and d['counts'].get('unreviewedWholeTasks')==0
   add(si,x,f'/wholeTaskReviews/{j}',x['afterFullCanonicalSHA256'],x['parentAfterCanonicalSHA256'],None,read,x['verdict'],d['sourceHead'],'S7e20-whole-task-single-goal')
   if x['id']in hashes:
    a=records[x['id']][-1];a.update(allObjectivesApproval='UNESTABLISHED_CONTEXT',goalReadScope='single-linked-goal; not all-path-objectives',scopedContentAcceptCandidateNoAllObjectives=x['verdict']=='ACCEPT' and read and a['taskExact'] and a['parentExact'] and a['sourceCommitExists'] and a['sourceCommitContentExact'])

rows=[];candidates=[]
for x in inv['exercises']:
 eid=x['id'];h=hashes[eid];rs=records[eid];hits={k:{conv:index.get(v,[]) for conv,v in vals.items()}for k,vals in h.items()};accept=[a for a in rs if a['explicitAcceptCandidate']];reasons=[]
 if not accept:
  if not rs:reasons.append('NO_SUPPORTED_STRUCTURED_REVIEW_RECORD' )
  else:
   if any(not a['taskExact'] for a in rs):reasons.append('STALE_TASK_BINDING')
   if any(not a['parentExact'] for a in rs):reasons.append('STALE_OR_MISSING_PARENT_BINDING')
   if any(not a['objectivesExact'] for a in rs):reasons.append('UNESTABLISHED_CONTEXT_OBJECTIVES' if any(not a['objectivesHash'] for a in rs) else 'STALE_OBJECTIVES_BINDING')
   if any(a['verdict'] in ['HOLD','PARTIAL','ACCEPT_WITH_SEPARATE_REMAINDERS_WHERE_LISTED','READ_WITH_14_REPAIR_SCOPE'] for a in rs):reasons.append('EXPLICIT_HOLD_OR_PARTIAL')
   if any(not a['completeDocumentedRead'] for a in rs):reasons.append('INCOMPLETE_READ_SCOPE')
  if any(hits[k][conv] for k in hits for conv in hits[k]):reasons.append('HASH_DISCOVERY_ONLY_CANNOT_UPGRADE_APPROVAL')
 row={'id':eid,'ref':x['ref'],'level':x['level'],'nodeSourceId':x['nodeSourceId'],'hashes':h,'reviewRecords':rs,'hashDiscovery':hits,'explicitAcceptCandidate':bool(accept),'scopedContentAcceptNoAllObjectives':any(a.get('scopedContentAcceptCandidateNoAllObjectives') for a in rs),'documentedSemanticRead':any(a['completeDocumentedRead'] for a in rs),'exactCurrentTaskAndParentRead':any(a['completeDocumentedRead'] and a['taskExact'] and a['parentExact'] and a['sourceCommitExists'] for a in rs),'missingReasons':reasons};row['coverageCategory']='FULL_EXPLICIT_ACCEPT_CANDIDATE' if accept else 'SCOPED_ACCEPT_ALL_OBJECTIVES_UNESTABLISHED' if row['scopedContentAcceptNoAllObjectives'] else 'EXACT_CURRENT_READ_WITHOUT_COMPLETE_EXPLICIT_APPROVAL' if row['exactCurrentTaskAndParentRead'] else 'HISTORICAL_READ_WITHOUT_EXACT_CURRENT_TASK_PARENT_BINDING' if row['documentedSemanticRead'] else 'NO_ADAPTED_READ_SCOPE_NOT_A_SEMANTIC_UNREAD_CLAIM';rows.append(row)
 if accept:
  a=accept[-1];s=sources[a['source']]
  if s['bytes']<=2000000:candidates.append({'id':eid,'approved':True,'binding':{'id':eid,'beforeFullSHA256':sha(canon(x['beforeFull'])),'afterBusinessSHA256':sha(canon(x['after']))},'reviewer':s['reviewer'],'evidence_uri':s['path']+'#'+a['pointer'],'docPath':s['path'],'docSHA256':s['byteSHA256'],'sourceCommit':a['sourceCommit']})
counts={'tasks':len(rows),'parents':len(inv['nodes']),'explicitAcceptCandidates':sum(x['explicitAcceptCandidate'] for x in rows),'missingWholeApprovals':sum(not x['explicitAcceptCandidate'] for x in rows),'casExerciseFragmentCandidates':len(candidates),'exclusiveCoverageCategories':dict(collections.Counter(x['coverageCategory'] for x in rows)),'perReason':dict(collections.Counter(z for x in rows for z in x['missingReasons'])),'supportedAdapters':dict(adapters),'sourceDocuments':len(sources)}
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
counts['scopedContentAcceptNoAllObjectives']=sum(x['scopedContentAcceptNoAllObjectives'] for x in rows)
counts['missingFullApprovalButDocumentedSemanticRead']=sum(not x['explicitAcceptCandidate'] and x['documentedSemanticRead'] for x in rows)
counts['noSupportedReadScope']=sum(not x['documentedSemanticRead'] for x in rows)
counts['missingFullApprovalWithExactCurrentTaskParentRead']=sum(not x['explicitAcceptCandidate'] and x['exactCurrentTaskAndParentRead'] for x in rows)
counts['scopedExactContentOnlyAwaitingAllObjectives']=sum(not x['explicitAcceptCandidate'] and x['scopedContentAcceptNoAllObjectives'] for x in rows)
counts['explicitParentCandidates']=sum(p['explicitParentCandidate'] for p in parents)
counts['parentsMissingExplicitCandidate']=len(parents)-counts['explicitParentCandidates']
report={'version':1,'school':'Sitov Academy','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'inventorySHA256':sha(raw),'sourceCommit':source,'actualContentCommit':'c8cbd52e9ee89621dc0658d7eaa2b24e4c5eb0e9','head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip(),'seedFileByteSHA256':seedbytes,'hashConventions':['actual Node JSON.stringify insertion order UTF8','actual Python sorted keys ensure_ascii=False compact UTF8'],'counts':counts,'sources':sources,'rows':rows,'parents':parents,'publicationApproved':False,'honestPartial':True,'composableBasePlusExplicitDelta':{'status':'PROPOSAL_ONLY_NOT_ESTABLISHED','candidates':[],'approved':False,'reason':'No supported exact prior-whole-task ACCEPT plus separately explicitly approved final delta and all-context/objective binding compiled in this lease.'},'limits':['Discovery covers all selected S4/S7/M JSON audits and both hash conventions. Explicit parsers cover S4 epochs34/35/36/38/39/41/42/43 and S7epochs20/22. Scope-restricted reads and missing all-objective bindings remain separate. Other schemas require scoped manual adjudication; their hashes never grant approval.','Old exact whole-node ACCEPT with explicit all-child reads is only a scoped content candidate when all-path-objective approval is absent. HOLD/PARTIAL/separate remainders and14-repair scope never become blanket child ACCEPT.','No global parentsApproval generated. This is a candidate evidence compilation, not a valid complete CAS review manifest or fresh editorial review.']}
for path,value in [(O/'epoch45-coverage-private.json',report),(O/'epoch45-cas-exercise-fragment-private.json',{'version':1,'publicationApproved':False,'validCompleteManifest':False,'parentsApprovalMissing':True,'exercises':candidates})]:path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');path.chmod(0o600)
compact={'version':1,'school':'Sitov Academy','inventorySHA256':sha(raw),'sourceCommit':source,'counts':counts,'publicationApproved':False,'honestPartial':True,'sources':[{'path':s['path'],'byteSHA256':s['byteSHA256'],'bytes':s['bytes']}for s in sources],'parents':parents,'perID':[{'id':x['id'],'ref':x['ref'],'level':x['level'],'explicitAcceptCandidate':x['explicitAcceptCandidate'],'scopedContentAcceptNoAllObjectives':x['scopedContentAcceptNoAllObjectives'],'documentedSemanticRead':x['documentedSemanticRead'],'coverageCategory':x['coverageCategory'],'exactCurrentTaskAndParentRead':x['exactCurrentTaskAndParentRead'],'structuredReviews':x['reviewRecords'],'missingReasons':x['missingReasons'],'candidateEvidence':[{'sourcePath':sources[a['source']]['path'],'docSHA256':sources[a['source']]['byteSHA256'],'pointer':a['pointer'],'sourceCommit':a['sourceCommit']}for a in x['reviewRecords'] if a['explicitAcceptCandidate']]}for x in rows],'limits':report['limits']}
(D/'epoch45-offline-content-coverage.json').write_text(json.dumps(compact,ensure_ascii=False,indent=2)+'\n');shutil.copyfile(O/'epoch45-coverage.py',D/'epoch45-coverage.py');print(json.dumps(counts,indent=2))
