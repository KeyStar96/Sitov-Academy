#!/usr/bin/env python3
"""Read-only artifact/baseline verifier; no semantic or release approval."""
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
BASE='9d0737da268820a3f8136dfa386d1c09fa2c6213'
ARTIFACT=Path(__file__).with_name('epoch26-quality-patch.json')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def at_base(path):return subprocess.check_output(['git','show',BASE+':'+path],cwd=ROOT)
def alias_entries(textid,task):
    prefix='sitov-pretest:'+textid+':'+task['id']
    result={prefix+':prompt':task['promptDe']}
    if task.get('fragmentDe') and task['fragmentDe'].strip():result[prefix+':fragment']=task['fragmentDe']
    result.update({prefix+':'+o['id']:o['textDe'] for o in task['options']})
    return result
p=json.loads(ARTIFACT.read_text());assert p['sourceCommit']==BASE
manifest=json.loads(at_base('supabase/seeds/sitov-pronunciation-pretests-2026-10-08.json'))
aliases=json.loads(at_base('supabase/seeds/sitov-pronunciation-pretest-audio-2026-10-08.json'))
sources={s['id']:s for s in json.loads(at_base('supabase/seeds/pronunciation-reading-2026.json'))}
assert all(sha(at_base(path))==digest for path,digest in p['sourceFileSHA256'].items())
base_drafts=manifest['drafts'][10:14];before={(d['textId'],t['id']):t for d in base_drafts for t in d['definition']['tasks']}
patches={(x['textId'],x['questionId']):x for x in p['patches']}
assert len(patches)==len(p['patches'])==31
assert sum(bool(x['findingIDs']) for x in patches.values())==23
assert sum(x['additionalSameFault'] for x in patches.values())==8
findings=p['independentAudit']['findings'];assert len(findings)==24
assert {f['findingId'] for f in findings}=={f for x in patches.values() for f in x['findingIDs']}
assert all(f['questionId']==x['questionId'] and f['textId']==x['textId'] for x in patches.values() for f in findings if f['findingId'] in x['findingIDs'])
changed_aliases=[];wording_changes=[]
for key,x in patches.items():
    old,new=x['previousTask'],x['currentTask'];assert old==before[key]
    assert old!=new and old.keys()==new.keys()
    assert all(old[k]==new[k] for k in old if k not in {'promptDe','options','rationaleDe'})
    assert len(new['options'])==3
    assert [o['id'] for o in old['options']]==[o['id'] for o in new['options']]
    assert len({o['textDe'].strip() for o in new['options']})==3
    assert all(set(a)==set(b)=={'id','textDe'} for a,b in zip(old['options'],new['options']))
    assert new['promptDe'].strip() and new['rationaleDe'].strip() and x['uniqueAnswerRationaleDe']==new['rationaleDe']
    old_correct=next(o['textDe'] for o in old['options'] if o['id']==old['correctOptionId'])
    new_correct=next(o['textDe'] for o in new['options'] if o['id']==new['correctOptionId'])
    if old_correct!=new_correct:
        wording_changes.append(new['id']);assert x['correctWordingChange']['before']==old_correct
        assert x['correctWordingChange']['after']==new_correct and x['correctWordingChange']['requiresMReReview'] is True
        assert x['correctWordingChange']['sourceEvidence']==old['sourceSpans']
        assert x['correctWordingChange']['meaningBeforeDe']==old['rationaleDe']
        assert x['correctWordingChange']['meaningAfterDe']==new['rationaleDe']
    else:assert x['correctWordingChange'] is None
    expected_old=alias_entries(key[0],old);expected_new=alias_entries(key[0],new)
    assert expected_old.keys()==expected_new.keys()
    for field,expected in [('previousAudioAliasEntries',expected_old),('currentAudioAliasEntries',expected_new)]:
        entries=x[field];assert len(entries)==len(expected)
        assert {e['alias']:e['text'] for e in entries}==expected
        assert all(e['textSHA256']==sha(e['text'].encode()) for e in entries)
    assert all(aliases[a]==text for a,text in expected_old.items())
    changed=[a for a in expected_old if expected_old[a]!=expected_new[a]]
    assert changed==x['changedAudioAliasKeys'];changed_aliases.extend(changed)
assert len(wording_changes)==4
assert set(wording_changes)=={'sitov.pretest.'+q for q in ['a12-01.words.q1','a12-01.syntax.q1','a12-02.nominal.q1','a12-04.words.q1']}
assert len(set(changed_aliases))==len(changed_aliases)==p['counts']['changedAudioAliases']==64
assert len(p['reviewList'])==96 and len(p['pools'])==4
review={(r['textId'],r['questionId']):r for r in p['reviewList']};assert len(review)==96
full_definitions=[]
for d,pool in zip(base_drafts,p['pools']):
    assert pool['textId']==d['textId'] and pool['previousDefinition']==d['definition']
    old,new=pool['previousDefinition'],pool['candidateDefinition']
    assert pool['priorReviewAsEvidenceOnly']==d['review'] and pool['priorReviewApprovesCandidate'] is False
    assert {k:v for k,v in old.items() if k!='tasks'}=={k:v for k,v in new.items() if k!='tasks'}
    assert pool['coresReviewed']==old['competencies'] and len(new['competencies'])==4
    for core in new['competencies']:
        own=[t for t in new['tasks'] if t['competencyId']==core['id']]
        assert len(own)==len(core['languageUnits'])==6 and len(set(core['languageUnits']))==6
        assert {t['assessmentUnit'] for t in own}==set(core['languageUnits']) and len({t['equivalenceKey'] for t in own})==6
    assert pool['sourceBody']==sources[d['textId']]['text']
    assert pool['textVersion']==d['textVersion']==sha(pool['sourceBody'].encode())
    assert [t['id'] for t in new['tasks']]==[t['id'] for t in old['tasks']] and len(new['tasks'])==24
    for a,b in zip(old['tasks'],new['tasks']):
        key=(d['textId'],b['id']);assert b==(patches[key]['currentTask'] if key in patches else a)
        row=review[key];assert all(row[k]==v for k,v in b.items()) and row['changed']==(key in patches)
        assert row['correctTextDe']==next(o['textDe'] for o in b['options'] if o['id']==b['correctOptionId'])
    for obj in new['tasks']+new['competencies']:
        for span in obj['sourceSpans']:assert pool['sourceBody'][span['start']:span['end']]==span['quote']
    full_definitions.extend([old,new])
