#!/usr/bin/env python3
"""Read-only artifact/baseline verifier; no semantic or release approval."""
import hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
BASE='0f92bf03fa50f13ec89fd32f235367e6876c2642'
ARTIFACT=Path(__file__).with_name('epoch27-quality-patch.json')
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
base_drafts=manifest['drafts'][14:20];before={(d['textId'],t['id']):t for d in base_drafts for t in d['definition']['tasks']}
patches={(x['textId'],x['questionId']):x for x in p['patches']}
assert len(patches)==len(p['patches'])==54
assert sum(bool(x['findingIDs']) for x in patches.values())==52
assert sum(x['additionalSameFault'] for x in patches.values())==2
findings=p['independentAudit']['findings'];assert len(findings)==56
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
assert set(wording_changes)=={'sitov.pretest.'+q for q in ['a12-05.words.q1','a12-07.words.q1','a12-09.words.q6','a12-10.words.q4','a12-10.words.q6','a12-05.syntax.q3','a12-06.syntax.q6','a12-07.verbs.q4','a12-07.verbs.q5','a12-07.syntax.q3','a12-07.syntax.q4','a12-07.syntax.q6','a12-09.verbs.q6','a12-10.verbs.q3','a12-10.syntax.q3']}
assert len(set(changed_aliases))==len(changed_aliases)==p['counts']['changedAudioAliases']==135
assert len(p['reviewList'])==144 and len(p['pools'])==6
review={(r['textId'],r['questionId']):r for r in p['reviewList']};assert len(review)==144
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
assert len(p['independentAudit']['dispositions'])==56
assert all(d['disposition']=='REPAIR_PROPOSED_M_REVIEW_PENDING' for d in p['independentAudit']['dispositions'])
assert all(x['constructEvidence']==x['previousTask']['sourceSpans'] for x in patches.values())
construct_changes=[x for x in patches.values() if x['constructChange'] is not None]
assert len(construct_changes)==10
assert all(x['constructChange']['requiresMReReview'] and x['constructChange']['sourceEvidence']==x['previousTask']['sourceSpans'] for x in construct_changes)
assert p['constraints']['candidateApproved'] is False and p['constraints']['humanReview'] is False
assert p['constraints']['audioPreparedForCandidate'] is False and p['verification']['releaseReady'] is False
md=ARTIFACT.with_suffix('.md').read_text()
assert all(r['questionId'] in md and r['promptDe'] in md and r['rationaleDe'] in md for r in review.values())
print(json.dumps({'status':'PASS_ARTIFACT_INVARIANTS_ONLY','base':BASE,'sources':6,'cores':24,'questions':144,'patches':54,'S7Findings':56,'extraSameFaults':2,'changedAudioAliases':135,'correctWordingExceptions':wording_changes,'artifactSHA256':sha(ARTIFACT.read_bytes()),'independentSemanticApproval':False,'humanReview':False,'candidateAudioPrepared':False},ensure_ascii=False))

all_dispositions=p['independentAudit']['allFindingDispositions'];assert len(all_dispositions)==82
assert len({d['findingId'] for d in all_dispositions})==82
assert sum(d['disposition'].startswith('REPAIR_PROPOSED') for d in all_dispositions)==56
assert sum(d['disposition']=='ALREADY_REPAIRED_IN_CURRENT_BASE_M_REVIEW_EVIDENCE' for d in all_dispositions)==24
assert sum(d['disposition']=='SOURCE_CURRICULUM_OPEN_SEPARATE_M_S2_SCOPE' for d in all_dispositions)==2
units=[x for x in p['patches'] if x.get('proposedUnitMetadataDelta')];assert len(units)==8
assert all(x['proposedUnitMetadataDelta']['candidateMetadataFrozen'] and x['proposedUnitMetadataDelta']['equivalenceReviewRequired'] and x['proposedUnitMetadataDelta']['sourceEvidence']==x['previousTask']['sourceSpans'] for x in units)
assert p['constraints']['semanticUnitConsistencyApproved'] is False
for x in p['patches']:assert '___' not in x['currentTask']['promptDe'] and '…' not in x['currentTask']['promptDe']
direction=next(x for x in p['patches'] if x['questionId']=='sitov.pretest.a12-10.nominal.q4')['currentTask']
assert 'Wohin' in direction['promptDe'] and 'meinen Kalender' not in direction['promptDe']
for suffix,gold in [('a12-09.verbs.q6','liegt'),('a12-10.verbs.q3','üben'),('a12-10.syntax.q3','Am Dienstag üben wir besonders viel Sprechen.')]:
    x=next(x for x in p['patches'] if x['questionId']=='sitov.pretest.'+suffix)['currentTask'];assert next(o['textDe'] for o in x['options'] if o['id']==x['correctOptionId'])==gold
print('PASS82_FINDING_DISPOSITIONS/24alreadyrepaired/2curriculumopen;8explicitmetadata-review-blocks;naturalprompts/explicitWohin/goldgrammar')
