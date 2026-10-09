#!/usr/bin/env python3
"""Read-only artifact/baseline verifier; no semantic or release approval."""
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
BASE='ecb13b7adae48ee2d7bc1c87dbb946e59a956fb7'
ARTIFACT=Path(__file__).with_name('epoch24-quality-patch.json')
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
base_drafts=manifest['drafts'][6:10];before={(d['textId'],t['id']):t for d in base_drafts for t in d['definition']['tasks']}
patches={(x['textId'],x['questionId']):x for x in p['patches']}
assert len(patches)==len(p['patches'])==32
assert sum(bool(x['findingIDs']) for x in patches.values())==19
assert sum(x['additionalSameFault'] for x in patches.values())==13
findings=p['independentAudit']['findings'];assert len(findings)==21
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
assert len(wording_changes)==11
assert set(wording_changes)=={'sitov.pretest.'+q for q in ['a11-07.words.q2','a11-07.verbs.q6','a11-08.words.q2','a11-08.words.q6','a11-08.syntax.q6','a11-08.nominal.q5','a11-08.nominal.q6','a11-09.words.q1','a11-09.syntax.q3','a11-10.words.q4','a11-10.verbs.q6']}
assert len(set(changed_aliases))==len(changed_aliases)==p['counts']['changedAudioAliases']==77
assert len(p['reviewList'])==96 and len(p['pools'])==4
review={(r['textId'],r['questionId']):r for r in p['reviewList']};assert len(review)==96
full_definitions=[]
for d,pool in zip(base_drafts,p['pools']):
    assert pool['textId']==d['textId'] and pool['previousDefinition']==d['definition']
    old,new=pool['previousDefinition'],pool['candidateDefinition']
    assert pool['priorReviewAsEvidenceOnly']==d['review'] and pool['priorReviewApprovesCandidate'] is False
    assert {k:v for k,v in old.items() if k!='tasks'}=={k:v for k,v in new.items() if k!='tasks'}
    assert pool['coresReviewed']==old['competencies'] and len(new['competencies'])==4
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
assert len(p['independentAudit']['dispositions'])==21
assert all(d['disposition']=='REPAIR_PROPOSED_M_REVIEW_PENDING' for d in p['independentAudit']['dispositions'])
assert all(x['constructEvidence']==x['previousTask']['sourceSpans'] for x in patches.values())
construct_changes=[x for x in patches.values() if x['constructChange'] is not None]
assert {x['questionId'] for x in construct_changes}=={'sitov.pretest.a11-08.syntax.q6','sitov.pretest.a11-10.syntax.q4'}
assert all(x['constructChange']['requiresMReReview'] and x['constructChange']['sourceEvidence']==x['previousTask']['sourceSpans'] for x in construct_changes)
assert p['constraints']['candidateApproved'] is False and p['constraints']['humanReview'] is False
assert p['constraints']['audioPreparedForCandidate'] is False and p['verification']['releaseReady'] is False
md=ARTIFACT.with_suffix('.md').read_text()
assert all(r['questionId'] in md and r['promptDe'] in md and r['rationaleDe'] in md for r in review.values())
print(json.dumps({'status':'PASS_ARTIFACT_INVARIANTS_ONLY','base':BASE,'sources':4,'cores':16,'questions':96,'patches':32,'S7Findings':21,'extraSameFaults':13,'changedAudioAliases':77,'correctWordingExceptions':wording_changes,'artifactSHA256':sha(ARTIFACT.read_bytes()),'independentSemanticApproval':False,'humanReview':False,'candidateAudioPrepared':False},ensure_ascii=False))

# Independently prove that the revision changes exactly the two requested candidates.
old_path=Path(__file__).with_name('epoch23-quality-patch.json')
original=json.loads(old_path.read_text())
request_path=ROOT/'docs/handoffs/SITOV-NIGHT-2026-10-08/M/a11-quality32-editorial-changes-requested.json'
request=json.loads(request_path.read_text());assert sha(old_path.read_bytes())==request['artifactSha256']==p['editorialRevision']['previousArtifactSHA256']
assert sha(request_path.read_bytes())==p['editorialRevision']['requestSHA256']
assert p['sourceCommit']==original['sourceCommit'] and p['sourceFileSHA256']==original['sourceFileSHA256'] and p['counts']==original['counts']
requested={c['questionId']:c['proposedPrompt'] for c in request['requiredCorrections']};assert len(requested)==2
changed=[]
for before,after in zip(original['patches'],p['patches']):
    qid=before['questionId'];assert qid==after['questionId']
    if qid not in requested:assert before==after;continue
    changed.append(qid);a,b=before['currentTask'],after['currentTask'];assert b['promptDe']==requested[qid]
    allowed={'promptDe'} if qid.endswith('words.q2') else {'promptDe','rationaleDe'}
    assert {k for k in a if a[k]!=b[k]}==allowed
    for field in before:
        if field not in {'currentTask','currentAudioAliasEntries','uniqueAnswerRationaleDe','correctWordingChange'}:assert before[field]==after[field]
    assert before['previousTask']==after['previousTask']
assert set(changed)==set(requested)
for a,b in zip(original['pools'],p['pools']):
    for field in a:
        if field not in {'candidateDefinition','candidateDefinitionContentHash'}:assert a[field]==b[field]
    for t,u in zip(a['candidateDefinition']['tasks'],b['candidateDefinition']['tasks']):
        if t['id'] not in requested:assert t==u
assert p['editorialRevision']['changedPrompts']==2 and p['editorialRevision']['netNewChangedAliasKeys']==0
assert sum(len(x['changedAudioAliasKeys']) for x in p['patches'])==77
print('PASS_EXACT_TWO_M_REQUESTED_PROMPTS; other30patches and original evidence unchanged;77distinctkeys/2updatedstrings')