node='import crypto from "node:crypto";process.stdin.setEncoding("utf8");let b="";for await(const c of process.stdin)b+=c;console.log(JSON.stringify(JSON.parse(b).map(d=>crypto.createHash("sha256").update(JSON.stringify(d)).digest("hex"))));'
hashes=json.loads(subprocess.run(['node','--input-type=module','-e',node],input=json.dumps(full_definitions,ensure_ascii=False),capture_output=True,text=True,check=True).stdout)
for i,pool in enumerate(p['pools']):
    assert hashes[i*2]==pool['previousDefinitionContentHash']==base_drafts[i]['review']['definitionContentHash']
    assert hashes[i*2+1]==pool['candidateDefinitionContentHash']
assert len(p['independentAudit']['dispositions'])==24
assert all(d['disposition']=='REPAIR_PROPOSED_M_REVIEW_PENDING' for d in p['independentAudit']['dispositions'])
assert all(x['constructEvidence']==x['previousTask']['sourceSpans'] for x in patches.values())
construct_changes=[x for x in patches.values() if x['constructChange'] is not None]
assert {x['questionId'] for x in construct_changes}=={'sitov.pretest.a12-01.syntax.q1','sitov.pretest.a12-02.verbs.q4','sitov.pretest.a12-02.verbs.q5','sitov.pretest.a12-04.verbs.q5'}
assert all(x['constructChange']['requiresMReReview'] and x['constructChange']['sourceEvidence']==x['previousTask']['sourceSpans'] for x in construct_changes)
assert p['constraints']['candidateApproved'] is False and p['constraints']['humanReview'] is False
assert p['constraints']['audioPreparedForCandidate'] is False and p['verification']['releaseReady'] is False
md=ARTIFACT.with_suffix('.md').read_text()
assert all(r['questionId'] in md and r['promptDe'] in md and r['rationaleDe'] in md for r in review.values())
print(json.dumps({'status':'PASS_ARTIFACT_INVARIANTS_ONLY','base':BASE,'sources':4,'cores':16,'questions':96,'patches':31,'S7Findings':24,'extraSameFaults':8,'changedAudioAliases':64,'correctWordingExceptions':wording_changes,'artifactSHA256':sha(ARTIFACT.read_bytes()),'independentSemanticApproval':False,'humanReview':False,'candidateAudioPrepared':False},ensure_ascii=False))

# Independently prove exact two prompt-only revisions against the immutable reviewed artifact.
old_path=Path(__file__).with_name('epoch25-quality-patch.json')
original=json.loads(old_path.read_text());request_path=ROOT/'docs/handoffs/SITOV-NIGHT-2026-10-08/M/a12-quality31-editorial-changes-requested.json';request=json.loads(request_path.read_text())
assert sha(old_path.read_bytes())==request['sourceArtifactSha256']==p['editorialRevision']['previousArtifactSHA256']
assert sha(request_path.read_bytes())==p['editorialRevision']['requestSHA256']
assert p['sourceCommit']==original['sourceCommit'] and p['sourceFileSHA256']==original['sourceFileSHA256'] and p['counts']==original['counts']
requested={c['questionId']:c for c in request['changes']};assert len(requested)==2
changed=[]
for before,after in zip(original['patches'],p['patches']):
    qid=before['questionId'];assert qid==after['questionId']
    if qid not in requested:assert before==after;continue
    changed.append(qid);a,b=before['currentTask'],after['currentTask'];assert a['promptDe']==requested[qid]['expected'] and b['promptDe']==requested[qid]['replacement']
    assert {k for k in a if a[k]!=b[k]}=={'promptDe'}
    for field in before:
        if field not in {'currentTask','currentAudioAliasEntries'}:assert before[field]==after[field]
assert set(changed)==set(requested)
for a,b in zip(original['pools'],p['pools']):
    for field in a:
        if field not in {'candidateDefinition','candidateDefinitionContentHash'}:assert a[field]==b[field]
    for t,u in zip(a['candidateDefinition']['tasks'],b['candidateDefinition']['tasks']):
        if t['id'] not in requested:assert t==u
for a,b in zip(original['reviewList'],p['reviewList']):
    assert a['questionId']==b['questionId']
    assert {k for k in a if a[k]!=b[k]}==({'promptDe'} if a['questionId'] in requested else set())
assert p['editorialRevision']['changedPrompts']==2 and p['editorialRevision']['netNewChangedAliasKeys']==0
assert sum(len(x['changedAudioAliasKeys']) for x in p['patches'])==64
print('PASS_EXACT_TWO_M_PROMPT_ONLY_REVISIONS; other29patches/options/keys/rationales/cores/evidence immutable;64keys/2revisedstrings')
